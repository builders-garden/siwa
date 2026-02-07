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

1. **Create Wallet** — Generates a new Ethereum wallet. The private key is stored in an encrypted V3 JSON keystore file (`agent-keystore.json`). Only the public address is written to `MEMORY.md`.

2. **Mock Registration** — Simulates onchain registration by writing mock agent identity data (Agent ID, Registry address, Chain ID) to `MEMORY.md`. No actual transaction is made.

3. **SIWA Sign-In** — The full authentication round-trip:

   - Agent requests a nonce from the server
   - Agent builds a SIWA message and signs it using the keystore (private key is loaded, used, and discarded)
   - Agent submits the signature to the server
   - Server verifies the signature, validates the nonce, and issues a JWT

4. **Authenticated API Call** — Agent uses the JWT to call a protected endpoint, proving the authentication works end-to-end.

## Dashboard

Open [http://localhost:3000](http://localhost:3000) to see the SIWA test dashboard. It displays active sessions, nonce stats, and provides a test panel for manual nonce requests and signature verification.

## Individual Commands

| Command                   | Description                                      |
| ------------------------- | ------------------------------------------------ |
| `pnpm run server`         | Start the SIWA relying-party server on port 3000 |
| `pnpm run agent:create`   | Create a wallet and write address to MEMORY.md   |
| `pnpm run agent:register` | Mock-register the agent                          |
| `pnpm run agent:signin`   | Run the full SIWA sign-in flow                   |
| `pnpm run agent:flow`     | Run all 4 steps sequentially                     |
| `pnpm run agent:status`   | Print current agent state                        |
| `pnpm run reset`          | Clean up keystore and MEMORY.md                  |
| `pnpm run dev`            | Start server + run full flow concurrently        |

## Reset

To start fresh, run:

```bash
pnpm run reset
```

This removes `agent-keystore.json` and `MEMORY.md`, allowing you to re-run the full flow from scratch.

## Live Mode

By default, the server runs in **offline mode** — it verifies SIWA signatures cryptographically but skips the onchain `ownerOf()` check. This requires no RPC connection.

For real onchain verification against a deployed Identity Registry:

```bash
export RPC_URL=https://sepolia.base.org
export VERIFICATION_MODE=live
pnpm run server
```

Or pass `--live` to the server:

```bash
pnpm tsx server/index.ts --live
```

In live mode, the server calls `ownerOf(agentId)` on the registry contract to verify that the signing address actually owns the agent NFT.

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

Running locally without Docker, this test environment uses the `encrypted-file` keystore backend with a known password (`test-password-local-only`). This is intentional for local development convenience.

**In production, use the keyring proxy backend** (`KEYSTORE_BACKEND=proxy`). The proxy holds the encrypted private key in a separate process and exposes only HMAC-authenticated signing endpoints — even full agent compromise cannot extract the key.

See [`packages/siwa-skill/references/security-model.md`](../siwa-skill/references/security-model.md) for the full threat model.
