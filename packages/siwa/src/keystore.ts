/**
 * keystore.ts
 *
 * Secure private key storage abstraction for ERC-8004 agents.
 *
 * Three backends, in order of preference:
 *   0. Keyring Proxy (via HMAC-authenticated HTTP) — key never enters agent process
 *   1. Ethereum V3 Encrypted JSON Keystore (via @noble/ciphers) — password-encrypted file on disk
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
 * EIP-7702 Support:
 *   Wallets are standard EOAs created via viem's generatePrivateKey().
 *   EIP-7702 allows these EOAs to temporarily delegate to smart contract
 *   implementations via authorization lists in type 4 transactions.
 *   Use signAuthorization() to sign delegation authorizations without
 *   exposing the private key.
 *
 * Dependencies:
 *   npm install viem
 *
 * Configuration (via env vars or passed options):
 *   KEYSTORE_BACKEND      — "encrypted-file" | "env" | "proxy" (auto-detected if omitted)
 *   KEYSTORE_PASSWORD     — Password for encrypted-file backend (prompted interactively if omitted)
 *   KEYSTORE_PATH         — Path to encrypted keystore file (default: ./agent-keystore.json)
 *   AGENT_PRIVATE_KEY     — Fallback for env backend only
 */

import {
  createWalletClient,
  http,
  type WalletClient,
  type TransactionRequest,
  type Account,
  type Chain,
  type Transport,
  type Hex,
  type Address,
  type SignableMessage,
  serializeTransaction,
  keccak256,
  toBytes,
  toHex,
  concat,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { hashAuthorization } from 'viem/experimental';
import { scrypt } from '@noble/hashes/scrypt';
import { randomBytes } from '@noble/hashes/utils';
import { ctr } from '@noble/ciphers/aes';
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

// Transaction type compatible with viem
export interface TransactionLike {
  to?: string;
  data?: string;
  value?: bigint;
  nonce?: number;
  chainId?: number;
  type?: number;
  maxFeePerGas?: bigint | null;
  maxPriorityFeePerGas?: bigint | null;
  gasLimit?: bigint;
  gas?: bigint;
  gasPrice?: bigint | null;
  accessList?: any[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_KEYSTORE_PATH = './agent-keystore.json';

// ---------------------------------------------------------------------------
// V3 Keystore Implementation (using noble-ciphers)
// ---------------------------------------------------------------------------

interface V3Keystore {
  version: 3;
  id: string;
  address: string;
  crypto: {
    ciphertext: string;
    cipherparams: { iv: string };
    cipher: string;
    kdf: string;
    kdfparams: {
      dklen: number;
      salt: string;
      n: number;
      r: number;
      p: number;
    };
    mac: string;
  };
}

function generateUUID(): string {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  const hex = toHex(bytes).slice(2);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

async function encryptKeystore(
  privateKey: Hex,
  password: string
): Promise<string> {
  const privateKeyBytes = toBytes(privateKey);
  const salt = randomBytes(32);
  const iv = randomBytes(16);

  // Scrypt parameters (standard for V3 keystores)
  const n = 262144; // 2^18
  const r = 8;
  const p = 1;
  const dklen = 32;

  // Derive key using scrypt
  const derivedKey = scrypt(new TextEncoder().encode(password), salt, { N: n, r, p, dkLen: dklen });

  // Encrypt private key with AES-128-CTR
  const encryptionKey = derivedKey.slice(0, 16);
  const cipher = ctr(encryptionKey, iv);
  const ciphertext = cipher.encrypt(privateKeyBytes);

  // Calculate MAC: keccak256(derivedKey[16:32] + ciphertext)
  const macData = concat([toHex(derivedKey.slice(16, 32)) as Hex, toHex(ciphertext) as Hex]);
  const mac = keccak256(macData);

  // Get address from private key
  const account = privateKeyToAccount(privateKey);

  const keystore: V3Keystore = {
    version: 3,
    id: generateUUID(),
    address: account.address.toLowerCase().slice(2),
    crypto: {
      ciphertext: toHex(ciphertext).slice(2),
      cipherparams: { iv: toHex(iv).slice(2) },
      cipher: 'aes-128-ctr',
      kdf: 'scrypt',
      kdfparams: {
        dklen,
        salt: toHex(salt).slice(2),
        n,
        r,
        p,
      },
      mac: mac.slice(2),
    },
  };

  return JSON.stringify(keystore);
}

async function decryptKeystore(
  json: string,
  password: string
): Promise<Hex> {
  const keystore: V3Keystore = JSON.parse(json);

  if (keystore.version !== 3) {
    throw new Error(`Unsupported keystore version: ${keystore.version}`);
  }

  const { crypto: cryptoData } = keystore;

  if (cryptoData.kdf !== 'scrypt') {
    throw new Error(`Unsupported KDF: ${cryptoData.kdf}`);
  }

  if (cryptoData.cipher !== 'aes-128-ctr') {
    throw new Error(`Unsupported cipher: ${cryptoData.cipher}`);
  }

  const { kdfparams } = cryptoData;
  const salt = toBytes(`0x${kdfparams.salt}`);
  const iv = toBytes(`0x${cryptoData.cipherparams.iv}`);
  const ciphertext = toBytes(`0x${cryptoData.ciphertext}`);

  // Derive key using scrypt
  const derivedKey = scrypt(
    new TextEncoder().encode(password),
    salt,
    { N: kdfparams.n, r: kdfparams.r, p: kdfparams.p, dkLen: kdfparams.dklen }
  );

  // Verify MAC
  const macData = concat([toHex(derivedKey.slice(16, 32)) as Hex, toHex(ciphertext) as Hex]);
  const calculatedMac = keccak256(macData).slice(2);

  if (calculatedMac.toLowerCase() !== cryptoData.mac.toLowerCase()) {
    throw new Error('Invalid password or corrupted keystore');
  }

  // Decrypt private key with AES-128-CTR
  const encryptionKey = derivedKey.slice(0, 16);
  const cipher = ctr(encryptionKey, iv);
  const privateKeyBytes = cipher.decrypt(ciphertext);

  return toHex(privateKeyBytes) as Hex;
}

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
// Encrypted V3 JSON Keystore backend
// ---------------------------------------------------------------------------

async function encryptedFileStore(
  privateKey: Hex,
  password: string,
  filePath: string
): Promise<void> {
  const json = await encryptKeystore(privateKey, password);
  fs.writeFileSync(filePath, json, { mode: 0o600 }); // Owner-only read/write
}

async function encryptedFileLoad(password: string, filePath: string): Promise<Hex | null> {
  if (!fs.existsSync(filePath)) return null;
  const json = fs.readFileSync(filePath, 'utf-8');
  return decryptKeystore(json, password);
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

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const address = account.address;

  switch (backend) {
    case 'encrypted-file': {
      const password = config.password || process.env.KEYSTORE_PASSWORD || deriveMachinePassword();
      await encryptedFileStore(privateKey, password, keystorePath);
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

  const hexKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as Hex;
  const account = privateKeyToAccount(hexKey);
  const address = account.address;

  switch (backend) {
    case 'encrypted-file': {
      const password = config.password || process.env.KEYSTORE_PASSWORD || deriveMachinePassword();
      await encryptedFileStore(hexKey, password, keystorePath);
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

  const privateKey = await _loadPrivateKeyInternal(config);
  if (!privateKey) return null;
  const account = privateKeyToAccount(privateKey);
  return account.address;
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

  const privateKey = await _loadPrivateKeyInternal(config);
  if (!privateKey) throw new Error('No wallet found. Run createWallet() first.');

  const account = privateKeyToAccount(privateKey);
  const signature = await account.signMessage({ message });
  return { signature, address: account.address };
}

/**
 * Sign a transaction.
 * The private key is loaded, used, and immediately discarded.
 * Only the signed transaction is returned.
 */
export async function signTransaction(
  tx: TransactionLike,
  config: KeystoreConfig = {}
): Promise<{ signedTx: string; address: string }> {
  const backend = config.backend || await detectBackend();
  if (backend === 'proxy') {
    const data = await proxyRequest(config, '/sign-transaction', { tx: tx as Record<string, unknown> });
    return { signedTx: data.signedTx, address: data.address };
  }

  const privateKey = await _loadPrivateKeyInternal(config);
  if (!privateKey) throw new Error('No wallet found. Run createWallet() first.');

  const account = privateKeyToAccount(privateKey);

  // Build transaction request for viem
  const viemTx: any = {
    to: tx.to as Address | undefined,
    data: tx.data as Hex | undefined,
    value: tx.value,
    nonce: tx.nonce,
    chainId: tx.chainId,
    gas: tx.gasLimit ?? tx.gas,
  };

  // Handle EIP-1559 vs legacy transactions
  if (tx.type === 2 || tx.maxFeePerGas !== undefined) {
    viemTx.type = 'eip1559';
    viemTx.maxFeePerGas = tx.maxFeePerGas;
    viemTx.maxPriorityFeePerGas = tx.maxPriorityFeePerGas;
  } else if (tx.gasPrice !== undefined) {
    viemTx.type = 'legacy';
    viemTx.gasPrice = tx.gasPrice;
  }

  if (tx.accessList) {
    viemTx.accessList = tx.accessList;
  }

  const signedTx = await account.signTransaction(viemTx);
  return { signedTx, address: account.address };
}

/**
 * Sign an EIP-7702 authorization for delegating the EOA to a contract.
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

  const privateKey = await _loadPrivateKeyInternal(config);
  if (!privateKey) throw new Error('No wallet found. Run createWallet() first.');

  const account = privateKeyToAccount(privateKey);

  // EIP-7702 authorization signing using viem experimental
  const chainId = auth.chainId ?? 1;
  const nonce = auth.nonce ?? 0;

  // Hash the authorization struct according to EIP-7702
  const authHash = hashAuthorization({
    contractAddress: auth.address as Address,
    chainId,
    nonce,
  });

  // Sign the authorization hash
  const signature = await account.sign({ hash: authHash });

  // Parse signature into r, s, yParity
  const r = signature.slice(0, 66) as Hex;
  const s = `0x${signature.slice(66, 130)}` as Hex;
  const v = parseInt(signature.slice(130, 132), 16);
  const yParity = v - 27; // Convert v to yParity (0 or 1)

  return {
    address: auth.address,
    nonce,
    chainId,
    yParity,
    r,
    s,
  };
}

/**
 * Get a wallet client for contract interactions.
 * NOTE: This creates a client with the private key in memory.
 * Use only within a narrow scope and discard immediately.
 * Prefer signMessage() / signTransaction() when possible.
 */
export async function getWalletClient(
  rpcUrl: string,
  config: KeystoreConfig = {}
): Promise<WalletClient<Transport, Chain | undefined, Account>> {
  const backend = config.backend || await detectBackend();
  if (backend === 'proxy') {
    throw new Error('getWalletClient() is not supported via proxy. The private key cannot be serialized over HTTP. Use signMessage() or signTransaction() instead.');
  }

  const privateKey = await _loadPrivateKeyInternal(config);
  if (!privateKey) throw new Error('No wallet found. Run createWallet() first.');

  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    transport: http(rpcUrl),
  });
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
// Internal — loads the private key. NEVER exposed publicly.
// ---------------------------------------------------------------------------

async function _loadPrivateKeyInternal(config: KeystoreConfig = {}): Promise<Hex | null> {
  const backend = config.backend || await detectBackend();
  const keystorePath = config.keystorePath || process.env.KEYSTORE_PATH || DEFAULT_KEYSTORE_PATH;

  let privateKey: Hex | null = null;

  switch (backend) {
    case 'encrypted-file': {
      const password = config.password || process.env.KEYSTORE_PASSWORD || deriveMachinePassword();
      privateKey = await encryptedFileLoad(password, keystorePath);
      break;
    }

    case 'env': {
      const envKey = process.env.AGENT_PRIVATE_KEY || null;
      if (envKey) {
        privateKey = (envKey.startsWith('0x') ? envKey : `0x${envKey}`) as Hex;
      }
      break;
    }
  }

  return privateKey;
}
