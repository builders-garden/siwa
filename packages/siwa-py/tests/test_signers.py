"""
Tests for SIWA Python SDK signers.
"""

import pytest
from eth_account import Account
from eth_account.messages import encode_defunct

from siwa_py.signers import LocalAccountSigner
from siwa_py import (
    sign_siwa_message,
    parse_siwa_message,
    generate_nonce,
    SIWAMessageFields,
)


# Test constants
TEST_DOMAIN = "test.example.com"
TEST_URI = "https://test.example.com/siwa/verify"
TEST_AGENT_ID = 999
TEST_AGENT_REGISTRY = "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e"
TEST_CHAIN_ID = 84532


class TestLocalAccountSigner:
    """Tests for LocalAccountSigner."""

    @pytest.fixture
    def account(self):
        """Create a test account."""
        return Account.create()

    @pytest.fixture
    def signer(self, account):
        """Create a signer from the test account."""
        return LocalAccountSigner(account)

    @pytest.mark.asyncio
    async def test_get_address(self, signer, account):
        """Test getting address from signer."""
        address = await signer.get_address()
        assert address == account.address
        assert address.startswith("0x")
        assert len(address) == 42

    @pytest.mark.asyncio
    async def test_sign_message(self, signer, account):
        """Test signing a message."""
        message = "Test message for signing"
        signature = await signer.sign_message(message)

        assert signature.startswith("0x")
        assert len(signature) == 132  # 65 bytes in hex + 0x prefix

        # Verify the signature
        message_hash = encode_defunct(text=message)
        recovered = Account.recover_message(message_hash, signature=signature)
        assert recovered.lower() == account.address.lower()

    @pytest.mark.asyncio
    async def test_sign_different_messages_produce_different_signatures(self, signer):
        """Test that different messages produce different signatures."""
        sig1 = await signer.sign_message("Message 1")
        sig2 = await signer.sign_message("Message 2")
        assert sig1 != sig2

    @pytest.mark.asyncio
    async def test_sign_same_message_produces_same_signature(self, signer):
        """Test that the same message produces the same signature."""
        message = "Consistent message"
        sig1 = await signer.sign_message(message)
        sig2 = await signer.sign_message(message)
        assert sig1 == sig2


class TestLocalAccountSignerFromPrivateKey:
    """Tests for creating LocalAccountSigner from private key."""

    def test_from_private_key_with_prefix(self):
        """Test creating signer from private key with 0x prefix."""
        private_key = "0x" + "ab" * 32  # Valid 32-byte private key
        signer = LocalAccountSigner.from_private_key(private_key)
        assert signer is not None

    def test_from_private_key_without_prefix(self):
        """Test creating signer from private key without 0x prefix."""
        private_key = "ab" * 32  # Valid 32-byte private key
        signer = LocalAccountSigner.from_private_key(private_key)
        assert signer is not None

    @pytest.mark.asyncio
    async def test_from_private_key_produces_correct_address(self):
        """Test that private key produces the expected address."""
        # Known private key and its corresponding address
        private_key = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        expected_account = Account.from_key(private_key)

        signer = LocalAccountSigner.from_private_key(private_key)
        address = await signer.get_address()

        assert address == expected_account.address


class TestSignSIWAMessage:
    """Tests for signing SIWA messages."""

    @pytest.fixture
    def account(self):
        """Create a test account."""
        return Account.create()

    @pytest.fixture
    def signer(self, account):
        """Create a signer from the test account."""
        return LocalAccountSigner(account)

    @pytest.mark.asyncio
    async def test_sign_siwa_message_basic(self, signer, account):
        """Test basic SIWA message signing."""
        nonce = generate_nonce()
        issued_at = "2024-01-01T00:00:00Z"

        result = await sign_siwa_message(
            SIWAMessageFields(
                domain=TEST_DOMAIN,
                uri=TEST_URI,
                agent_id=TEST_AGENT_ID,
                agent_registry=TEST_AGENT_REGISTRY,
                chain_id=TEST_CHAIN_ID,
                nonce=nonce,
                issued_at=issued_at,
            ),
            signer,
        )

        assert "message" in result
        assert "signature" in result
        assert "address" in result

        # Check signature format
        assert result["signature"].startswith("0x")
        assert len(result["signature"]) == 132

        # Check address matches signer
        assert result["address"].lower() == account.address.lower()

    @pytest.mark.asyncio
    async def test_sign_siwa_message_with_statement(self, signer):
        """Test SIWA message signing with statement."""
        result = await sign_siwa_message(
            SIWAMessageFields(
                domain=TEST_DOMAIN,
                statement="Please sign in to access your account.",
                uri=TEST_URI,
                agent_id=TEST_AGENT_ID,
                agent_registry=TEST_AGENT_REGISTRY,
                chain_id=TEST_CHAIN_ID,
                nonce=generate_nonce(),
                issued_at="2024-01-01T00:00:00Z",
            ),
            signer,
        )

        assert "Please sign in to access your account." in result["message"]

    @pytest.mark.asyncio
    async def test_sign_siwa_message_parses_correctly(self, signer, account):
        """Test that signed message can be parsed correctly."""
        nonce = generate_nonce()

        result = await sign_siwa_message(
            SIWAMessageFields(
                domain=TEST_DOMAIN,
                statement="Test statement",
                uri=TEST_URI,
                agent_id=TEST_AGENT_ID,
                agent_registry=TEST_AGENT_REGISTRY,
                chain_id=TEST_CHAIN_ID,
                nonce=nonce,
                issued_at="2024-01-01T00:00:00Z",
            ),
            signer,
        )

        # Parse the message
        parsed = parse_siwa_message(result["message"])

        assert parsed["domain"] == TEST_DOMAIN
        assert parsed["address"].lower() == account.address.lower()
        assert parsed["agent_id"] == TEST_AGENT_ID
        assert parsed["chain_id"] == TEST_CHAIN_ID
        assert parsed["nonce"] == nonce

    @pytest.mark.asyncio
    async def test_sign_siwa_message_signature_valid(self, signer, account):
        """Test that the signature is valid and can be verified."""
        result = await sign_siwa_message(
            SIWAMessageFields(
                domain=TEST_DOMAIN,
                uri=TEST_URI,
                agent_id=TEST_AGENT_ID,
                agent_registry=TEST_AGENT_REGISTRY,
                chain_id=TEST_CHAIN_ID,
                nonce=generate_nonce(),
                issued_at="2024-01-01T00:00:00Z",
            ),
            signer,
        )

        # Verify the signature
        message_hash = encode_defunct(text=result["message"])
        recovered = Account.recover_message(message_hash, signature=result["signature"])

        assert recovered.lower() == account.address.lower()

    @pytest.mark.asyncio
    async def test_sign_siwa_message_address_mismatch_raises(self, signer):
        """Test that address mismatch raises ValueError."""
        wrong_address = "0x0000000000000000000000000000000000000001"

        with pytest.raises(ValueError, match="Address mismatch"):
            await sign_siwa_message(
                SIWAMessageFields(
                    domain=TEST_DOMAIN,
                    address=wrong_address,  # Wrong address
                    uri=TEST_URI,
                    agent_id=TEST_AGENT_ID,
                    agent_registry=TEST_AGENT_REGISTRY,
                    chain_id=TEST_CHAIN_ID,
                    nonce=generate_nonce(),
                    issued_at="2024-01-01T00:00:00Z",
                ),
                signer,
            )

    @pytest.mark.asyncio
    async def test_sign_siwa_message_with_correct_address(self, signer, account):
        """Test signing with explicitly provided correct address."""
        result = await sign_siwa_message(
            SIWAMessageFields(
                domain=TEST_DOMAIN,
                address=account.address,  # Correct address
                uri=TEST_URI,
                agent_id=TEST_AGENT_ID,
                agent_registry=TEST_AGENT_REGISTRY,
                chain_id=TEST_CHAIN_ID,
                nonce=generate_nonce(),
                issued_at="2024-01-01T00:00:00Z",
            ),
            signer,
        )

        assert result["address"].lower() == account.address.lower()


class TestSignatureVerification:
    """Tests for signature verification against tampered messages."""

    @pytest.fixture
    def account(self):
        """Create a test account."""
        return Account.create()

    @pytest.fixture
    def signer(self, account):
        """Create a signer from the test account."""
        return LocalAccountSigner(account)

    @pytest.mark.asyncio
    async def test_tampered_message_fails_verification(self, signer, account):
        """Test that a tampered message fails verification."""
        result = await sign_siwa_message(
            SIWAMessageFields(
                domain=TEST_DOMAIN,
                uri=TEST_URI,
                agent_id=TEST_AGENT_ID,
                agent_registry=TEST_AGENT_REGISTRY,
                chain_id=TEST_CHAIN_ID,
                nonce=generate_nonce(),
                issued_at="2024-01-01T00:00:00Z",
            ),
            signer,
        )

        # Tamper with the message
        tampered_message = result["message"].replace(TEST_DOMAIN, "evil.com")

        # Verify with tampered message - should recover a different address
        message_hash = encode_defunct(text=tampered_message)
        recovered = Account.recover_message(message_hash, signature=result["signature"])

        assert recovered.lower() != account.address.lower()

    @pytest.mark.asyncio
    async def test_wrong_signature_fails_verification(self, account):
        """Test that a wrong signature fails verification."""
        # Create two different accounts
        account1 = Account.create()
        account2 = Account.create()

        signer1 = LocalAccountSigner(account1)

        # Sign with account1
        result = await sign_siwa_message(
            SIWAMessageFields(
                domain=TEST_DOMAIN,
                uri=TEST_URI,
                agent_id=TEST_AGENT_ID,
                agent_registry=TEST_AGENT_REGISTRY,
                chain_id=TEST_CHAIN_ID,
                nonce=generate_nonce(),
                issued_at="2024-01-01T00:00:00Z",
            ),
            signer1,
        )

        # Verify with account2's address - should fail
        message_hash = encode_defunct(text=result["message"])
        recovered = Account.recover_message(message_hash, signature=result["signature"])

        assert recovered.lower() != account2.address.lower()
        assert recovered.lower() == account1.address.lower()
