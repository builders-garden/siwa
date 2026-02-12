---
name: siwa
version: 0.1.0
description: >
  Use this skill to integrate ERC-8004 agent registration and SIWA authentication
  with multiple wallet provider (Privy, MetaMask, WalletConnect, private key, etc.).
---

# SIWA SDK — Wallet Integration

This guide covers **ERC-8004 agent registration** and **SIWA authentication** for applications that already have their own wallet solution. No keyring proxy required.

The SIWA SDK provides a unified `Signer` interface that works with:
- **Private keys** via viem's `LocalAccount`
- **Browser wallets** via viem's `WalletClient` (MetaMask, Coinbase Wallet, etc.)
- **Embedded wallets** like Privy, Dynamic, Magic, etc.
- **WalletConnect** sessions

---

## Quick Start

### 1. Install

```bash
npm install @buildersgarden/siwa viem
```

### 2. Create a Signer from Your Wallet

Choose the wrapper that matches your wallet provider:

**Option A: Private Key (Backend/Scripts)**

```typescript
import { createLocalAccountSigner } from "@buildersgarden/siwa/signer";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const signer = createLocalAccountSigner(account);
```

**Option B: WalletClient (Browser/Privy/MetaMask)**

```typescript
import { createWalletClientSigner } from "@buildersgarden/siwa/signer";
import { createWalletClient, custom } from "viem";
import { baseSepolia } from "viem/chains";

// MetaMask / Coinbase Wallet / any injected provider
const walletClient = createWalletClient({
  chain: baseSepolia,
  transport: custom(window.ethereum),
});
const signer = createWalletClientSigner(walletClient);

// Privy embedded wallet
const provider = await privyWallet.getEthereumProvider();
const walletClient = createWalletClient({
  chain: baseSepolia,
  transport: custom(provider),
});
const signer = createWalletClientSigner(walletClient);
```

### 3. Register as an ERC-8004 Agent

```typescript
import { registerAgent } from "@buildersgarden/siwa/registry";

const result = await registerAgent({
  agentURI: "data:application/json;base64,...",  // or ipfs://...
  chainId: 84532,  // Base Sepolia
  signer,
});

console.log("Registered! Agent ID:", result.agentId);
console.log("Registry:", result.agentRegistry);
```

### 4. Sign In with SIWA

```typescript
import { signSIWAMessage } from "@buildersgarden/siwa";

const { message, signature, address } = await signSIWAMessage({
  domain: "example.com",
  uri: "https://example.com/siwa",
  agentId: result.agentId,
  agentRegistry: result.agentRegistry,
  chainId: 84532,
  nonce: "random-nonce-from-server",
  issuedAt: new Date().toISOString(),
}, signer);

// Send to server for verification
const response = await fetch("https://example.com/siwa/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message, signature }),
});
```

---

## Signer Interface

The SDK uses a simple `Signer` interface:

```typescript
interface Signer {
  getAddress(): Promise<Address>;
  signMessage(message: string): Promise<Hex>;
  signRawMessage?(rawHex: Hex): Promise<Hex>;
}

interface TransactionSigner extends Signer {
  signTransaction(tx: TransactionRequest): Promise<Hex>;
}
```

Both `createLocalAccountSigner()` and `createWalletClientSigner()` return objects implementing these interfaces.

---

## ERC-8004 Registration

### What is ERC-8004?

ERC-8004 is an onchain agent registry. Registering gives your agent:
- A unique **Agent ID** on a specific chain
- An **Agent Registry** identifier (e.g., `eip155:84532:0x8004...`)
- Onchain **metadata** (name, description, capabilities)
- A foundation for **reputation** tracking

### Creating Agent Metadata

Your agent needs a metadata URI. Two options:

**Option A: Base64 Data URI (Simple, no dependencies)**

```typescript
const metadata = {
  name: "My Agent",
  description: "A helpful AI assistant",
  capabilities: ["chat", "analysis"],
  version: "1.0.0",
};

const encoded = Buffer.from(JSON.stringify(metadata)).toString("base64");
const agentURI = `data:application/json;base64,${encoded}`;
```

**Option B: IPFS (Recommended for production)**

```typescript
const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.PINATA_JWT}`,
  },
  body: JSON.stringify({ pinataContent: metadata }),
});
const { IpfsHash } = await res.json();
const agentURI = `ipfs://${IpfsHash}`;
```

### IMPORTANT: Before Registration

**You MUST ask the user for confirmation before registering.** Registration is an onchain transaction that:
- Costs gas (requires funded wallet)
- Cannot be undone
- Permanently associates metadata with the wallet

**Required confirmations:**
1. **Chain selection** — Ask which chain to register on (Base Sepolia for testing, Base for production)
2. **Metadata review** — Show the user the metadata that will be stored onchain and ask for approval
3. **Gas confirmation** — Inform the user about gas costs

Example confirmation prompt:
```
Ready to register your agent onchain:

  Chain: Base Sepolia (84532)
  Address: 0x1234...abcd

  Metadata:
    Name: Trading Bot
    Description: Automated DeFi trading agent
    Capabilities: swap, liquidity, yield

  Estimated gas: ~0.001 ETH

Do you want to proceed? (yes/no)
```

### Full Registration Example

```typescript
import { createLocalAccountSigner } from "@buildersgarden/siwa/signer";
import { registerAgent } from "@buildersgarden/siwa/registry";
import { ensureIdentityExists, writeIdentityField } from "@buildersgarden/siwa/identity";
import { privateKeyToAccount } from "viem/accounts";

async function registerMyAgent() {
  // 1. Create signer from private key
  const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
  const signer = createLocalAccountSigner(account);

  // 2. Initialize identity file
  const identityPath = "./SIWA_IDENTITY.md";
  ensureIdentityExists(identityPath);

  // 3. Prepare metadata (get from user input!)
  const metadata = {
    name: "Trading Bot",
    description: "Automated DeFi trading agent",
    capabilities: ["swap", "liquidity", "yield"],
  };
  const encoded = Buffer.from(JSON.stringify(metadata)).toString("base64");
  const agentURI = `data:application/json;base64,${encoded}`;

  // 4. Register onchain
  const result = await registerAgent({
    agentURI,
    chainId: 84532,  // Base Sepolia
    signer,
  });

  // 5. Store registration data in SIWA_IDENTITY.md
  const address = await signer.getAddress();
  writeIdentityField("Address", address, identityPath);
  writeIdentityField("Agent ID", String(result.agentId), identityPath);
  writeIdentityField("Agent Registry", result.agentRegistry, identityPath);
  writeIdentityField("Chain ID", "84532", identityPath);

  console.log("Registration successful!");
  console.log("  Agent ID:", result.agentId);
  console.log("  Registry:", result.agentRegistry);
  console.log("  Tx Hash:", result.txHash);
  console.log("  Identity saved to:", identityPath);

  return result;
}
```

### SIWA_IDENTITY.md

After registration, your identity file will contain:

```markdown
# SIWA Identity

- **Address**: `0x1234...abcd`
- **Agent ID**: `42`
- **Agent Registry**: `eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e`
- **Chain ID**: `84532`
```

This file is used by:
- `readIdentity()` to load your agent's identity for SIWA sign-in
- `isRegistered()` to check if registration is complete
- Your application to persist identity across sessions

### Registry Addresses

Read from references/contract-addresses.md
---

## SIWA Authentication

### What is SIWA?

SIWA (Sign-In With Agent) is like "Sign-In With Ethereum" but for registered agents. It proves:
1. Ownership of a wallet address
2. Registration as an ERC-8004 agent
3. The agent's onchain identity (ID + registry)

### Client-Side Flow

```typescript
import { signSIWAMessage } from "@buildersgarden/siwa";
import { createWalletClientSigner } from "@buildersgarden/siwa/signer";

async function signIn(walletClient, agentId, agentRegistry, chainId) {
  const signer = createWalletClientSigner(walletClient);

  // 1. Request nonce from your server
  const nonceRes = await fetch("/api/siwa/nonce", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: await signer.getAddress(),
      agentId,
      agentRegistry,
    }),
  });
  const { nonce, issuedAt, expirationTime } = await nonceRes.json();

  // 2. Sign the SIWA message
  const { message, signature } = await signSIWAMessage({
    domain: window.location.host,
    uri: window.location.origin,
    agentId,
    agentRegistry,
    chainId,
    nonce,
    issuedAt,
    expirationTime,
  }, signer);

  // 3. Verify with server
  const verifyRes = await fetch("/api/siwa/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, signature }),
  });

  const session = await verifyRes.json();
  return session;  // { receipt, agentId, address, ... }
}
```
---

## Authenticated API Calls (ERC-8128)

After SIWA sign-in, use the receipt for authenticated requests:

```typescript
import { signAuthenticatedRequest } from "@buildersgarden/siwa/erc8128";
import { createWalletClientSigner } from "@buildersgarden/siwa/signer";

async function callProtectedAPI(walletClient, receipt) {
  const signer = createWalletClientSigner(walletClient);

  const request = new Request("https://api.example.com/agent-action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "execute", params: { ... } }),
  });

  const signedRequest = await signAuthenticatedRequest(
    request,
    receipt,
    signer,
    84532  // chainId
  );

  const response = await fetch(signedRequest);
  return response.json();
}
```

---

## SDK Reference

### Signer Module (`@buildersgarden/siwa/signer`)

| Export | Description |
|--------|-------------|
| `Signer` | Interface for message signing |
| `TransactionSigner` | Extended interface with transaction signing |
| `createLocalAccountSigner(account)` | Create signer from viem LocalAccount |
| `createWalletClientSigner(client, account?)` | Create signer from viem WalletClient |

### Main Module (`@buildersgarden/siwa`)

| Export | Description |
|--------|-------------|
| `signSIWAMessage(fields, signer)` | Sign a SIWA authentication message |
| `verifySIWA(message, signature, options)` | Verify SIWA signature + onchain registration |
| `parseSIWAMessage(message)` | Parse SIWA message string to fields |
| `buildSIWAMessage(fields)` | Build SIWA message from fields |

### Registry Module (`@buildersgarden/siwa/registry`)

| Export | Description |
|--------|-------------|
| `registerAgent(options)` | Register as ERC-8004 agent onchain |
| `getAgent(id, registry, client)` | Read agent profile from registry |
| `getReputation(id, registry, client)` | Read agent reputation |

### ERC-8128 Module (`@buildersgarden/siwa/erc8128`)

| Export | Description |
|--------|-------------|
| `signAuthenticatedRequest(req, receipt, signer, chainId)` | Sign HTTP request with ERC-8128 |
| `verifyAuthenticatedRequest(req, options)` | Verify signed HTTP request |

### Receipt Module (`@buildersgarden/siwa/receipt`)

| Export | Description |
|--------|-------------|
| `createReceipt(claims, options)` | Create HMAC-signed receipt |
| `verifyReceipt(receipt, secret)` | Verify and decode receipt |

---

## Troubleshooting

**"User rejected the request"** — User denied the signature request in their wallet

**"Insufficient funds"** — Wallet needs ETH for gas (registration is an onchain tx)

**"Agent not found"** — The agent ID doesn't exist in the specified registry

**"Signature verification failed"** — Message was modified or wrong signer

**"Nonce already used"** — Replay attack prevented; get a fresh nonce

---

## Further Reading

- [ERC-8004 Specification](https://eips.ethereum.org/EIPS/eip-8004) — Agent Registry standard
- [SIWA Protocol](references/siwa-spec.md) — Full authentication specification
- [ERC-8128](https://eips.ethereum.org/EIPS/eip-8128) — HTTP Message Signatures
- [viem Documentation](https://viem.sh) — Ethereum TypeScript library