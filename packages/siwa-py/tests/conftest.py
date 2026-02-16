"""
Pytest configuration and fixtures for SIWA Python SDK tests.
"""

import pytest
from eth_account import Account

from siwa_py.signers import LocalAccountSigner


@pytest.fixture
def test_private_key():
    """A fixed test private key for deterministic tests."""
    return "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"


@pytest.fixture
def test_account(test_private_key):
    """A test account from the fixed private key."""
    return Account.from_key(test_private_key)


@pytest.fixture
def test_signer(test_account):
    """A test signer from the fixed account."""
    return LocalAccountSigner(test_account)


@pytest.fixture
def random_account():
    """A randomly generated test account."""
    return Account.create()


@pytest.fixture
def random_signer(random_account):
    """A signer from the random account."""
    return LocalAccountSigner(random_account)
