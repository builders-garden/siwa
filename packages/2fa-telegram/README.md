# 2FA Telegram Server

Internal server that handles Telegram-based two-factor authentication for SIWA signing operations. When enabled, all signing requests must be approved via Telegram before the keyring-proxy will sign.

## Features

- **Telegram Bot Integration** — Sends approval requests with inline keyboard buttons
- **Transaction Decoding** — Decodes function signatures via 4byte.directory API
- **Audit Logging** — JSON-lines audit log for all approval events
- **Configurable Timeout** — Auto-reject requests after configurable timeout (default: 60s)
- **In-Memory State** — No database required, pending approvals stored in memory

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────┐
│  Keyring Proxy  │────▶│  2FA Telegram    │────▶│   Telegram    │
│  (Port 3100)    │     │  (Port 3200)     │     │     API       │
└─────────────────┘     └──────────────────┘     └───────────────┘
                               ▲
                               │
                        ┌──────┴───────┐
                        │  2FA Gateway │◀──── Telegram Webhooks
                        │  (Port 3201) │
                        └──────────────┘
```

## Quick Start

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your Telegram bot token and chat ID
# See "Telegram Bot Setup" below

# Install dependencies
pnpm install

# Start the server
pnpm dev
```

## Telegram Bot Setup

1. **Create a bot** via [@BotFather](https://t.me/BotFather):
   - Send `/newbot`
   - Follow the prompts to name your bot
   - Copy the bot token

2. **Get your chat ID** via [@userinfobot](https://t.me/userinfobot):
   - Send any message to the bot
   - It will reply with your user ID

3. **Set the webhook** (after starting the gateway):
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<PUBLIC_URL>/webhook"
   ```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | - | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Yes | - | Your Telegram user ID |
| `TFA_INTERNAL_SECRET` | Yes | - | Shared secret with keyring-proxy |
| `TFA_PORT` | No | 3200 | Server port |
| `TFA_APPROVAL_TIMEOUT_MS` | No | 60000 | Timeout in milliseconds |
| `TFA_AUDIT_LOG_PATH` | No | ./audit.jsonl | Path to audit log file |

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | None | Health check with pending count |
| `/request-approval` | POST | Secret | Request user approval (blocks until response) |
| `/internal-webhook` | POST | None | Receive webhook callbacks from gateway |

## Telegram Message Format

When a signing request is received, the bot sends a message like:

```
🔐 SIWA Signing Request

📋 Request ID: abc123
⏱️ Expires: 60 seconds

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔑 Wallet
0x742d35Cc6634C0532925a3b844Bc7e7595f42e01

📝 Operation
Sign Transaction

⛓️ Chain
Base Sepolia (84532)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📤 To
0xdead...beef

💰 Value
0.5 ETH

📦 Data
transfer(address,uint256)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[✅ Approve]  [❌ Reject]
```

## Audit Log Format

Logs are written in JSON-lines format to the configured path:

```jsonl
{"timestamp":"2026-02-09T15:30:00.000Z","event":"request_created","requestId":"abc123","operation":"sign-transaction","wallet":"0x742d..."}
{"timestamp":"2026-02-09T15:30:15.000Z","event":"user_approved","requestId":"abc123","responseTimeMs":15000}
{"timestamp":"2026-02-09T15:31:00.000Z","event":"request_timeout","requestId":"def456"}
{"timestamp":"2026-02-09T15:32:00.000Z","event":"user_rejected","requestId":"ghi789","responseTimeMs":8000}
```

## Security Notes

- This server should **never be exposed publicly** — only the gateway should be public
- The `TFA_INTERNAL_SECRET` must match the `TFA_SERVER_SECRET` in keyring-proxy
- All communication from keyring-proxy is authenticated via the shared secret

## License

MIT
