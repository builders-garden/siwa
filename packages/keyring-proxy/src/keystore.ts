/**
 * keystore.ts — Local encrypted-file key management for the keyring proxy.
 *
 * Uses the Ethereum V3 Encrypted JSON Keystore format (scrypt + AES-128-CTR)
 * for backward compatibility with existing deployed keystores.
 *
 * This is intentionally separate from the SDK's keystore.ts, which is
 * proxy-only (HTTP calls). The proxy itself needs direct access to the
 * private key for signing, so it uses this local implementation.
 */

import {
  type Hex,
  type Address,
  keccak256,
  toBytes,
  toHex,
  concat,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { hashAuthorization } from "viem/experimental";
import { scrypt } from "@noble/hashes/scrypt";
import { randomBytes } from "@noble/hashes/utils";
import { ctr } from "@noble/ciphers/aes";
import * as fs from "fs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LocalKeystoreConfig {
  keystorePath: string;
  password: string;
}

export interface WalletInfo {
  address: string;
}

export interface SignResult {
  signature: string;
  address: string;
}

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

export interface AuthorizationRequest {
  address: string;
  chainId?: number;
  nonce?: number;
}

export interface SignedAuthorization {
  address: string;
  nonce: number;
  chainId: number;
  yParity: number;
  r: string;
  s: string;
}

// ---------------------------------------------------------------------------
// V3 Keystore format
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

function encryptKeystore(privateKey: Hex, password: string): string {
  const privateKeyBytes = toBytes(privateKey);
  const salt = randomBytes(32);
  const iv = randomBytes(16);

  const n = 262144; // 2^18
  const r = 8;
  const p = 1;
  const dklen = 32;

  const derivedKey = scrypt(new TextEncoder().encode(password), salt, {
    N: n,
    r,
    p,
    dkLen: dklen,
  });

  const encryptionKey = derivedKey.slice(0, 16);
  const cipher = ctr(encryptionKey, iv);
  const ciphertext = cipher.encrypt(privateKeyBytes);

  const macData = concat([
    toHex(derivedKey.slice(16, 32)) as Hex,
    toHex(ciphertext) as Hex,
  ]);
  const mac = keccak256(macData);

  const account = privateKeyToAccount(privateKey);

  const keystore: V3Keystore = {
    version: 3,
    id: generateUUID(),
    address: account.address.toLowerCase().slice(2),
    crypto: {
      ciphertext: toHex(ciphertext).slice(2),
      cipherparams: { iv: toHex(iv).slice(2) },
      cipher: "aes-128-ctr",
      kdf: "scrypt",
      kdfparams: { dklen, salt: toHex(salt).slice(2), n, r, p },
      mac: mac.slice(2),
    },
  };

  return JSON.stringify(keystore);
}

function decryptKeystore(json: string, password: string): Hex {
  const keystore: V3Keystore = JSON.parse(json);

  if (keystore.version !== 3) {
    throw new Error(`Unsupported keystore version: ${keystore.version}`);
  }

  const { crypto: cryptoData } = keystore;

  if (cryptoData.kdf !== "scrypt") {
    throw new Error(`Unsupported KDF: ${cryptoData.kdf}`);
  }
  if (cryptoData.cipher !== "aes-128-ctr") {
    throw new Error(`Unsupported cipher: ${cryptoData.cipher}`);
  }

  const { kdfparams } = cryptoData;
  const salt = toBytes(`0x${kdfparams.salt}`);
  const iv = toBytes(`0x${cryptoData.cipherparams.iv}`);
  const ciphertext = toBytes(`0x${cryptoData.ciphertext}`);

  const derivedKey = scrypt(new TextEncoder().encode(password), salt, {
    N: kdfparams.n,
    r: kdfparams.r,
    p: kdfparams.p,
    dkLen: kdfparams.dklen,
  });

  const macData = concat([
    toHex(derivedKey.slice(16, 32)) as Hex,
    toHex(ciphertext) as Hex,
  ]);
  const calculatedMac = keccak256(macData).slice(2);

  if (calculatedMac.toLowerCase() !== cryptoData.mac.toLowerCase()) {
    throw new Error("Invalid password or corrupted keystore");
  }

  const encryptionKey = derivedKey.slice(0, 16);
  const cipher = ctr(encryptionKey, iv);
  const privateKeyBytes = cipher.decrypt(ciphertext);

  return toHex(privateKeyBytes) as Hex;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function loadPrivateKey(config: LocalKeystoreConfig): Hex {
  if (!fs.existsSync(config.keystorePath)) {
    throw new Error("No wallet found. Run createWallet() first.");
  }
  const json = fs.readFileSync(config.keystorePath, "utf-8");
  return decryptKeystore(json, config.password);
}

function parseBigIntFromJson(value: unknown): bigint | undefined {
  if (value === null || value === undefined) return undefined;
  let result: bigint;
  if (typeof value === "bigint") result = value;
  else if (typeof value === "number") result = BigInt(value);
  else if (typeof value === "string") result = BigInt(value);
  else return undefined;
  return result === 0n ? undefined : result;
}

function parseBigIntKeepZero(value: unknown): bigint | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") return BigInt(value);
  return undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createWallet(config: LocalKeystoreConfig): WalletInfo {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  const json = encryptKeystore(privateKey, config.password);
  fs.writeFileSync(config.keystorePath, json, { mode: 0o600 });

  return { address: account.address };
}

export function hasWallet(config: LocalKeystoreConfig): boolean {
  return fs.existsSync(config.keystorePath);
}

export function getAddress(config: LocalKeystoreConfig): string | null {
  if (!fs.existsSync(config.keystorePath)) return null;
  const json = fs.readFileSync(config.keystorePath, "utf-8");
  const keystore: V3Keystore = JSON.parse(json);
  return `0x${keystore.address}` as Address;
}

export async function signMessage(
  message: string,
  config: LocalKeystoreConfig
): Promise<SignResult> {
  const privateKey = loadPrivateKey(config);
  const account = privateKeyToAccount(privateKey);
  const signature = await account.signMessage({ message });
  return { signature, address: account.address };
}

export async function signTransaction(
  tx: TransactionLike,
  config: LocalKeystoreConfig
): Promise<{ signedTx: string; address: string }> {
  const privateKey = loadPrivateKey(config);
  const account = privateKeyToAccount(privateKey);

  const value = parseBigIntFromJson(tx.value);
  const gas = parseBigIntKeepZero(tx.gasLimit ?? tx.gas);
  const maxFeePerGas = parseBigIntKeepZero(tx.maxFeePerGas);
  const maxPriorityFeePerGas = parseBigIntKeepZero(tx.maxPriorityFeePerGas);
  const gasPrice = parseBigIntKeepZero(tx.gasPrice);

  const viemTx: any = {
    to: tx.to as Address | undefined,
    data: tx.data as Hex | undefined,
    value,
    nonce: tx.nonce,
    chainId: tx.chainId,
    gas,
  };

  if (tx.type === 2 || tx.maxFeePerGas !== undefined) {
    viemTx.type = "eip1559";
    viemTx.maxFeePerGas = maxFeePerGas;
    viemTx.maxPriorityFeePerGas = maxPriorityFeePerGas;
  } else if (tx.gasPrice !== undefined) {
    viemTx.type = "legacy";
    viemTx.gasPrice = gasPrice;
  }

  if (tx.accessList) {
    viemTx.accessList = tx.accessList;
  }

  const signedTx = await account.signTransaction(viemTx);
  return { signedTx, address: account.address };
}

export async function signAuthorization(
  auth: AuthorizationRequest,
  config: LocalKeystoreConfig
): Promise<SignedAuthorization> {
  const privateKey = loadPrivateKey(config);
  const account = privateKeyToAccount(privateKey);

  const chainId = auth.chainId ?? 1;
  const nonce = auth.nonce ?? 0;

  const authHash = hashAuthorization({
    contractAddress: auth.address as Address,
    chainId,
    nonce,
  });

  const signature = await account.sign({ hash: authHash });

  const r = signature.slice(0, 66) as Hex;
  const s = `0x${signature.slice(66, 130)}` as Hex;
  const v = parseInt(signature.slice(130, 132), 16);
  const yParity = v - 27;

  return {
    address: auth.address,
    nonce,
    chainId,
    yParity,
    r,
    s,
  };
}
