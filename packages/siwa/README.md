# SIWA — Sign In With Agent

A Claude Code skill for registering AI agents on the [ERC-8004 (Trustless Agents)](https://github.com/builders-garden/ERC-8004) standard and authenticating them via SIWA, a challenge-response protocol inspired by [EIP-4361 (SIWE)](https://eips.ethereum.org/EIPS/eip-4361).

## What it does

- **Create Wallet** — Generate an Ethereum wallet with secure key storage (encrypted V3 file, keyring proxy, or env var)
- **Register Agent (Sign Up)** — Mint an ERC-721 identity NFT on the ERC-8004 Identity Registry with metadata (endpoints, trust model, services)
- **Authenticate (Sign In)** — Prove ownership of an onchain agent identity by signing a structured SIWA message; receive a JWT from the relying party

## Project Structure

```
scripts/           Core skill implementation
  keystore.ts        Secure key storage (3 backends)
  memory.ts          MEMORY.md read/write helpers
  siwa.ts            SIWA message building, signing, verification
  create_wallet.ts   Wallet creation flow
  register_agent.ts  Onchain registration flow

references/        Protocol documentation
  siwa-spec.md       Full SIWA specification
  security-model.md  Threat model and keystore architecture
  contract-addresses.md  Deployed registry addresses
  registration-guide.md  Registration file schema

assets/            Templates
  MEMORY.md.template
  registration-template.json

test/              Local test environment (Express server + CLI agent)
```

## Quick Start (Local Test)

```bash
cd test
pnpm install

# Terminal 1: Start the SIWA relying-party server
pnpm run server

# Terminal 2: Run the full agent flow (create wallet → register → sign in → authenticated call)
pnpm run agent:flow

# Or run both at once:
pnpm run dev
```

See [`test/README.md`](test/README.md) for full details on the test environment.

## Security Model

The agent's private key never enters the agent's context window. All cryptographic operations are handled by the keystore module, which loads the key, uses it, and discards it immediately.

| Backend | Storage | Use case |
|---------|---------|----------|
| `proxy` | HMAC-authenticated HTTP to a keyring proxy server | Production — process isolation, key never enters agent |
| `encrypted-file` | Ethereum V3 JSON Keystore (AES-128-CTR + scrypt) | Local development, Docker, CI |
| `env` | `AGENT_PRIVATE_KEY` environment variable | Testing only |

See [`references/security-model.md`](references/security-model.md) for the full threat model.

## Tech Stack

- **TypeScript** (ES modules, strict mode)
- **viem** — wallet management and contract interaction
- **pnpm** — package manager

## References

- [SKILL.md](SKILL.md) — Full skill documentation and API reference
- [ERC-8004 specification](https://github.com/builders-garden/ERC-8004)
- [SIWA protocol spec](references/siwa-spec.md)

