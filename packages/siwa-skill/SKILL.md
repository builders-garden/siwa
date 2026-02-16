---
name: siwa
version: 0.2.0
description: >
  Use this skill to integrate ERC-8004 agent registration and SIWA authentication
  with multiple wallet providers (Privy, Coinbase, Circle, private key, smart accounts, etc.).
---

# SIWA SDK — Wallet Integration

This guide covers **ERC-8004 agent registration** and **SIWA authentication** for applications that already have their own wallet solution. No keyring proxy required.

The SIWA SDK provides a unified `Signer` interface that works with:
- **Agentic wallets** like Privy, Coinbase, Circle, Bankr
- **Private keys** via viem's `LocalAccount`
- **Smart contract wallets** like Safe, ZeroDev/Kernel, Coinbase Smart Wallet (ERC-1271)
- **Self-hosted keyring proxy** with optional 2FA

---

## Quick Start

### 1. Install

```bash
npm install @buildersgarden/siwa
```

### 2. Create a Signer from Your Wallet

Choose the wrapper that matches your wallet provider:

**Option A: Private Key (Backend/Scripts)**

```typescript
import { createLocalAccountSigner } from "@buildersgarden/siwa/signer";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const signer = createLocalAccountSigner(account);
```

**Option B: Circle Developer-Controlled Wallet**

```typescript
import { createCircleSiwaSigner } from "@buildersgarden/siwa/signer";

const signer = await createCircleSiwaSigner({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  walletId: process.env.CIRCLE_WALLET_ID!,
});
```

**Option C: Privy Server Wallet**

```typescript
import { PrivyClient } from "@privy-io/node";
import { createPrivySiwaSigner } from "@buildersgarden/siwa/signer";

const privy = new PrivyClient({
  appId: process.env.PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
});

const signer = createPrivySiwaSigner({
  client: privy,
  walletId: "your-wallet-id",
  walletAddress: "0x...",
});
```

**Option D: viem WalletClient (MetaMask, Coinbase, etc.)**

```typescript
import { createWalletClientSigner } from "@buildersgarden/siwa/signer";
import { createWalletClient, custom } from "viem";
import { baseSepolia } from "viem/chains";

const walletClient = createWalletClient({
  chain: baseSepolia,
  transport: custom(provider),
});
const signer = createWalletClientSigner(walletClient);
```

**Option E: Smart Contract Wallets (Safe, ZeroDev/Kernel)**

```typescript
import { createWalletClientSigner } from "@buildersgarden/siwa/signer";
import { createWalletClient, custom } from "viem";
import { baseSepolia } from "viem/chains";

// Safe example
import Safe from "@safe-global/protocol-kit";
const safe = await Safe.init({ provider, safeAddress });
const walletClient = createWalletClient({
  chain: baseSepolia,
  transport: custom(safe.getProvider()),
});
const signer = createWalletClientSigner(walletClient);

// ZeroDev / Kernel example
const walletClient = kernelClient.toWalletClient();
const signer = createWalletClientSigner(walletClient);
```

**Option F: Bankr Agent API**

```typescript
import { createBankrSiwaSigner } from "@buildersgarden/siwa/signer";

const signer = await createBankrSiwaSigner({
  apiKey: process.env.BANKR_API_KEY!,
});
```

> Bankr wallets are ERC-4337 smart accounts — signatures are verified via ERC-1271 automatically. No extra SDK needed.

**Option G: Keyring Proxy (Self-Hosted)**

```typescript
import { createKeyringProxySigner } from "@buildersgarden/siwa/signer";

const signer = createKeyringProxySigner({
  proxyUrl: process.env.KEYRING_PROXY_URL,
  proxySecret: process.env.KEYRING_PROXY_SECRET,
});
```

### 3. Register as an ERC-8004 Agent

```typescript
import { registerAgent } from "@buildersgarden/siwa/registry";

const result = await registerAgent({
  agentURI: "data:application/json;base64,...",  // or ipfs://...
  chainId: 84532,  // Base Sepolia
  signer,
});

console.log("Registered! Agent ID:", result.agentId);
console.log("Registry:", result.agentRegistry);
```

### 4. Sign In with SIWA

```typescript
import { signSIWAMessage } from "@buildersgarden/siwa";

const { message, signature, address } = await signSIWAMessage({
  domain: "example.com",
  uri: "https://example.com/siwa",
  agentId: result.agentId,
  agentRegistry: result.agentRegistry,
  chainId: 84532,
  nonce: "random-nonce-from-server",
  issuedAt: new Date().toISOString(),
}, signer);

// Send to server for verification
const response = await fetch("https://example.com/siwa/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message, signature }),
});
```

---

## Signer Interface

The SDK uses a simple `Signer` interface:

```typescript
type SignerType = 'eoa' | 'sca';

interface Signer {
  getAddress(): Promise<Address>;
  signMessage(message: string): Promise<Hex>;
  signRawMessage?(rawHex: Hex): Promise<Hex>;
}

interface TransactionSigner extends Signer {
  signTransaction(tx: TransactionRequest): Promise<Hex>;
}
```

- `SignerType` — detected automatically during verification: `'eoa'` for EOA wallets, `'sca'` for smart contract wallets (ERC-1271)
- `createLocalAccountSigner()` and `createKeyringProxySigner()` return `TransactionSigner`
- `createWalletClientSigner()` returns `Signer` (works with both EOA and smart contract wallets)

---

## ERC-8004 Registration

### What is ERC-8004?

ERC-8004 is an onchain agent registry. Registering gives your agent:
- A unique **Agent ID** on a specific chain
- An **Agent Registry** identifier (e.g., `eip155:84532:0x8004...`)
- Onchain **metadata** (name, description, capabilities)
- A foundation for **reputation** tracking

### Creating Agent Metadata

Your agent needs a metadata URI. Two options:

**Option A: Base64 Data URI (Simple, no dependencies)**

```typescript
const metadata = {
  name: "My Agent",
  description: "A helpful AI assistant",
  capabilities: ["chat", "analysis"],
  version: "1.0.0",
};

const encoded = Buffer.from(JSON.stringify(metadata)).toString("base64");
const agentURI = `data:application/json;base64,${encoded}`;
```

**Option B: IPFS (Recommended for production)**

```typescript
const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.PINATA_JWT}`,
  },
  body: JSON.stringify({ pinataContent: metadata }),
});
const { IpfsHash } = await res.json();
const agentURI = `ipfs://${IpfsHash}`;
```

### IMPORTANT: Before Registration

**You MUST ask the user for confirmation before registering.** Registration is an onchain transaction that:
- Costs gas (requires funded wallet)
- Cannot be undone
- Permanently associates metadata with the wallet

**Required confirmations:**
1. **Chain selection** — Ask which chain to register on (Base Sepolia for testing, Base for production)
2. **Metadata review** — Show the user the metadata that will be stored onchain and ask for approval
3. **Gas confirmation** — Inform the user about gas costs

Example confirmation prompt:
```
Ready to register your agent onchain:

  Chain: Base Sepolia (84532)
  Address: 0x1234...abcd

  Metadata:
    Name: Trading Bot
    Description: Automated DeFi trading agent
    Capabilities: swap, liquidity, yield

  Estimated gas: ~0.001 ETH

Do you want to proceed? (yes/no)
```

### Full Registration Example

```typescript
import { createLocalAccountSigner } from "@buildersgarden/siwa/signer";
import { registerAgent } from "@buildersgarden/siwa/registry";
import { ensureIdentityExists, writeIdentityField } from "@buildersgarden/siwa/identity";
import { privateKeyToAccount } from "viem/accounts";

async function registerMyAgent() {
  // 1. Create signer from private key
  const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
  const signer = createLocalAccountSigner(account);

  // 2. Initialize identity file
  const identityPath = "./SIWA_IDENTITY.md";
  ensureIdentityExists(identityPath);

  // 3. Prepare metadata (get from user input!)
  const metadata = {
    name: "Trading Bot",
    description: "Automated DeFi trading agent",
    capabilities: ["swap", "liquidity", "yield"],
  };
  const encoded = Buffer.from(JSON.stringify(metadata)).toString("base64");
  const agentURI = `data:application/json;base64,${encoded}`;

  // 4. Register onchain
  const result = await registerAgent({
    agentURI,
    chainId: 84532,  // Base Sepolia
    signer,
  });

  // 5. Store registration data in SIWA_IDENTITY.md
  const address = await signer.getAddress();
  writeIdentityField("Address", address, identityPath);
  writeIdentityField("Agent ID", String(result.agentId), identityPath);
  writeIdentityField("Agent Registry", result.agentRegistry, identityPath);
  writeIdentityField("Chain ID", "84532", identityPath);

  console.log("Registration successful!");
  console.log("  Agent ID:", result.agentId);
  console.log("  Registry:", result.agentRegistry);
  console.log("  Tx Hash:", result.txHash);
  console.log("  Identity saved to:", identityPath);

  return result;
}
```

### SIWA_IDENTITY.md

After registration, your identity file will contain:

```markdown
# SIWA Identity

- **Address**: `0x1234...abcd`
- **Agent ID**: `42`
- **Agent Registry**: `eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e`
- **Chain ID**: `84532`
```

This file is used by:
- `readIdentity()` to load your agent's identity for SIWA sign-in
- `isRegistered()` to check if registration is complete
- Your application to persist identity across sessions

### Registry Addresses

Read from references/contract-addresses.md
---

## SIWA Authentication

### What is SIWA?

SIWA (Sign-In With Agent) is like "Sign-In With Ethereum" but for registered agents. It proves:
1. Ownership of a wallet address
2. Registration as an ERC-8004 agent
3. The agent's onchain identity (ID + registry)

### Client-Side Flow

```typescript
import { signSIWAMessage } from "@buildersgarden/siwa";
import { createWalletClientSigner } from "@buildersgarden/siwa/signer";

async function signIn(walletClient, agentId, agentRegistry, chainId) {
  const signer = createWalletClientSigner(walletClient);

  // 1. Request nonce from your server
  const nonceRes = await fetch("/api/siwa/nonce", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: await signer.getAddress(),
      agentId,
      agentRegistry,
    }),
  });
  const { nonce, issuedAt, expirationTime } = await nonceRes.json();

  // 2. Sign the SIWA message
  const { message, signature } = await signSIWAMessage({
    domain: window.location.host,
    uri: window.location.origin,
    agentId,
    agentRegistry,
    chainId,
    nonce,
    issuedAt,
    expirationTime,
  }, signer);

  // 3. Verify with server
  const verifyRes = await fetch("/api/siwa/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, signature }),
  });

  const session = await verifyRes.json();
  return session;  // { receipt, agentId, address, signerType, ... }
}
```

### Server-Side Verification

```typescript
import { createSIWANonce, verifySIWA } from "@buildersgarden/siwa";
import { createMemorySIWANonceStore } from "@buildersgarden/siwa/nonce-store";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL),
});
const nonceStore = createMemorySIWANonceStore();

// Nonce endpoint — issue
const nonce = await createSIWANonce(params, client, { nonceStore });

// Verify endpoint — consume
const result = await verifySIWA(
  message,
  signature,
  "api.example.com",
  { nonceStore },
  client,
  { allowedSignerTypes: ['eoa', 'sca'] },  // optional criteria
);

if (result.valid) {
  console.log("Verified agent:", result.agentId);
  console.log("Signer type:", result.signerType); // 'eoa' or 'sca'
}
```

---

## Authenticated API Calls (ERC-8128)

After SIWA sign-in, use the receipt for authenticated requests:

```typescript
import { signAuthenticatedRequest } from "@buildersgarden/siwa/erc8128";
import { createWalletClientSigner } from "@buildersgarden/siwa/signer";

async function callProtectedAPI(walletClient, receipt) {
  const signer = createWalletClientSigner(walletClient);

  const request = new Request("https://api.example.com/agent-action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "execute", params: { ... } }),
  });

  const signedRequest = await signAuthenticatedRequest(
    request,
    receipt,
    signer,
    84532  // chainId
  );

  const response = await fetch(signedRequest);
  return response.json();
}
```

---

## Server Middleware

### Next.js

```typescript
import { withSiwa, siwaOptions } from "@buildersgarden/siwa/next";

export const POST = withSiwa(async (agent, req) => {
  return { agent: { address: agent.address, agentId: agent.agentId } };
}, { allowedSignerTypes: ['eoa', 'sca'] });

export { siwaOptions as OPTIONS };
```

### Express

```typescript
import express from "express";
import { siwaMiddleware, siwaJsonParser, siwaCors } from "@buildersgarden/siwa/express";

const app = express();
app.use(siwaJsonParser());
app.use(siwaCors());

app.get("/api/protected", siwaMiddleware({ allowedSignerTypes: ['eoa'] }), (req, res) => {
  res.json({ agent: req.agent });
});
```

### Fastify

```typescript
import Fastify from "fastify";
import { siwaPlugin, siwaAuth } from "@buildersgarden/siwa/fastify";

const fastify = Fastify();
await fastify.register(siwaPlugin);

fastify.post("/api/protected", { preHandler: siwaAuth() }, async (req) => {
  return { agent: req.agent };
});
```

### Hono

```typescript
import { Hono } from "hono";
import { siwaMiddleware, siwaCors } from "@buildersgarden/siwa/hono";

const app = new Hono();
app.use("*", siwaCors());
app.post("/api/protected", siwaMiddleware(), (c) => {
  return c.json({ agent: c.get("agent") });
});
```

---

## SDK Reference

### Signer Module (`@buildersgarden/siwa/signer`)

| Export | Description |
|--------|-------------|
| `SignerType` | Type: `'eoa' \| 'sca'` — detected during verification |
| `Signer` | Interface for message signing |
| `TransactionSigner` | Extended interface with transaction signing |
| `KeyringProxyConfig` | Type: `{ proxyUrl, proxySecret }` |
| `createLocalAccountSigner(account)` | Create signer from viem LocalAccount |
| `createWalletClientSigner(client, account?)` | Create signer from viem WalletClient |
| `createKeyringProxySigner(config)` | Create signer from keyring proxy server |
| `createCircleSiwaSigner(config)` | Create signer from Circle developer-controlled wallet. Config: `{ apiKey, entitySecret, walletId, walletAddress? }` |
| `createCircleSiwaSignerFromClient(config)` | Create signer from existing Circle client. Config: `{ client, walletId, walletAddress? }` |
| `createPrivySiwaSigner(config)` | Create signer from Privy server wallet. Config: `{ client, walletId, walletAddress }` |
| `createBankrSiwaSigner(config)` | Create signer from Bankr Agent API (ERC-4337 smart account). Config: `{ apiKey?, baseUrl? }`. Reads `BANKR_API_KEY` env var if apiKey omitted. |

### Main Module (`@buildersgarden/siwa`)

| Export | Description |
|--------|-------------|
| `signSIWAMessage(fields, signer)` | Sign a SIWA authentication message |
| `verifySIWA(message, signature, domain, nonceValid, client, criteria?)` | Verify SIWA signature + onchain registration. Criteria: `allowedSignerTypes`, `requiredServices`, `requiredTrust`, `minScore`, `custom`. Result includes `signerType`. |
| `parseSIWAMessage(message)` | Parse SIWA message string to fields |
| `buildSIWAMessage(fields)` | Build SIWA message from fields |

### Registry Module (`@buildersgarden/siwa/registry`)

| Export | Description |
|--------|-------------|
| `registerAgent(options)` | Register as ERC-8004 agent onchain |
| `getAgent(id, registry, client)` | Read agent profile from registry |
| `getReputation(id, registry, client)` | Read agent reputation |

### ERC-8128 Module (`@buildersgarden/siwa/erc8128`)

| Export | Description |
|--------|-------------|
| `signAuthenticatedRequest(req, receipt, signer, chainId, options?)` | Sign HTTP request with ERC-8128. Options: `{ signerAddress }` for TBA identity override. |
| `verifyAuthenticatedRequest(req, options)` | Verify signed HTTP request. Options accept `allowedSignerTypes`. Result includes `signerType`. |
| `createErc8128Signer(signer, chainId, options?)` | Create ERC-8128 HTTP signer from SIWA Signer |

### Receipt Module (`@buildersgarden/siwa/receipt`)

| Export | Description |
|--------|-------------|
| `createReceipt(payload, options)` | Create HMAC-signed receipt. Payload: `{ address, agentId, agentRegistry, chainId, verified, signerType? }`. Options: `{ secret, ttl? }` (ttl in ms, default 30min). Returns `{ receipt, expiresAt }`. |
| `verifyReceipt(receipt, secret)` | Verify and decode receipt. Returns `ReceiptPayload` (address, agentId, agentRegistry, chainId, verified, signerType?, iat, exp) or `null`. |
| `DEFAULT_RECEIPT_TTL` | Default receipt validity: 30 minutes (1800000 ms) |
| `ReceiptPayload` | Type: `{ address, agentId, agentRegistry, chainId, verified, signerType?, iat, exp }` |
| `ReceiptOptions` | Type: `{ secret, ttl? }` |
| `ReceiptResult` | Type: `{ receipt, expiresAt }` |

### Token Bound Accounts Module (`@buildersgarden/siwa/tba`)

| Export | Description |
|--------|-------------|
| `ERC6551_REGISTRY` | Canonical ERC-6551 registry address |
| `computeTbaAddress(params)` | Compute deterministic Token Bound Account address for an NFT |
| `isTbaForAgent(params)` | Check if a signer address matches the expected Token Bound Account for an agent |

### Next.js Module (`@buildersgarden/siwa/next`)

| Export | Description |
|--------|-------------|
| `withSiwa(handler, options?)` | Wrap route handler with ERC-8128 auth. Handler: `(agent: SiwaAgent, req: Request) => object \| Response`. Options: `WithSiwaOptions`. |
| `siwaOptions()` | Return 204 OPTIONS response with CORS headers. Use: `export { siwaOptions as OPTIONS }` |
| `corsJson(data, init?)` | JSON Response with CORS headers. `init: { status?: number }` |
| `corsHeaders()` | Returns CORS headers object for manual use |
| `WithSiwaOptions` | Type: `{ receiptSecret?, rpcUrl?, verifyOnchain?, allowedSignerTypes? }` |
| `SiwaAgent` | Type: `{ address, agentId, agentRegistry, chainId, signerType? }` |

### Express Module (`@buildersgarden/siwa/express`)

| Export | Description |
|--------|-------------|
| `siwaMiddleware(options?)` | Auth middleware. Sets `req.agent` on success. Options: `SiwaMiddlewareOptions`. |
| `siwaJsonParser()` | JSON parser with rawBody capture for Content-Digest verification |
| `siwaCors(options?)` | CORS middleware with SIWA headers. Options: `SiwaCorsOptions` |
| `SiwaMiddlewareOptions` | Type: `{ receiptSecret?, rpcUrl?, verifyOnchain?, publicClient?, allowedSignerTypes? }` |

### Fastify Module (`@buildersgarden/siwa/fastify`)

| Export | Description |
|--------|-------------|
| `siwaPlugin` | Fastify plugin: sets up CORS with SIWA headers. Uses `@fastify/cors` if installed, manual fallback otherwise. |
| `siwaAuth(options?)` | preHandler hook: verifies ERC-8128 signature + receipt. Sets `req.agent` on success. Options: `SiwaAuthOptions`. |
| `SiwaAuthOptions` | Type: `{ receiptSecret?, rpcUrl?, verifyOnchain?, publicClient?, allowedSignerTypes? }` |
| `SiwaPluginOptions` | Type: `{ origin?, allowedHeaders? }` |

### Hono Module (`@buildersgarden/siwa/hono`)

| Export | Description |
|--------|-------------|
| `siwaMiddleware(options?)` | Auth middleware: verifies ERC-8128 signature + receipt. Sets `c.set("agent", agent)` on success. Options: `SiwaMiddlewareOptions`. |
| `siwaCors(options?)` | CORS middleware with SIWA headers. Handles OPTIONS preflight. Options: `SiwaCorsOptions`. |
| `SiwaMiddlewareOptions` | Type: `{ receiptSecret?, rpcUrl?, verifyOnchain?, publicClient?, allowedSignerTypes? }` |

### Nonce Store Module (`@buildersgarden/siwa/nonce-store`)

| Export | Description |
|--------|-------------|
| `SIWANonceStore` | Interface: `{ issue(nonce, ttlMs): Promise<boolean>, consume(nonce): Promise<boolean> }` |
| `createMemorySIWANonceStore()` | In-memory store with TTL expiry. Single-process only. |
| `createRedisSIWANonceStore(redis, prefix?)` | Redis-backed store. Uses `SET ... PX ... NX` + `DEL`. Default prefix: `"siwa:nonce:"`. |
| `createKVSIWANonceStore(kv, prefix?)` | Cloudflare Workers KV store. Uses `put` with `expirationTtl` + `get`/`delete`. |
| `RedisLikeClient` | Interface: `{ set(...args): Promise<unknown>, del(...args): Promise<number> }` — satisfied by ioredis and node-redis. |
| `KVNamespaceLike` | Interface: `{ put(key, value, options?), get(key), delete(key) }` — satisfied by Cloudflare KV bindings. |

### Identity Module (`@buildersgarden/siwa/identity`)

| Export | Description |
|--------|-------------|
| `ensureIdentityExists(path, template?)` | Initialize SIWA_IDENTITY.md if missing |
| `readIdentity(path)` | Parse SIWA_IDENTITY.md to typed object |
| `writeIdentityField(key, value, path)` | Write a field to SIWA_IDENTITY.md |
| `isRegistered({ identityPath, client? })` | Check registration status |

---

## Token Bound Accounts (TBA)

If your agent uses an ERC-6551 Token Bound Account as its signer (instead of the wallet that owns the NFT), use the TBA utilities:

```typescript
import { computeTbaAddress, isTbaForAgent } from "@buildersgarden/siwa/tba";

// Compute the deterministic TBA address for an agent NFT
const tbaAddress = computeTbaAddress({
  implementation: "0x...TBAImpl",
  tokenContract: "0x...AgentRegistry",
  tokenId: 42n,
  chainId: 84532,
});

// Verify a signer is the expected TBA for an agent
const valid = isTbaForAgent({
  signerAddress: "0x...",
  implementation: "0x...TBAImpl",
  agentRegistry: "0x...AgentRegistry",
  agentId: 42,
  chainId: 84532,
});
```

When signing with a TBA, pass `signerAddress` to ERC-8128 so the keyid identifies the TBA:

```typescript
const signed = await signAuthenticatedRequest(
  request, receipt, signer, 84532,
  { signerAddress: tbaAddress },
);
```

---

## Troubleshooting

**"User rejected the request"** — User denied the signature request in their wallet

**"Insufficient funds"** — Wallet needs ETH for gas (registration is an onchain tx)

**"Agent not found"** — The agent ID doesn't exist in the specified registry

**"Signature verification failed"** — Message was modified or wrong signer

**"Nonce already used"** — Replay attack prevented; get a fresh nonce

**"Signer type not allowed"** — The server's `allowedSignerTypes` policy rejected the signer (EOA vs SCA)

---

## Further Reading

- [ERC-8004 Specification](https://eips.ethereum.org/EIPS/eip-8004) — Agent Registry standard
- [SIWA Protocol](references/siwa-spec.md) — Full authentication specification
- [ERC-8128](https://eips.ethereum.org/EIPS/eip-8128) — HTTP Message Signatures
- [viem Documentation](https://viem.sh) — Ethereum TypeScript library
