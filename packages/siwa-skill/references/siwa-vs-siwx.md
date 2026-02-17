# SIWA Sessions vs x402 SIWX

> Why ERC-8128 per-request signatures are stronger than CAIP-122 challenge-response for agent authentication.

## Two approaches to "pay once, authenticate later"

Both SIWA Sessions and x402's SIWX solve the same problem: an agent pays for a resource once and then accesses it without paying again. The difference is how the agent proves its identity on subsequent requests.

| | x402 SIWX | SIWA Sessions |
|---|---|---|
| Auth mechanism | CAIP-122 challenge-response (EIP-4361) | ERC-8128 HTTP Message Signatures (RFC 9421) |
| What gets signed | A human-readable challenge string | The actual HTTP request (method, path, headers, body digest) |
| Header | `SIGN-IN-WITH-X` (signed challenge) | `Signature` + `Signature-Input` + `X-SIWA-Receipt` |
| Proof scope | Domain-wide for the TTL window | Bound to one specific request |
| Replay risk | Proof can be replayed on any endpoint on the same domain | Proof is useless for a different request |

## How CAIP-122 / SIWX works

The client signs a **challenge message** — a human-readable string:

```
example.com wants you to sign in with your Ethereum account:
0xABC...
Nonce: abc123
Issued At: 2026-02-16T00:00:00Z
Expiration Time: 2026-02-16T01:00:00Z
```

That signed proof is sent as the `SIGN-IN-WITH-X` header on subsequent requests. The server checks: "has this wallet paid before?" If yes, access is granted.

The problem: the proof is **not bound to the HTTP request**. The signed message says nothing about the method, path, body, or headers of the request it accompanies. The same proof works for any request to the same domain within the expiry window.

### What an intercepted SIWX proof allows

If an attacker captures the `SIGN-IN-WITH-X` header value:

- Replay it on `DELETE /api/account` even though it was signed for `GET /api/data`
- Replay it with a completely different request body
- Replay it on any route on the same domain until the nonce expires
- Use it from a different IP, user-agent, or context

The only protections are domain binding and time-based nonce expiry — coarse-grained, not request-specific.

## How ERC-8128 / SIWA works

Every request gets its own cryptographic signature computed over the **actual HTTP message components** per RFC 9421:

- `@method` — `GET`, `POST`, etc.
- `@target-uri` — the full request URL
- `content-digest` — SHA-256 hash of the request body
- `x-siwa-receipt` — the SIWA identity receipt (binding agent identity to the signature)
- `@signature-params` — creation timestamp, nonce, key ID

The signature base for a GET to `/api/data` is fundamentally different from a POST to `/api/data` with a body, which is different from a GET to `/api/admin`. Each produces a unique signature that cannot be reused.

### What an intercepted SIWA signature allows

Nothing useful. The signature is bound to:

- The exact method and URL
- The exact body content (via Content-Digest)
- The exact receipt header value
- A creation timestamp (replay window rejection)
- A unique nonce

Changing any component invalidates the signature. There is no transferable "proof token."

## The core difference

CAIP-122 proves **who you are**. ERC-8128 proves **who you are AND that you authorized this specific request**.

It's the difference between showing your ID at the door (SIWX) versus signing each individual transaction at the counter (SIWA). The ID can be photocopied; the per-transaction signature cannot be reused.

## Why this matters for agents

Autonomous agents operate in adversarial environments — they process untrusted input, call external APIs, and run for extended periods. A leaked session token (SIWX proof) grants broad access. A leaked per-request signature (SIWA) grants access to exactly one request that already happened.

For human users clicking through a browser, CAIP-122 is reasonable — the UX cost of signing every request would be prohibitive. For agents that sign programmatically with no UX overhead, per-request signatures are strictly better.

## Session storage comparison

Both approaches need server-side storage to track which agents have paid:

```
// x402 SIWX
hasPaid(address, resourceUri): boolean
recordPayment(address, resourceUri): void

// SIWA Sessions
get(address, resource): X402Session | null
set(address, resource, session, ttlMs): void
```

SIWA Sessions add explicit TTL at the store level, so sessions auto-expire without separate cleanup logic.

## Trade-offs

**x402 SIWX advantages:**
- Chain-agnostic (EVM + Solana via CAIP-2)
- Part of the official x402 spec — interoperable with standard x402 clients
- Simpler client implementation (sign one message, reuse the proof)

**SIWA Sessions advantages:**
- Per-request authentication (no replay across endpoints)
- No new headers — reuses existing SIWA signature flow
- Stronger security model for autonomous agents
- Built-in TTL expiry
