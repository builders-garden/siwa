# ERC-8004 SIWA Local Test Environment

A local test environment for the ERC-8004 SIWA (Sign In With Agent) authentication flow.

## Quick Start

```bash
cd packages/siwa-testing
pnpm install

# Terminal 1: Start the SIWA server
pnpm run server

# Terminal 2: Run the full agent flow
pnpm run agent:flow

# Or run both at once:
pnpm run dev
```

## What Happens

The `full-flow` command runs a 4-step agent lifecycle:

1. **Create Wallet** — Creates a wallet via the keyring proxy. Only the public address is written to `IDENTITY.md`.

2. **Mock Registration** — Simulates onchain registration by writing mock agent identity data (Agent ID, Registry address, Chain ID) to `IDENTITY.md`. No actual transaction is made.

3. **SIWA Sign-In** — The full authentication round-trip:

   - Agent requests a nonce — server validates onchain registration via `createSIWANonce()` before issuing
   - Agent builds a SIWA message and signs it using the keystore (address resolved from keystore, key loaded, used, and discarded)
   - Agent submits the signature to the server
   - Server verifies via `verifySIWA()` and returns a standard `SIWAResponse` (with JWT on success, or registration instructions on failure)

4. **Authenticated API Call** — Agent uses the JWT to call a protected endpoint, proving the authentication works end-to-end.

## Dashboard

Open [http://localhost:3000](http://localhost:3000) to see the SIWA test dashboard. It displays active sessions, nonce stats, and provides a test panel for manual nonce requests and signature verification.

## Individual Commands

| Command                   | Description                                      |
| ------------------------- | ------------------------------------------------ |
| `pnpm run server`         | Start the SIWA relying-party server on port 3000 |
| `pnpm run agent:create`   | Create a wallet and write address to IDENTITY.md  |
| `pnpm run agent:register` | Mock-register the agent                          |
| `pnpm run agent:signin`   | Run the full SIWA sign-in flow                   |
| `pnpm run agent:flow`     | Run all 4 steps sequentially                     |
| `pnpm run agent:status`   | Print current agent state                        |
| `pnpm run reset`          | Clean up IDENTITY.md                             |
| `pnpm run dev`            | Start server + run full flow concurrently        |

## Reset

To start fresh, run:

```bash
pnpm run reset
```

This removes `IDENTITY.md`, allowing you to re-run the full flow from scratch.

## RPC Configuration

The server requires an RPC endpoint for onchain verification. Both `createSIWANonce()` and `verifySIWA()` from the SDK check the ERC-8004 Identity Registry to validate agent registration and NFT ownership.

```bash
export RPC_URL=https://sepolia.base.org
pnpm run server
```

The server will exit on startup if `RPC_URL` is not set.

## Docker Testing

Docker Compose configurations at the monorepo root let you test the full security architecture with process-isolated signing via the keyring proxy. This is important because the proxy backend is the recommended production configuration — the private key lives in a separate process and never enters the agent.

### Proxy + OpenClaw Gateway

Runs the keyring proxy alongside an OpenClaw AI agent gateway:

```bash
# From the monorepo root
cp .env.proxy.example .env   # fill in secrets
docker compose -f docker-compose.proxy.yml up -d
```

### Full Integration Test

Runs all three services (keyring proxy, SIWA server, OpenClaw gateway) for end-to-end testing:

```bash
# From the monorepo root
docker compose -f docker-compose.test.yml up -d --build

# Run the agent flow against Docker services
cd packages/siwa-testing
pnpm run reset
KEYSTORE_BACKEND=proxy \
  KEYRING_PROXY_URL=http://localhost:3100 \
  KEYRING_PROXY_SECRET=test-secret-123 \
  SERVER_URL=http://localhost:3000 \
  SERVER_DOMAIN=localhost:3000 \
  pnpm run agent:flow
```

See the [root README](../../README.md) for more details on the Docker setup.

## Security Note

All signing is delegated to a **keyring proxy** — the private key never enters the agent process. The proxy holds the encrypted key in a separate process and exposes only HMAC-authenticated signing endpoints.

See [`packages/siwa-skill/references/security-model.md`](../siwa-skill/references/security-model.md) for the full threat model.
