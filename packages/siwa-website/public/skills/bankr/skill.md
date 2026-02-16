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

If your agent doesn't have an ERC-8004 identity yet, register onchain using the Bankr Agent API's sign + submit endpoints:

```typescript
import { encodeFunctionData } from "viem";

const IDENTITY_REGISTRY_ADDRESS = "0x8004A818BFB912233c491871b3d84c89A494BD9e"; //According to the chain

// Prepare agent metadata
const metadata = {
  name: "My Agent",
  description: "A helpful AI assistant",
  capabilities: ["chat", "analysis"],
};
const agentURI = `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString("base64")}`;

const IDENTITY_REGISTRY_ABI = [
  {
    name: "register",
    type: "function",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
] as const;

// Encode the register function call
const data = encodeFunctionData({
  abi: IDENTITY_REGISTRY_ABI,
  functionName: "register",
  args: [agentURI],
});

// Sign the registration transaction via Bankr API
const signRes = await fetch("https://api.bankr.bot/agent/sign", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": process.env.BANKR_API_KEY!,
  },
  body: JSON.stringify({
    signatureType: "eth_signTransaction",
    transaction: {
      to: IDENTITY_REGISTRY_ADDRESS,
      chainId: 84532,
      data: data,
    },
  }),
});

const { signature } = await signRes.json();
console.log("Signed transaction:", signature);

// Submit the signed transaction via Bankr API
const submitRes = await fetch("https://api.bankr.bot/agent/submit", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": process.env.BANKR_API_KEY!,
  },
  body: JSON.stringify({ signedTransaction: signature }),
});

const result = await submitRes.json();
console.log("Transaction hash:", result.txHash);
```

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
