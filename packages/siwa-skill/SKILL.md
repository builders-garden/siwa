---
name: siwa
version: 0.0.1
description: >
  Use this skill when an agent needs to: (1) create or manage an Ethereum wallet,
  (2) sign messages or transactions securely (transfers, contract calls, DeFi interactions), 
  (3) register on ERC-8004 and (4) authenticate via SIWA.
---

# SIWA Skill

This skill provides **secure Ethereum wallet operations** for AI agents. The private key is stored in a separate keyring proxy server — it never enters the agent's process, protecting against prompt injection and key exfiltration.

---

## IMPORTANT: Always Use the SIWA SDK

**You MUST use the `@buildersgarden/siwa` SDK for ALL blockchain operations.** Never call the keyring proxy HTTP endpoints directly — the SDK handles HMAC authentication internally.

```typescript
// CORRECT — Always use SDK functions
import { createWallet, signTransaction, getAddress } from "@buildersgarden/siwa/keystore";
const wallet = await createWallet();

// WRONG — Never call proxy endpoints directly
// fetch("http://proxy/create-wallet", ...) ❌
```

### SDK Modules Reference

| Module | Purpose | Key Functions |
|--------|---------|---------------|
| `@buildersgarden/siwa/keystore` | Wallet & signing | `createWallet()`, `signTransaction()`, `signMessage()`, `getAddress()` |
| `@buildersgarden/siwa/identity` | Identity file management | `readIdentity()`, `writeIdentityField()`, `isRegistered()` |
| `@buildersgarden/siwa` | SIWA authentication | `signSIWAMessage()`, `verifySIWA()` |
| `@buildersgarden/siwa/registry` | Read onchain data | `getAgent()`, `getReputation()` |
| `@buildersgarden/siwa/erc8128` | Authenticated API calls | `signAuthenticatedRequest()` |

---

## What You Can Do

| Operation | SDK Function | Module |
|-----------|--------------|--------|
| **Create Wallet** | `createWallet()` | `keystore` |
| **Get Wallet Address** | `getAddress()` | `keystore` |
| **Sign Messages** | `signMessage()` | `keystore` |
| **Sign Transactions** | `signTransaction()` | `keystore` |
| **Read Identity File** | `readIdentity()` | `identity` |
| **Update Identity File** | `writeIdentityField()` | `identity` |
| **Check if Registered** | `isRegistered()` | `identity` |
| **SIWA Sign-In** | `signSIWAMessage()` | main |
| **Get Agent Profile** | `getAgent()` | `registry` |
| **Get Agent Reputation** | `getReputation()` | `registry` |
| **Authenticated API Calls** | `signAuthenticatedRequest()` | `erc8128` |

---

## First Time Setup (Required)

**On first use of this skill, you MUST complete these steps:**

### 1. Install the SDK

```bash
npm install @buildersgarden/siwa
```

### 2. Set Environment Variables

```bash
KEYRING_PROXY_URL=https://your-keyring-proxy.up.railway.app
KEYRING_PROXY_SECRET=your-shared-secret
```

### 3. Create a Wallet

```typescript
import { createWallet } from "@buildersgarden/siwa/keystore";
import { ensureIdentityExists, writeIdentityField } from "@buildersgarden/siwa/identity";

// Initialize identity file
ensureIdentityExists("./SIWA_IDENTITY.md");

// Create wallet (key stored securely in proxy)
const wallet = await createWallet();
writeIdentityField("Address", wallet.address, "./SIWA_IDENTITY.md");

console.log("Wallet created:", wallet.address);
```

### 4. Fund the Wallet

**STOP — Ask the user to fund the wallet before proceeding only if the wallets doesnt have funds (ETH) on the chain it wants to register on.**

```
Wallet created successfully!

  Address: 0x1234...abcd
  Chain:   Base Sepolia (chainId 84532)

Please send some ETH to this address to cover gas fees.
Faucet: https://www.alchemy.com/faucets/base-sepolia

Let me know once funded and I'll proceed with registration.
```

### 5. Create Agent Metadata

**Option A — IPFS (Pinata, recommended):**

```typescript
const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.PINATA_JWT}`,
  },
  body: JSON.stringify({ pinataContent: registrationFile }),
});
const { IpfsHash } = await res.json();
const agentURI = `ipfs://${IpfsHash}`;
```

**Option B — Base64 data URI:**

```typescript
const encoded = Buffer.from(JSON.stringify(registrationFile)).toString(
  "base64"
);
const agentURI = `data:application/json;base64,${encoded}`;
```

### Step 6: Register Onchain (signed via proxy)

The SDK's `registerAgent()` handles the entire onchain flow — building the transaction, signing via the keyring proxy, broadcasting, and parsing the `Registered` event:

```typescript
import { registerAgent } from "@buildersgarden/siwa/registry";
import { writeIdentityField } from "@buildersgarden/siwa/identity";

const result = await registerAgent({
  agentURI,
  chainId: 84532, //According to the chain chosen by the user
  keystoreConfig: { proxyUrl, proxySecret },
});

// Persist PUBLIC results to SIWA_IDENTITY.md
writeIdentityField("Agent ID", result.agentId);
writeIdentityField("Agent Registry", result.agentRegistry);
writeIdentityField("Chain ID", "84532");
```

`registerAgent()` returns `{ agentId, txHash, registryAddress, agentRegistry }`. It resolves the registry address and RPC endpoint automatically from the chain ID (override with `rpcUrl` if needed).

See [references/contract-addresses.md](references/contract-addresses.md) for deployed addresses per chain.

After registration, your `SIWA_IDENTITY.md` will contain:
```markdown
- **Address**: `0x1234...abcd`
- **Agent ID**: `42`
- **Agent Registry**: `eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e`
- **Chain ID**: `84532`
```

---

## Sending Transactions

Once registered, you can sign and send any Ethereum transaction:

```typescript
import { signTransaction, getAddress } from "@buildersgarden/siwa/keystore";
import { createPublicClient, http, parseEther } from "viem";
import { base } from "viem/chains";

const client = createPublicClient({ chain: base, transport: http() });
const address = await getAddress();

// Build any transaction you want
const tx = {
  to: "0xRecipientAddress...",
  value: parseEther("0.01"),
  nonce: await client.getTransactionCount({ address }),
  chainId: base.id,
  type: 2,
  maxFeePerGas: 1000000000n,
  maxPriorityFeePerGas: 1000000n,
  gas: 21000n,
};

// Sign via proxy (key never leaves the proxy)
const { signedTx } = await signTransaction(tx);

// Broadcast
const txHash = await client.sendRawTransaction({ serializedTransaction: signedTx });
console.log("Transaction sent:", txHash);
```

---

## Security Model

```
┌─────────────────────────────────────────────────────────────────┐
│                      Your Agent Process                          │
│  (No private keys — delegates all signing to proxy)              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HMAC-authenticated HTTP
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Keyring Proxy Server                         │
│  - Stores encrypted private key                                  │
│  - Signs transactions on request                                 │
│  - Never exposes the key                                         │
└─────────────────────────────────────────────────────────────────┘
```

**Key security properties:**
- Private key **never enters** the agent process
- Even if the agent is fully compromised, attacker can only request signatures — cannot extract the key
- All requests authenticated via HMAC-SHA256 with timestamp-based replay protection

---

## Telegram 2FA (Optional)

The keyring proxy supports **Telegram-based two-factor authentication**. When enabled, every signing request requires manual approval via Telegram before the transaction is signed.

### How it works

```
┌──────────┐     ┌─────────────────┐     ┌──────────────┐     ┌──────────┐
│  Agent   │────▶│  Keyring Proxy  │────▶│ 2FA Telegram │────▶│ Telegram │
│          │     │                 │     │   Server     │     │   Bot    │
└──────────┘     └─────────────────┘     └──────────────┘     └──────────┘
                                                                    │
                                                                    ▼
                                                              ┌──────────┐
                                                              │   You    │
                                                              │ Approve? │
                                                              └──────────┘
```

1. Agent requests a signature (e.g., `signTransaction()`)
2. Keyring proxy sends approval request to 2FA Telegram server
3. You receive a Telegram message with transaction details and Approve/Reject buttons
4. If approved within 60 seconds, the signature proceeds; otherwise rejected

### Telegram message example

```
🔐 SIWA Signing Request

📋 Request ID: abc123
⏱️ Expires: 60 seconds

🔑 Wallet: 0x742d35Cc...
📝 Operation: Sign Transaction
⛓️ Chain: Base (8453)

📤 To: 0xdead...beef
💰 Value: 0.5 ETH

[✅ Approve]  [❌ Reject]
```

### When to use 2FA

- **High-value transactions** — Adds human oversight before signing
- **Production deployments** — Extra security layer for real funds
- **Compliance requirements** — Audit trail of all approved operations

2FA is configured on the keyring proxy via environment variables (`TFA_ENABLED=true`). See the [keyring-proxy documentation](../../keyring-proxy/README.md) for setup instructions.

---

## Core API

```typescript
import {
  createWallet,      // Create a new wallet → { address }
  getAddress,        // Get wallet address → string
  hasWallet,         // Check if wallet exists → boolean
  signMessage,       // Sign a message → { signature, address }
  signTransaction,   // Sign a transaction → { signedTx, address }
} from "@buildersgarden/siwa/keystore";
```

**None of these functions return the private key.**

---

## Example: Transfer USDC

Here's a complete example of sending USDC on Base:

```typescript
import { signTransaction, getAddress } from "@buildersgarden/siwa/keystore";
import { createPublicClient, http, encodeFunctionData, parseUnits } from "viem";
import { base } from "viem/chains";

// USDC contract on Base
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_DECIMALS = 6;

// ERC-20 transfer ABI
const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

async function transferUSDC(recipientAddress: string, amount: string) {
  const client = createPublicClient({
    chain: base,
    transport: http(process.env.RPC_URL),
  });

  const address = await getAddress();

  // Encode the transfer call
  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [recipientAddress, parseUnits(amount, USDC_DECIMALS)],
  });

  // Get transaction parameters
  const nonce = await client.getTransactionCount({ address });
  const { maxFeePerGas, maxPriorityFeePerGas } = await client.estimateFeesPerGas();
  const gas = await client.estimateGas({
    account: address,
    to: USDC_ADDRESS,
    data,
  });

  // Build the transaction
  const tx = {
    to: USDC_ADDRESS,
    data,
    nonce,
    chainId: base.id,
    type: 2,
    maxFeePerGas,
    maxPriorityFeePerGas,
    gas: (gas * 120n) / 100n, // 20% buffer
  };

  // Sign via proxy
  const { signedTx } = await signTransaction(tx);

  // Broadcast
  const txHash = await client.sendRawTransaction({ serializedTransaction: signedTx });
  console.log(`Sent ${amount} USDC to ${recipientAddress}`);
  console.log(`Transaction: https://basescan.org/tx/${txHash}`);

  // Wait for confirmation
  const receipt = await client.waitForTransactionReceipt({ hash: txHash });
  console.log(`Confirmed in block ${receipt.blockNumber}`);

  return txHash;
}

// Usage
await transferUSDC("0xRecipient...", "10.00"); // Send 10 USDC
```

---

## Example: Transfer ETH

```typescript
import { signTransaction, getAddress } from "@buildersgarden/siwa/keystore";
import { createPublicClient, http, parseEther } from "viem";
import { base } from "viem/chains";

async function transferETH(recipientAddress: string, amountInEth: string) {
  const client = createPublicClient({
    chain: base,
    transport: http(process.env.RPC_URL),
  });

  const address = await getAddress();
  const nonce = await client.getTransactionCount({ address });
  const { maxFeePerGas, maxPriorityFeePerGas } = await client.estimateFeesPerGas();

  const tx = {
    to: recipientAddress,
    value: parseEther(amountInEth),
    nonce,
    chainId: base.id,
    type: 2,
    maxFeePerGas,
    maxPriorityFeePerGas,
    gas: 21000n,
  };

  const { signedTx } = await signTransaction(tx);
  const txHash = await client.sendRawTransaction({ serializedTransaction: signedTx });

  console.log(`Sent ${amountInEth} ETH to ${recipientAddress}`);
  console.log(`Transaction: https://basescan.org/tx/${txHash}`);

  return txHash;
}

// Usage
await transferETH("0xRecipient...", "0.01"); // Send 0.01 ETH
```

---

## Example: Call Any Contract

The keyring proxy works with **any** Ethereum transaction. Here's a generic pattern:

```typescript
import { signTransaction, getAddress } from "@buildersgarden/siwa/keystore";
import { createPublicClient, http, encodeFunctionData } from "viem";
import { base } from "viem/chains";

async function callContract(
  contractAddress: string,
  abi: any[],
  functionName: string,
  args: any[],
  value?: bigint
) {
  const client = createPublicClient({
    chain: base,
    transport: http(process.env.RPC_URL),
  });

  const address = await getAddress();

  // Encode the function call
  const data = encodeFunctionData({ abi, functionName, args });

  // Get transaction parameters
  const nonce = await client.getTransactionCount({ address });
  const { maxFeePerGas, maxPriorityFeePerGas } = await client.estimateFeesPerGas();
  const gas = await client.estimateGas({
    account: address,
    to: contractAddress,
    data,
    value,
  });

  // Build and sign
  const tx = {
    to: contractAddress,
    data,
    value: value || 0n,
    nonce,
    chainId: base.id,
    type: 2,
    maxFeePerGas,
    maxPriorityFeePerGas,
    gas: (gas * 120n) / 100n,
  };

  const { signedTx } = await signTransaction(tx);
  const txHash = await client.sendRawTransaction({ serializedTransaction: signedTx });

  return txHash;
}
```

---

## SIWA Authentication (Optional)

After registering, authenticate with SIWA-enabled services:

```typescript
import { signSIWAMessage } from "@buildersgarden/siwa";
import { readIdentity } from "@buildersgarden/siwa/identity";

const identity = readIdentity("./SIWA_IDENTITY.md");

// 1. Request nonce from server
const nonceRes = await fetch("https://api.example.com/siwa/nonce", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    address: identity.address,
    agentId: identity.agentId,
    agentRegistry: identity.agentRegistry,
  }),
});
const { nonce, issuedAt, expirationTime } = await nonceRes.json();

// 2. Sign the SIWA message (via proxy)
const { message, signature } = await signSIWAMessage({
  domain: "api.example.com",
  uri: "https://api.example.com/siwa",
  agentId: identity.agentId,
  agentRegistry: identity.agentRegistry,
  chainId: identity.chainId,
  nonce,
  issuedAt,
  expirationTime,
});

// 3. Verify with server
const verifyRes = await fetch("https://api.example.com/siwa/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message, signature }),
});
const session = await verifyRes.json();
console.log("Authenticated! Receipt:", session.receipt);
```

---

## Reading Onchain Data

Use the `registry` module to read agent profiles and reputation from the ERC-8004 registries:

```typescript
import { getAgent, getReputation } from "@buildersgarden/siwa/registry";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL),
});

// Get agent profile by ID
const agent = await getAgent(
  42,  // agentId
  "0x8004A818BFB912233c491871b3d84c89A494BD9e",  // registry address
  client
);

console.log("Agent name:", agent.name);
console.log("Agent services:", agent.services);
console.log("Active:", agent.active);

// Get agent reputation
const reputation = await getReputation(
  42,  // agentId
  "0x8004BAa1...9b63",  // reputation registry address
  client
);

console.log("Reputation score:", reputation.score);
console.log("Feedback count:", reputation.feedbackCount);
```

---

## Supported Chains

The keyring proxy works with any EVM chain. Just set the correct `chainId` in your transactions.

| Chain | Chain ID | RPC |
|-------|----------|-----|
| Base | 8453 | https://mainnet.base.org |
| Base Sepolia | 84532 | https://sepolia.base.org |
| Ethereum | 1 | https://eth.llamarpc.com |
| Ethereum Sepolia | 11155111 | https://rpc.sepolia.org |
| Polygon | 137 | https://polygon-rpc.com |
| Arbitrum | 42161 | https://arb1.arbitrum.io/rpc |

---

## Common Token Addresses

| Token | Chain | Address |
|-------|-------|---------|
| USDC | Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| USDC | Ethereum | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| USDC | Polygon | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` |
| USDT | Ethereum | `0xdAC17F958D2ee523a2206206994597C13D831ec7` |
| DAI | Ethereum | `0x6B175474E89094C44Da98b954EesDbEeb5fBcbAEFD` |

---

## Troubleshooting

**"Cannot find module"** — Run `npm install @buildersgarden/siwa`

**"HMAC validation failed"** — Check that `KEYRING_PROXY_SECRET` matches between agent and proxy

**"Insufficient funds"** — The wallet needs ETH for gas. Fund it before sending transactions.

**"Nonce too low"** — Another transaction was sent. Get a fresh nonce with `getTransactionCount()`.

---

## Reference

- [Full SKILL.md](SKILL.md) — Complete skill documentation with all details
- [Security Model](references/security-model.md) — Threat model and architecture
- [SIWA Spec](references/siwa-spec.md) — Full SIWA protocol specification
- [Contract Addresses](references/contract-addresses.md) — Registry addresses per chain