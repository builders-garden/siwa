/**
 * receipt.ts
 *
 * Stateless HMAC-signed verification receipts.
 *
 * A receipt proves that onchain registration was checked during SIWA sign-in.
 * It is issued after successful verification and attached to every subsequent
 * request alongside an ERC-8128 HTTP signature.
 *
 * Receipt alone is useless (can't forge signatures).
 * Signature alone is insufficient (proves key control, not registration).
 * Together = authentication + authorization.
 *
 * Format: base64url(json).base64url(hmac-sha256)
 * Same token format as nonce tokens in siwa.ts.
 */

import * as crypto from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReceiptPayload {
  address: string;
  agentId: number;
  agentRegistry: string;
  chainId: number;
  verified: 'offline' | 'onchain';
  iat: number; // issued at (ms since epoch)
  exp: number; // expires at (ms since epoch)
}

export interface ReceiptOptions {
  secret: string;
  ttl?: number; // milliseconds, defaults to DEFAULT_RECEIPT_TTL
}

export interface ReceiptResult {
  receipt: string;
  expiresAt: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default receipt validity: 30 minutes */
export const DEFAULT_RECEIPT_TTL = 30 * 60 * 1000;

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Create an HMAC-signed receipt token.
 *
 * @param payload  Agent identity fields from a successful SIWA verification
 * @param options  HMAC secret and optional TTL override
 * @returns        `{ receipt, expiresAt }` — the token and its ISO expiry
 */
export function createReceipt(
  payload: Omit<ReceiptPayload, 'iat' | 'exp'>,
  options: ReceiptOptions,
): ReceiptResult {
  const now = Date.now();
  const ttl = options.ttl ?? DEFAULT_RECEIPT_TTL;
  const exp = now + ttl;

  const full: ReceiptPayload = {
    ...payload,
    iat: now,
    exp,
  };

  const data = Buffer.from(JSON.stringify(full)).toString('base64url');
  const sig = crypto.createHmac('sha256', options.secret).update(data).digest('base64url');

  return {
    receipt: `${data}.${sig}`,
    expiresAt: new Date(exp).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

/**
 * Verify and decode a receipt token.
 *
 * Uses constant-time comparison and checks expiry.
 *
 * @param receipt  The `base64url(json).base64url(hmac)` token
 * @param secret   HMAC secret used to sign the receipt
 * @returns        Decoded payload, or `null` if invalid/expired
 */
export function verifyReceipt(receipt: string, secret: string): ReceiptPayload | null {
  const dotIdx = receipt.indexOf('.');
  if (dotIdx === -1) return null;

  const data = receipt.slice(0, dotIdx);
  const sig = receipt.slice(dotIdx + 1);
  if (!data || !sig) return null;

  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');

  // Constant-time comparison
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  // Decode and check expiry
  const payload: ReceiptPayload = JSON.parse(Buffer.from(data, 'base64url').toString());
  if (payload.exp < Date.now()) return null;

  return payload;
}
