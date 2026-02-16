# SIWA Python SDK

Sign In With Agent (SIWA) - Python SDK for ERC-8004 agent authentication.

## Installation

```bash
pip install siwa
```

## Quick Start

```python
from siwa_py import (
    build_siwa_message,
    parse_siwa_message,
    sign_siwa_message,
    generate_nonce,
    SIWAMessageFields,
)
from siwa_py.signers import LocalAccountSigner
from eth_account import Account

# Create a signer from a private key
account = Account.from_key("0x...")
signer = LocalAccountSigner(account)

# Sign a SIWA message
result = await sign_siwa_message(
    SIWAMessageFields(
        domain="example.com",
        uri="https://example.com/login",
        agent_id=123,
        agent_registry="eip155:84532:0x8004AA63...",
        chain_id=84532,
        nonce=generate_nonce(),
        issued_at="2024-01-01T00:00:00Z",
    ),
    signer,
)

print(result["message"])
print(result["signature"])
print(result["address"])
```

## Features

- Build and parse SIWA messages
- Sign messages with local accounts
- Verify signatures
- Full type hints with Pydantic

## Development

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Type checking
mypy siwa_py

# Linting
ruff check siwa_py
```

## License

MIT
