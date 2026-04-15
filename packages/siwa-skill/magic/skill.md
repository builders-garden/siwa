---
name: siwa-magic
version: 0.2.0
description: >
  Magic server wallet integration for SIWA authentication.
---

# SIWA Magic Signer

Sign SIWA messages using Magic server-side wallets. Keys are held in a Trusted Execution Environment (TEE) — the agent never touches them.

## Install

```bash
npm install @buildersgarden/siwa
```

No additional SDK needed — the Magic signer calls the Magic Express API directly over HTTP.

## Create Signer

```typescript
import { createMagicSiwaSigner } from "@buildersgarden/siwa/signer";

const signer = await createMagicSiwaSigner({
  secretKey: process.env.MAGIC_SECRET_KEY!,
  jwt: agentJwt,           // JWT from your OIDC provider
  providerId: process.env.MAGIC_PROVIDER_ID!,
});
```

The signer calls `POST /v1/wallet` on creation to fetch (or create) the wallet address. This validates credentials and caches the address for subsequent signing calls.

## Prerequisites

You need three things:

1. **Magic Secret Key** — from your Magic dashboard
2. **Identity Provider ID** — register a provider with Magic's Express API (see below)
3. **JWT** — a valid token from that provider, identifying the agent

The JWT maps to an identity in Magic, and each identity has a wallet. No wallet IDs needed — wallet lookup is handled automatically via the JWT.

### Setting Up an Identity Provider

Magic needs to verify the JWTs your agents present. You register an OIDC-compatible identity provider that tells Magic where to find your public keys.

**Option A: Self-signed JWTs (lowest friction)**

Generate an RSA key pair and host the public key as a JWKS endpoint. This can be a static file on any public URL (GitHub Gist, your app's `/.well-known/jwks.json` route, S3, etc.).

```typescript
import { generateKeyPair, exportJWK, exportPKCS8 } from "jose";

const { publicKey, privateKey } = await generateKeyPair("RS256", {
  extractable: true,
});

// Save private key (keep secret — used to sign JWTs)
const privatePem = await exportPKCS8(privateKey);

// Build JWKS (host publicly)
const jwk = await exportJWK(publicKey);
jwk.kid = "my-agent-key-1";
jwk.alg = "RS256";
jwk.use = "sig";
const jwks = { keys: [jwk] };
```

Then mint JWTs with matching `issuer` and `audience` claims:

```typescript
import { SignJWT, importPKCS8 } from "jose";

const key = await importPKCS8(privatePem, "RS256");
const jwt = await new SignJWT({ sub: "my-agent" })
  .setProtectedHeader({ alg: "RS256", kid: "my-agent-key-1" })
  .setIssuedAt()
  .setExpirationTime("1h")
  .setIssuer("my-app")
  .setAudience("my-app")
  .sign(key);
```

**Option B: External identity provider**

Use any OIDC-compatible provider (Auth0, Clerk, Firebase Auth, etc.) — just point Magic to their JWKS endpoint.

### Register the Provider with Magic

```bash
curl -X POST 'https://tee.express.magiclabs.com/v1/identity/provider' \
  -H 'Content-Type: application/json' \
  -H 'X-Magic-Secret-Key: YOUR_SECRET_KEY' \
  -d '{
    "issuer": "my-app",
    "audience": "my-app",
    "jwks_uri": "https://example.com/.well-known/jwks.json"
  }'
```

The response contains the `provider_id` — use this as `MAGIC_PROVIDER_ID`.

**Important:** The `issuer` and `audience` must match the `iss` and `aud` claims in your JWTs. The `jwks_uri` must be publicly reachable so Magic can fetch the public keys for verification.

## Register as ERC-8004 Agent

If your agent doesn't have an ERC-8004 identity yet, register onchain. You'll need a funded wallet (Base Sepolia ETH for testnet).

```typescript
import { encodeFunctionData } from "viem";

const IDENTITY_REGISTRY_ADDRESS = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const BASE_SEPOLIA_CAIP2 = "eip155:84532";

const IDENTITY_REGISTRY_ABI = [
  {
    name: "register",
    type: "function",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
] as const;

const metadata = {
  name: "My Agent",
  description: "A helpful AI assistant",
  capabilities: ["chat", "analysis"],
};
const agentURI = `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString("base64")}`;

const data = encodeFunctionData({
  abi: IDENTITY_REGISTRY_ABI,
  functionName: "register",
  args: [agentURI],
});

// Send the registration transaction via Magic's Express API
const address = await signer.getAddress();
// Use your preferred method to submit the transaction to Base Sepolia
```

---

## SIWA Authentication Flow

The authentication flow consists of two steps:

> **Note:** The URLs below (`api.example.com`) are placeholders. Replace them with your own server that implements the SIWA verification endpoints. See the [Server-Side Verification](https://siwa.id/skills/server-side/skill.md) skill for implementation details.

1. **Get a nonce** from the server's `/siwa/nonce` endpoint
2. **Sign and verify** by sending the signature to `/siwa/verify`

### Step 1: Request Nonce

```typescript
const nonceRes = await fetch("https://api.example.com/siwa/nonce", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    address: await signer.getAddress(),
    agentId: 42,
    agentRegistry: "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e",
  }),
});
const { nonce, nonceToken, issuedAt, expirationTime } = await nonceRes.json();
```

### Step 2: Sign and Verify

```typescript
import { signSIWAMessage } from "@buildersgarden/siwa";

const { message, signature, address } = await signSIWAMessage({
  domain: "api.example.com",
  uri: "https://api.example.com/siwa",
  agentId: 42,
  agentRegistry: "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e",
  chainId: 84532,
  nonce,
  issuedAt,
  expirationTime,
}, signer);

// Send to server for verification
const verifyRes = await fetch("https://api.example.com/siwa/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message, signature, nonceToken }),
});

const { receipt, agentId } = await verifyRes.json();
// Store the receipt for authenticated API calls
```

## Sign Authenticated Request (ERC-8128)

```typescript
import { signAuthenticatedRequest } from "@buildersgarden/siwa/erc8128";

const request = new Request("https://api.example.com/action", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "execute" }),
});

const signedRequest = await signAuthenticatedRequest(
  request,
  receipt,  // from SIWA sign-in
  signer,
  84532,
);

const response = await fetch(signedRequest);
```

## How It Works Under the Hood

```
Agent (using SIWA SDK)
  │
  ├─ createMagicSiwaSigner({ jwt, providerId })
  │     └─ POST /v1/wallet → gets wallet address
  │
  ├─ signSIWAMessage(fields, signer)
  │     └─ signer.signMessage(message)
  │           └─ POST /v1/wallet/sign/message → TEE signs, returns signature
  │
  └─ sends { message, signature } to verifying service
```

The Magic Express API proxies all signing to a Trusted Execution Environment. Private keys never leave the TEE, and the agent never has direct access to them.

## Environment Variables

```bash
MAGIC_SECRET_KEY=sk-live-...       # From your Magic dashboard
MAGIC_PROVIDER_ID=your-provider-id # From POST /v1/identity/provider (see Prerequisites)
```

The JWT is passed per-request (not an env var) since each agent has its own token.
