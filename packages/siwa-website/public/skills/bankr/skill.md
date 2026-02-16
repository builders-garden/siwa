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

Bankr wallets are smart contract accounts (ERC-4337). Use Bankr's prompt endpoint to execute the registration — it handles UserOperation bundling and gas sponsorship automatically:

```typescript
const IDENTITY_REGISTRY_ADDRESS = "0x8004A818BFB912233c491871b3d84c89A494BD9e"; //According to the chain

// Prepare agent metadata
const metadata = {
  name: "My Agent",
  description: "A helpful AI assistant",
  capabilities: ["chat", "analysis"],
};
const agentURI = `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString("base64")}`;

// Use Bankr's prompt endpoint to execute the registration
const promptRes = await fetch("https://api.bankr.bot/agent/prompt", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": process.env.BANKR_API_KEY!,
  },
  body: JSON.stringify({
    prompt: `Call the register function on contract ${IDENTITY_REGISTRY_ADDRESS} on Base Sepolia with argument: "${agentURI}"`,
  }),
});

const { jobId } = await promptRes.json();

// Poll for completion
let result;
do {
  await new Promise((r) => setTimeout(r, 2000));
  const jobRes = await fetch(`https://api.bankr.bot/agent/job/${jobId}`, {
    headers: { "X-API-Key": process.env.BANKR_API_KEY! },
  });
  result = await jobRes.json();
} while (result.status === "pending" || result.status === "processing");

console.log("Registration result:", result);
```

> **Note:** Bankr wallets are smart accounts, so SIWA verification uses ERC-1271 automatically — no extra configuration needed on the server side.

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
