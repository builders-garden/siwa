"""
SIWA - Sign In With Agent (Python SDK)

A Python SDK for ERC-8004 agent authentication.
"""

from siwa_py.siwa import (
    SIWAErrorCode,
    SIWAMessageFields,
    SIWAVerificationResult,
    SIWAResponse,
    build_siwa_message,
    parse_siwa_message,
    generate_nonce,
    sign_siwa_message,
    verify_siwa,
    build_siwa_response,
)
from siwa_py.types import Signer, SignerType

__version__ = "0.0.1"

__all__ = [
    # Core functions
    "build_siwa_message",
    "parse_siwa_message",
    "generate_nonce",
    "sign_siwa_message",
    "verify_siwa",
    "build_siwa_response",
    # Types
    "SIWAErrorCode",
    "SIWAMessageFields",
    "SIWAVerificationResult",
    "SIWAResponse",
    "Signer",
    "SignerType",
]
