---
name: siwa
version: 0.1.0
description: >
  Use this skill when an agent needs to: (1) create or manage an Ethereum wallet,
  (2) sign messages or transactions securely (transfers, contract calls, DeFi interactions),
  (3) register on ERC-8004 and (4) authenticate via SIWA.
---

# SIWA Skill

This skill provides **secure Ethereum wallet operations** for AI agents. The SDK supports multiple wallet backends through a unified `Signer` interface:

- **Keyring Proxy** — Private key stored in a separate server (recommended for agents)
- **Local Account** — Direct private key usage via viem
- **WalletClient** — Browser wallets, Privy, MetaMask, WalletConnect, etc.

---

## IMPORTANT: Always Use the SIWA SDK

**You MUST use the `@buildersgarden/siwa` SDK for ALL blockchain operations.** The SDK provides a wallet-agnostic `Signer` interface that works with any wallet provider.

```typescript
// CORRECT — Use the Signer interface
import { createKeyringProxySigner } from "@buildersgarden/siwa/signer";
import { signSIWAMessage } from "@buildersgarden/siwa";

const signer = createKeyringProxySigner({ proxyUrl, proxySecret });
const { message, signature } = await signSIWAMessage(fields, signer);

// WRONG — Never call proxy endpoints directly
// fetch("http://proxy/sign-message", ...) ❌
```

### SDK Modules Reference

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `@buildersgarden/siwa/signer` | Wallet abstraction | `Signer`, `TransactionSigner`, `createKeyringProxySigner()`, `createLocalAccountSigner()`, `createWalletClientSigner()` |
| `@buildersgarden/siwa/keystore` | Keyring proxy admin | `createWallet()`, `hasWallet()`, `getAddress()`, `signAuthorization()` |
| `@buildersgarden/siwa` | SIWA authentication | `signSIWAMessage()`, `verifySIWA()` |
| `@buildersgarden/siwa/identity` | Identity file management | `readIdentity()`, `writeIdentityField()`, `isRegistered()` |
| `@buildersgarden/siwa/registry` | Onchain registration & reads | `registerAgent()`, `getAgent()`, `getReputation()` |
| `@buildersgarden/siwa/erc8128` | Authenticated API calls | `signAuthenticatedRequest()`, `verifyAuthenticatedRequest()` |
| `@buildersgarden/siwa/receipt` | Receipt helpers | `createReceipt()`, `verifyReceipt()` |

---

## Signer Interface

The SDK uses a unified `Signer` interface for all signing operations:

```typescript
interface Signer {
  getAddress(): Promise<Address>;
  signMessage(message: string): Promise<Hex>;
  signRawMessage?(rawHex: Hex): Promise<Hex>;  // For ERC-8128
}

interface TransactionSigner extends Signer {
  signTransaction(tx: TransactionRequest): Promise<Hex>;
}
```

### Creating Signers

**1. Keyring Proxy (Recommended for Agents)**

```typescript
import { createKeyringProxySigner } from "@buildersgarden/siwa/signer";

const signer = createKeyringProxySigner({
  proxyUrl: process.env.KEYRING_PROXY_URL,
  proxySecret: process.env.KEYRING_PROXY_SECRET,
});
```

**2. Local Account (Private Key)**

```typescript
import { createLocalAccountSigner } from "@buildersgarden/siwa/signer";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount("0x...");
const signer = createLocalAccountSigner(account);
```

**3. WalletClient (Browser Wallets, Privy, etc.)**

```typescript
import { createWalletClientSigner } from "@buildersgarden/siwa/signer";
import { createWalletClient, custom } from "viem";

// With Privy
const provider = await privyWallet.getEthereumProvider();
const walletClient = createWalletClient({ transport: custom(provider) });
const signer = createWalletClientSigner(walletClient);

// With window.ethereum (MetaMask)
const walletClient = createWalletClient({ transport: custom(window.ethereum) });
const signer = createWalletClientSigner(walletClient);
```

---

## What You Can Do

| Operation | Function | Module |
|-----------|----------|--------|
| **Create Signer** | `createKeyringProxySigner()`, `createLocalAccountSigner()`, `createWalletClientSigner()` | `signer` |
| **Create Wallet (Proxy)** | `createWallet()` | `keystore` |
| **Get Address (Proxy)** | `getAddress()` | `keystore` |
| **Sign Messages** | `signer.signMessage()` | via Signer |
| **Sign Transactions** | `signer.signTransaction()` | via TransactionSigner |
| **SIWA Sign-In** | `signSIWAMessage()` | main |
| **Register Agent** | `registerAgent()` | `registry` |
| **Read Identity File** | `readIdentity()` | `identity` |
| **Update Identity File** | `writeIdentityField()` | `identity` |
| **Get Agent Profile** | `getAgent()` | `registry` |
| **Authenticated API Calls** | `signAuthenticatedRequest()` | `erc8128` |

---

## First Time Setup (Keyring Proxy)

**On first use with the keyring proxy, complete these steps:**

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
import { createWallet, getAddress } from "@buildersgarden/siwa/keystore";
import { ensureIdentityExists, writeIdentityField } from "@buildersgarden/siwa/identity";

// Initialize identity file
ensureIdentityExists("./SIWA_IDENTITY.md");

// Create wallet (key stored securely in proxy)
const wallet = await createWallet();
writeIdentityField("Address", wallet.address, "./SIWA_IDENTITY.md");

console.log("Wallet created:", wallet.address);
```

### 4. Fund the Wallet

**STOP — Ask the user to fund the wallet before proceeding only if the wallet doesn't have funds (ETH) on the chain it wants to register on.**

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
const encoded = Buffer.from(JSON.stringify(registrationFile)).toString("base64");
const agentURI = `data:application/json;base64,${encoded}`;
```

### Step 6: Register Onchain

**IMPORTANT — Before registering, you MUST:**

1. **Ask the user for agent metadata** — Prompt the user to provide the metadata that will be associated with their onchain identity (name, description, services, capabilities, etc.). Do not assume or auto-generate this information.

2. **Ask for explicit confirmation** — Before submitting the registration transaction, show the user a summary of what will be registered (address, metadata URI, chain, estimated gas) and ask for their explicit confirmation to proceed. Registration is an onchain action that costs gas and cannot be undone.

The SDK's `registerAgent()` handles the entire onchain flow:

```typescript
import { registerAgent } from "@buildersgarden/siwa/registry";
import { createKeyringProxySigner } from "@buildersgarden/siwa/signer";
import { writeIdentityField } from "@buildersgarden/siwa/identity";

const signer = createKeyringProxySigner({
  proxyUrl: process.env.KEYRING_PROXY_URL,
  proxySecret: process.env.KEYRING_PROXY_SECRET,
});

const result = await registerAgent({
  agentURI,
  chainId: 84532,
  signer,
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
import { createKeyringProxySigner } from "@buildersgarden/siwa/signer";
import { createPublicClient, http, parseEther } from "viem";
import { base } from "viem/chains";

const signer = createKeyringProxySigner({
  proxyUrl: process.env.KEYRING_PROXY_URL,
  proxySecret: process.env.KEYRING_PROXY_SECRET,
});

const client = createPublicClient({ chain: base, transport: http() });
const address = await signer.getAddress();

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

// Sign via signer (key never leaves the proxy)
const signedTx = await signer.signTransaction(tx);

// Broadcast
const txHash = await client.sendRawTransaction({ serializedTransaction: signedTx });
console.log("Transaction sent:", txHash);
```

---

## Security Model (Keyring Proxy)

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

1. Agent requests a signature (e.g., `signer.signTransaction()`)
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

## SIWA Authentication

After registering, authenticate with SIWA-enabled services:

```typescript
import { signSIWAMessage } from "@buildersgarden/siwa";
import { createKeyringProxySigner } from "@buildersgarden/siwa/signer";
import { readIdentity } from "@buildersgarden/siwa/identity";

const signer = createKeyringProxySigner({
  proxyUrl: process.env.KEYRING_PROXY_URL,
  proxySecret: process.env.KEYRING_PROXY_SECRET,
});

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

// 2. Sign the SIWA message
const { message, signature } = await signSIWAMessage({
  domain: "api.example.com",
  uri: "https://api.example.com/siwa",
  agentId: identity.agentId,
  agentRegistry: identity.agentRegistry,
  chainId: identity.chainId,
  nonce,
  issuedAt,
  expirationTime,
}, signer);

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

## Authenticated API Calls (ERC-8128)

Use signed HTTP requests for authenticated API calls:

```typescript
import { signAuthenticatedRequest } from "@buildersgarden/siwa/erc8128";
import { createKeyringProxySigner } from "@buildersgarden/siwa/signer";

const signer = createKeyringProxySigner({
  proxyUrl: process.env.KEYRING_PROXY_URL,
  proxySecret: process.env.KEYRING_PROXY_SECRET,
});

// Create a request
const request = new Request("https://api.example.com/agent-action", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "transfer", amount: 100 }),
});

// Sign it with ERC-8128
const signedRequest = await signAuthenticatedRequest(
  request,
  receipt,  // From SIWA sign-in
  signer,
  84532     // chainId
);

// Send the signed request
const response = await fetch(signedRequest);
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

## Example: Transfer ETH

```typescript
import { createKeyringProxySigner } from "@buildersgarden/siwa/signer";
import { createPublicClient, http, parseEther } from "viem";
import { base } from "viem/chains";

async function transferETH(recipientAddress: string, amountInEth: string) {
  const signer = createKeyringProxySigner({
    proxyUrl: process.env.KEYRING_PROXY_URL,
    proxySecret: process.env.KEYRING_PROXY_SECRET,
  });

  const client = createPublicClient({
    chain: base,
    transport: http(process.env.RPC_URL),
  });

  const address = await signer.getAddress();
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

  const signedTx = await signer.signTransaction(tx);
  const txHash = await client.sendRawTransaction({ serializedTransaction: signedTx });

  console.log(`Sent ${amountInEth} ETH to ${recipientAddress}`);
  console.log(`Transaction: https://basescan.org/tx/${txHash}`);

  return txHash;
}

// Usage
await transferETH("0xRecipient...", "0.01"); // Send 0.01 ETH
```

---

## Example: Transfer USDC

```typescript
import { createKeyringProxySigner } from "@buildersgarden/siwa/signer";
import { createPublicClient, http, encodeFunctionData, parseUnits } from "viem";
import { base } from "viem/chains";

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_DECIMALS = 6;

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
  const signer = createKeyringProxySigner({
    proxyUrl: process.env.KEYRING_PROXY_URL,
    proxySecret: process.env.KEYRING_PROXY_SECRET,
  });

  const client = createPublicClient({
    chain: base,
    transport: http(process.env.RPC_URL),
  });

  const address = await signer.getAddress();

  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [recipientAddress, parseUnits(amount, USDC_DECIMALS)],
  });

  const nonce = await client.getTransactionCount({ address });
  const { maxFeePerGas, maxPriorityFeePerGas } = await client.estimateFeesPerGas();
  const gas = await client.estimateGas({
    account: address,
    to: USDC_ADDRESS,
    data,
  });

  const tx = {
    to: USDC_ADDRESS,
    data,
    nonce,
    chainId: base.id,
    type: 2,
    maxFeePerGas,
    maxPriorityFeePerGas,
    gas: (gas * 120n) / 100n,
  };

  const signedTx = await signer.signTransaction(tx);
  const txHash = await client.sendRawTransaction({ serializedTransaction: signedTx });

  console.log(`Sent ${amount} USDC to ${recipientAddress}`);
  console.log(`Transaction: https://basescan.org/tx/${txHash}`);

  return txHash;
}

// Usage
await transferUSDC("0xRecipient...", "10.00"); // Send 10 USDC
```

---

## Supported Chains

The SDK works with any EVM chain. Just set the correct `chainId` in your transactions.

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

- [Security Model](references/security-model.md) — Threat model and architecture
- [SIWA Spec](references/siwa-spec.md) — Full SIWA protocol specification
- [Contract Addresses](references/contract-addresses.md) — Registry addresses per chain
