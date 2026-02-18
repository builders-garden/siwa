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

| Import | Description |
|--------|-------------|
| `@buildersgarden/siwa` | Core: signSIWAMessage, verifySIWA, createSIWANonce, parseSIWAMessage, buildSIWAMessage, createClientResolver, parseChainId |
| `@buildersgarden/siwa/signer` | Signer factories (see wallet-specific skills above) |
| `@buildersgarden/siwa/erc8128` | ERC-8128 HTTP signing/verification |
| `@buildersgarden/siwa/receipt` | HMAC receipt helpers |
| `@buildersgarden/siwa/nonce-store` | Nonce stores (Memory, Redis, KV) |
| `@buildersgarden/siwa/identity` | SIWA_IDENTITY.md helpers |
| `@buildersgarden/siwa/registry` | Onchain agent registration |
| `@buildersgarden/siwa/client-resolver` | Dynamic PublicClient resolution for multi-chain servers |
| `@buildersgarden/siwa/next` | Next.js middleware (withSiwa, siwaOptions) |
| `@buildersgarden/siwa/express` | Express middleware (siwaMiddleware, siwaJsonParser, siwaCors) |
| `@buildersgarden/siwa/hono` | Hono middleware (siwaMiddleware, siwaCors) |
| `@buildersgarden/siwa/fastify` | Fastify middleware (siwaPlugin, siwaAuth) |
| `@buildersgarden/siwa/x402` | x402 payment helpers |
| `@buildersgarden/siwa/captcha` | Reverse CAPTCHA (prove you're an AI) |

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
