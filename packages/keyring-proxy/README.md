# Keyring Proxy Server

A standalone Express server that acts as the security boundary for agent signing operations. The agent process delegates all signing to this server over HMAC-authenticated HTTP, so private keys never enter the agent's process.

## Features

- **HMAC-SHA256 Authentication** — All requests require valid HMAC signatures with timestamp-based replay protection
- **Audit Logging** — All operations are logged with timestamps, source IPs, and success/failure status
- **EIP-7702 Support** — Sign authorization tuples for account abstraction delegations

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

| Variable               | Required | Description                                              |
| ---------------------- | -------- | -------------------------------------------------------- |
| `KEYRING_PROXY_SECRET` | Yes      | Shared HMAC secret for signing operations                |
| `KEYRING_PROXY_PORT`   | No       | Listen port (default: 3100)                              |
| `KEYSTORE_BACKEND`     | Yes      | Backend type: `encrypted-file` or `env` (NOT `proxy`)    |
| `KEYSTORE_PASSWORD`    | Yes\*    | Password for encrypted-file backend                      |
| `KEYSTORE_PATH`        | No       | Path to keystore file (default: `./agent-keystore.json`) |

## API Endpoints

### Health & Wallet Management

| Endpoint         | Method | Auth | Description            |
| ---------------- | ------ | ---- | ---------------------- |
| `/health`        | GET    | None | Health check           |
| `/create-wallet` | POST   | HMAC | Create a new wallet    |
| `/has-wallet`    | POST   | HMAC | Check if wallet exists |
| `/get-address`   | POST   | HMAC | Get wallet address     |

### Signing Operations

| Endpoint              | Method | Auth | Description                 |
| --------------------- | ------ | ---- | --------------------------- |
| `/sign-message`       | POST   | HMAC | Sign a message              |
| `/sign-transaction`   | POST   | HMAC | Sign a transaction          |
| `/sign-authorization` | POST   | HMAC | Sign EIP-7702 authorization |

## HMAC Authentication

All requests (except `/health`) require HMAC-SHA256 authentication:

```typescript
import { computeHmac } from "@buildersgarden/siwa/proxy-auth";

const body = JSON.stringify({ message: "Hello" });
const headers = computeHmac(secret, "POST", "/sign-message", body);
// Returns: { 'x-keyring-timestamp': '...', 'x-keyring-signature': '...' }
```

The HMAC is computed over: `${timestamp}:${method}:${path}:${body}`

Requests are rejected if:

- Timestamp is older than 5 minutes
- Signature doesn't match

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
│  ┌─────────────┐  ┌─────────────────────────┐                   │
│  │   HMAC      │  │      Keystore           │                   │
│  │   Auth      │──│   (encrypted-file)      │                   │
│  │   Layer     │  │                         │                   │
│  └─────────────┘  └─────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

## License

MIT
