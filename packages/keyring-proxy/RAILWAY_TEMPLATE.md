# Deploy and Host siwa-keyring-proxy on Railway

**siwa-keyring-proxy** is a standalone Express server that acts as a security boundary for AI agent signing. It holds encrypted private keys and exposes HMAC-authenticated HTTP endpoints for wallet creation, message signing, and transaction signing — so private keys never enter the agent's process.

## About Hosting siwa-keyring-proxy

Hosting siwa-keyring-proxy involves deploying a single Docker container running a Node.js Express server. The service manages Ethereum private keys using either an AES-encrypted JSON Keystore (persisted to a volume) or a raw private key from an environment variable. All signing requests are authenticated via HMAC-SHA256 with a shared secret, ensuring only authorized agents can request signatures. The server exposes a `/health` endpoint for readiness checks. Configuration is entirely through environment variables — set a shared HMAC secret, choose a keystore backend, and provide a password or private key.

## Common Use Cases

- **AI agent wallet security** — Run alongside an AI agent (e.g. OpenClaw) so the agent can sign Ethereum transactions without ever accessing the private key, defending against prompt injection and key exfiltration.
- **ERC-8004 agent registration and SIWA authentication** — Agents use the proxy to sign onchain registration transactions and SIWA (Sign In With Agent) challenge-response messages.
- **Bring your own wallet** — Set `AGENT_PRIVATE_KEY` to plug in an existing funded wallet instead of generating a new one.

## Dependencies for siwa-keyring-proxy Hosting

- **@buildersgarden/siwa** (npm) — Core SDK providing keystore abstraction and HMAC proxy-auth utilities.
- **Node.js 22** — Runtime environment (included in the Docker image).

### Deployment Dependencies

- [SIWA documentation](https://siwa.id/docs) — SDK reference, protocol spec, and security model.
- [ERC-8004 Trustless Agents standard](https://eips.ethereum.org/EIPS/eip-8004) — The onchain agent identity standard that SIWA implements.
- [SIWA GitHub repository](https://github.com/builders-garden/siwa) — Source code for the keyring proxy, SDK, and reference server.

### Implementation Details

The keyring proxy requires these environment variables:

| Variable                | Required    | Description                                                        |
| ----------------------- | ----------- | ------------------------------------------------------------------ |
| `KEYRING_PROXY_SECRET` | Yes         | Shared HMAC-SHA256 secret. Must match your agent.                  |
| `KEYSTORE_PASSWORD`     | Conditional | Password for the encrypted-file keystore (default backend).        |
| `AGENT_PRIVATE_KEY`     | Conditional | Hex-encoded private key (0x...) to use an existing wallet instead. |

When `AGENT_PRIVATE_KEY` is set, the keystore backend auto-detects to `env` — no password or encrypted file needed.

### Security Model

The keyring proxy implements defense-in-depth security:

- **Private Key Isolation** — The private key never leaves the keyring-proxy process. The agent only receives signed outputs, never the key itself. This protects against prompt injection and key exfiltration attacks.
- **Encrypted Storage** — When using the `encrypted-file` backend, keys are stored using AES-128-CTR encryption with scrypt key derivation (N=16384). Keys are decrypted in memory only when signing.
- **HMAC Authentication** — All signing requests require HMAC-SHA256 authentication with timestamp-based replay protection (5-minute window). Invalid or expired requests are rejected.
- **Audit Logging** — Every operation is logged with timestamp, source IP, and success/failure status for forensic analysis.

#### Network Deployment Recommendations

For production deployments, all SIWA services should run within the same **private/internal network**:

```
                 Public                          Internal Network
              ─────────────      ┌────────────────────────────────────────────────┐
                                 │                                                │
┌─────────┐   ┌──────────┐      │  ┌─────────────────┐      ┌──────────────────┐ │
│  Users  │──▶│  Agent   │─────────▶│  Keyring Proxy  │─────▶│  2FA Telegram    │ │
└─────────┘   │ (Public) │ HMAC │  │   (Port 3100)   │      │   (Port 3200)    │ │
              └──────────┘      │  └─────────────────┘      └──────────────────┘ │
                                │                                     ▲          │
                                │                                     │          │
                                │                           ┌─────────┴────────┐ │
                                │                           │   2FA Gateway    │ │
                                │                           │   (Port 3201)    │ │
                                │                           └─────────┬────────┘ │
                                └─────────────────────────────────────┼──────────┘
              ┌───────────────┐                                       │
              │   Telegram    │◀──────────────────────────────────────┘
              │     API       │                              Webhooks
              └───────────────┘
```

- The **Agent** is public-facing (users interact with it)
- The **keyring-proxy** and **2fa-telegram** should never be publicly exposed
- The **2fa-gateway** needs public access only to receive Telegram webhook callbacks
- Use Railway's private networking to ensure internal services communicate securely

### Optional 2FA Configuration

If you want to enable Telegram-based two-factor authentication for signing operations, you need to deploy two additional services and configure the following environment variables:

| Variable            | Required | Description                                                        |
| ------------------- | -------- | ------------------------------------------------------------------ |
| `TFA_ENABLED`       | No       | Set to `true` to enable Telegram 2FA                               |
| `TFA_SERVER_URL`    | If 2FA   | Internal URL of the 2FA Telegram server                            |
| `TFA_SECRET`        | If 2FA   | Shared secret with the 2FA server                                  |
| `TFA_OPERATIONS`    | No       | Comma-separated list of operations requiring 2FA (default: all)    |

#### Additional Services Required for 2FA

Telegram 2FA requires deploying two additional services from the SIWA monorepo:

1. **2fa-telegram** — Internal server that communicates with the Telegram API to send approval requests and receive responses. Configure it with your Telegram bot token and chat ID. This service should **never be publicly exposed**.

2. **2fa-gateway** — Public-facing gateway that receives Telegram webhook callbacks. This is the **only** component that should be exposed to the internet. It features rate limiting (60 requests/minute per IP) and minimal attack surface.

Both services are optional and only needed if you want users to manually approve signing operations via Telegram. Without 2FA, signing requests are processed immediately upon valid HMAC authentication.

The proxy exposes these HMAC-authenticated endpoints:

```
GET  /health              — Health check (no auth required)
POST /create-wallet       — Generate a new wallet
POST /has-wallet          — Check if a wallet exists
POST /get-address         — Get the wallet's public address
POST /sign-message        — Sign an arbitrary message
POST /sign-transaction    — Sign an Ethereum transaction
POST /sign-authorization  — Sign an EIP-7702 authorization
```

## Why Deploy siwa-keyring-proxy on Railway?

Railway is a singular platform to deploy your infrastructure stack. Railway will host your infrastructure so you don't have to deal with configuration, while allowing you to vertically and horizontally scale it.

By deploying siwa-keyring-proxy on Railway, you are one step closer to supporting a complete full-stack application with minimal burden. Host your servers, databases, AI agents, and more on Railway.
