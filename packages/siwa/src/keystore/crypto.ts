/**
 * keystore/crypto.ts
 *
 * V3 Encrypted JSON Keystore implementation and password derivation.
 * Extracted from the original keystore.ts.
 */

import {
  type Hex,
  toBytes,
  toHex,
  concat,
  keccak256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { scrypt } from "@noble/hashes/scrypt";
import { randomBytes } from "@noble/hashes/utils";
import { ctr } from "@noble/ciphers/aes";
import * as crypto from "crypto";
import * as os from "os";
import type { V3Keystore } from "./types.js";

// ---------------------------------------------------------------------------
// UUID generation
// ---------------------------------------------------------------------------

function generateUUID(): string {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  const hex = toHex(bytes).slice(2);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16
  )}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// ---------------------------------------------------------------------------
// V3 Keystore encrypt / decrypt
// ---------------------------------------------------------------------------

export async function encryptKeystore(
  privateKey: Hex,
  password: string
): Promise<string> {
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

export async function decryptKeystore(
  json: string,
  password: string
): Promise<Hex> {
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
// Password derivation
// ---------------------------------------------------------------------------

/**
 * Derive a password from the machine's identity.
 * NOT meant as a strong user password — fallback so agents can operate
 * without interactive prompts. For production, always set KEYSTORE_PASSWORD.
 */
export function deriveMachinePassword(): string {
  const factors = [
    process.env.USER || process.env.USERNAME || "agent",
    process.env.HOME || process.env.USERPROFILE || "/tmp",
    os.hostname(),
    os.platform(),
  ];
  return crypto.createHash("sha256").update(factors.join(":")).digest("hex");
}
