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

- [SIWA documentation](https://siwa.builders.garden/docs) — SDK reference, protocol spec, and security model.
- [ERC-8004 Trustless Agents standard](https://eips.ethereum.org/EIPS/eip-8004) — The onchain agent identity standard that SIWA implements.
- [SIWA GitHub repository](https://github.com/builders-garden/siwa) — Source code for the keyring proxy, SDK, and reference server.

### Implementation Details

The keyring proxy requires these environment variables:

| Variable | Required | Description |
|---|---|---|
| `KEYRING_PROXY_SECRET` | Yes | Shared HMAC-SHA256 secret. Must match your agent. |
| `KEYSTORE_PASSWORD` | Conditional | Password for the encrypted-file keystore (default backend). |
| `AGENT_PRIVATE_KEY` | Conditional | Hex-encoded private key (0x...) to use an existing wallet instead. |

When `AGENT_PRIVATE_KEY` is set, the keystore backend auto-detects to `env` — no password or encrypted file needed.

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
