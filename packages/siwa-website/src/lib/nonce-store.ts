import * as crypto from "crypto";

interface StoredNonce {
  nonce: string;
  address: string;
  createdAt: Date;
  expiresAt: Date;
  consumed: boolean;
}

const NONCE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

const nonces = new Map<string, StoredNonce>();

function cleanup() {
  const now = new Date();
  for (const [key, stored] of nonces) {
    if (now > stored.expiresAt) {
      nonces.delete(key);
    }
  }
}

export function createNonce(address: string): {
  nonce: string;
  issuedAt: string;
  expirationTime: string;
} {
  cleanup();

  const nonce = crypto.randomBytes(16).toString("hex");
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + NONCE_EXPIRY_MS);

  nonces.set(nonce, {
    nonce,
    address,
    createdAt,
    expiresAt,
    consumed: false,
  });

  return {
    nonce,
    issuedAt: createdAt.toISOString(),
    expirationTime: expiresAt.toISOString(),
  };
}

export function validateNonce(nonce: string): boolean {
  const stored = nonces.get(nonce);
  if (!stored) return false;
  if (stored.consumed) return false;
  if (new Date() > stored.expiresAt) {
    nonces.delete(nonce);
    return false;
  }
  stored.consumed = true;
  return true;
}

export function getNonceCount(): number {
  return nonces.size;
}
