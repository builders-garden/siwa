---
name: siwa-bankr
version: 0.2.0
description: >
  Bankr wallet integration for SIWA authentication.
---

# SIWA Bankr Signer

Sign SIWA messages using Bankr's Agent API wallets.

## Install

```bash
npm install @buildersgarden/siwa
```

No additional SDK is required — the Bankr signer communicates directly with the Bankr Agent API over HTTP.

## Create Signer

```typescript
import { createBankrSiwaSigner } from "@buildersgarden/siwa/signer";

const signer = await createBankrSiwaSigner({
  apiKey: process.env.BANKR_API_KEY!,
});
```

The wallet address is fetched automatically from Bankr's `/agent/me` endpoint.

## Register as ERC-8004 Agent

Bankr wallets are smart contract accounts (ERC-4337). Use Bankr's `/agent/submit` endpoint with pre-encoded calldata to execute the registration as an arbitrary transaction:

```typescript
import { encodeRegisterAgent } from "@buildersgarden/siwa/registry";

// Prepare agent metadata
const metadata = {
  name: "My Agent",
  description: "A helpful AI assistant",
  capabilities: ["chat", "analysis"],
};
const agentURI = `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString("base64")}`;

// Encode the registration calldata (resolves the registry address automatically)
const { to, data } = encodeRegisterAgent({ agentURI, chainId: 84532 });

// Submit as arbitrary transaction via Bankr API
const submitRes = await fetch("https://api.bankr.bot/agent/submit", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": process.env.BANKR_API_KEY!,
  },
  body: JSON.stringify({
    transaction: { to, data, value: "0", chainId: 84532 },
    waitForConfirmation: true,
  }),
});

const result = await submitRes.json();
console.log("Transaction hash:", result.txHash);
```

> **Note:** Bankr wallets are smart accounts — SIWA verification uses ERC-1271 automatically. The `/agent/submit` endpoint handles UserOperation bundling internally. See [Bankr arbitrary transactions](https://github.com/BankrBot/openclaw-skills/blob/main/bankr/references/arbitrary-transaction.md) for details.

---

## SIWA Authentication Flow

The authentication flow consists of two steps:

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
const { nonce, issuedAt, expirationTime } = await nonceRes.json();
```

### Step 2: Sign and Verify

```typescript
import { signSIWAMessage } from "@buildersgarden/siwa";

const { message, signature, address } = await signSIWAMessage({
  domain: "api.example.com",
  uri: "https://api.example.com/siwa",
  agentId: 42,
  agentRegistry: "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e", //According to the chain
  chainId: 84532,
  nonce,
  issuedAt,
  expirationTime,
}, signer);

// Send to server for verification
const verifyRes = await fetch("https://api.example.com/siwa/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message, signature }),
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

## Environment Variables

```bash
BANKR_API_KEY=your-bankr-api-key
```

## Already using Bankr?

If your agent already uses Bankr's [OpenClaw trading skill](https://github.com/BankrBot/openclaw-skills/tree/main/bankr) for swaps, bridges, or DeFi, this signer lets you add SIWA authentication on top — same API key, same wallet, no extra setup. Bankr's trading skill handles what your agent *does*; the SIWA signer handles how your agent *proves who it is*.
