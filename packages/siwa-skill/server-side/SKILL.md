---
name: siwa-server
version: 0.1.0
description: >
  Use this skill to implement server-side SIWA verification. For backends and APIs
  that need to authenticate ERC-8004 agents without signing capabilities.
---

# SIWA Server-Side Verification

This guide covers **server-side SIWA verification** for Agent backends and APIs that need to authenticate agents. No wallet or signing required — only verification.

Use this when building:
- API backends that accept SIWA authentication
- Authentication services for agent ecosystems
- Middleware for protected endpoints
- Session management systems

---

## Quick Start

### 1. Install

```bash
npm install @buildersgarden/siwa viem
```

### 2. Verify a SIWA Signature

```typescript
import { parseSIWAMessage, verifySIWA } from "@buildersgarden/siwa";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL),
});

async function verifyAgent(message: string, signature: string) {
  const fields = parseSIWAMessage(message);

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

## Verification Flow

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Agent     │────▶│   Your Server   │────▶│  ERC-8004        │
│  (Client)   │     │  (Verifier)     │     │  Registry        │
└─────────────┘     └─────────────────┘     └──────────────────┘
      │                     │                        │
      │  1. POST /nonce     │                        │
      │◀────────────────────│                        │
      │     { nonce }       │                        │
      │                     │                        │
      │  2. Sign message    │                        │
      │     (client-side)   │                        │
      │                     │                        │
      │  3. POST /verify    │                        │
      │────────────────────▶│                        │
      │  { message, sig }   │  4. Verify signature   │
      │                     │────────────────────────▶│
      │                     │  5. Check registration │
      │                     │◀────────────────────────│
      │  6. { receipt }     │                        │
      │◀────────────────────│                        │
```

---

## Complete Server Implementation

### Express.js

```typescript
import express from "express";
import { randomBytes } from "crypto";
import { parseSIWAMessage, verifySIWA } from "@buildersgarden/siwa";
import { createReceipt, verifyReceipt } from "@buildersgarden/siwa/receipt";
import { verifyAuthenticatedRequest } from "@buildersgarden/siwa/erc8128";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const app = express();
app.use(express.json());

// RPC client for onchain verification
const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL),
});

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

  res.json({ nonce, issuedAt, expirationTime });
});

// ─── Verify Endpoint ─────────────────────────────────────────────────

app.post("/api/siwa/verify", async (req, res) => {
  const { message, signature } = req.body;

  if (!message || !signature) {
    return res.status(400).json({ error: "Missing message or signature" });
  }

  try {
    // 1. Parse the SIWA message
    const fields = parseSIWAMessage(message);

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

**app/api/siwa/nonce/route.ts**

```typescript
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

// In production, use Redis or database
const nonceStore = new Map<string, { nonce: string; issuedAt: string; expires: number }>();

export async function POST(req: Request) {
  const { address, agentId, agentRegistry } = await req.json();

  if (!address || agentId === undefined || !agentRegistry) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const nonce = randomBytes(16).toString("hex");
  const issuedAt = new Date().toISOString();
  const expirationTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const key = `${address}:${agentId}:${agentRegistry}`;
  nonceStore.set(key, { nonce, issuedAt, expires: Date.now() + 10 * 60 * 1000 });

  // Clean up expired nonces periodically
  for (const [k, v] of nonceStore.entries()) {
    if (Date.now() > v.expires) nonceStore.delete(k);
  }

  return NextResponse.json({ nonce, issuedAt, expirationTime });
}

// Export for other routes to access
export { nonceStore };
```

**app/api/siwa/verify/route.ts**

```typescript
import { NextResponse } from "next/server";
import { parseSIWAMessage, verifySIWA } from "@buildersgarden/siwa";
import { createReceipt } from "@buildersgarden/siwa/receipt";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { nonceStore } from "../nonce/route";

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL),
});

const SIWA_SECRET = process.env.SIWA_SECRET!;

export async function POST(req: Request) {
  const { message, signature } = await req.json();

  if (!message || !signature) {
    return NextResponse.json({ error: "Missing message or signature" }, { status: 400 });
  }

  try {
    const fields = parseSIWAMessage(message);

    // Verify nonce
    const key = `${fields.address}:${fields.agentId}:${fields.agentRegistry}`;
    const stored = nonceStore.get(key);

    if (!stored || stored.nonce !== fields.nonce || Date.now() > stored.expires) {
      return NextResponse.json({ error: "Invalid or expired nonce" }, { status: 401 });
    }

    // Verify signature + onchain
    const result = await verifySIWA(
      message,
      signature,
      process.env.NEXT_PUBLIC_DOMAIN!,
      (nonce) => {
        if (!stored || stored.nonce !== nonce) return false;
        nonceStore.delete(key);
        return true;
      },
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
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const app = express();

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL),
});

// Apply SIWA middleware to protected routes
app.use("/api/protected", siwaMiddleware({
  receiptSecret: process.env.SIWA_SECRET!,
  client,
}));

app.get("/api/protected/data", (req, res) => {
  // req.siwa contains verified agent info
  const { address, agentId, verified } = req.siwa;

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
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL),
});

const options = siwaOptions({
  receiptSecret: process.env.SIWA_SECRET!,
  client,
});

// Wrap your handler
export const GET = withSiwa(async (req, { siwa }) => {
  return Response.json({
    message: `Hello Agent #${siwa.agentId}!`,
    address: siwa.address,
  });
}, options);
```

---

## Verification Options

### verifySIWA Parameters

```typescript
verifySIWA(
  message: string,          // Full SIWA message string
  signature: string,        // EIP-191 signature hex
  expectedDomain: string,   // Must match message domain
  nonceValid: NonceValidator, // Nonce validation (see below)
  client: PublicClient,     // viem client for onchain checks
  criteria?: SIWAVerifyCriteria, // Optional verification criteria
)

// NonceValidator: either a callback or stateless token
type NonceValidator =
  | ((nonce: string) => boolean | Promise<boolean>)
  | { nonceToken: string; secret: string };

// SIWAVerifyCriteria: optional policy enforcement
interface SIWAVerifyCriteria {
  allowedSignerTypes?: SignerType[];   // 'eoa', 'sca', or both
  requiredServices?: string[];         // Required ERC-8004 services
  requiredTrust?: string[];            // Required trust models
  minScore?: number;                   // Minimum reputation score
  minFeedbackCount?: number;           // Minimum feedback count
  reputationRegistryAddress?: string;  // For reputation queries
  mustBeActive?: boolean;              // Require active agent
  custom?: (agent) => boolean;         // Custom validation
}
```

### Verification Example

```typescript
const result = await verifySIWA(
  message,
  signature,
  "example.com",
  (nonce) => validateAndConsumeNonce(nonce),
  client,
  { allowedSignerTypes: ['eoa'] },  // optional criteria
);

// result.valid, result.address, result.agentId, result.signerType
```

---

## Receipt System

Receipts are HMAC-signed tokens that prove successful SIWA verification. Use them for:
- Session management
- Authenticated API calls (ERC-8128)
- Caching verification results

### Creating Receipts

```typescript
import { createReceipt } from "@buildersgarden/siwa/receipt";

const { receipt } = createReceipt({
  address: "0x1234...",
  agentId: 42,
  agentRegistry: "eip155:84532:0x8004...",
  chainId: 84532,
  verified: "onchain",
}, {
  secret: process.env.SIWA_SECRET!,
  expiresIn: 3600,  // 1 hour
});
```

### Verifying Receipts

```typescript
import { verifyReceipt } from "@buildersgarden/siwa/receipt";

const claims = verifyReceipt(receipt, process.env.SIWA_SECRET!);

if (claims === null) {
  // Invalid or expired receipt
}

// claims = { address, agentId, agentRegistry, chainId, verified, exp, iat }
```

---

## ERC-8128 Request Verification

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

## Captcha (Reverse CAPTCHA)

SIWA includes a "reverse CAPTCHA" — inspired by [MoltCaptcha](https://github.com/MoltCaptcha/MoltCaptcha) — that proves an entity is an AI agent. Servers can challenge agents at sign-in or during authenticated requests.

### Sign-In Captcha

Add `captchaPolicy` and `captchaOptions` to `createSIWANonce`:

```typescript
import { createSIWANonce } from "@buildersgarden/siwa";

const result = await createSIWANonce(
  { address, agentId, agentRegistry },
  client,
  {
    secret: SIWA_SECRET,
    captchaPolicy: async ({ address }) => {
      const known = await db.agents.exists(address);
      return known ? null : 'medium';  // challenge unknown agents
    },
    captchaOptions: { secret: SIWA_SECRET },
  },
);

if (result.status === 'captcha_required') {
  // Return challenge to agent
  return res.json(result);
}
// result.status === 'nonce_issued' — continue normally
```

When the agent resubmits with `challengeResponse`, `createSIWANonce` verifies it automatically:

```typescript
const result = await createSIWANonce(
  { address, agentId, agentRegistry, challengeResponse: req.body.challengeResponse },
  client,
  { secret: SIWA_SECRET, captchaPolicy, captchaOptions: { secret: SIWA_SECRET } },
);
```

### Per-Request Captcha

Add `captchaPolicy` to middleware options for random spot-checks:

```typescript
// Express
app.use("/api/sensitive", siwaMiddleware({
  receiptSecret: SIWA_SECRET,
  captchaPolicy: ({ request }) => {
    if (request?.url.includes('/transfer') && Math.random() < 0.05) return 'hard';
    return null;
  },
  captchaOptions: { secret: SIWA_SECRET },
}));

// Next.js
export const POST = withSiwa(handler, {
  captchaPolicy: () => Math.random() < 0.05 ? 'easy' : null,
  captchaOptions: { secret: process.env.SIWA_SECRET! },
});
```

When a captcha is required, the middleware returns 401 with the challenge in the body and `X-SIWA-Challenge` header. The agent solves it, adds `X-SIWA-Challenge-Response`, re-signs the request with ERC-8128, and retries.

### Verification Options

All verification behavior is configurable via `captchaOptions.verify`:

```typescript
captchaOptions: {
  secret: SIWA_SECRET,
  verify: {
    useServerTiming: true,         // don't trust client timestamps (default)
    timingToleranceSeconds: 5,     // extra seconds for latency (default: 2)
    asciiTolerance: 2,             // allow ±2 on ASCII sum (default: 0)
    revealConstraints: false,      // hide actual/target in results (default: true)
    consumeChallenge: async (token) => {
      // One-time use via Redis
      return await redis.set(`captcha:${token}`, '1', 'NX', 'EX', 60) === 'OK';
    },
  },
  // Override difficulty settings per tier
  difficulties: {
    easy: { timeLimitSeconds: 45 },
  },
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `useServerTiming` | `true` | Check elapsed time server-side instead of trusting the agent's `solvedAt` |
| `timingToleranceSeconds` | `2` | Extra seconds added to time limit for network latency |
| `asciiTolerance` | `0` | Allow ±N tolerance on ASCII sum comparison |
| `revealConstraints` | `true` | Include actual vs target values in verification results |
| `consumeChallenge` | — | Callback for one-time-use tokens (return `false` to reject replays) |

### Difficulty Levels

| Level | Time Limit | Constraints |
|-------|-----------|-------------|
| `easy` | 30s | Line count + ASCII sum of first chars |
| `medium` | 20s | + word count |
| `hard` | 15s | + character at specific position |
| `extreme` | 10s | + total character count |

---

## Security Considerations

### Nonce Management

- **Generate cryptographically random nonces** (use `crypto.randomBytes`)
- **Store nonces server-side** with expiration
- **Consume nonces after use** (one-time use)
- **Use Redis or database in production** (not in-memory Map)

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
| `parseSIWAMessage(message)` | Parse SIWA message string to fields |
| `verifySIWA(message, signature, domain, nonceValid, client, criteria?)` | Verify signature + onchain registration |
| `buildSIWAMessage(fields)` | Build SIWA message from fields |

### Receipt Module (`@buildersgarden/siwa/receipt`)

| Export | Description |
|--------|-------------|
| `createReceipt(claims, options)` | Create HMAC-signed receipt |
| `verifyReceipt(receipt, secret)` | Verify and decode receipt |

### ERC-8128 Module (`@buildersgarden/siwa/erc8128`)

| Export | Description |
|--------|-------------|
| `verifyAuthenticatedRequest(req, options)` | Verify ERC-8128 signed HTTP request. Options accept `captchaPolicy` and `captchaOptions`. |
| `retryWithCaptcha(response, request, receipt, signer, chainId, solver, options?)` | Agent-side: detect captcha in 401, solve, re-sign, return retry request. |

### Captcha Module (`@buildersgarden/siwa/captcha`)

| Export | Description |
|--------|-------------|
| `createCaptchaChallenge(difficulty, options)` | Generate challenge + HMAC-signed token |
| `verifyCaptchaSolution(token, solution, secret, verifyOptions?)` | Verify constraints + timing (async) |
| `unpackCaptchaResponse(packed)` | Unpack agent's challenge response |
| `solveCaptchaChallenge(nonceResponse, solver)` | Agent-side: detect + solve captcha from nonce response |
| `CaptchaSolver` | Type: solver callback `(challenge) => string \| Promise<string>` |

### Express Module (`@buildersgarden/siwa/express`)

| Export | Description |
|--------|-------------|
| `siwaMiddleware(options)` | Express middleware for SIWA verification. Options accept `captchaPolicy` and `captchaOptions`. |
| `createSiwaMiddleware(defaults)` | Factory: pre-configured `siwaMiddleware` with shared options. Per-route overrides supported. |
| `siwaJsonParser()` | JSON parser with SIWA-aware error handling |
| `siwaCors(options)` | CORS middleware for SIWA endpoints |

### Next.js Module (`@buildersgarden/siwa/next`)

| Export | Description |
|--------|-------------|
| `withSiwa(handler, options)` | Wrap route handler with SIWA verification. Options accept `captchaPolicy` and `captchaOptions`. |
| `createWithSiwa(defaults)` | Factory: pre-configured `withSiwa` with shared options. Per-handler overrides supported. |
| `siwaOptions(config)` | Create options object for withSiwa |
| `corsJson(data, status?)` | Return JSON with CORS headers |

---

## Environment Variables

```bash
# Required
SIWA_SECRET=your-32-byte-random-secret
RPC_URL=https://sepolia.base.org

# Optional
DOMAIN=api.example.com
```

---

## Further Reading

- [SIWA Protocol Specification](references/siwa-spec.md)
- [ERC-8004 Registry](https://eips.ethereum.org/EIPS/eip-8004)
- [ERC-8128 HTTP Signatures](https://eips.ethereum.org/EIPS/eip-8128)
- [viem Documentation](https://viem.sh)
