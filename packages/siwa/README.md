# SIWA — Sign In With Agent

A Claude Code skill for registering AI agents on the [ERC-8004 (Trustless Agents)](https://github.com/builders-garden/ERC-8004) standard and authenticating them via SIWA, a challenge-response protocol inspired by [EIP-4361 (SIWE)](https://eips.ethereum.org/EIPS/eip-4361).

## What it does

- **Create Wallet** — Generate an Ethereum wallet via a keyring proxy (private key never enters the agent process)
- **Register Agent (Sign Up)** — Mint an ERC-721 identity NFT on the ERC-8004 Identity Registry with metadata (endpoints, trust model, services)
- **Authenticate (Sign In)** — Prove ownership of an onchain agent identity by signing a structured SIWA message; receive a verification receipt from the relying party and use ERC-8128 per-request signatures for subsequent API calls

## Project Structure

```
src/               Core SDK modules
  keystore.ts        Proxy-only keystore (signing delegated over HMAC-authenticated HTTP)
  identity.ts        SIWA_IDENTITY.md read/write helpers
  siwa.ts            SIWA message building, signing, verification
  proxy-auth.ts      HMAC-SHA256 authentication utilities
  registry.ts        Onchain agent profile & reputation lookups
  addresses.ts       Deployed contract addresses
  receipt.ts         Stateless HMAC receipt creation and verification
  erc8128.ts         ERC-8128 HTTP Message Signatures (sign/verify)

references/        Protocol documentation
  siwa-spec.md       Full SIWA specification
  security-model.md  Threat model and keystore architecture

assets/            Templates
  SIWA_IDENTITY.template.md

```

## Quick Start (Local Test)

The test harness lives in the `siwa-testing` package (sibling in this monorepo):

```bash
cd packages/siwa-testing
pnpm install

# Terminal 1: Start the SIWA relying-party server
pnpm run server

# Terminal 2: Run the full agent flow (create wallet → register → sign in → authenticated call)
pnpm run agent:flow

# Or run both at once:
pnpm run dev
```

See [`packages/siwa-testing/README.md`](../siwa-testing/README.md) for full details on the test environment.

## Security Model

The agent's private key never enters the agent process. All signing is delegated to a **keyring proxy** over HMAC-authenticated HTTP. Even full agent compromise cannot extract the key — only request signatures.

See [`references/security-model.md`](references/security-model.md) for the full threat model.

## Tech Stack

- **TypeScript** (ES modules, strict mode)
- **viem** — wallet management and contract interaction
- **pnpm** — package manager

## References

- [skill.md](skill.md) — Full skill documentation and API reference
- [ERC-8004 specification](https://github.com/builders-garden/ERC-8004)
- [SIWA protocol spec](references/siwa-spec.md)

