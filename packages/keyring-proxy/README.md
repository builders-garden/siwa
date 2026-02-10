# Keyring Proxy Server

A standalone Express server that acts as the security boundary for agent signing operations. The agent process delegates all signing to this server over HMAC-authenticated HTTP, so private keys never enter the agent's process.

## Features

- **HMAC-SHA256 Authentication** — All requests require valid HMAC signatures with timestamp-based replay protection
- **Audit Logging** — All operations are logged with timestamps, source IPs, and success/failure status
- **EIP-7702 Support** — Sign authorization tuples for account abstraction delegations
- **Optional 2FA** — Telegram-based two-factor authentication for signing operations

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

### 2FA Configuration (Optional)

| Variable            | Required | Description                                              |
| ------------------- | -------- | -------------------------------------------------------- |
| `TFA_ENABLED`       | No       | Set to `true` to enable Telegram 2FA                     |
| `TFA_SERVER_URL`    | If 2FA   | URL of the 2FA Telegram server (e.g., `http://localhost:3200`) |
| `TFA_SECRET`        | If 2FA   | Shared secret with 2FA server                            |
| `TFA_OPERATIONS`    | No       | Comma-separated list of operations requiring 2FA (default: all) |

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

## 2FA Setup (Optional)

Enable Telegram-based two-factor authentication to require manual approval for all signing operations.

### Architecture with 2FA

```
┌──────────┐     ┌───────────────┐     ┌──────────────┐     ┌─────────────┐
│  Agent   │────▶│ Keyring Proxy │────▶│ 2FA Telegram │────▶│  Telegram   │
│          │HMAC │               │     │ (Internal)   │     │    API      │
└──────────┘     └───────────────┘     └──────────────┘     └─────────────┘
                                              ▲
                                              │
                                       ┌──────┴──────┐
                                       │ 2FA Gateway │◀─── Telegram
                                       │  (Public)   │     Webhooks
                                       └─────────────┘
```

### Quick Start

1. **Start the 2FA services:**

   ```bash
   # Terminal 1: 2FA Telegram server
   cd packages/2fa-telegram
   cp .env.example .env
   # Edit .env with your Telegram bot token and chat ID
   pnpm dev

   # Terminal 2: 2FA Gateway
   cd packages/2fa-gateway
   cp .env.example .env
   pnpm dev
   ```

2. **Expose the gateway publicly** (for local development):

   ```bash
   # Terminal 3
   ngrok http 3201
   # Or: cloudflared tunnel --url http://localhost:3201
   ```

3. **Set the Telegram webhook:**

   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<PUBLIC_URL>/webhook"
   ```

4. **Start keyring-proxy with 2FA enabled:**

   ```bash
   # Terminal 4
   cd packages/keyring-proxy
   cp .env.example .env
   # Edit .env and set TFA_ENABLED=true
   pnpm dev
   ```

### Telegram Bot Setup

1. Create a bot via [@BotFather](https://t.me/BotFather) — send `/newbot`
2. Get your chat ID from [@userinfobot](https://t.me/userinfobot)
3. Add both to your `packages/2fa-telegram/.env`

### 2FA Flow

When a signing request is received:

1. Keyring proxy contacts the 2FA server
2. 2FA server sends a Telegram message with Approve/Reject buttons
3. User clicks a button within the timeout period
4. If approved, signing proceeds; if rejected or timeout, request fails

See the [2fa-telegram README](../2fa-telegram/README.md) for more details.

## License

MIT
