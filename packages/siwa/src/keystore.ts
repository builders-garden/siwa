/**
 * keystore.ts
 *
 * Secure private key storage abstraction for ERC-8004 agents.
 *
 * Three backends, in order of preference:
 *   0. Keyring Proxy (via HMAC-authenticated HTTP) — key never enters agent process
 *   1. Ethereum V3 Encrypted JSON Keystore (via ethers.js) — password-encrypted file on disk
 *   2. Environment variable fallback (AGENT_PRIVATE_KEY) — least secure, for CI/testing only
 *
 * The private key NEVER leaves this module as a return value.
 * External code interacts only through:
 *   - createWallet()          → returns { address } (no private key)
 *   - importWallet(pk)        → stores and returns { address }
 *   - signMessage(msg)        → returns { signature }
 *   - signTransaction(tx)     → returns { signedTx }
 *   - signAuthorization(auth) → returns signed EIP-7702 authorization (no key exposed)
 *   - getAddress()            → returns the public address
 *   - hasWallet()             → returns boolean
 *
 * EIP-7702 Support (requires ethers >= 6.14.3):
 *   Wallets are standard EOAs created via ethers.Wallet.createRandom().
 *   EIP-7702 allows these EOAs to temporarily delegate to smart contract
 *   implementations via authorization lists in type 4 transactions.
 *   Use signAuthorization() to sign delegation authorizations without
 *   exposing the private key.
 *
 * Dependencies:
 *   npm install ethers
 *
 * Configuration (via env vars or passed options):
 *   KEYSTORE_BACKEND      — "encrypted-file" | "env" | "proxy" (auto-detected if omitted)
 *   KEYSTORE_PASSWORD     — Password for encrypted-file backend (prompted interactively if omitted)
 *   KEYSTORE_PATH         — Path to encrypted keystore file (default: ./agent-keystore.json)
 *   AGENT_PRIVATE_KEY     — Fallback for env backend only
 */

import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';
import { computeHmac } from './proxy-auth.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KeystoreBackend = 'encrypted-file' | 'env' | 'proxy';

export interface KeystoreConfig {
  backend?: KeystoreBackend;
  keystorePath?: string;
  password?: string;             // For encrypted-file backend
  proxyUrl?: string;             // For proxy backend — keyring proxy server URL
  proxySecret?: string;          // For proxy backend — HMAC shared secret
}

export interface WalletInfo {
  address: string;
  backend: KeystoreBackend;
  keystorePath?: string;         // Only for encrypted-file backend
}

export interface SignResult {
  signature: string;
  address: string;
}

export interface AuthorizationRequest {
  address: string;       // Contract address to delegate to
  chainId?: number;      // Optional; auto-detected if omitted
  nonce?: number;        // Optional; use current_nonce + 1 for self-sent txns
}

export interface SignedAuthorization {
  address: string;       // Delegated contract address
  nonce: number;
  chainId: number;
  yParity: number;
  r: string;
  s: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_KEYSTORE_PATH = './agent-keystore.json';

// ---------------------------------------------------------------------------
// Proxy backend — HMAC-authenticated HTTP to a keyring proxy server
// ---------------------------------------------------------------------------

async function proxyRequest(
  config: KeystoreConfig,
  endpoint: string,
  body: Record<string, unknown> = {},
): Promise<any> {
  const url = config.proxyUrl || process.env.KEYRING_PROXY_URL;
  const secret = config.proxySecret || process.env.KEYRING_PROXY_SECRET;
  if (!url) throw new Error('Proxy backend requires KEYRING_PROXY_URL or config.proxyUrl');
  if (!secret) throw new Error('Proxy backend requires KEYRING_PROXY_SECRET or config.proxySecret');

  const bodyStr = JSON.stringify(body, (_key, value) =>
    typeof value === 'bigint' ? '0x' + value.toString(16) : value
  );
  const hmacHeaders = computeHmac(secret, 'POST', endpoint, bodyStr);

  const res = await fetch(`${url}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...hmacHeaders,
    },
    body: bodyStr,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Proxy ${endpoint} failed (${res.status}): ${text}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Backend detection
// ---------------------------------------------------------------------------

export async function detectBackend(): Promise<KeystoreBackend> {
  // 0. Proxy backend (if URL is set)
  if (process.env.KEYRING_PROXY_URL) return 'proxy';

  // 1. Check for existing encrypted keystore file
  if (fs.existsSync(process.env.KEYSTORE_PATH || DEFAULT_KEYSTORE_PATH)) {
    return 'encrypted-file';
  }

  // 2. Check for env var
  if (process.env.AGENT_PRIVATE_KEY) return 'env';

  // 3. Default to encrypted-file (will be created on first use)
  return 'encrypted-file';
}

// ---------------------------------------------------------------------------
// Encrypted V3 JSON Keystore backend (ethers.js built-in)
// ---------------------------------------------------------------------------

async function encryptedFileStore(
  privateKey: string,
  address: string,
  password: string,
  filePath: string
): Promise<void> {
  const account: { address: string; privateKey: string } = { address, privateKey };
  // ethers v6: encryptKeystoreJsonSync or encryptKeystoreJson
  const json = await ethers.encryptKeystoreJson(account, password);
  fs.writeFileSync(filePath, json, { mode: 0o600 }); // Owner-only read/write
}

async function encryptedFileLoad(password: string, filePath: string): Promise<string | null> {
  if (!fs.existsSync(filePath)) return null;
  const json = fs.readFileSync(filePath, 'utf-8');
  const wallet = await ethers.Wallet.fromEncryptedJson(json, password);
  return wallet.privateKey;
}

function encryptedFileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

// ---------------------------------------------------------------------------
// Password derivation for encrypted-file backend
//
// When no explicit password is given, derive one from the machine's identity.
// This is NOT meant as a strong user password — it's a fallback so agents
// can operate without interactive prompts. For production, always set
// KEYSTORE_PASSWORD or use the OS keychain.
// ---------------------------------------------------------------------------

function deriveMachinePassword(): string {
  const factors = [
    process.env.USER || process.env.USERNAME || 'agent',
    process.env.HOME || process.env.USERPROFILE || '/tmp',
    os.hostname(),
    os.platform(),
  ];
  return crypto
    .createHash('sha256')
    .update(factors.join(':'))
    .digest('hex');
}

// ---------------------------------------------------------------------------
// Public API — the ONLY way external code touches private keys
// ---------------------------------------------------------------------------

/**
 * Create a new random wallet and store it securely.
 * Returns only the public address — NEVER the private key.
 */
export async function createWallet(config: KeystoreConfig = {}): Promise<WalletInfo> {
  const backend = config.backend || await detectBackend();
  const keystorePath = config.keystorePath || process.env.KEYSTORE_PATH || DEFAULT_KEYSTORE_PATH;

  if (backend === 'proxy') {
    const data = await proxyRequest(config, '/create-wallet');
    return { address: data.address, backend, keystorePath: undefined };
  }

  const wallet = ethers.Wallet.createRandom();
  const privateKey = wallet.privateKey;
  const address = wallet.address;

  switch (backend) {
    case 'encrypted-file': {
      const password = config.password || process.env.KEYSTORE_PASSWORD || deriveMachinePassword();
      await encryptedFileStore(privateKey, address, password, keystorePath);
      break;
    }

    case 'env':
      // For env backend, we print the key ONCE for the operator to capture.
      // This is the ONLY time the raw key is ever exposed.
      console.log('=== ENV BACKEND (testing only) ===');
      console.log(`Set this in your environment:`);
      console.log(`  export AGENT_PRIVATE_KEY="${privateKey}"`);
      console.log('=================================');
      break;
  }

  return {
    address,
    backend,
    keystorePath: backend === 'encrypted-file' ? keystorePath : undefined,
  };
}

/**
 * Import an existing private key into the secure store.
 * After calling this, the caller should discard its copy of the key.
 * Returns only the public address.
 */
export async function importWallet(
  privateKey: string,
  config: KeystoreConfig = {}
): Promise<WalletInfo> {
  const backend = config.backend || await detectBackend();
  if (backend === 'proxy') {
    throw new Error('importWallet() is not supported via proxy. Import the wallet on the proxy server directly.');
  }

  const keystorePath = config.keystorePath || process.env.KEYSTORE_PATH || DEFAULT_KEYSTORE_PATH;

  const wallet = new ethers.Wallet(privateKey);
  const address = wallet.address;

  switch (backend) {
    case 'encrypted-file': {
      const password = config.password || process.env.KEYSTORE_PASSWORD || deriveMachinePassword();
      await encryptedFileStore(privateKey, address, password, keystorePath);
      break;
    }

    case 'env':
      // Nothing to persist for env backend
      break;
  }

  return {
    address,
    backend,
    keystorePath: backend === 'encrypted-file' ? keystorePath : undefined,
  };
}

/**
 * Check if a wallet is available in any backend.
 */
export async function hasWallet(config: KeystoreConfig = {}): Promise<boolean> {
  const backend = config.backend || await detectBackend();
  if (backend === 'proxy') {
    const data = await proxyRequest(config, '/has-wallet');
    return data.hasWallet;
  }

  const keystorePath = config.keystorePath || process.env.KEYSTORE_PATH || DEFAULT_KEYSTORE_PATH;

  switch (backend) {
    case 'encrypted-file':
      return encryptedFileExists(keystorePath);
    case 'env':
      return !!process.env.AGENT_PRIVATE_KEY;
  }
}

/**
 * Get the wallet's public address (no private key exposed).
 */
export async function getAddress(config: KeystoreConfig = {}): Promise<string | null> {
  const backend = config.backend || await detectBackend();
  if (backend === 'proxy') {
    const data = await proxyRequest(config, '/get-address');
    return data.address;
  }

  const wallet = await _loadWalletInternal(config);
  if (!wallet) return null;
  const address = wallet.address;
  // wallet goes out of scope and is GC'd — private key not returned
  return address;
}

/**
 * Sign a message (EIP-191 personal_sign).
 * The private key is loaded, used, and immediately discarded.
 * Only the signature is returned.
 */
export async function signMessage(
  message: string,
  config: KeystoreConfig = {}
): Promise<SignResult> {
  const backend = config.backend || await detectBackend();
  if (backend === 'proxy') {
    const data = await proxyRequest(config, '/sign-message', { message });
    return { signature: data.signature, address: data.address };
  }

  const wallet = await _loadWalletInternal(config);
  if (!wallet) throw new Error('No wallet found. Run createWallet() first.');

  const signature = await wallet.signMessage(message);
  const address = wallet.address;
  // wallet goes out of scope — private key discarded
  return { signature, address };
}

/**
 * Sign a transaction.
 * The private key is loaded, used, and immediately discarded.
 * Only the signed transaction is returned.
 */
export async function signTransaction(
  tx: ethers.TransactionRequest,
  config: KeystoreConfig = {}
): Promise<{ signedTx: string; address: string }> {
  const backend = config.backend || await detectBackend();
  if (backend === 'proxy') {
    const data = await proxyRequest(config, '/sign-transaction', { tx: tx as Record<string, unknown> });
    return { signedTx: data.signedTx, address: data.address };
  }

  const wallet = await _loadWalletInternal(config);
  if (!wallet) throw new Error('No wallet found. Run createWallet() first.');

  const signedTx = await wallet.signTransaction(tx);
  const address = wallet.address;
  return { signedTx, address };
}

/**
 * Sign an EIP-7702 authorization for delegating the EOA to a contract.
 * Requires ethers >= 6.14.3.
 *
 * This allows the agent's EOA to temporarily act as a smart contract
 * during a type 4 transaction. The private key is loaded, used, and
 * immediately discarded — only the signed authorization tuple is returned.
 *
 * @param auth — Authorization request (target contract address, optional chainId/nonce)
 * @returns Signed authorization tuple (address, nonce, chainId, yParity, r, s)
 */
export async function signAuthorization(
  auth: AuthorizationRequest,
  config: KeystoreConfig = {}
): Promise<SignedAuthorization> {
  const backend = config.backend || await detectBackend();
  if (backend === 'proxy') {
    const data = await proxyRequest(config, '/sign-authorization', { auth });
    return data as SignedAuthorization;
  }

  const wallet = await _loadWalletInternal(config);
  if (!wallet) throw new Error('No wallet found. Run createWallet() first.');

  // ethers v6.14.3+ exposes wallet.authorize()
  if (typeof (wallet as any).authorize !== 'function') {
    throw new Error(
      'wallet.authorize() not available. EIP-7702 requires ethers >= 6.14.3. ' +
      'Run: pnpm add ethers@latest'
    );
  }

  const authorization = await (wallet as any).authorize({
    address: auth.address,
    ...(auth.chainId !== undefined && { chainId: auth.chainId }),
    ...(auth.nonce !== undefined && { nonce: auth.nonce }),
  });

  // wallet goes out of scope — private key discarded
  return authorization as SignedAuthorization;
}

/**
 * Get a connected signer (for contract interactions).
 * NOTE: This returns a signer with the private key in memory.
 * Use only within a narrow scope and discard immediately.
 * Prefer signMessage() / signTransaction() when possible.
 */
export async function getSigner(
  provider: ethers.Provider,
  config: KeystoreConfig = {}
): Promise<ethers.Wallet> {
  const backend = config.backend || await detectBackend();
  if (backend === 'proxy') {
    throw new Error('getSigner() is not supported via proxy. The private key cannot be serialized over HTTP. Use signMessage() or signTransaction() instead.');
  }

  const wallet = await _loadWalletInternal(config);
  if (!wallet) throw new Error('No wallet found. Run createWallet() first.');
  return wallet.connect(provider);
}

/**
 * Delete the stored wallet from the active backend.
 * DESTRUCTIVE — the identity is lost if no backup exists.
 */
export async function deleteWallet(config: KeystoreConfig = {}): Promise<boolean> {
  const backend = config.backend || await detectBackend();
  if (backend === 'proxy') {
    throw new Error('deleteWallet() is not supported via proxy. Delete the wallet on the proxy server directly.');
  }

  const keystorePath = config.keystorePath || process.env.KEYSTORE_PATH || DEFAULT_KEYSTORE_PATH;

  switch (backend) {
    case 'encrypted-file':
      if (fs.existsSync(keystorePath)) {
        fs.unlinkSync(keystorePath);
        return true;
      }
      return false;
    case 'env':
      console.warn('Cannot delete env-based wallet. Unset AGENT_PRIVATE_KEY manually.');
      return false;
  }
}

// ---------------------------------------------------------------------------
// Internal — loads the wallet. NEVER exposed publicly.
// ---------------------------------------------------------------------------

async function _loadWalletInternal(config: KeystoreConfig = {}): Promise<ethers.Wallet | null> {
  const backend = config.backend || await detectBackend();
  const keystorePath = config.keystorePath || process.env.KEYSTORE_PATH || DEFAULT_KEYSTORE_PATH;

  let privateKey: string | null = null;

  switch (backend) {
    case 'encrypted-file': {
      const password = config.password || process.env.KEYSTORE_PASSWORD || deriveMachinePassword();
      privateKey = await encryptedFileLoad(password, keystorePath);
      break;
    }

    case 'env':
      privateKey = process.env.AGENT_PRIVATE_KEY || null;
      break;
  }

  if (!privateKey) return null;
  return new ethers.Wallet(privateKey);
}
