/**
 * Keyring Proxy Server
 *
 * Standalone Express server that acts as the security boundary for agent signing.
 * The agent process delegates all signing to this server over HMAC-authenticated HTTP,
 * so private keys never enter the agent's process.
 *
 * Features:
 *   - HMAC-SHA256 authentication for all requests
 *   - Audit logging for all operations
 *
 * Usage:
 *   KEYRING_PROXY_SECRET=<secret> KEYSTORE_BACKEND=encrypted-file \
 *     KEYSTORE_PASSWORD=<password> tsx src/index.ts
 *
 * Environment:
 *   KEYRING_PROXY_SECRET        — Required. Shared HMAC secret for signing operations.
 *   KEYRING_PROXY_PORT          — Listen port (default: 3100)
 *   KEYSTORE_BACKEND            — Backend: "encrypted-file" (default) or "env"
 *   KEYSTORE_PASSWORD           — Password for encrypted-file backend
 *   KEYSTORE_PATH               — Path to keystore file
 *   AGENT_PRIVATE_KEY           — Private key for env backend (0x...)
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { verifyHmac } from "@buildersgarden/siwa/proxy-auth";
import {
  privateKeyToAccount,
  generatePrivateKey,
  signMessage as viemSignMessage,
  signTransaction as viemSignTransaction,
  signAuthorization as viemSignAuthorization,
} from "viem/accounts";
import type { Hex, Address, TransactionSerializable } from "viem";

// @noble crypto libraries - audited, pure JS, type-safe
import { scrypt } from "@noble/hashes/scrypt.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes } from "@noble/hashes/utils.js";
import { ctr } from "@noble/ciphers/aes.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SECRET = process.env.KEYRING_PROXY_SECRET;
if (!SECRET) {
  console.error("FATAL: KEYRING_PROXY_SECRET is required");
  process.exit(1);
}

const PORT = parseInt(
  process.env.PORT || process.env.KEYRING_PROXY_PORT || "3100",
  10
);

type KeystoreBackend = "encrypted-file" | "env";

const innerBackend = (process.env.KEYSTORE_BACKEND ||
  "encrypted-file") as KeystoreBackend;

const KEYSTORE_PATH = process.env.KEYSTORE_PATH || "./agent-keystore.json";
const KEYSTORE_PASSWORD = process.env.KEYSTORE_PASSWORD;
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;

// Validate config
if (innerBackend === "encrypted-file" && !KEYSTORE_PASSWORD) {
  console.error("FATAL: KEYSTORE_PASSWORD is required for encrypted-file backend");
  process.exit(1);
}
if (innerBackend === "env" && !AGENT_PRIVATE_KEY) {
  console.error("FATAL: AGENT_PRIVATE_KEY is required for env backend");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Encrypted Keystore Implementation
// ---------------------------------------------------------------------------

interface EncryptedKeystore {
  version: number;
  address: string;
  crypto: {
    cipher: string;
    ciphertext: string;
    cipherparams: { iv: string };
    kdf: string;
    kdfparams: {
      n: number;
      r: number;
      p: number;
      dklen: number;
      salt: string;
    };
    mac: string;
  };
}

// Scrypt parameters - N=16384 is secure and works on most systems
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

function deriveKey(password: string, salt: Uint8Array): Uint8Array {
  return scrypt(new TextEncoder().encode(password), salt, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    dkLen: 32,
  });
}

function toHexString(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHexString(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function encryptPrivateKey(privateKey: Hex, password: string): EncryptedKeystore {
  const account = privateKeyToAccount(privateKey);
  const salt = randomBytes(32);
  const derivedKey = deriveKey(password, salt);

  const iv = randomBytes(16);
  const encryptionKey = derivedKey.subarray(0, 16);
  const cipher = ctr(encryptionKey, iv);

  // Remove 0x prefix for encryption
  const keyBytes = fromHexString(privateKey.slice(2));
  const ciphertext = cipher.encrypt(keyBytes);

  // MAC = sha256(derivedKey[16:32] + ciphertext)
  const macInput = new Uint8Array(16 + ciphertext.length);
  macInput.set(derivedKey.subarray(16, 32), 0);
  macInput.set(ciphertext, 16);
  const mac = sha256(macInput);

  return {
    version: 3,
    address: account.address.toLowerCase().slice(2),
    crypto: {
      cipher: "aes-128-ctr",
      ciphertext: toHexString(ciphertext),
      cipherparams: { iv: toHexString(iv) },
      kdf: "scrypt",
      kdfparams: {
        n: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        dklen: 32,
        salt: toHexString(salt),
      },
      mac: toHexString(mac),
    },
  };
}

function decryptPrivateKey(keystore: EncryptedKeystore, password: string): Hex {
  const salt = fromHexString(keystore.crypto.kdfparams.salt);
  const { n, r, p } = keystore.crypto.kdfparams;
  const derivedKey = scrypt(new TextEncoder().encode(password), salt, {
    N: n,
    r,
    p,
    dkLen: 32,
  });

  const ciphertext = fromHexString(keystore.crypto.ciphertext);

  // Verify MAC
  const macInput = new Uint8Array(16 + ciphertext.length);
  macInput.set(derivedKey.subarray(16, 32), 0);
  macInput.set(ciphertext, 16);
  const mac = sha256(macInput);

  if (toHexString(mac) !== keystore.crypto.mac) {
    throw new Error("Invalid password or corrupted keystore");
  }

  const iv = fromHexString(keystore.crypto.cipherparams.iv);
  const decryptionKey = derivedKey.subarray(0, 16);
  const decipher = ctr(decryptionKey, iv);
  const privateKeyBytes = decipher.decrypt(ciphertext);

  return `0x${toHexString(privateKeyBytes)}` as Hex;
}

function saveKeystore(keystore: EncryptedKeystore, keystorePath: string): void {
  const dir = path.dirname(keystorePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(keystorePath, JSON.stringify(keystore, null, 2));
}

function loadKeystore(keystorePath: string): EncryptedKeystore | null {
  if (!fs.existsSync(keystorePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(keystorePath, "utf-8"));
}

// ---------------------------------------------------------------------------
// Keystore Operations
// ---------------------------------------------------------------------------

async function getPrivateKey(): Promise<Hex> {
  if (innerBackend === "env") {
    return AGENT_PRIVATE_KEY as Hex;
  }

  // encrypted-file backend
  const keystore = loadKeystore(KEYSTORE_PATH);
  if (!keystore) {
    throw new Error("No wallet found. Call /create-wallet first.");
  }
  return decryptPrivateKey(keystore, KEYSTORE_PASSWORD!);
}

async function createWalletInternal(): Promise<{ address: string; backend: string }> {
  if (innerBackend === "env") {
    const account = privateKeyToAccount(AGENT_PRIVATE_KEY as Hex);
    return { address: account.address, backend: "env" };
  }

  // encrypted-file backend
  const existing = loadKeystore(KEYSTORE_PATH);
  if (existing) {
    throw new Error("Wallet already exists. Use /get-address to retrieve the address.");
  }

  const privateKey = generatePrivateKey();
  const keystore = encryptPrivateKey(privateKey, KEYSTORE_PASSWORD!);
  saveKeystore(keystore, KEYSTORE_PATH);

  return { address: `0x${keystore.address}`, backend: "encrypted-file" };
}

async function hasWalletInternal(): Promise<boolean> {
  if (innerBackend === "env") {
    return !!AGENT_PRIVATE_KEY;
  }
  return loadKeystore(KEYSTORE_PATH) !== null;
}

async function getAddressInternal(): Promise<string> {
  if (innerBackend === "env") {
    const account = privateKeyToAccount(AGENT_PRIVATE_KEY as Hex);
    return account.address;
  }

  const keystore = loadKeystore(KEYSTORE_PATH);
  if (!keystore) {
    throw new Error("No wallet found. Call /create-wallet first.");
  }
  return `0x${keystore.address}`;
}

async function signMessageInternal(message: string): Promise<{ signature: string; address: string }> {
  const privateKey = await getPrivateKey();
  const account = privateKeyToAccount(privateKey);
  const signature = await viemSignMessage({ message, privateKey });
  return { signature, address: account.address };
}

async function signTransactionInternal(tx: TransactionSerializable): Promise<{ signedTx: string; address: string }> {
  const privateKey = await getPrivateKey();
  const account = privateKeyToAccount(privateKey);
  const signedTx = await viemSignTransaction({ transaction: tx, privateKey });
  return { signedTx, address: account.address };
}

async function signAuthorizationInternal(auth: {
  address: string;
  chainId?: number;
  nonce?: number;
}): Promise<any> {
  const privateKey = await getPrivateKey();
  const account = privateKeyToAccount(privateKey);

  const authRequest = {
    address: auth.address as Address,
    chainId: auth.chainId || 1,
    nonce: auth.nonce ?? 0,
  };

  const signedAuth = await viemSignAuthorization({
    ...authRequest,
    privateKey,
  });

  return signedAuth;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively converts BigInt values to strings for JSON serialization.
 * viem returns BigInt values which can't be serialized by JSON.stringify.
 */
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === "object") {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInt(value);
    }
    return result;
  }
  return obj;
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

interface AuditEntry {
  timestamp: string;
  method: string;
  path: string;
  sourceIp: string;
  success: boolean;
  error?: string;
}

export const auditLog: AuditEntry[] = [];

function audit(req: Request, success: boolean, error?: string) {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    sourceIp: req.ip || req.socket.remoteAddress || "unknown",
    success,
    error,
  };
  auditLog.push(entry);
  const status = success ? "OK" : "FAIL";
  const errStr = error ? ` — ${error}` : "";
  console.log(
    `[AUDIT] ${entry.timestamp} ${status} ${req.method} ${req.path} from ${entry.sourceIp}${errStr}`
  );
}

// ---------------------------------------------------------------------------
// Express setup
// ---------------------------------------------------------------------------

const app = express();

// Raw body capture for HMAC verification
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

// ---------------------------------------------------------------------------
// HMAC auth middleware
// ---------------------------------------------------------------------------

/**
 * Main HMAC authentication middleware.
 */
function hmacAuth(req: Request, res: Response, next: NextFunction) {
  if (req.path === "/health") return next();

  const timestamp = req.headers["x-keyring-timestamp"] as string;
  const signature = req.headers["x-keyring-signature"] as string;

  if (!timestamp || !signature) {
    audit(req, false, "Missing HMAC headers");
    res.status(401).json({
      error: "Missing HMAC headers",
      expected: {
        "X-Keyring-Timestamp": "<milliseconds since epoch>",
        "X-Keyring-Signature":
          "<HMAC-SHA256 hex of METHOD\\nPATH\\nTIMESTAMP\\nBODY>",
      },
      hint: "Use the SDK: import { computeHmac } from '@buildersgarden/siwa/proxy-auth'",
    });
    return;
  }

  const rawBody = (req as any).rawBody || "";

  const result = verifyHmac(
    SECRET!,
    req.method,
    req.path,
    rawBody,
    timestamp,
    signature
  );

  if (!result.valid) {
    audit(req, false, result.error);
    res.status(401).json({
      error: result.error,
      payload_format: "METHOD\\nPATH\\nTIMESTAMP\\nBODY",
      hint: "Use the SDK: import { computeHmac } from '@buildersgarden/siwa/proxy-auth'",
    });
    return;
  }

  return next();
}

app.use(hmacAuth);

// ---------------------------------------------------------------------------
// Health endpoint
// ---------------------------------------------------------------------------

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    backend: innerBackend,
  });
});

// ---------------------------------------------------------------------------
// Wallet endpoints
// ---------------------------------------------------------------------------

app.post("/create-wallet", async (req: Request, res: Response) => {
  try {
    const info = await createWalletInternal();
    audit(req, true);
    res.json({
      address: info.address,
      backend: info.backend,
    });
  } catch (err: any) {
    audit(req, false, err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/has-wallet", async (req: Request, res: Response) => {
  try {
    const exists = await hasWalletInternal();
    audit(req, true);
    res.json({ hasWallet: exists });
  } catch (err: any) {
    audit(req, false, err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/get-address", async (req: Request, res: Response) => {
  try {
    const address = await getAddressInternal();
    audit(req, true);
    res.json({ address });
  } catch (err: any) {
    audit(req, false, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Signing endpoints
// ---------------------------------------------------------------------------

app.post("/sign-message", async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    if (typeof message !== "string") {
      audit(req, false, "Missing message field");
      res.status(400).json({ error: 'Missing "message" field' });
      return;
    }

    const result = await signMessageInternal(message);
    audit(req, true);
    res.json(result);
  } catch (err: any) {
    audit(req, false, err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/sign-transaction", async (req: Request, res: Response) => {
  try {
    const { tx } = req.body;
    if (!tx || typeof tx !== "object") {
      audit(req, false, "Missing tx field");
      res.status(400).json({ error: 'Missing "tx" field' });
      return;
    }

    const result = await signTransactionInternal(tx);
    audit(req, true);
    res.json(result);
  } catch (err: any) {
    audit(req, false, err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/sign-authorization", async (req: Request, res: Response) => {
  try {
    const { auth } = req.body;
    if (!auth || typeof auth !== "object") {
      audit(req, false, "Missing auth field");
      res.status(400).json({ error: 'Missing "auth" field' });
      return;
    }

    const result = await signAuthorizationInternal(auth);
    audit(req, true);
    // viem returns BigInt values which need conversion for JSON
    res.json(serializeBigInt(result));
  } catch (err: any) {
    audit(req, false, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`Keyring proxy server listening on port ${PORT}`);
  console.log(`Backend: ${innerBackend}`);
  console.log(`HMAC auth: enabled`);
});
