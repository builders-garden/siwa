"""
SIWA (Sign In With Agent) utility functions.

Provides message building, signing (agent-side), and verification (server-side).
"""

import secrets
import re
from datetime import datetime
from enum import Enum
from typing import Optional, TypedDict, Literal, Union, Callable, Awaitable

from eth_account import Account
from eth_account.messages import encode_defunct
from web3 import Web3

from siwa_py.types import Signer, SignerType


class SIWAErrorCode(str, Enum):
    """Error codes for SIWA verification failures."""

    INVALID_SIGNATURE = "INVALID_SIGNATURE"
    DOMAIN_MISMATCH = "DOMAIN_MISMATCH"
    INVALID_NONCE = "INVALID_NONCE"
    MESSAGE_EXPIRED = "MESSAGE_EXPIRED"
    MESSAGE_NOT_YET_VALID = "MESSAGE_NOT_YET_VALID"
    INVALID_REGISTRY_FORMAT = "INVALID_REGISTRY_FORMAT"
    NOT_REGISTERED = "NOT_REGISTERED"
    NOT_OWNER = "NOT_OWNER"
    AGENT_NOT_ACTIVE = "AGENT_NOT_ACTIVE"
    MISSING_SERVICE = "MISSING_SERVICE"
    MISSING_TRUST_MODEL = "MISSING_TRUST_MODEL"
    LOW_REPUTATION = "LOW_REPUTATION"
    CUSTOM_CHECK_FAILED = "CUSTOM_CHECK_FAILED"
    VERIFICATION_FAILED = "VERIFICATION_FAILED"


class SIWAMessageFields(TypedDict, total=False):
    """Fields for a SIWA message."""

    domain: str
    address: str
    statement: Optional[str]
    uri: str
    version: str
    agent_id: int
    agent_registry: str  # e.g. "eip155:84532:0x8004AA63..."
    chain_id: int
    nonce: str
    issued_at: str  # RFC 3339
    expiration_time: Optional[str]  # RFC 3339
    not_before: Optional[str]  # RFC 3339
    request_id: Optional[str]


class SIWAVerificationResult(TypedDict, total=False):
    """Result of SIWA verification."""

    valid: bool
    address: str
    agent_id: int
    agent_registry: str
    chain_id: int
    verified: Literal["offline", "onchain"]
    signer_type: SignerType
    code: SIWAErrorCode
    error: str


class SIWASkillRef(TypedDict):
    """Reference to the SIWA skill/SDK."""

    name: str
    install: str
    url: str


class SIWAAction(TypedDict, total=False):
    """Action for unregistered agents."""

    type: Literal["register"]
    message: str
    skill: SIWASkillRef
    steps: list[str]
    registry_address: Optional[str]
    chain_id: Optional[int]


class SIWAResponse(TypedDict, total=False):
    """Standard SIWA response format for platforms."""

    status: Literal["authenticated", "not_registered", "rejected"]
    address: Optional[str]
    agent_id: Optional[int]
    agent_registry: Optional[str]
    chain_id: Optional[int]
    verified: Optional[Literal["offline", "onchain"]]
    signer_type: Optional[SignerType]
    code: Optional[SIWAErrorCode]
    error: Optional[str]
    action: Optional[SIWAAction]
    skill: Optional[SIWASkillRef]


def build_siwa_response(result: SIWAVerificationResult) -> SIWAResponse:
    """
    Convert a SIWAVerificationResult into a standard SIWAResponse
    that platforms can forward directly to agents.
    """
    skill_ref: SIWASkillRef = {
        "name": "siwa",
        "install": "pip install siwa",
        "url": "https://siwa.id/skill.md",
    }

    base: SIWAResponse = {
        "address": result.get("address"),
        "agent_id": result.get("agent_id"),
        "agent_registry": result.get("agent_registry"),
        "chain_id": result.get("chain_id"),
        "verified": result.get("verified"),
    }

    if result.get("signer_type"):
        base["signer_type"] = result["signer_type"]

    if result.get("valid"):
        return {"status": "authenticated", **base}

    if result.get("code") == SIWAErrorCode.NOT_REGISTERED:
        registry_parts = result.get("agent_registry", "").split(":")
        registry_address = registry_parts[2] if len(registry_parts) == 3 else None
        chain_id = result.get("chain_id") or (
            int(registry_parts[1]) if len(registry_parts) >= 2 else None
        )

        return {
            "status": "not_registered",
            **base,
            "code": result.get("code"),
            "error": "Agent is not registered on the ERC-8004 Identity Registry.",
            "skill": skill_ref,
            "action": {
                "type": "register",
                "message": "This address is not registered as an ERC-8004 agent. Install the SIWA SDK and register before signing in.",
                "skill": skill_ref,
                "steps": [
                    "Install the SDK: pip install siwa",
                    "Create a wallet: from siwa import create_wallet; wallet = create_wallet()",
                    "Fund the wallet with ETH on the target chain for gas fees",
                    "Build ERC-8004 registration metadata (JSON with name, description, services, active: true)",
                    "Register onchain: call register(agent_uri) on the Identity Registry contract",
                    "Retry SIWA sign-in",
                ],
                "registry_address": registry_address,
                "chain_id": chain_id,
            },
        }

    return {
        "status": "rejected",
        **base,
        "code": result.get("code"),
        "error": result.get("error"),
        "skill": skill_ref,
    }


def build_siwa_message(fields: SIWAMessageFields) -> str:
    """
    Build a SIWA plaintext message string from structured fields.

    Args:
        fields: The SIWA message fields

    Returns:
        The formatted SIWA message string
    """
    lines: list[str] = []

    lines.append(f"{fields['domain']} wants you to sign in with your Agent account:")
    lines.append(fields["address"])
    lines.append("")

    if fields.get("statement"):
        lines.append(fields["statement"])
    lines.append("")

    lines.append(f"URI: {fields['uri']}")
    lines.append(f"Version: {fields.get('version', '1')}")
    lines.append(f"Agent ID: {fields['agent_id']}")
    lines.append(f"Agent Registry: {fields['agent_registry']}")
    lines.append(f"Chain ID: {fields['chain_id']}")
    lines.append(f"Nonce: {fields['nonce']}")
    lines.append(f"Issued At: {fields['issued_at']}")

    if fields.get("expiration_time"):
        lines.append(f"Expiration Time: {fields['expiration_time']}")
    if fields.get("not_before"):
        lines.append(f"Not Before: {fields['not_before']}")
    if fields.get("request_id"):
        lines.append(f"Request ID: {fields['request_id']}")

    return "\n".join(lines)


def parse_siwa_message(message: str) -> SIWAMessageFields:
    """
    Parse a SIWA message string back into structured fields.

    Args:
        message: The SIWA message string

    Returns:
        The parsed message fields

    Raises:
        ValueError: If the message format is invalid
    """
    lines = message.split("\n")

    domain_match = re.match(
        r"^(.+) wants you to sign in with your Agent account:$", lines[0]
    )
    if not domain_match:
        raise ValueError("Invalid SIWA message: missing domain line")

    domain = domain_match.group(1)
    address = lines[1]

    if not address or not address.startswith("0x") or len(address) != 42:
        raise ValueError("Invalid SIWA message: missing or malformed address")

    # Parse fields after the blank lines
    field_map: dict[str, str] = {}
    statement: Optional[str] = None
    in_statement = False
    stmt_lines: list[str] = []

    for i in range(2, len(lines)):
        line = lines[i]

        if i == 2 and line == "":
            in_statement = True
            continue

        if in_statement:
            if line == "" or line.startswith("URI: "):
                in_statement = False
                statement = "\n".join(stmt_lines).strip() or None
                if line.startswith("URI: "):
                    key, _, value = line.partition(": ")
                    field_map[key] = value
                continue
            stmt_lines.append(line)
            continue

        if ": " in line:
            key, _, value = line.partition(": ")
            field_map[key] = value

    return SIWAMessageFields(
        domain=domain,
        address=address,
        statement=statement,
        uri=field_map.get("URI", ""),
        version=field_map.get("Version", "1"),
        agent_id=int(field_map.get("Agent ID", "0")),
        agent_registry=field_map.get("Agent Registry", ""),
        chain_id=int(field_map.get("Chain ID", "0")),
        nonce=field_map.get("Nonce", ""),
        issued_at=field_map.get("Issued At", ""),
        expiration_time=field_map.get("Expiration Time"),
        not_before=field_map.get("Not Before"),
        request_id=field_map.get("Request ID"),
    )


def generate_nonce(length: int = 16) -> str:
    """
    Generate a cryptographically secure nonce.

    Args:
        length: The length of the nonce (default 16)

    Returns:
        A URL-safe base64 encoded random string
    """
    return secrets.token_urlsafe(length)[:length]


async def sign_siwa_message(
    fields: SIWAMessageFields,
    signer: Signer,
) -> dict[str, str]:
    """
    Sign a SIWA message using the provided signer.

    The signer abstracts the wallet implementation, allowing you to use:
        - LocalAccountSigner: Local private key
        - KeyringProxySigner: Remote keyring proxy server

    The agent address is resolved from the signer - the single source of truth.
    If fields.address is provided, it must match the signer's address.

    Args:
        fields: SIWA message fields. 'address' is optional.
        signer: A Signer implementation

    Returns:
        Dict with 'message', 'signature', and 'address' keys

    Raises:
        ValueError: If the provided address doesn't match the signer's address
    """
    signer_address = await signer.get_address()

    if fields.get("address") and signer_address.lower() != fields["address"].lower():
        raise ValueError(
            f"Address mismatch: signer has {signer_address}, message claims {fields['address']}"
        )

    resolved_fields = {**fields, "address": signer_address}
    message = build_siwa_message(resolved_fields)
    signature = await signer.sign_message(message)

    return {
        "message": message,
        "signature": signature,
        "address": signer_address,
    }


NonceValidator = Union[
    Callable[[str], bool],
    Callable[[str], Awaitable[bool]],
]


async def verify_siwa(
    message: str,
    signature: str,
    expected_domain: str,
    nonce_validator: NonceValidator,
    w3: Web3,
    registry_address: Optional[str] = None,
) -> SIWAVerificationResult:
    """
    Verify a SIWA message and signature.

    Checks:
    1. Message format validity
    2. Signature recovery
    3. Domain binding
    4. Nonce validation
    5. Time window (expiration_time / not_before)
    6. Onchain ownership (if w3 provided)

    Args:
        message: Full SIWA message string
        signature: EIP-191 signature hex string
        expected_domain: The server's domain for domain binding
        nonce_validator: Callback to validate nonce
        w3: Web3 instance for onchain verification
        registry_address: Optional override for registry address

    Returns:
        SIWAVerificationResult with valid=True on success
    """

    def fail(
        fields: SIWAMessageFields,
        code: SIWAErrorCode,
        error: str,
    ) -> SIWAVerificationResult:
        return SIWAVerificationResult(
            valid=False,
            address=fields.get("address", ""),
            agent_id=fields.get("agent_id", 0),
            agent_registry=fields.get("agent_registry", ""),
            chain_id=fields.get("chain_id", 0),
            verified="onchain",
            code=code,
            error=error,
        )

    try:
        # 1. Parse message
        fields = parse_siwa_message(message)

        # 2. Verify signature
        message_hash = encode_defunct(text=message)
        try:
            recovered = Account.recover_message(message_hash, signature=signature)
        except Exception:
            return fail(fields, SIWAErrorCode.INVALID_SIGNATURE, "Invalid signature")

        # 3. Address match
        if recovered.lower() != fields["address"].lower():
            return fail(
                fields,
                SIWAErrorCode.INVALID_SIGNATURE,
                f"Signature recovered {recovered}, expected {fields['address']}",
            )

        # 4. Domain binding
        if fields["domain"] != expected_domain:
            return fail(
                fields,
                SIWAErrorCode.DOMAIN_MISMATCH,
                f"Domain mismatch: expected {expected_domain}, got {fields['domain']}",
            )

        # 5. Nonce validation
        import asyncio

        nonce_result = nonce_validator(fields["nonce"])
        if asyncio.iscoroutine(nonce_result):
            nonce_ok = await nonce_result
        else:
            nonce_ok = nonce_result

        if not nonce_ok:
            return fail(
                fields, SIWAErrorCode.INVALID_NONCE, "Invalid or consumed nonce"
            )

        # 6. Time window
        now = datetime.utcnow()
        if fields.get("expiration_time"):
            exp = datetime.fromisoformat(
                fields["expiration_time"].replace("Z", "+00:00")
            )
            if now > exp.replace(tzinfo=None):
                return fail(fields, SIWAErrorCode.MESSAGE_EXPIRED, "Message expired")

        if fields.get("not_before"):
            nbf = datetime.fromisoformat(fields["not_before"].replace("Z", "+00:00"))
            if now < nbf.replace(tzinfo=None):
                return fail(
                    fields,
                    SIWAErrorCode.MESSAGE_NOT_YET_VALID,
                    "Message not yet valid (not_before)",
                )

        # 7. Onchain ownership verification
        registry_parts = fields["agent_registry"].split(":")
        if len(registry_parts) != 3 or registry_parts[0] != "eip155":
            return fail(
                fields,
                SIWAErrorCode.INVALID_REGISTRY_FORMAT,
                "Invalid agent_registry format",
            )

        reg_address = registry_address or registry_parts[2]

        # ERC-721 ownerOf ABI
        owner_of_abi = [
            {
                "name": "ownerOf",
                "type": "function",
                "stateMutability": "view",
                "inputs": [{"name": "tokenId", "type": "uint256"}],
                "outputs": [{"name": "", "type": "address"}],
            }
        ]

        try:
            contract = w3.eth.contract(
                address=Web3.to_checksum_address(reg_address), abi=owner_of_abi
            )
            owner = contract.functions.ownerOf(fields["agent_id"]).call()
        except Exception:
            return fail(
                fields,
                SIWAErrorCode.NOT_REGISTERED,
                "Agent is not registered on the ERC-8004 Identity Registry",
            )

        if owner.lower() != recovered.lower():
            return fail(
                fields,
                SIWAErrorCode.NOT_OWNER,
                "Signer is not the owner of this agent NFT",
            )

        # Detect signer type
        code = w3.eth.get_code(Web3.to_checksum_address(fields["address"]))
        signer_type: SignerType = "sca" if code and code != b"" else "eoa"

        return SIWAVerificationResult(
            valid=True,
            address=recovered,
            agent_id=fields["agent_id"],
            agent_registry=fields["agent_registry"],
            chain_id=fields["chain_id"],
            verified="onchain",
            signer_type=signer_type,
        )

    except Exception as e:
        return SIWAVerificationResult(
            valid=False,
            address="",
            agent_id=0,
            agent_registry="",
            chain_id=0,
            verified="offline",
            code=SIWAErrorCode.VERIFICATION_FAILED,
            error=str(e),
        )
