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

```typescript
import { parseSIWAMessage, verifySIWA, createClientResolver, parseChainId } from "@buildersgarden/siwa";

// Dynamic client resolver — supports all chains, no hardcoding needed
const resolver = createClientResolver();

async function verifyAgent(message: string, signature: string) {
  const fields = parseSIWAMessage(message);
  const chainId = parseChainId(fields.agentRegistry);
  const client = resolver.getClient(chainId!);

  const result = await verifySIWA(
    message,
    signature,
    "api.example.com",
    (nonce) => validateAndConsumeNonce(nonce),
    client,
  );

  if (!result.valid) {
    throw new Error(result.error);
  }

  return {
    address: result.address,
    agentId: result.agentId,
    verified: result.verified,  // "onchain" | "offline"
  };
}
```

---

## Framework Middleware

The SDK provides pre-built middleware that handles SIWA sign-in (nonce + verify), ERC-8128 request verification, receipts, and CORS — all in a few lines.

---

## Complete Server Implementation

### Express.js

```typescript
import express from "express";
import { randomBytes } from "crypto";
import { parseSIWAMessage, verifySIWA, createClientResolver, parseChainId } from "@buildersgarden/siwa";
import { createReceipt, verifyReceipt } from "@buildersgarden/siwa/receipt";
import { verifyAuthenticatedRequest } from "@buildersgarden/siwa/erc8128";

const app = express();
app.use(express.json());

// Dynamic client resolver — supports all chains, no hardcoding needed
const resolver = createClientResolver();

// In-memory nonce store (use Redis in production)
const nonceStore = new Map<string, { nonce: string; expires: number }>();

const SIWA_SECRET = process.env.SIWA_SECRET || "change-me-in-production";

// ─── Nonce Endpoint ──────────────────────────────────────────────────

app.post("/api/siwa/nonce", (req, res) => {
  const { address, agentId, agentRegistry } = req.body;

  if (!address || agentId === undefined || !agentRegistry) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const nonce = randomBytes(16).toString("hex");
  const issuedAt = new Date().toISOString();
  const expirationTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Store nonce with expiration
  const key = `${address}:${agentId}:${agentRegistry}`;
  nonceStore.set(key, { nonce, expires: Date.now() + 10 * 60 * 1000 });

  const chainId = parseChainId(agentRegistry);
  res.json({ nonce, issuedAt, expirationTime, chainId });
});

// ─── Verify Endpoint ─────────────────────────────────────────────────

app.post("/api/siwa/verify", async (req, res) => {
  const { message, signature } = req.body;

  if (!message || !signature) {
    return res.status(400).json({ error: "Missing message or signature" });
  }

  try {
    // 1. Parse the SIWA message and resolve the client for this chain
    const fields = parseSIWAMessage(message);
    const chainId = parseChainId(fields.agentRegistry);
    if (!chainId) {
      return res.status(400).json({ error: "Invalid agentRegistry format" });
    }
    const client = resolver.getClient(chainId);

    // 2. Verify nonce was issued by us
    const key = `${fields.address}:${fields.agentId}:${fields.agentRegistry}`;
    const stored = nonceStore.get(key);

    if (!stored) {
      return res.status(401).json({ error: "Invalid or expired nonce" });
    }

    if (stored.nonce !== fields.nonce) {
      return res.status(401).json({ error: "Nonce mismatch" });
    }

    if (Date.now() > stored.expires) {
      nonceStore.delete(key);
      return res.status(401).json({ error: "Nonce expired" });
    }

    // 3. Verify signature and onchain registration
    const result = await verifySIWA(
      message,
      signature,
      process.env.DOMAIN || "localhost",
      (nonce) => {
        // Validate nonce was issued by us and consume it
        if (stored.nonce !== nonce) return false;
        nonceStore.delete(key);
        return true;
      },
      client,
    );

    if (!result.valid) {
      return res.status(401).json({ error: result.error });
    }

    // 4. Create receipt for authenticated API calls
    const { receipt } = createReceipt({
      address: result.address,
      agentId: result.agentId,
      agentRegistry: result.agentRegistry,
      chainId: result.chainId,
      verified: result.verified,
    }, {
      secret: SIWA_SECRET,
      ttl: 3600_000,  // 1 hour in ms
    });

    res.json({
      success: true,
      address: result.address,
      agentId: result.agentId,
      verified: result.verified,
      receipt,
    });

  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ─── Protected Endpoint (ERC-8128) ───────────────────────────────────

app.post("/api/agent-action", async (req, res) => {
  try {
    // Verify the ERC-8128 signed request
    const result = await verifyAuthenticatedRequest(req, {
      receiptSecret: SIWA_SECRET,
    });

    if (!result.valid) {
      return res.status(401).json({ error: result.error });
    }

    // Access verified agent info
    const { address, agentId } = result.agent;

    // Process the action
    const { action, params } = req.body;

    res.json({
      success: true,
      agent: { address, agentId, verified },
      result: `Processed ${action} for agent #${agentId}`,
    });

  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log("SIWA server running on http://localhost:3000");
});
```

### Next.js App Router

**lib/siwa-resolver.ts** (shared module)

```typescript
import { createClientResolver, createMemorySIWANonceStore } from "@buildersgarden/siwa";

export const resolver = createClientResolver();
export const nonceStore = createMemorySIWANonceStore();
```

**app/api/siwa/nonce/route.ts**

```typescript
import { NextResponse } from "next/server";
import { createSIWANonce, parseChainId } from "@buildersgarden/siwa";
import { resolver, nonceStore } from "@/lib/siwa-resolver";

export async function POST(req: Request) {
  const { address, agentId, agentRegistry } = await req.json();

  if (!address || agentId === undefined || !agentRegistry) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const chainId = parseChainId(agentRegistry);
  if (!chainId) {
    return NextResponse.json({ error: "Invalid agentRegistry format" }, { status: 400 });
  }

  const client = resolver.getClient(chainId);
  const result = await createSIWANonce(
    { address, agentId, agentRegistry },
    client,
    { nonceStore },
  );

  if (result.status !== "nonce_issued") {
    return NextResponse.json(result, { status: 403 });
  }

  return NextResponse.json({
    nonce: result.nonce,
    issuedAt: result.issuedAt,
    expirationTime: result.expirationTime,
    chainId,
  });
}
```

**app/api/siwa/verify/route.ts**

```typescript
import { NextResponse } from "next/server";
import { parseSIWAMessage, verifySIWA, parseChainId } from "@buildersgarden/siwa";
import { createReceipt } from "@buildersgarden/siwa/receipt";
import { resolver, nonceStore } from "@/lib/siwa-resolver";

const SIWA_SECRET = process.env.SIWA_SECRET!;

export async function POST(req: Request) {
  const { message, signature } = await req.json();

  if (!message || !signature) {
    return NextResponse.json({ error: "Missing message or signature" }, { status: 400 });
  }

  try {
    const fields = parseSIWAMessage(message);
    const chainId = parseChainId(fields.agentRegistry);
    if (!chainId) {
      return NextResponse.json({ error: "Invalid agentRegistry format" }, { status: 400 });
    }
    const client = resolver.getClient(chainId);

    const result = await verifySIWA(
      message,
      signature,
      process.env.NEXT_PUBLIC_DOMAIN!,
      { nonceStore },
      client,
    );

    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    // Create receipt
    const { receipt } = createReceipt({
      address: result.address,
      agentId: result.agentId,
      agentRegistry: result.agentRegistry,
      chainId: result.chainId,
      verified: result.verified,
    }, {
      secret: SIWA_SECRET,
      ttl: 3600_000,  // 1 hour in ms
    });

    return NextResponse.json({
      success: true,
      address: result.address,
      agentId: result.agentId,
      verified: result.verified,
      receipt,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
```

**app/api/protected/route.ts**

```typescript
import { NextResponse } from "next/server";
import { verifyAuthenticatedRequest } from "@buildersgarden/siwa/erc8128";

const SIWA_SECRET = process.env.SIWA_SECRET!;

export async function GET(req: Request) {
  const result = await verifyAuthenticatedRequest(req, {
    receiptSecret: SIWA_SECRET,
  });

  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  return NextResponse.json({
    message: `Hello Agent #${result.agent.agentId}!`,
    agent: result.agent,
  });
}

export async function POST(req: Request) {
  const result = await verifyAuthenticatedRequest(req, {
    receiptSecret: SIWA_SECRET,
  });

  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  const body = await req.json();

  return NextResponse.json({
    success: true,
    agent: result.agent,
    received: body,
  });
}
```

---

## SDK Wrappers for Express & Next.js

The SDK provides pre-built middleware for common frameworks:

### Express Middleware

```typescript
import express from "express";
import { siwaMiddleware, siwaJsonParser, siwaCors } from "@buildersgarden/siwa/express";

const app = express();

// Apply SIWA middleware to protected routes — no hardcoded chain needed
app.use("/api/protected", siwaMiddleware({
  receiptSecret: process.env.SIWA_SECRET!,
}));

app.get("/api/protected/data", (req, res) => {
  // req.agent contains verified agent info
  const { address, agentId, verified } = req.agent;

  res.json({
    message: `Hello Agent #${agentId}!`,
    address,
    verified,
  });
});
```

### Next.js Wrapper

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

For authenticated API calls, agents sign HTTP requests with ERC-8128:

```typescript
import { verifyAuthenticatedRequest } from "@buildersgarden/siwa/erc8128";

async function handleRequest(req: Request) {
  const result = await verifyAuthenticatedRequest(req, {
    receiptSecret: process.env.SIWA_SECRET!,
    // Optional: nonce store for replay protection
    nonceStore: myNonceStore,
  });

  if (!result.valid) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: 401,
    });
  }

  // result.agent contains:
  // - address: string
  // - agentId: number
  // - agentRegistry: string
  // - chainId: number
  // - signerType?: 'eoa' | 'sca'

  return new Response(JSON.stringify({ agent: result.agent }));
}
```

---

## Security Considerations

### Nonce Management

- **Use the built-in nonce store** for production: `createMemorySIWANonceStore()` (single-process), `createRedisSIWANonceStore(redis)` (multi-instance), or `createKVSIWANonceStore(kv)` (Cloudflare Workers)
- **Nonce stores handle issue + consume atomically** — no manual nonce tracking needed
- **For custom backends** (SQL, Prisma, etc.), implement the `SIWANonceStore` interface (just `issue` + `consume`)
- **Memory store is single-process only** — nonces are lost on restart; use Redis for production

### Domain Verification

- **Always verify the domain** matches your expected domain
- **Prevents SIWA messages** signed for other services from being reused

### Receipt Security

- **Use a strong secret** (32+ random bytes)
- **Rotate secrets periodically**
- **Set appropriate expiration times**
- **Never expose the secret** to clients

### Clock Tolerance

- Allow some clock skew between client and server
- Default is 60 seconds
- Adjust based on your security requirements

---

## SDK Reference

### Main Module (`@buildersgarden/siwa`)

| Export | Description |
|--------|-------------|
| `signSIWAMessage(fields, signer)` | Sign a SIWA authentication message |
| `parseSIWAMessage(message)` | Parse SIWA message string to fields |
| `verifySIWA(message, signature, domain, nonceValid, client, criteria?)` | Verify signature + onchain registration. `nonceValid` accepts callback, `{ nonceToken, secret }`, or `{ nonceStore }`. |
| `createSIWANonce(params, client, options?)` | Issue nonce with optional `{ nonceStore }` for server-side tracking |
| `buildSIWAMessage(fields)` | Build SIWA message from fields |

### Receipt Module (`@buildersgarden/siwa/receipt`)

| Export | Description |
|--------|-------------|
| `createReceipt(payload, options)` | Create HMAC-signed receipt. Options: `{ secret, ttl? }` (ttl in ms, default 30min). Returns `{ receipt, expiresAt }`. |
| `verifyReceipt(receipt, secret)` | Verify and decode receipt. Returns `ReceiptPayload` or `null`. |
| `DEFAULT_RECEIPT_TTL` | Default receipt validity: 30 minutes (1800000 ms) |

### ERC-8128 Module (`@buildersgarden/siwa/erc8128`)

| Export | Description |
|--------|-------------|
| `verifyAuthenticatedRequest(req, options)` | Verify ERC-8128 signed HTTP request. Options: `VerifyOptions`. Returns `AuthResult`. |
| `VerifyOptions` | Type: `{ receiptSecret, rpcUrl?, verifyOnchain?, publicClient?, nonceStore?, allowedSignerTypes? }` |
| `AuthResult` | Type: `{ valid: true, agent: SiwaAgent } \| { valid: false, error: string }` |
| `SiwaAgent` | Type: `{ address, agentId, agentRegistry, chainId, signerType? }` |

### Client Resolver Module (`@buildersgarden/siwa/client-resolver`)

| Export | Description |
|--------|-------------|
| `createClientResolver(options?)` | Create a resolver that lazily creates and caches `PublicClient` per chain. Options: `{ rpcOverrides?, allowedChainIds? }`. |
| `parseChainId(agentRegistry)` | Extract chain ID from `eip155:{chainId}:{address}` format. Returns `number \| null`. |
| `ClientResolver` | Interface: `{ getClient(chainId), isSupported(chainId), supportedChainIds() }` |
| `ClientResolverOptions` | Type: `{ rpcOverrides?: Record<number, string>, allowedChainIds?: number[] }` |

### Nonce Store Module (`@buildersgarden/siwa/nonce-store`)

| Export | Description |
|--------|-------------|
| `SIWANonceStore` | Interface: `{ issue(nonce, ttlMs), consume(nonce) }` |
| `createMemorySIWANonceStore()` | In-memory store with TTL expiry (single-process) |
| `createRedisSIWANonceStore(redis, prefix?)` | Redis-backed store. Default prefix: `"siwa:nonce:"` |
| `createKVSIWANonceStore(kv, prefix?)` | Cloudflare Workers KV store |
| `RedisLikeClient` | Interface for ioredis / node-redis |
| `KVNamespaceLike` | Interface for Cloudflare KV bindings |

### Express Module (`@buildersgarden/siwa/express`)

| Export | Description |
|--------|-------------|
| `siwaMiddleware(options?)` | Auth middleware. Sets `req.agent` (and `req.payment` when x402). Options: `{ receiptSecret?, rpcUrl?, verifyOnchain?, publicClient?, allowedSignerTypes?, x402?: X402Config }` |
| `siwaJsonParser()` | JSON parser with rawBody capture for Content-Digest verification |
| `siwaCors(options?)` | CORS middleware with SIWA headers |

### Next.js Module (`@buildersgarden/siwa/next`)

| Export | Description |
|--------|-------------|
| `withSiwa(handler, options?)` | Wrap route handler with SIWA auth. Handler: `(agent, req, payment?) => object \| Response`. Options: `{ receiptSecret?, rpcUrl?, verifyOnchain?, allowedSignerTypes?, x402?: X402Config }` |
| `siwaOptions(corsOpts?)` | Return 204 OPTIONS response with CORS headers. Pass `{ x402: true }` to include payment headers. |
| `corsJson(data, init?)` | JSON Response with CORS headers. `init: { status?: number }` |
| `corsHeaders()` | Returns CORS headers object |

### Fastify Module (`@buildersgarden/siwa/fastify`)

| Export | Description |
|--------|-------------|
| `siwaPlugin` | Fastify plugin: CORS with SIWA headers. Uses `@fastify/cors` if available. |
| `siwaAuth(options?)` | preHandler hook: verifies ERC-8128 + receipt. Sets `req.agent`. Options: `{ receiptSecret?, rpcUrl?, verifyOnchain?, publicClient?, allowedSignerTypes? }` |

### Hono Module (`@buildersgarden/siwa/hono`)

| Export | Description |
|--------|-------------|
| `siwaMiddleware(options?)` | Auth middleware. Sets `c.set("agent", agent)`. Options: `{ receiptSecret?, rpcUrl?, verifyOnchain?, publicClient?, allowedSignerTypes? }` |
| `siwaCors(options?)` | CORS middleware with SIWA headers + OPTIONS preflight |

---

## Environment Variables

```bash
# Required
SIWA_SECRET=your-32-byte-random-secret

# Optional — override RPC endpoints per chain (createClientResolver checks these)
RPC_URL_84532=https://sepolia.base.org
RPC_URL_8453=https://mainnet.base.org
RPC_URL_11155111=https://rpc.sepolia.org

# Optional
DOMAIN=api.example.com
```

> **Note:** `createClientResolver()` includes built-in RPC endpoints for all supported chains (Base, Base Sepolia, ETH Sepolia, Linea Sepolia, Polygon Amoy). Set `RPC_URL_{chainId}` environment variables only when you need to override the defaults (e.g., for a private RPC provider).

---

## Further Reading

- [Full Documentation](https://siwa.id/docs) — Complete API reference, advanced options, and examples
- [SIWA Protocol Specification](references/siwa-spec.md)
- [ERC-8004 Registry](https://eips.ethereum.org/EIPS/eip-8004)
- [ERC-8128 HTTP Signatures](https://eips.ethereum.org/EIPS/eip-8128)
