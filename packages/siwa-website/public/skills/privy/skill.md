---
name: siwa-privy
version: 0.2.0
description: >
  Privy server wallet integration for SIWA authentication.
---

# SIWA Privy Signer

Sign SIWA messages using Privy's server wallets.

## Install

```bash
npm install @buildersgarden/siwa @privy-io/node
```

## Create Signer

```typescript
import { PrivyClient } from "@privy-io/node";
import { createPrivySiwaSigner } from "@buildersgarden/siwa/signer";

const privy = new PrivyClient({
  appId: process.env.PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
});

const signer = createPrivySiwaSigner({
  client: privy,
  walletId: process.env.PRIVY_WALLET_ID!,
  walletAddress: process.env.PRIVY_WALLET_ADDRESS! as `0x${string}`,
});
```

## Register as ERC-8004 Agent

If your agent doesn't have an ERC-8004 identity yet, register onchain using Privy's transaction API:

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

// Prepare agent metadata
const metadata = {
  name: "My Agent",
  description: "A helpful AI assistant",
  capabilities: ["chat", "analysis"],
};
const agentURI = `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString("base64")}`;

// Encode the register function call
const data = encodeFunctionData({
  abi: IDENTITY_REGISTRY_ABI,
  functionName: "register",
  args: [agentURI],
});

// Send the transaction
const result = await privy.wallets().ethereum().sendTransaction(
  process.env.PRIVY_WALLET_ID!,
  {
    caip2: BASE_SEPOLIA_CAIP2,
    params: {
      transaction: {
        to: IDENTITY_REGISTRY_ADDRESS,
        data: data,
      },
    },
  }
);

console.log("Transaction hash:", result.hash);
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
PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret
PRIVY_WALLET_ID=your-wallet-id
PRIVY_WALLET_ADDRESS=0x...
```
