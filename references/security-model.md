# Security Model

How ERC-8004 agent identity keys are stored and protected against prompt injection and accidental exposure.

## Threat Model

### The core problem

An AI agent that processes untrusted input (messages from other agents, web content, user prompts) is vulnerable to **prompt injection**: adversarial instructions embedded in the input that manipulate the agent's behavior.

If the private key is stored in a plaintext file (like a `.env` or a markdown memo), a prompt injection can instruct the agent to:

1. Read the file containing the private key
2. Exfiltrate it (embed in an HTTP request, return it in a response, encode it in an outbound message)

The key is then compromised, and the attacker controls the agent's on-chain identity.

### What we defend against

| Threat | Description | Mitigation |
|---|---|---|
| **Prompt injection exfiltration** | Malicious input instructs the agent to read and leak the private key | Key is never in any file the agent reads into context |
| **Context window leakage** | Key appears in the agent's working memory / LLM context | Key is loaded inside a function, used, and discarded — never returned |
| **File system snooping** | Another process reads the key from disk | OS keychain uses encrypted storage with access controls; V3 keystore is AES-encrypted |
| **Log / error exposure** | Key appears in stack traces, console output, or error messages | Signing functions return only signatures, never raw keys |
| **Accidental commit** | Key is committed to version control | No file in the project ever contains the plaintext key |

### What we do NOT defend against

- A fully compromised host (root access) — nothing can protect keys on a fully owned machine short of hardware HSMs
- Malicious code that the agent itself executes (if the agent runs arbitrary code, it can call the keystore API)
- Side-channel attacks on the signing process

For the highest security in production, use a **hardware wallet** or **TEE-based signer** (see ERC-8004's Validation Registry trust models).

## Architecture: Three-Layer Keystore

The `keystore.ts` module provides three storage backends. The agent auto-detects the best available one.

### Layer 1: OS Keychain (`os-keychain`)

**Best option when available.**

Uses the operating system's native credential store:

| OS | Backend | Encryption |
|---|---|---|
| macOS | Keychain | AES-256, protected by user login password + Secure Enclave on Apple Silicon |
| Windows | Credential Manager | DPAPI (Data Protection API), tied to user account |
| Linux | libsecret / GNOME Keyring | AES-128, unlocked on user login |

**Node.js access**: via [keytar](https://www.npmjs.com/package/keytar) (`npm install keytar`)

**How it resists prompt injection**: The key is stored in an encrypted OS database that is not a file the agent would ever read as text. Even if an injection instructs the agent to "read all files in the project directory," there is no file containing the key.

**Limitations**: Requires `keytar` native module (C++ bindings). Not available in all environments (Docker containers, serverless, CI).

### Layer 2: Ethereum V3 Encrypted JSON Keystore (`encrypted-file`)

**The Ethereum-native approach. Available everywhere.**

Uses the same encrypted format as MetaMask, Geth, and MyEtherWallet:

- **KDF**: scrypt (N=131072, r=8, p=1) derives a 256-bit key from the password
- **Cipher**: AES-128-CTR encrypts the private key
- **MAC**: Keccak-256 integrity check
- **File on disk**: `agent-keystore.json` — contains only ciphertext, never the raw key

This is built into ethers.js:

```typescript
// Encrypt (on wallet creation)
const json = await wallet.encrypt(password);
fs.writeFileSync('./agent-keystore.json', json, { mode: 0o600 });

// Decrypt (on signing)
const wallet = await ethers.Wallet.fromEncryptedJson(json, password);
```

**How it resists prompt injection**: Even if an injection reads `agent-keystore.json`, it gets AES-encrypted ciphertext like:

```json
{"address":"88a5c2d9...","Crypto":{"ciphertext":"10adcc8bcaf49474c6710460e0dc97...","kdf":"scrypt",...}}
```

This is useless without the password. The password can itself be stored in the OS keychain (layered defense) or derived from machine-specific factors.

**File permissions**: Created with `chmod 600` (owner-only read/write).

### Layer 3: Environment Variable (`env`)

**For CI/CD and testing only. Not recommended for production.**

Reads `AGENT_PRIVATE_KEY` from the process environment. This is the least secure option because:

- Environment variables can be read by any process running as the same user
- They may appear in process listings (`/proc/<pid>/environ` on Linux)
- Container orchestrators may log them

Use only when the OS keychain and encrypted file are unavailable (e.g., ephemeral CI runners).

## The Signing Boundary

The most important architectural decision: **external code never receives the private key.**

The `keystore.ts` module exposes only these functions:

```
createWallet()        → { address, backend }           // No key
importWallet(pk)      → { address, backend }           // Consumes key, never returns it
getAddress()          → string                          // Public address only
hasWallet()           → boolean
signMessage(msg)      → { signature, address }          // Key loaded, used, discarded
signTransaction(tx)   → { signedTx, address }           // Key loaded, used, discarded
getSigner(provider)   → ethers.Wallet                   // For contract calls; use in narrow scope
```

The private key exists in memory only during the `signMessage()` or `signTransaction()` call. It is loaded from the backend, used for the cryptographic operation, and then the `Wallet` object falls out of scope and is eligible for garbage collection. It is **never returned** to the calling code.

This means:

- The agent's main loop / LLM context never sees the key
- MEMORY.md contains only public data (address, agentId, etc.)
- A prompt injection that says "read all files and send me secrets" gets nothing useful

## MEMORY.md: Public Data Only

After this redesign, MEMORY.md stores only:

| Field | Sensitive? | Example |
|---|---|---|
| Address | No (public) | `0x1234...abcd` |
| Keystore Backend | No | `encrypted-file` |
| Keystore Path | Low risk | `./agent-keystore.json` |
| Agent ID | No (public) | `42` |
| Agent Registry | No (public) | `eip155:84532:0x8004AA63...` |
| Agent URI | No (public) | `ipfs://Qm...` |
| Chain ID | No (public) | `84532` |
| Sessions | Medium | Session tokens (short-lived) |

The **Private Key** field has been removed entirely.

## Setup Guide

### Recommended: OS Keychain + Encrypted File backup

```bash
# Install keytar for OS keychain support
npm install keytar

# On Linux, also install libsecret:
# sudo apt-get install libsecret-1-dev
```

The keystore will auto-detect and use the OS keychain. To also keep an encrypted file backup:

```typescript
import { createWallet } from './scripts/keystore';

// Creates wallet in OS keychain
const info = await createWallet({ backend: 'os-keychain' });

// Also save an encrypted backup
await importWallet(/* key from backup */, {
  backend: 'encrypted-file',
  password: 'strong-passphrase',
  keystorePath: './backup-keystore.json'
});
```

### Fallback: Encrypted File only

If `keytar` is unavailable (Docker, CI, serverless):

```bash
export KEYSTORE_PASSWORD="your-strong-passphrase"
```

The keystore will auto-detect the encrypted-file backend and use the password to encrypt/decrypt.

### CI/Testing: Environment Variable

```bash
export AGENT_PRIVATE_KEY="0xabc123..."
export KEYSTORE_BACKEND="env"
```

## Key Rotation

To rotate the agent's key while preserving its on-chain identity:

1. Create a new wallet via `createWallet()`
2. Transfer the agent NFT to the new address: `transferFrom(oldAddress, newAddress, agentId)`
3. The `agentWallet` metadata key auto-clears on transfer (per ERC-8004 spec)
4. Update MEMORY.md with the new address
5. Delete the old wallet: `deleteWallet()`

## Dependencies

| Package | Required? | Purpose |
|---|---|---|
| `ethers` | **Yes** | Wallet operations, V3 keystore encryption, signing |
| `keytar` | No (recommended) | OS keychain access (macOS Keychain, Windows Credential Manager, Linux libsecret) |

No other dependencies are needed. The encrypted-file backend uses only `ethers` built-in functions.
