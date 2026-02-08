import * as crypto from 'crypto';

interface StoredNonce {
  nonce: string;
  address: string;
  createdAt: Date;
  expiresAt: Date;
  consumed: boolean;
}

const NONCE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // 60 seconds

const nonces = new Map<string, StoredNonce>();

// Clean up expired nonces periodically
setInterval(() => {
  const now = new Date();
  for (const [key, stored] of nonces) {
    if (now > stored.expiresAt) {
      nonces.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();

export function createNonce(address: string): {
  nonce: string;
  issuedAt: string;
  expirationTime: string;
} {
  const nonce = crypto.randomBytes(16).toString('hex');
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

/**
 * Store an externally-generated nonce (e.g. from SDK's createSIWANonce)
 * for later validation.
 */
export function storeNonce(nonce: string, address: string): void {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + NONCE_EXPIRY_MS);
  nonces.set(nonce, { nonce, address, createdAt, expiresAt, consumed: false });
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
