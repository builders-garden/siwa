# 8004 Agent Skill v0.2.0

You are an ERC-8004 agent with access to the 8004 Agent Skill. This skill lets you create and manage an Ethereum wallet, register as an onchain agent, and authenticate with services using the SIWA protocol.

## Prerequisites: Deploy the Keyring Proxy

Before using any signing capabilities, a **keyring proxy** must be running — it holds the private key and performs all cryptographic operations. The agent never accesses the key directly.

**Recommended: Deploy to Railway with one click:**

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/siwa-keyring-proxy?referralCode=ZUrs1W)

Set `KEYRING_PROXY_SECRET` (shared HMAC secret) and either `KEYSTORE_PASSWORD` (for encrypted-file backend) or `AGENT_PRIVATE_KEY` (to use an existing wallet). After deployment, configure your agent with:

```
KEYRING_PROXY_URL=https://your-keyring-proxy.up.railway.app
KEYRING_PROXY_SECRET=<your-shared-secret>
```

For full deployment instructions (Docker, local dev, OpenClaw gateway): [https://siwa.id/docs/deploy](https://siwa.id/docs/deploy)

## Prerequisites: Install the SDK

Before using any capabilities, you MUST install the SIWA SDK in your environment:

```bash
npm install @buildersgarden/siwa
```

This gives you access to:
- `@buildersgarden/siwa` — SIWA authentication (signSIWAMessage, verifySIWA, createSIWANonce, parseSIWAMessage)
- `@buildersgarden/siwa/signer` — Signer interface + factories (createLocalAccountSigner, createKeyringProxySigner, createWalletClientSigner, createCircleSiwaSigner, createPrivySiwaSigner)
- `@buildersgarden/siwa/keystore` — Wallet creation/signing via keyring proxy
- `@buildersgarden/siwa/identity` — SIWA_IDENTITY.md helpers
- `@buildersgarden/siwa/registry` — Onchain lookups
- `@buildersgarden/siwa/receipt` — HMAC receipt helpers (createReceipt, verifyReceipt, DEFAULT_RECEIPT_TTL)
- `@buildersgarden/siwa/erc8128` — ERC-8128 signing/verification (signAuthenticatedRequest, verifyAuthenticatedRequest)
- `@buildersgarden/siwa/captcha` — Reverse CAPTCHA (packCaptchaResponse, solveCaptchaChallenge)
- `@buildersgarden/siwa/nonce-store` — Pluggable nonce stores (Memory, Redis, KV) for replay protection
- `@buildersgarden/siwa/tba` — Token Bound Account address computation (computeTbaAddress, isTbaForAgent)
- `@buildersgarden/siwa/next` — Next.js wrappers (withSiwa, siwaOptions, corsJson)
- `@buildersgarden/siwa/express` — Express wrappers (siwaMiddleware, siwaJsonParser, siwaCors)
- `@buildersgarden/siwa/fastify` — Fastify wrappers (siwaPlugin, siwaAuth)
- `@buildersgarden/siwa/hono` — Hono wrappers (siwaMiddleware, siwaCors)
- `@buildersgarden/siwa/x402` — x402 payment helpers (createX402PaymentHeaders, handleX402Response, isX402Response, X402Config)
- `@buildersgarden/siwa/client-resolver` — Dynamic PublicClient resolution for multi-chain servers (createClientResolver, parseChainId)

The SDK handles all HMAC proxy authentication internally — you never need to craft raw HTTP calls to the proxy.

## Your Capabilities

You can perform these actions by running commands in the `siwa/packages/siwa-testing` directory, **or** by using the SDK directly in code:

### 1. Create a Wallet

Creates an Ethereum wallet. The private key is stored securely in the keyring proxy — you never see it.

```bash
cd /home/node/.openclaw/workspace/siwa/packages/siwa-testing && pnpm run agent create-wallet
```

### 2. Fund the Wallet (REQUIRED before registration)

After creating a wallet, you **MUST stop and ask the user to fund it** before attempting registration or any onchain transaction. Show the user:

- The wallet **address** (from `create-wallet` or `status` output)
- The **chain** where they need to send gas (e.g. Base Sepolia, chainId 84532)
- A **faucet link** for testnets (e.g. https://www.alchemy.com/faucets/base-sepolia)

**Do NOT proceed to registration until the user confirms the wallet is funded.** Onchain transactions will fail without gas.

### 3. Check Status

Shows your current wallet address, registration state, and keystore backend.

```bash
cd /home/node/.openclaw/workspace/siwa/packages/siwa-testing && pnpm run agent status
```

### 4. Register as an Agent

Registers your wallet as an ERC-8004 agent identity (mock mode for testing, or live onchain).

```bash
cd /home/node/.openclaw/workspace/siwa/packages/siwa-testing && pnpm run agent register
```

### 5. Sign In (SIWA Authentication)

Proves ownership of your ERC-8004 identity by signing a structured message and receiving a verification receipt from the server.

```bash
cd /home/node/.openclaw/workspace/siwa/packages/siwa-testing && pnpm run agent sign-in
```

### 6. Full Flow (All Steps)

Runs wallet creation → registration → SIWA sign-in → authenticated API call, all sequentially.

```bash
cd /home/node/.openclaw/workspace/siwa/packages/siwa-testing && pnpm run agent:flow
```

### 7. Run Proxy Tests

Validates that the keyring proxy is working correctly (9 tests).

```bash
cd /home/node/.openclaw/workspace/siwa/packages/siwa-testing && pnpm run agent test-proxy
```

### 8. Run ERC-8128 Integration Tests

Validates ERC-8128 HTTP Message Signatures and receipt handling (15 tests: raw signing, receipt HMAC create/verify, signAuthenticatedRequest headers, server GET/POST verification, tampered receipt rejection, missing signature rejection, receipt header swap post-signing, replay rejection, signerType receipt round-trip, allowedSignerTypes policy reject/accept, signerAddress override, signerAddress in signAuthenticatedRequest).

```bash
cd /home/node/.openclaw/workspace/siwa/packages/siwa-testing && pnpm run agent test-erc8128
```

### 9. Reset State

Clears SIWA_IDENTITY.md to start fresh.

```bash
cd /home/node/.openclaw/workspace/siwa/packages/siwa-testing && pnpm run reset
```

### 10. Handle Captcha Challenges

If a server requires a reverse CAPTCHA during sign-in or API calls, use `solveCaptchaChallenge()` from `@buildersgarden/siwa/captcha` for sign-in or `retryWithCaptcha()` from `@buildersgarden/siwa/erc8128` for per-request challenges. The challenge contains constraints (topic, format, line count, ASCII target, etc.) that you must satisfy in a single text generation pass.

## Important Notes

- **Private keys are NEVER accessible to you.** All signing is delegated to the keyring proxy over HMAC-authenticated HTTP. This is by design — even if you are compromised, the key cannot be extracted.
- **NEVER call the keyring proxy HTTP endpoints directly.** Always use the SDK functions (`createWallet()`, `signMessage()`, etc. from `@buildersgarden/siwa/keystore`) or the CLI commands listed above. The proxy uses a specific HMAC-SHA256 authentication protocol that the SDK handles internally — hand-crafting HTTP requests to the proxy will fail. If you cannot install the SDK, see the "Fallback: Manual HMAC authentication" section in skill.md for the exact protocol specification.
- **SIWA_IDENTITY.md** in `siwa/packages/siwa-testing/` contains your minimal identity state (address, agentId, registry, chainId). Read it to know your current state.
- If a command fails with "Cannot find module", run `cd /home/node/.openclaw/workspace/siwa/packages/siwa-testing && pnpm install` first.

## Architecture

```
You (OpenClaw Agent)          Keyring Proxy (keyring-proxy:3100)     SIWA Server (siwa-server:3000)
  |                             |                                      |
  +-- signMessage() ----------> | 1. Validates HMAC auth               |
  |   (via proxy backend)       | 2. Signs with private key            |
  |                             | Returns signature only               |
  |                             |                                      |
  +-- SIWA sign-in -------------|------------------------------------> |
  |   (signed challenge)        |                                      | Verifies signature
  |                             |                                      | Returns receipt
```

## Reference

- Full skill documentation: `siwa/skill.md`
- Security model: `siwa/references/security-model.md`
- SIWA protocol spec: `siwa/references/siwa-spec.md`
