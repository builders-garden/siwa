---
name: siwa-circle
version: 0.2.0
description: >
  Circle developer-controlled wallet integration for SIWA authentication.
---

# SIWA Circle Signer

Sign SIWA messages using Circle's developer-controlled wallets.

## Install

```bash
npm install @buildersgarden/siwa @circle-fin/developer-controlled-wallets
```

## Create Signer

```typescript
import { createCircleSiwaSigner } from "@buildersgarden/siwa/signer";

const signer = await createCircleSiwaSigner({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  walletId: process.env.CIRCLE_WALLET_ID!,
});
```

The wallet address is fetched automatically from Circle.

## From Existing Client

If you already have a Circle client instance:

```typescript
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { createCircleSiwaSignerFromClient } from "@buildersgarden/siwa/signer";

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});

const signer = await createCircleSiwaSignerFromClient({
  client,
  walletId: process.env.CIRCLE_WALLET_ID!,
});
```

## Register as ERC-8004 Agent

If your agent doesn't have an ERC-8004 identity yet, register onchain using Circle's contract execution API:

```typescript
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});

const IDENTITY_REGISTRY_ADDRESS = "0x8004A818BFB912233c491871b3d84c89A494BD9e"; //According to the chain

// Prepare agent metadata
const metadata = {
  name: "My Agent",
  description: "A helpful AI assistant",
  capabilities: ["chat", "analysis"],
};
const agentURI = `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString("base64")}`;

// Call the register(string agentURI) function on the registry
const response = await client.createContractExecutionTransaction({
  walletId: process.env.CIRCLE_WALLET_ID!,
  contractAddress: IDENTITY_REGISTRY_ADDRESS,
  abiFunctionSignature: "register(string)",
  abiParameters: [agentURI],
  fee: {
    type: "level",
    config: {
      feeLevel: "HIGH",
    },
  },
});

const tx = response.data;
console.log("Transaction ID:", tx?.id);
console.log("Transaction hash:", tx?.txHash);
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

## Environment Variables

```bash
CIRCLE_API_KEY=your-circle-api-key
CIRCLE_ENTITY_SECRET=your-entity-secret
CIRCLE_WALLET_ID=your-wallet-id
```
