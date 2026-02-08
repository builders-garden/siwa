# 8004 Agent Skill v0.0.1

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

For full deployment instructions (Docker, local dev, OpenClaw gateway): [https://siwa.builders.garden/docs/deploy](https://siwa.builders.garden/docs/deploy)

## Prerequisites: Install the SDK

Before using any capabilities, you MUST install the SIWA SDK in your environment:

```bash
npm install @buildersgarden/siwa
```

This gives you access to `@buildersgarden/siwa/keystore` (wallet creation, signing), `@buildersgarden/siwa/siwa` (SIWA authentication), `@buildersgarden/siwa/identity` (IDENTITY.md helpers), and `@buildersgarden/siwa/registry` (onchain lookups). The SDK handles all HMAC proxy authentication internally — you never need to craft raw HTTP calls to the proxy.

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

Proves ownership of your ERC-8004 identity by signing a structured message and receiving a JWT from the server.

```bash
cd /home/node/.openclaw/workspace/siwa/packages/siwa-testing && pnpm run agent sign-in
```

### 6. Full Flow (All Steps)

Runs wallet creation → registration → SIWA sign-in → authenticated API call, all sequentially.

```bash
cd /home/node/.openclaw/workspace/siwa/packages/siwa-testing && pnpm run agent:flow
```

### 7. Run Proxy Tests

Validates that the keyring proxy is working correctly (6 tests).

```bash
cd /home/node/.openclaw/workspace/siwa/packages/siwa-testing && pnpm run agent test-proxy
```

### 8. Reset State

Clears IDENTITY.md to start fresh.

```bash
cd /home/node/.openclaw/workspace/siwa/packages/siwa-testing && pnpm run reset
```

## Signing Policies

The keyring proxy includes a **policy engine** that controls what you can sign. Policies act as guardrails — even if you are compromised, you can only sign operations that match the defined rules.

**Default policy** (auto-attached on wallet creation):

- Transactions up to 0.1 ETH
- All message signing (for SIWA authentication)
- All EIP-7702 authorization signing

Policies can restrict by chain, contract allowlist, spending limits, message patterns, and more. See the full documentation for policy structure and examples: [https://siwa.builders.garden/docs#policies](https://siwa.builders.garden/docs#policies)

**Environment variable**: Set `KEYRING_POLICY_ADMIN_SECRET` on the proxy for a separate admin secret that can create/update/delete policies, while the regular `KEYRING_PROXY_SECRET` can only sign and read policies.

## Important Notes

- **Private keys are NEVER accessible to you.** All signing is delegated to the keyring proxy over HMAC-authenticated HTTP. This is by design — even if you are compromised, the key cannot be extracted.
- **Signing is policy-controlled.** The proxy evaluates every signing request against attached policies before using the key. If no ALLOW rule matches (or any DENY rule fires), the request is rejected.
- **NEVER call the keyring proxy HTTP endpoints directly.** Always use the SDK functions (`createWallet()`, `signMessage()`, etc. from `@buildersgarden/siwa/keystore`) or the CLI commands listed above. The proxy uses a specific HMAC-SHA256 authentication protocol that the SDK handles internally — hand-crafting HTTP requests to the proxy will fail. If you cannot install the SDK, see the "Fallback: Manual HMAC authentication" section in SKILL.md for the exact protocol specification.
- **IDENTITY.md** in `siwa/packages/siwa-testing/` contains your minimal identity state (address, agentId, registry, chainId). Read it to know your current state.
- If a command fails with "Cannot find module", run `cd /home/node/.openclaw/workspace/siwa/packages/siwa-testing && pnpm install` first.

## Architecture

```
You (OpenClaw Agent)          Keyring Proxy (keyring-proxy:3100)     SIWA Server (siwa-server:3000)
  |                             |                                      |
  +-- signMessage() ----------> | 1. Validates HMAC auth               |
  |   (via proxy backend)       | 2. Evaluates policies                |
  |                             | 3. Signs (if policy allows)          |
  |                             | Returns signature only               |
  |                             |                                      |
  +-- SIWA sign-in -------------|------------------------------------> |
  |   (signed challenge)        |                                      | Verifies signature
  |                             |                                      | Returns JWT
```

## Reference

- Full skill documentation: `siwa/SKILL.md`
- Security model: `siwa/references/security-model.md`
- SIWA protocol spec: `siwa/references/siwa-spec.md`
- Signing policies: [https://siwa.builders.garden/docs#policies](https://siwa.builders.garden/docs#policies)
