---
name: siwa-server
version: 0.2.0
description: >
  Use this skill to implement server-side SIWA verification. For backends and APIs
  that need to authenticate ERC-8004 agents without signing capabilities.
---

# SIWA Server-Side Verification

This guide covers **server-side SIWA verification** for backends and APIs that need to authenticate agents. No wallet or signing required — only verification.

For full API reference and advanced options, see [https://siwa.id/docs](https://siwa.id/docs).

---

## Quick Start

### 1. Install

```bash
npm install @buildersgarden/siwa viem
```

### 2. Set Environment Variables

```bash
SIWA_SECRET=your-32-byte-random-secret
RPC_URL=https://sepolia.base.org
```

---

## Framework Middleware

The SDK provides pre-built middleware that handles SIWA sign-in (nonce + verify), ERC-8128 request verification, receipts, and CORS — all in a few lines.

### Next.js

```typescript
import { withSiwa, siwaOptions } from "@buildersgarden/siwa/next";

export const POST = withSiwa(async (agent, req) => {
  const body = await req.json();
  return { agent: { address: agent.address, agentId: agent.agentId }, received: body };
}, {
  receiptSecret: process.env.SIWA_SECRET!,
  allowedSignerTypes: ['eoa', 'sca'],
});

export { siwaOptions as OPTIONS };
```

### Express

```typescript
import express from "express";
import { siwaMiddleware, siwaJsonParser, siwaCors } from "@buildersgarden/siwa/express";

const app = express();
app.use(siwaJsonParser());
app.use(siwaCors());

app.get("/api/protected", siwaMiddleware({
  receiptSecret: process.env.SIWA_SECRET!,
}), (req, res) => {
  res.json({ agent: req.agent });
});
```

### Fastify

```typescript
import Fastify from "fastify";
import { siwaPlugin, siwaAuth } from "@buildersgarden/siwa/fastify";

const fastify = Fastify();
await fastify.register(siwaPlugin);

fastify.post("/api/protected", {
  preHandler: siwaAuth({
    receiptSecret: process.env.SIWA_SECRET!,
    allowedSignerTypes: ['eoa'],
  }),
}, async (req) => {
  return { agent: req.agent };
});

await fastify.listen({ port: 3000 });
```

### Hono

```typescript
import { Hono } from "hono";
import { siwaMiddleware, siwaCors } from "@buildersgarden/siwa/hono";

const app = new Hono();
app.use("*", siwaCors());

app.post("/api/protected", siwaMiddleware({
  receiptSecret: process.env.SIWA_SECRET!,
}), (c) => {
  return c.json({ agent: c.get("agent") });
});

export default app;
```

---

## x402 Payment Middleware

Add pay-per-request or pay-once monetization to any SIWA-protected endpoint. The middleware enforces: **SIWA authentication first** (401), then **payment verification** (402).

### Server Setup

```typescript
import { createFacilitatorClient, type X402Config } from "@buildersgarden/siwa/x402";

const facilitator = createFacilitatorClient({
  url: "https://api.cdp.coinbase.com/platform/v2/x402",
});

const x402: X402Config = {
  facilitator,
  resource: { url: "/api/premium", description: "Premium data" },
  accepts: [{
    scheme: "exact",
    network: "eip155:84532",
    amount: "1000000",  // 1 USDC (6 decimals)
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    payTo: "0xYourAddress",
    maxTimeoutSeconds: 60,
  }],
};
```

### Pay-Once Sessions

```typescript
import { createMemoryX402SessionStore } from "@buildersgarden/siwa/x402";

const x402WithSession: X402Config = {
  ...x402,
  session: {
    store: createMemoryX402SessionStore(),
    ttl: 3_600_000,  // 1 hour
  },
};
```

### Framework Examples

**Next.js:**
```typescript
export const POST = withSiwa(async (agent, req, payment) => {
  return { agent, txHash: payment?.txHash };
}, { x402 });
export const OPTIONS = () => siwaOptions({ x402: true });
```

**Express:**
```typescript
app.post("/api/premium", siwaMiddleware({ x402 }), (req, res) => {
  res.json({ agent: req.agent, txHash: req.payment?.txHash });
});
app.use(siwaCors({ x402: true }));
```

**Hono:**
```typescript
app.use("*", siwaCors({ x402: true }));
app.post("/api/premium", siwaMiddleware({ x402 }), (c) => {
  return c.json({ agent: c.get("agent"), txHash: c.get("payment")?.txHash });
});
```

**Fastify:**
```typescript
await fastify.register(siwaPlugin, { x402: true });
fastify.post("/api/premium", { preHandler: siwaAuth({ x402 }) }, async (req) => {
  return { agent: req.agent, txHash: req.payment?.txHash };
});
```

---

## Verification Options

```typescript
verifySIWA(
  message: string,          // Full SIWA message string
  signature: string,        // EIP-191 signature hex
  expectedDomain: string,   // Must match message domain
  nonceValid: NonceValidator, // Nonce validation (see below)
  client: PublicClient,     // viem client for onchain checks
  criteria?: SIWAVerifyCriteria, // Optional verification criteria
)

// NonceValidator: callback, stateless token, or nonce store
type NonceValidator =
  | ((nonce: string) => boolean | Promise<boolean>)
  | { nonceToken: string; secret: string }
  | { nonceStore: SIWANonceStore };
```

### Using Nonce Stores

```typescript
import { createSIWANonce, verifySIWA } from "@buildersgarden/siwa";
import { createMemorySIWANonceStore } from "@buildersgarden/siwa/nonce-store";

const nonceStore = createMemorySIWANonceStore();

// Issue nonce
const nonce = await createSIWANonce(params, client, { nonceStore });

// Verify — nonceStore consumes the nonce automatically
const result = await verifySIWA(
  message, signature, "example.com",
  { nonceStore },
  client,
  { allowedSignerTypes: ['eoa'] },
);
```

Available stores: `createMemorySIWANonceStore()` (single-process), `createRedisSIWANonceStore(redis)` (multi-instance), `createKVSIWANonceStore(kv)` (Cloudflare Workers).

---

## Captcha (Reverse CAPTCHA)

Servers can challenge agents at sign-in or during authenticated requests to prove they are AI agents.

### Sign-In Captcha

```typescript
import { createSIWANonce } from "@buildersgarden/siwa";

const result = await createSIWANonce(
  { address, agentId, agentRegistry },
  client,
  {
    secret: SIWA_SECRET,
    captchaPolicy: async ({ address }) => {
      const known = await db.agents.exists(address);
      return known ? null : 'medium';
    },
    captchaOptions: { secret: SIWA_SECRET },
  },
);

if (result.status === 'captcha_required') {
  return res.json(result);  // Agent solves and resubmits
}
```

### Per-Request Captcha

```typescript
export const POST = withSiwa(handler, {
  captchaPolicy: () => Math.random() < 0.05 ? 'easy' : null,
  captchaOptions: { secret: process.env.SIWA_SECRET! },
});
```

| Level | Time Limit | Constraints |
|-------|-----------|-------------|
| `easy` | 30s | Line count + ASCII sum of first chars |
| `medium` | 20s | + word count |
| `hard` | 15s | + character at specific position |
| `extreme` | 10s | + total character count |

---

## Security Notes

- **Nonce stores** handle issue + consume atomically — use Redis for production (memory store is single-process only)
- **Domain verification** prevents SIWA messages signed for other services from being reused
- **Receipt secrets** should be 32+ random bytes, rotated periodically, never exposed to clients
- **Clock tolerance** defaults to 60 seconds — adjust based on your requirements

---

## Further Reading

- [Full Documentation](https://siwa.id/docs) — Complete API reference, advanced options, and examples
- [SIWA Protocol Specification](references/siwa-spec.md)
- [ERC-8004 Registry](https://eips.ethereum.org/EIPS/eip-8004)
- [ERC-8128 HTTP Signatures](https://eips.ethereum.org/EIPS/eip-8128)
