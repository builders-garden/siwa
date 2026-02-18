---
name: siwa
version: 0.2.0
description: >
  SIWA (Sign-In With Agent) authentication for ERC-8004 registered agents.
---

# SIWA SDK 

Sign-In With Agent (SIWA) lets AI agents authenticate with services using their ERC-8004 onchain identity.

## Install

```bash
npm install @buildersgarden/siwa
```

## Skills

### Agent-Side (Signing)

Choose based on your wallet provider:

- [Bankr](https://siwa.id/skills/bankr/skill.md) — Bankr Agent API wallets
- [Circle](https://siwa.id/skills/circle/skill.md) — Circle developer-controlled wallets
- [Privy](https://siwa.id/skills/privy/skill.md) — Privy server wallets
- [Private Key](https://siwa.id/skills/private-key/skill.md) — Raw private key (viem LocalAccount)
- [Keyring Proxy](https://siwa.id/skills/keyring-proxy/skill.md) — Self-hosted proxy with optional 2FA

### Server-Side (Verification)

- [Server-Side Verification](https://siwa.id/skills/server-side/skill.md) — Next.js, Express, Hono, Fastify

## SDK Modules

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
import { createSIWANonce, verifySIWA, parseSIWAMessage, createClientResolver, parseChainId } from "@buildersgarden/siwa";
import { createMemorySIWANonceStore } from "@buildersgarden/siwa/nonce-store";

// Dynamic client resolver — supports all chains, no hardcoding needed
const resolver = createClientResolver();
const nonceStore = createMemorySIWANonceStore();

// Nonce endpoint — resolve client from agentRegistry
const chainId = parseChainId(agentRegistry)!;
const client = resolver.getClient(chainId);
const nonce = await createSIWANonce(params, client, { nonceStore });

// Verify endpoint — resolve client from the message
const fields = parseSIWAMessage(message);
const verifyChainId = parseChainId(fields.agentRegistry)!;
const verifyClient = resolver.getClient(verifyChainId);
const result = await verifySIWA(
  message,
  signature,
  "api.example.com",
  { nonceStore },
  verifyClient,
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

## x402 Payments (Agent-Side)

When an API requires payment, it returns HTTP **402** with a `Payment-Required` header. The agent decodes the payment options, constructs a signed payment, and retries with a `Payment-Signature` header — all while maintaining SIWA authentication.

### Handling a 402 Response

```typescript
import {
  encodeX402Header,
  decodeX402Header,
  type PaymentRequired,
  type PaymentPayload,
} from "@buildersgarden/siwa/x402";
import { signAuthenticatedRequest } from "@buildersgarden/siwa/erc8128";

// 1. Make initial authenticated request (may get 402)
const signedRequest = await signAuthenticatedRequest(
  new Request("https://api.example.com/premium", { method: "POST" }),
  receipt,
  signer,
  84532,
);

const res = await fetch(signedRequest);

if (res.status === 402) {
  // 2. Decode payment requirements from header
  const header = res.headers.get("Payment-Required");
  const { accepts, resource } = decodeX402Header<PaymentRequired>(header!);

  // 3. Pick a payment option and construct payload
  const option = accepts[0];
  const payload: PaymentPayload = {
    signature: "0x...",  // sign the payment with your wallet
    payment: {
      scheme: option.scheme,
      network: option.network,
      amount: option.amount,
      asset: option.asset,
      payTo: option.payTo,
    },
    resource,
  };

  // 4. Retry with both SIWA auth + payment header
  const retryRequest = await signAuthenticatedRequest(
    new Request("https://api.example.com/premium", {
      method: "POST",
      headers: {
        "Payment-Signature": encodeX402Header(payload),
      },
    }),
    receipt,
    signer,
    84532,
  );

  const paidRes = await fetch(retryRequest);
  // paidRes.headers.get("Payment-Response") contains { txHash, ... }
}
```

### x402 Headers

| Header | Direction | Description |
|--------|-----------|-------------|
| `Payment-Required` | Server → Agent | Base64-encoded JSON with accepted payment options. Sent with 402. |
| `Payment-Signature` | Agent → Server | Base64-encoded signed payment payload. |
| `Payment-Response` | Server → Agent | Base64-encoded settlement result with transaction hash. |

### Pay-Once Sessions

Some endpoints use **pay-once mode**: the first request requires payment, subsequent requests from the same agent to the same resource pass through without payment until the session expires. If you receive a 200 on a previously-paid endpoint, the session is still active — no need to pay again.

---

## Captcha (Reverse CAPTCHA)

SIWA includes a "reverse CAPTCHA" mechanism — inspired by [MoltCaptcha](https://github.com/MoltCaptcha/MoltCaptcha) — that proves an entity **is** an AI agent, not a human. Challenges exploit how LLMs generate text in a single autoregressive pass (satisfying multiple constraints simultaneously), while humans must iterate.

Two integration points:
1. **Sign-in flow** — server requires captcha before issuing a nonce
2. **Per-request** — middleware randomly challenges agents during authenticated API calls

### Agent-Side: Handling a Captcha Challenge

The SDK provides two convenience wrappers for the captcha retry pattern:

#### Sign-In Captcha: `solveCaptchaChallenge()`

```typescript
import { solveCaptchaChallenge } from "@buildersgarden/siwa/captcha";

// 1. Request nonce
const nonceRes = await fetch("/api/siwa/nonce", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ address, agentId, agentRegistry }),
});
const data = await nonceRes.json();

// 2. Detect + solve captcha if required
const captcha = await solveCaptchaChallenge(data, async (challenge) => {
  // LLM generates text satisfying all constraints in a single pass
  // challenge: { topic, format, lineCount, asciiTarget, wordCount?, timeLimitSeconds, ... }
  // Your LLM generates text satisfying all constraints in one pass.
  // Use any provider (Anthropic, OpenAI, etc.) — the solver just returns a string.
  return await generateText(challenge);
});

if (captcha.solved) {
  // 3. Retry with challenge response
  const retryRes = await fetch("/api/siwa/nonce", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, agentId, agentRegistry, challengeResponse: captcha.challengeResponse }),
  });
}
```

#### Per-Request Captcha: `retryWithCaptcha()`

```typescript
import { signAuthenticatedRequest, retryWithCaptcha } from "@buildersgarden/siwa/erc8128";

const url = "https://api.example.com/action";
const body = JSON.stringify({ key: "value" });

// 1. Sign and send
const signed = await signAuthenticatedRequest(
  new Request(url, { method: "POST", body }),
  receipt, signer, chainId,
);
const response = await fetch(signed);

// 2. Detect + solve captcha, re-sign, and get retry request
const result = await retryWithCaptcha(
  response,
  new Request(url, { method: "POST", body }), // fresh request (original body consumed)
  receipt, signer, chainId,
  async (challenge) => generateText(challenge), // your LLM solver
);

if (result.retry) {
  const retryResponse = await fetch(result.request);
}
```

> **Note:** Pass a **fresh, unconsumed** Request to `retryWithCaptcha` — the original is consumed after signing/sending.

### Difficulty Levels

| Level | Time Limit | Constraints |
|-------|-----------|-------------|
| `easy` | 30s | Line count + ASCII sum of first chars |
| `medium` | 20s | + word count |
| `hard` | 15s | + character at specific position |
| `extreme` | 10s | + total character count |

## Links

- [Documentation](https://siwa.id/docs)
- [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004)
- [ERC-8128](https://eips.ethereum.org/EIPS/eip-8128)
