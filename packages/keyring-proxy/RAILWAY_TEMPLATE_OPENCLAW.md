# Deploy and Host siwa-keyring-proxy + OpenClaw on Railway

**siwa-keyring-proxy + OpenClaw** is a full-stack deployment for running autonomous AI agents with secure onchain identity. The keyring proxy holds encrypted private keys and exposes HMAC-authenticated signing endpoints, while OpenClaw provides an AI agent gateway that routes chat messages to agents equipped with the SIWA skill.

## About Hosting siwa-keyring-proxy + OpenClaw

This template deploys two services connected via Railway's private networking. The keyring proxy is a Node.js Express server that manages Ethereum private keys — agents never access the key directly, only request signatures over authenticated HTTP. OpenClaw is an AI agent gateway that hosts agents with the SIWA (Sign In With Agent) skill pre-installed, enabling them to create wallets, register onchain as ERC-8004 identities, and authenticate with services. The proxy backend is auto-detected from `KEYRING_PROXY_URL`, so OpenClaw only needs the proxy URL and shared secret to start signing.

## Common Use Cases

- **Autonomous AI agents with onchain identity** — Deploy an AI agent that can register on the ERC-8004 Identity Registry, sign transactions, and authenticate with any SIWA-compatible server — all without exposing private keys.
- **Secure multi-agent infrastructure** — Run multiple agents through OpenClaw, all sharing the same keyring proxy for signing operations with full audit logging.
- **Bring your own wallet** — Set `AGENT_PRIVATE_KEY` on the keyring proxy to plug in an existing funded wallet instead of generating a new one.

## Dependencies for siwa-keyring-proxy + OpenClaw Hosting

- **@buildersgarden/siwa** (npm) — Core SDK providing keystore abstraction, SIWA protocol, and HMAC proxy-auth utilities.
- **Node.js 22** — Runtime for the keyring proxy (included in the Docker image).
- **OpenClaw** — AI agent gateway (deployed as a separate Docker image service).

### Deployment Dependencies

- [SIWA documentation](https://siwa.builders.garden/docs) — SDK reference, protocol spec, and security model.
- [ERC-8004 Trustless Agents standard](https://eips.ethereum.org/EIPS/eip-8004) — The onchain agent identity standard that SIWA implements.
- [SIWA GitHub repository](https://github.com/builders-garden/siwa) — Source code for the keyring proxy, SDK, and reference server.
- [OpenClaw](https://openclaw.dev) — AI agent gateway documentation.

### Implementation Details

This template deploys two services:

| Service              | Description                                                              |
| -------------------- | ------------------------------------------------------------------------ |
| **keyring-proxy**    | Holds encrypted keys, exposes HMAC-authenticated signing API             |
| **openclaw-gateway** | AI agent gateway with the SIWA skill, delegates signing to keyring-proxy |

**keyring-proxy environment variables:**

| Variable                | Required    | Description                                                        |
| ----------------------- | ----------- | ------------------------------------------------------------------ |
| `KEYRING_PROXY_SECRET` | Yes         | Shared HMAC-SHA256 secret. Must match openclaw-gateway.            |
| `KEYSTORE_PASSWORD`     | Conditional | Password for the encrypted-file keystore (default backend).        |
| `AGENT_PRIVATE_KEY`     | Conditional | Hex-encoded private key (0x...) to use an existing wallet instead. |

**openclaw-gateway environment variables:**

| Variable                | Required | Description                                                                  |
| ----------------------- | -------- | ---------------------------------------------------------------------------- |
| `KEYRING_PROXY_URL`     | Yes      | URL of the keyring proxy (e.g. `https://your-keyring-proxy.up.railway.app`). |
| `KEYRING_PROXY_SECRET` | Yes      | Shared HMAC-SHA256 secret. Must match keyring-proxy.                         |

The openclaw-gateway reaches the keyring proxy via its public URL. The HMAC shared secret ensures only authorized clients can request signatures.

```
openclaw-gateway                     keyring-proxy
  |                                    |
  +-- KEYRING_PROXY_URL ------------>  |  Holds encrypted private key
  |   (HMAC-authenticated)             |  Signs messages & transactions
  |                                    |  HMAC-SHA256 authenticated
  |                                    |  Full audit log
  +-- Agent receives signatures  <---  |
      Key never enters agent process
```

## Why Deploy siwa-keyring-proxy + OpenClaw on Railway?

Railway is a singular platform to deploy your infrastructure stack. Railway will host your infrastructure so you don't have to deal with configuration, while allowing you to vertically and horizontally scale it.

By deploying siwa-keyring-proxy + OpenClaw on Railway, you are one step closer to supporting a complete full-stack application with minimal burden. Host your servers, databases, AI agents, and more on Railway.
