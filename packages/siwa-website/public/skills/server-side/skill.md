---
name: siwa-server-side
version: 0.3.0
description: >
  Server-side SIWA verification for Next.js, Express, Hono, and Fastify.
---

# SIWA Server-Side Verification

Verify SIWA authentication and protect API routes with ERC-8128 signed requests.

## Install

```bash
npm install @buildersgarden/siwa viem
```

## Overview

Server-side verification requires three parts:

1. **Nonce Endpoint** (`/siwa/nonce`) — Issue a nonce for the agent to sign
2. **Verify Endpoint** (`/siwa/verify`) — Verify the signed message and issue a receipt
3. **ERC-8128 Middleware** — Verify subsequent API requests using the receipt

The SDK includes a **client resolver** that dynamically resolves the correct RPC endpoint and viem `PublicClient` for any chain — no hardcoded chain config needed.

---

## Nonce Endpoint

Issue a nonce for the agent to include in their SIWA message. The nonce prevents replay attacks. The agent sends its `agentRegistry` (e.g. `eip155:8453:0x...`), and the server uses `parseChainId` to resolve the right chain automatically.

### Next.js

```typescript
// app/api/siwa/nonce/route.ts
import { createSIWANonce } from "@buildersgarden/siwa";
import { corsJson, siwaOptions } from "@buildersgarden/siwa/next";
import { createClientResolver, parseChainId } from "@buildersgarden/siwa/client-resolver";

const resolver = createClientResolver();

// Simple in-memory nonce store (use Redis in production)
const nonceStore = new Map<string, number>();

export async function POST(req: Request) {
  const { address, agentId, agentRegistry } = await req.json();

  const chainId = parseChainId(agentRegistry);
  if (!chainId) {
    return corsJson({ error: "Invalid agentRegistry format" }, { status: 400 });
  }

  const client = resolver.getClient(chainId);

  const result = await createSIWANonce(
    { address, agentId, agentRegistry },
    client,
  );

  // Store nonce for verification
  nonceStore.set(result.nonce, Date.now());

  return corsJson({
    nonce: result.nonce,
    issuedAt: result.issuedAt,
    expirationTime: result.expirationTime,
  });
}

export { siwaOptions as OPTIONS };
```

### Express

```typescript
// routes/siwa.ts
import express from "express";
import { createSIWANonce } from "@buildersgarden/siwa";
import { siwaCors, siwaJsonParser } from "@buildersgarden/siwa/express";
import { createClientResolver, parseChainId } from "@buildersgarden/siwa/client-resolver";

const router = express.Router();
router.use(siwaJsonParser());
router.use(siwaCors());

const resolver = createClientResolver();
const nonceStore = new Map<string, number>();

router.post("/nonce", async (req, res) => {
  const { address, agentId, agentRegistry } = req.body;

  const chainId = parseChainId(agentRegistry);
  if (!chainId) {
    return res.status(400).json({ error: "Invalid agentRegistry format" });
  }

  const client = resolver.getClient(chainId);

  const result = await createSIWANonce(
    { address, agentId, agentRegistry },
    client,
  );

  nonceStore.set(result.nonce, Date.now());

  res.json({
    nonce: result.nonce,
    issuedAt: result.issuedAt,
    expirationTime: result.expirationTime,
  });
});

export default router;
```

### Hono

```typescript
// src/routes/siwa.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createSIWANonce } from "@buildersgarden/siwa";
import { createClientResolver, parseChainId } from "@buildersgarden/siwa/client-resolver";

const app = new Hono();

app.use("*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "X-SIWA-Receipt", "Signature", "Signature-Input", "Content-Digest"],
}));

const resolver = createClientResolver();
const nonceStore = new Map<string, number>();

app.post("/nonce", async (c) => {
  const { address, agentId, agentRegistry } = await c.req.json();

  const chainId = parseChainId(agentRegistry);
  if (!chainId) {
    return c.json({ error: "Invalid agentRegistry format" }, 400);
  }

  const client = resolver.getClient(chainId);

  const result = await createSIWANonce(
    { address, agentId, agentRegistry },
    client,
  );

  nonceStore.set(result.nonce, Date.now());

  return c.json({
    nonce: result.nonce,
    issuedAt: result.issuedAt,
    expirationTime: result.expirationTime,
  });
});

export default app;
```

### Fastify

```typescript
// src/routes/siwa.ts
import { FastifyPluginAsync } from "fastify";
import { createSIWANonce } from "@buildersgarden/siwa";
import { createClientResolver, parseChainId } from "@buildersgarden/siwa/client-resolver";

const resolver = createClientResolver();
const nonceStore = new Map<string, number>();

const siwaRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/nonce", async (req) => {
    const { address, agentId, agentRegistry } = req.body as {
      address: string;
      agentId: number;
      agentRegistry: string;
    };

    const chainId = parseChainId(agentRegistry);
    if (!chainId) {
      throw fastify.httpErrors.badRequest("Invalid agentRegistry format");
    }

    const client = resolver.getClient(chainId);

    const result = await createSIWANonce(
      { address, agentId, agentRegistry },
      client,
    );

    nonceStore.set(result.nonce, Date.now());

    return {
      nonce: result.nonce,
      issuedAt: result.issuedAt,
      expirationTime: result.expirationTime,
    };
  });
};

export default siwaRoutes;
```

---

## Verify Endpoint

Verify the signed SIWA message and issue an HMAC receipt. The chain is resolved from the `agentRegistry` field in the signed message.

### Next.js

```typescript
// app/api/siwa/verify/route.ts
import { verifySIWA, parseSIWAMessage } from "@buildersgarden/siwa";
import { createReceipt } from "@buildersgarden/siwa/receipt";
import { corsJson, siwaOptions } from "@buildersgarden/siwa/next";
import { createClientResolver, parseChainId } from "@buildersgarden/siwa/client-resolver";

const resolver = createClientResolver();

// Shared with nonce endpoint
const nonceStore = new Map<string, number>();

export async function POST(req: Request) {
  const { message, signature } = await req.json();

  const fields = parseSIWAMessage(message);
  const chainId = parseChainId(fields.agentRegistry);
  if (!chainId) {
    return corsJson({ error: "Invalid agentRegistry in message" }, { status: 400 });
  }

  const client = resolver.getClient(chainId);

  const result = await verifySIWA(
    message,
    signature,
    "api.example.com",
    (nonce) => {
      if (!nonceStore.has(nonce)) return false;
      nonceStore.delete(nonce); // consume nonce
      return true;
    },
    client,
  );

  if (!result.valid) {
    return corsJson({ error: result.error }, { status: 401 });
  }

  const { receipt } = createReceipt({
    address: result.address,
    agentId: result.agentId,
    agentRegistry: result.agentRegistry,
    chainId: result.chainId,
    signerType: result.signerType,
  }, { secret: process.env.RECEIPT_SECRET! });

  return corsJson({ receipt, agentId: result.agentId });
}

export { siwaOptions as OPTIONS };
```

### Express

```typescript
// routes/siwa.ts (add to same router)
import { parseSIWAMessage } from "@buildersgarden/siwa";

router.post("/verify", async (req, res) => {
  const { message, signature } = req.body;

  const fields = parseSIWAMessage(message);
  const chainId = parseChainId(fields.agentRegistry);
  if (!chainId) {
    return res.status(400).json({ error: "Invalid agentRegistry in message" });
  }

  const client = resolver.getClient(chainId);

  const result = await verifySIWA(
    message,
    signature,
    "api.example.com",
    (nonce) => {
      if (!nonceStore.has(nonce)) return false;
      nonceStore.delete(nonce);
      return true;
    },
    client,
  );

  if (!result.valid) {
    return res.status(401).json({ error: result.error });
  }

  const { receipt } = createReceipt({
    address: result.address,
    agentId: result.agentId,
    agentRegistry: result.agentRegistry,
    chainId: result.chainId,
    signerType: result.signerType,
  }, { secret: process.env.RECEIPT_SECRET! });

  res.json({ receipt, agentId: result.agentId });
});
```

### Hono

```typescript
// src/routes/siwa.ts (add to same app)
import { parseSIWAMessage } from "@buildersgarden/siwa";

app.post("/verify", async (c) => {
  const { message, signature } = await c.req.json();

  const fields = parseSIWAMessage(message);
  const chainId = parseChainId(fields.agentRegistry);
  if (!chainId) {
    return c.json({ error: "Invalid agentRegistry in message" }, 400);
  }

  const client = resolver.getClient(chainId);

  const result = await verifySIWA(
    message,
    signature,
    "api.example.com",
    (nonce) => {
      if (!nonceStore.has(nonce)) return false;
      nonceStore.delete(nonce);
      return true;
    },
    client,
  );

  if (!result.valid) {
    return c.json({ error: result.error }, 401);
  }

  const { receipt } = createReceipt({
    address: result.address,
    agentId: result.agentId,
    agentRegistry: result.agentRegistry,
    chainId: result.chainId,
    signerType: result.signerType,
  }, { secret: process.env.RECEIPT_SECRET! });

  return c.json({ receipt, agentId: result.agentId });
});
```

### Fastify

```typescript
// src/routes/siwa.ts (add to same plugin)
import { parseSIWAMessage } from "@buildersgarden/siwa";

fastify.post("/verify", async (req, reply) => {
  const { message, signature } = req.body as { message: string; signature: string };

  const fields = parseSIWAMessage(message);
  const chainId = parseChainId(fields.agentRegistry);
  if (!chainId) {
    return reply.status(400).send({ error: "Invalid agentRegistry in message" });
  }

  const client = resolver.getClient(chainId);

  const result = await verifySIWA(
    message,
    signature,
    "api.example.com",
    (nonce) => {
      if (!nonceStore.has(nonce)) return false;
      nonceStore.delete(nonce);
      return true;
    },
    client,
  );

  if (!result.valid) {
    return reply.status(401).send({ error: result.error });
  }

  const { receipt } = createReceipt({
    address: result.address,
    agentId: result.agentId,
    agentRegistry: result.agentRegistry,
    chainId: result.chainId,
    signerType: result.signerType,
  }, { secret: process.env.RECEIPT_SECRET! });

  return { receipt, agentId: result.agentId };
});
```

---

## Protected Routes (ERC-8128 Middleware)

After sign-in, protect API routes with ERC-8128 signature verification.

### Next.js

```typescript
// app/api/protected/route.ts
import { withSiwa, siwaOptions } from "@buildersgarden/siwa/next";

export const POST = withSiwa(async (agent, req) => {
  const body = await req.json();
  return { received: body, agent };
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

app.post("/api/protected", siwaMiddleware(), (req, res) => {
  res.json({ agent: req.agent });
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

---

## Client Resolver

The `createClientResolver` factory lazily creates and caches viem `PublicClient` instances per chain ID — no need to hardcode chain imports or a single RPC URL.

### RPC Resolution Order

1. Explicit `rpcOverrides` map passed to `createClientResolver()`
2. Environment variable `RPC_URL_{chainId}` (e.g. `RPC_URL_8453`)
3. Built-in defaults from the SDK (Base, Base Sepolia, Ethereum, Sepolia, Linea Sepolia, Amoy)

### Options

```typescript
import { createClientResolver } from "@buildersgarden/siwa/client-resolver";

// Default — uses built-in RPCs + env vars
const resolver = createClientResolver();

// With explicit overrides and chain restrictions
const resolver = createClientResolver({
  rpcOverrides: {
    8453: "https://my-base-rpc.example.com",
    42161: "https://my-arbitrum-rpc.example.com",
  },
  allowedChainIds: [8453, 84532, 42161],
});

resolver.getClient(8453);        // returns cached PublicClient
resolver.isSupported(42161);     // true
resolver.supportedChainIds();    // [8453, 84532, 42161]
```

### `parseChainId`

Extracts the chain ID from an `eip155:{chainId}:{address}` agent registry string:

```typescript
import { parseChainId } from "@buildersgarden/siwa/client-resolver";

parseChainId("eip155:8453:0xAbc...");  // 8453
parseChainId("invalid");               // null
```

---

## Middleware Options

| Option | Type | Description |
|--------|------|-------------|
| `receiptSecret` | `string` | HMAC secret. Defaults to `RECEIPT_SECRET` env. |
| `allowedSignerTypes` | `('eoa' \| 'sca')[]` | Restrict to EOA or smart contract accounts. |
| `verifyOnchain` | `boolean` | Re-check ownerOf on every request. |
| `rpcUrl` | `string` | RPC URL for onchain verification. |
| `publicClient` | `PublicClient` | viem client for ERC-1271 signatures. |

---

## Environment Variables

```bash
RECEIPT_SECRET=your-hmac-secret-min-32-chars

# Per-chain RPC overrides (optional — SDK includes defaults)
RPC_URL_8453=https://mainnet.base.org
RPC_URL_84532=https://sepolia.base.org
RPC_URL_42161=https://arb1.arbitrum.io/rpc
```
