# SIWA — Sign In With Agent 

SIWA lets AI agents prove who they are. Think [Sign In With Ethereum](https://eips.ethereum.org/EIPS/eip-4361), but for agents instead of humans.

An agent signs a message proving it owns an [ERC-8004](https://github.com/builders-garden/ERC-8004) identity NFT. The server verifies the signature and checks onchain ownership. If it all checks out, the agent gets a session token.

## Quick Start

```bash
npm install @buildersgarden/siwa
```

Two functions cover the core flow:

```ts
// Agent signs a SIWA message
import { signSIWAMessage } from '@buildersgarden/siwa';
const { message, signature } = await signSIWAMessage({ domain, address, agentId, ... });

// Server verifies it
import { verifySIWA } from '@buildersgarden/siwa';
const result = verifySIWA(message, signature, { domain, nonce });
```

For a full walkthrough, see the [documentation](https://siwa.builders.garden/docs).

## Try It Locally

Clone the repo and run the test harness to see the full flow (wallet creation, registration, SIWA sign-in) without deploying anything:

```bash
git clone https://github.com/builders-garden/siwa
cd siwa && pnpm install
cd packages/siwa-testing && pnpm run dev
```

## Repository Structure

This is a monorepo with three packages:

| Package | What it does |
|---------|-------------|
| [`packages/siwa`](packages/siwa/) | The core SDK. Wallet management, SIWA signing/verification, registry helpers. |
| [`packages/siwa-skill`](packages/siwa-skill/) | A skill file agents can read to learn how to register and authenticate on their own. |
| [`packages/siwa-testing`](packages/siwa-testing/) | Test harness with an Express server, CLI agent, and keyring proxy for local development. |

## How It Works

1. The agent asks the server for a **nonce** (one-time challenge)
2. The agent builds a SIWA message and **signs** it
3. The server **verifies** the signature and confirms the agent owns the identity NFT onchain
4. The server returns a **JWT session token**

The agent's private key is kept in a separate keyring proxy process, so the agent never touches it directly. For details on the security architecture, deployment options, and the full protocol spec, see the [docs](https://siwa.builders.garden/docs).

## Docker

Docker Compose files are included for testing with the keyring proxy:

```bash
# Proxy + OpenClaw gateway
cp .env.proxy.example .env   # fill in secrets
docker compose -f docker-compose.proxy.yml up -d

# Full integration (proxy + SIWA server + OpenClaw)
docker compose -f docker-compose.test.yml up -d --build
```

See [`packages/siwa-testing/README.md`](packages/siwa-testing/README.md) for more.

## Links

- [Documentation](https://siwa.builders.garden/docs)
- [API Endpoints](https://siwa.builders.garden/docs/endpoints)
- [Deployment Guide](https://siwa.builders.garden/docs/deploy)
- [ERC-8004 Standard](https://eips.ethereum.org/EIPS/eip-8004)
- [Agent Explorer (8004scan)](https://www.8004scan.io/)

## License

MIT — Builders Garden SRL 2026
