# SIWA Monorepo — Sign In With Agent

A monorepo for the SIWA (Sign In With Agent) protocol, enabling AI agents to register on the [ERC-8004](https://github.com/builders-garden/ERC-8004) standard and authenticate via a challenge-response protocol inspired by [EIP-4361 (SIWE)](https://eips.ethereum.org/EIPS/eip-4361).

## Packages

| Package | Description |
|---------|-------------|
| [`packages/siwa`](packages/siwa/) | Core library — keystore, SIWA signing/verification, memory helpers |
| [`packages/siwa-skill`](packages/siwa-skill/) | Agent skill definition — SKILL.md, CLAUDE.md, references, assets |
| [`packages/siwa-testing`](packages/siwa-testing/) | Test harness — Express server, CLI agent, keyring proxy |

## Quick Start

```bash
pnpm install

# Run the local test flow (encrypted-file keystore)
cd packages/siwa-testing
pnpm run dev
```

## Docker Testing

Docker Compose configurations are provided for testing the full security architecture with process-isolated signing via the keyring proxy.

### Proxy + OpenClaw Gateway

Runs the keyring proxy alongside an OpenClaw AI agent gateway. The agent uses `KEYSTORE_BACKEND=proxy` so private keys never enter the agent process.

```bash
cp .env.proxy.example .env   # fill in secrets
docker compose -f docker-compose.proxy.yml up -d
```

### Full Integration Test

Runs all three services (keyring proxy, SIWA relying-party server, OpenClaw gateway) for end-to-end testing:

```bash
docker compose -f docker-compose.test.yml up -d --build

# Run the agent flow against the Docker services
cd packages/siwa-testing
pnpm run reset
KEYSTORE_BACKEND=proxy \
  KEYRING_PROXY_URL=http://localhost:3100 \
  KEYRING_PROXY_SECRET=test-secret-123 \
  SERVER_URL=http://localhost:3000 \
  SERVER_DOMAIN=localhost:3000 \
  pnpm run agent:flow
```

See [`packages/siwa-testing/README.md`](packages/siwa-testing/README.md) for full details on the test environment and CLI commands.

## Security Model

Private keys are held in a separate **keyring proxy server** and never enter the agent process. The agent delegates all signing over HMAC-SHA256 authenticated HTTP. Even under full agent compromise, an attacker can only request signatures — the key itself cannot be extracted.

See [`packages/siwa-skill/references/security-model.md`](packages/siwa-skill/references/security-model.md) for the full threat model.

## License

MIT — Builders Garden SRL 2026
