"""
Comprehensive tests for SIWA Python SDK core functionality.
"""

import pytest
from datetime import datetime, timedelta
from siwa_py import (
    build_siwa_message,
    parse_siwa_message,
    generate_nonce,
    build_siwa_response,
    SIWAMessageFields,
    SIWAVerificationResult,
    SIWAErrorCode,
)


class TestGenerateNonce:
    """Tests for nonce generation."""

    def test_default_length(self):
        """Test nonce generation with default length."""
        nonce = generate_nonce()
        assert len(nonce) == 16
        assert isinstance(nonce, str)

    def test_custom_length_8(self):
        """Test nonce generation with length 8."""
        nonce = generate_nonce(8)
        assert len(nonce) == 8

    def test_custom_length_32(self):
        """Test nonce generation with length 32."""
        nonce = generate_nonce(32)
        assert len(nonce) == 32

    def test_uniqueness(self):
        """Test that nonces are unique."""
        nonces = {generate_nonce() for _ in range(100)}
        assert len(nonces) == 100

    def test_url_safe_characters(self):
        """Test that nonces contain only URL-safe characters."""
        for _ in range(10):
            nonce = generate_nonce()
            # URL-safe base64 uses A-Z, a-z, 0-9, -, _
            for char in nonce:
                assert char.isalnum() or char in "-_"


class TestBuildSIWAMessage:
    """Tests for SIWA message building."""

    def test_basic_message(self):
        """Test building a basic SIWA message."""
        fields = SIWAMessageFields(
            domain="example.com",
            address="0x1234567890123456789012345678901234567890",
            uri="https://example.com/login",
            version="1",
            agent_id=123,
            agent_registry="eip155:84532:0x8004AA63B05E4C14eC1Fe6B35AD3bAe8A7Bc9b66",
            chain_id=84532,
            nonce="abc123",
            issued_at="2024-01-01T00:00:00Z",
        )

        message = build_siwa_message(fields)

        assert "example.com wants you to sign in with your Agent account:" in message
        assert "0x1234567890123456789012345678901234567890" in message
        assert "Agent ID: 123" in message
        assert "Chain ID: 84532" in message
        assert "Nonce: abc123" in message
        assert "URI: https://example.com/login" in message
        assert "Version: 1" in message

    def test_message_with_statement(self):
        """Test building a message with a statement."""
        fields = SIWAMessageFields(
            domain="example.com",
            address="0x1234567890123456789012345678901234567890",
            statement="Please sign in to access your account.",
            uri="https://example.com/login",
            agent_id=123,
            agent_registry="eip155:84532:0x8004AA63",
            chain_id=84532,
            nonce="abc123",
            issued_at="2024-01-01T00:00:00Z",
        )

        message = build_siwa_message(fields)
        assert "Please sign in to access your account." in message

    def test_message_with_optional_fields(self):
        """Test building a message with optional fields."""
        fields = SIWAMessageFields(
            domain="example.com",
            address="0x1234567890123456789012345678901234567890",
            uri="https://example.com/login",
            agent_id=123,
            agent_registry="eip155:84532:0x8004AA63",
            chain_id=84532,
            nonce="abc123",
            issued_at="2024-01-01T00:00:00Z",
            expiration_time="2024-01-01T01:00:00Z",
            not_before="2024-01-01T00:00:00Z",
            request_id="req-456",
        )

        message = build_siwa_message(fields)
        assert "Expiration Time: 2024-01-01T01:00:00Z" in message
        assert "Not Before: 2024-01-01T00:00:00Z" in message
        assert "Request ID: req-456" in message


class TestParseSIWAMessage:
    """Tests for SIWA message parsing."""

    def test_parse_basic_message(self):
        """Test parsing a basic SIWA message."""
        message = """example.com wants you to sign in with your Agent account:
0x1234567890123456789012345678901234567890

Test statement

URI: https://example.com/login
Version: 1
Agent ID: 123
Agent Registry: eip155:84532:0x8004AA63B05E4C14eC1Fe6B35AD3bAe8A7Bc9b66
Chain ID: 84532
Nonce: abc123
Issued At: 2024-01-01T00:00:00Z"""

        fields = parse_siwa_message(message)

        assert fields["domain"] == "example.com"
        assert fields["address"] == "0x1234567890123456789012345678901234567890"
        assert fields["statement"] == "Test statement"
        assert fields["agent_id"] == 123
        assert fields["chain_id"] == 84532
        assert fields["nonce"] == "abc123"
        assert fields["agent_registry"] == "eip155:84532:0x8004AA63B05E4C14eC1Fe6B35AD3bAe8A7Bc9b66"

    def test_parse_message_without_statement(self):
        """Test parsing a message without a statement."""
        message = """example.com wants you to sign in with your Agent account:
0x1234567890123456789012345678901234567890


URI: https://example.com/login
Version: 1
Agent ID: 42
Agent Registry: eip155:1:0xABCDEF
Chain ID: 1
Nonce: xyz789
Issued At: 2024-06-15T12:00:00Z"""

        fields = parse_siwa_message(message)

        assert fields["domain"] == "example.com"
        assert fields["agent_id"] == 42
        assert fields["chain_id"] == 1
        assert fields["statement"] is None or fields["statement"] == ""

    def test_parse_message_with_optional_fields(self):
        """Test parsing a message with optional fields."""
        message = """example.com wants you to sign in with your Agent account:
0x1234567890123456789012345678901234567890


URI: https://example.com/login
Version: 1
Agent ID: 100
Agent Registry: eip155:84532:0x8004AA63
Chain ID: 84532
Nonce: nonce123
Issued At: 2024-01-01T00:00:00Z
Expiration Time: 2024-01-01T01:00:00Z
Not Before: 2024-01-01T00:00:00Z
Request ID: req-789"""

        fields = parse_siwa_message(message)

        assert fields["expiration_time"] == "2024-01-01T01:00:00Z"
        assert fields["not_before"] == "2024-01-01T00:00:00Z"
        assert fields["request_id"] == "req-789"

    def test_parse_invalid_message_missing_domain(self):
        """Test parsing an invalid message without domain line."""
        with pytest.raises(ValueError, match="missing domain line"):
            parse_siwa_message("Invalid message without domain")

    def test_parse_invalid_message_malformed_address(self):
        """Test parsing a message with malformed address."""
        message = """example.com wants you to sign in with your Agent account:
not-an-address"""

        with pytest.raises(ValueError, match="missing or malformed address"):
            parse_siwa_message(message)

    def test_parse_invalid_message_short_address(self):
        """Test parsing a message with short address."""
        message = """example.com wants you to sign in with your Agent account:
0x1234"""

        with pytest.raises(ValueError, match="missing or malformed address"):
            parse_siwa_message(message)


class TestMessageRoundtrip:
    """Tests for building and parsing messages (roundtrip)."""

    def test_basic_roundtrip(self):
        """Test that building and parsing gives the same fields."""
        original = SIWAMessageFields(
            domain="example.com",
            address="0x1234567890123456789012345678901234567890",
            statement="Sign in to access your account",
            uri="https://example.com/login",
            version="1",
            agent_id=42,
            agent_registry="eip155:84532:0x8004AA63B05E4C14eC1Fe6B35AD3bAe8A7Bc9b66",
            chain_id=84532,
            nonce="random123",
            issued_at="2024-01-15T10:30:00Z",
            expiration_time="2024-01-15T11:30:00Z",
        )

        message = build_siwa_message(original)
        parsed = parse_siwa_message(message)

        assert parsed["domain"] == original["domain"]
        assert parsed["address"] == original["address"]
        assert parsed["statement"] == original["statement"]
        assert parsed["agent_id"] == original["agent_id"]
        assert parsed["chain_id"] == original["chain_id"]
        assert parsed["nonce"] == original["nonce"]
        assert parsed["expiration_time"] == original["expiration_time"]

    def test_roundtrip_all_optional_fields(self):
        """Test roundtrip with all optional fields."""
        original = SIWAMessageFields(
            domain="test.example.com",
            address="0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
            statement="Multi-line\nstatement\ntest.",
            uri="https://test.example.com/api/siwa",
            version="1",
            agent_id=999,
            agent_registry="eip155:42161:0x1234567890123456789012345678901234567890",
            chain_id=42161,
            nonce="secure-nonce-value",
            issued_at="2024-06-01T00:00:00Z",
            expiration_time="2024-06-01T00:05:00Z",
            not_before="2024-06-01T00:00:00Z",
            request_id="request-id-12345",
        )

        message = build_siwa_message(original)
        parsed = parse_siwa_message(message)

        assert parsed["domain"] == original["domain"]
        assert parsed["agent_registry"] == original["agent_registry"]
        assert parsed["not_before"] == original["not_before"]
        assert parsed["request_id"] == original["request_id"]


class TestBuildSIWAResponse:
    """Tests for building SIWA responses."""

    def test_authenticated_response(self):
        """Test building an authenticated response."""
        result = SIWAVerificationResult(
            valid=True,
            address="0x1234567890123456789012345678901234567890",
            agent_id=123,
            agent_registry="eip155:84532:0x8004AA63",
            chain_id=84532,
            verified="onchain",
            signer_type="eoa",
        )

        response = build_siwa_response(result)

        assert response["status"] == "authenticated"
        assert response["address"] == "0x1234567890123456789012345678901234567890"
        assert response["agent_id"] == 123
        assert response["verified"] == "onchain"
        assert response["signer_type"] == "eoa"

    def test_not_registered_response(self):
        """Test building a not_registered response."""
        result = SIWAVerificationResult(
            valid=False,
            address="0x1234567890123456789012345678901234567890",
            agent_id=0,
            agent_registry="eip155:84532:0x8004AA63",
            chain_id=84532,
            verified="onchain",
            code=SIWAErrorCode.NOT_REGISTERED,
            error="Agent is not registered",
        )

        response = build_siwa_response(result)

        assert response["status"] == "not_registered"
        assert response["code"] == SIWAErrorCode.NOT_REGISTERED
        assert response["action"] is not None
        assert response["action"]["type"] == "register"
        assert "steps" in response["action"]

    def test_rejected_response(self):
        """Test building a rejected response."""
        result = SIWAVerificationResult(
            valid=False,
            address="0x1234567890123456789012345678901234567890",
            agent_id=123,
            agent_registry="eip155:84532:0x8004AA63",
            chain_id=84532,
            verified="onchain",
            code=SIWAErrorCode.INVALID_SIGNATURE,
            error="Invalid signature",
        )

        response = build_siwa_response(result)

        assert response["status"] == "rejected"
        assert response["code"] == SIWAErrorCode.INVALID_SIGNATURE
        assert response["error"] == "Invalid signature"


class TestSIWAErrorCode:
    """Tests for SIWA error codes."""

    def test_all_error_codes_exist(self):
        """Test that all expected error codes exist."""
        expected_codes = [
            "INVALID_SIGNATURE",
            "DOMAIN_MISMATCH",
            "INVALID_NONCE",
            "MESSAGE_EXPIRED",
            "MESSAGE_NOT_YET_VALID",
            "INVALID_REGISTRY_FORMAT",
            "NOT_REGISTERED",
            "NOT_OWNER",
            "AGENT_NOT_ACTIVE",
            "MISSING_SERVICE",
            "MISSING_TRUST_MODEL",
            "LOW_REPUTATION",
            "CUSTOM_CHECK_FAILED",
            "VERIFICATION_FAILED",
        ]

        for code in expected_codes:
            assert hasattr(SIWAErrorCode, code)
            assert getattr(SIWAErrorCode, code).value == code

    def test_error_codes_are_strings(self):
        """Test that error codes are string enums."""
        for code in SIWAErrorCode:
            assert isinstance(code.value, str)
