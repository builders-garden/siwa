# 2FA Gateway

Minimal public gateway that receives Telegram webhook callbacks and forwards them to the internal 2FA Telegram server. This is the only component that should be exposed to the internet.

## Features

- **Minimal Attack Surface** — Only `/webhook` endpoint, all other routes return 404
- **Rate Limiting** — Built-in rate limiting (60 requests/minute per IP)
- **Request Validation** — Validates Telegram update format before forwarding
- **Health Check** — Simple health endpoint for monitoring

## Architecture

```
    Public Internet                    Internal Network
    ───────────────                    ────────────────

    ┌───────────┐                     ┌──────────────────┐
    │  Telegram │                     │   2FA Telegram   │
    │    API    │                     │   (Port 3200)    │
    └─────┬─────┘                     └────────▲─────────┘
          │                                    │
          │ Webhook POST                       │ Forward
          ▼                                    │
    ┌─────────────┐                            │
    │ 2FA Gateway │────────────────────────────┘
    │ (Port 3201) │
    └─────────────┘
```

## Quick Start

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your configuration

# Install dependencies
pnpm install

# Start the gateway
pnpm dev
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TFA_INTERNAL_URL` | Yes | - | URL of 2fa-telegram server |
| `TELEGRAM_BOT_TOKEN` | No | - | Bot token. If set, webhook is auto-registered on startup |
| `WEBHOOK_URL` | No | Auto | Public webhook URL. Auto-detected on Railway |
| `TFA_GATEWAY_PORT` | No | 3201 | Gateway port |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/webhook` | POST | Telegram webhook receiver |

All other routes return 404.

## Webhook Setup

### Automatic (Railway)

On Railway, the webhook is **automatically registered** on startup when:
1. `TELEGRAM_BOT_TOKEN` is set
2. The service has a public domain (Railway sets `RAILWAY_PUBLIC_DOMAIN` automatically)

No manual webhook setup required.

### Manual / Local Development

For local testing, use ngrok or cloudflared to expose the gateway:

```bash
# Using ngrok
ngrok http 3201

# Using cloudflared (no account needed)
cloudflared tunnel --url http://localhost:3201
```

Then either:
- Set `WEBHOOK_URL` env var to the public URL (auto-registers on startup), or
- Manually call the Telegram API:

```bash
# Set the webhook
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<PUBLIC_URL>/webhook"

# Verify it's set
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

## Rate Limiting

The gateway implements simple in-memory rate limiting:
- **Window**: 60 seconds
- **Max requests**: 60 per IP per window

Requests exceeding the limit receive HTTP 429 (Too Many Requests).

## Security Notes

- This is the **only** component that should be publicly exposed
- The gateway only forwards to the internal 2FA server — it cannot initiate requests
- Consider adding additional security measures in production:
  - IP allowlisting for Telegram's servers
  - TLS termination at a reverse proxy
  - Web Application Firewall (WAF)

## Docker

```bash
docker build -t 2fa-gateway -f Dockerfile .
docker run -p 3201:3201 \
  -e TFA_INTERNAL_URL=http://2fa-telegram:3200 \
  2fa-gateway
```

## License

MIT
