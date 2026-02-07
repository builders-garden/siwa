# Keyring Proxy Server

A standalone Express server that acts as the security boundary for agent signing operations. The agent process delegates all signing to this server over HMAC-authenticated HTTP, so private keys never enter the agent's process.

## Features

- **HMAC-SHA256 Authentication** — All requests require valid HMAC signatures with timestamp-based replay protection
- **Policy-Based Signing Controls** — Privy-inspired policy system for transaction, message, and authorization validation
- **Audit Logging** — All operations are logged with timestamps, source IPs, and success/failure status
- **EIP-7702 Support** — Sign authorization tuples for account abstraction delegations
- **Hybrid Authentication** — Optional separate admin secret for policy management

## Quick Start

```bash
# Install dependencies
pnpm install

# Start the proxy
KEYRING_PROXY_SECRET=your-secret \
KEYSTORE_PASSWORD=your-password \
KEYSTORE_BACKEND=encrypted-file \
pnpm start
```

The proxy will start on port 3100 (configurable via `KEYRING_PROXY_PORT`).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `KEYRING_PROXY_SECRET` | Yes | Shared HMAC secret for signing operations |
| `KEYRING_POLICY_ADMIN_SECRET` | No | Separate secret for policy management (if not set, uses regular secret) |
| `KEYRING_PROXY_PORT` | No | Listen port (default: 3100) |
| `KEYSTORE_BACKEND` | Yes | Backend type: `encrypted-file` or `env` (NOT `proxy`) |
| `KEYSTORE_PASSWORD` | Yes* | Password for encrypted-file backend |
| `KEYSTORE_PATH` | No | Path to keystore file (default: `./agent-keystore.json`) |
| `POLICY_STORE_PATH` | No | Path to policies JSON file (default: `./data/policies.json`) |

## API Endpoints

### Health & Wallet Management

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | None | Health check with status info |
| `/create-wallet` | POST | HMAC | Create a new wallet with default policy |
| `/has-wallet` | POST | HMAC | Check if wallet exists |
| `/get-address` | POST | HMAC | Get wallet address |

### Signing Operations

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/sign-message` | POST | HMAC | Sign a message (policy-checked) |
| `/sign-transaction` | POST | HMAC | Sign a transaction (policy-checked) |
| `/sign-authorization` | POST | HMAC | Sign EIP-7702 authorization (policy-checked) |

### Policy Management

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `GET /policies` | GET | HMAC | List all policies |
| `GET /policies/:id` | GET | HMAC | Get policy by ID |
| `POST /policies` | POST | Admin | Create a new policy |
| `PUT /policies/:id` | PUT | Admin | Update a policy |
| `DELETE /policies/:id` | DELETE | Admin | Delete a policy |

### Wallet-Policy Bindings

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `GET /wallets/:address/policies` | GET | HMAC | List policies for wallet |
| `POST /wallets/:address/policies/:policyId` | POST | Admin | Attach policy to wallet |
| `DELETE /wallets/:address/policies/:policyId` | DELETE | Admin | Detach policy from wallet |

## Policy System

The policy system is inspired by [Privy's embedded wallet policies](https://docs.privy.io/guide/react/wallets/smart-wallets/policies). Policies define rules that are evaluated before any signing operation.

### Evaluation Logic

1. **Any DENY rule fires** → Request is rejected immediately
2. **Any ALLOW rule fires** (no DENY) → Request is approved
3. **No rules fire** → Request is denied (default closed)

### Policy Structure

```typescript
interface Policy {
  id: string;
  version: '1.0';
  name: string;
  chain_type: 'ethereum';
  rules: Rule[];
  created_at: string;
  updated_at: string;
}

interface Rule {
  name: string;
  method: 'sign_transaction' | 'sign_message' | 'sign_authorization' | '*';
  action: 'ALLOW' | 'DENY';
  conditions: Condition[];
}

interface Condition {
  field_source: FieldSource;
  field: string;
  operator: 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'in' | 'not_in' | 'matches';
  value: string | number | string[];
  abi?: object;  // Required for calldata decoding
}
```

### Field Sources

#### `ethereum_transaction`
| Field | Type | Description |
|-------|------|-------------|
| `to` | address | Recipient address |
| `value` | wei string | ETH amount |
| `chain_id` | number | Target chain |
| `gas` | number | Gas limit |
| `data` | hex string | Raw calldata |

#### `ethereum_calldata`
Requires `abi` field in condition to decode function calls.

| Field | Type | Description |
|-------|------|-------------|
| `function_name` | string | Decoded function name (e.g., `transfer`) |
| `<function>.<param>` | varies | Function parameter by name (e.g., `transfer.to`) |

#### `message`
| Field | Type | Description |
|-------|------|-------------|
| `content` | string | Message text |
| `length` | number | Message length |
| `is_hex` | boolean | If message starts with 0x |

#### `ethereum_authorization`
| Field | Type | Description |
|-------|------|-------------|
| `contract` | address | Delegate contract address |
| `chain_id` | number | Authorization chain |

#### `system`
| Field | Type | Description |
|-------|------|-------------|
| `current_unix_timestamp` | number | Current time in seconds |

### Example Policies

#### Spending Limit (Allow up to 0.1 ETH)
```json
{
  "name": "Max 0.1 ETH per transaction",
  "rules": [{
    "name": "Spending limit",
    "method": "sign_transaction",
    "action": "ALLOW",
    "conditions": [{
      "field_source": "ethereum_transaction",
      "field": "value",
      "operator": "lte",
      "value": "100000000000000000"
    }]
  }]
}
```

#### Chain Restriction (Base only)
```json
{
  "name": "Base mainnet only",
  "rules": [{
    "name": "Chain restriction",
    "method": "sign_transaction",
    "action": "ALLOW",
    "conditions": [{
      "field_source": "ethereum_transaction",
      "field": "chain_id",
      "operator": "eq",
      "value": 8453
    }]
  }]
}
```

#### Block Unlimited Approvals
```json
{
  "name": "Block unlimited ERC20 approvals",
  "rules": [{
    "name": "Deny max uint256 approvals",
    "method": "sign_transaction",
    "action": "DENY",
    "conditions": [
      {
        "field_source": "ethereum_calldata",
        "field": "function_name",
        "operator": "eq",
        "value": "approve",
        "abi": [{"name": "approve", "type": "function", "inputs": [{"name": "spender", "type": "address"}, {"name": "amount", "type": "uint256"}]}]
      },
      {
        "field_source": "ethereum_calldata",
        "field": "approve.amount",
        "operator": "eq",
        "value": "115792089237316195423570985008687907853269984665640564039457584007913129639935"
      }
    ]
  }]
}
```

#### SIWA Messages Only
```json
{
  "name": "Only SIWA messages",
  "rules": [{
    "name": "Allow SIWA",
    "method": "sign_message",
    "action": "ALLOW",
    "conditions": [{
      "field_source": "message",
      "field": "content",
      "operator": "matches",
      "value": "wants you to sign in with your Agent account"
    }]
  }]
}
```

#### EIP-7702 Delegate Allowlist
```json
{
  "name": "Approved 7702 delegates",
  "rules": [{
    "name": "Allowlist",
    "method": "sign_authorization",
    "action": "ALLOW",
    "conditions": [{
      "field_source": "ethereum_authorization",
      "field": "contract",
      "operator": "in",
      "value": ["0xApprovedModule1", "0xApprovedModule2"]
    }]
  }]
}
```

## Default Policy

When a wallet is created, it automatically gets a default policy attached:

- **Allow transactions up to 0.1 ETH**
- **Allow all message signing**
- **Allow all EIP-7702 authorizations**

You can skip this by passing `skipDefaultPolicy: true` to the create-wallet request, or provide a custom `defaultPolicy` object.

## HMAC Authentication

All requests (except `/health`) require HMAC-SHA256 authentication:

```typescript
import { computeHmac } from '@buildersgarden/siwa/proxy-auth';

const body = JSON.stringify({ message: 'Hello' });
const headers = computeHmac(secret, 'POST', '/sign-message', body);
// Returns: { 'x-keyring-timestamp': '...', 'x-keyring-signature': '...' }
```

The HMAC is computed over: `${timestamp}:${method}:${path}:${body}`

Requests are rejected if:
- Timestamp is older than 5 minutes
- Signature doesn't match
- Admin operation attempted with regular secret (when admin secret is configured)

## Running Tests

```bash
# From siwa-testing package
cd ../siwa-testing

# Basic policy tests
KEYRING_PROXY_URL=http://localhost:3100 \
KEYRING_PROXY_SECRET=your-secret \
KEYSTORE_BACKEND=proxy \
pnpm tsx agent/cli.ts test-policies

# Advanced tests (calldata, message, 7702, admin secret)
KEYRING_POLICY_ADMIN_SECRET=your-admin-secret \
pnpm tsx agent/cli.ts test-policies-advanced
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Agent Process                               │
│  (No private keys - delegates all signing to proxy)             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HMAC-authenticated HTTP
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Keyring Proxy Server                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   HMAC      │  │   Policy    │  │      Keystore           │  │
│  │   Auth      │──│   Engine    │──│   (encrypted-file)      │  │
│  │   Layer     │  │             │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## License

MIT
