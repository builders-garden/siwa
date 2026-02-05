/**
 * proxy-auth.ts
 *
 * Shared HMAC-SHA256 authentication utility for the keyring proxy.
 * Used by both the proxy client (keystore.ts) and server (test/proxy/index.ts).
 *
 * Security features:
 *   - HMAC-SHA256 over method + path + body + timestamp
 *   - 30-second timestamp drift limit for replay protection
 *   - Constant-time comparison via crypto.timingSafeEqual
 */

import * as crypto from 'crypto';

const MAX_DRIFT_MS = 30_000; // 30 seconds

export interface HmacHeaders {
  'X-Proxy-Timestamp': string;
  'X-Proxy-Signature': string;
}

/**
 * Compute HMAC-SHA256 headers for an outgoing request.
 */
export function computeHmac(
  secret: string,
  method: string,
  path: string,
  body: string,
): HmacHeaders {
  const timestamp = Date.now().toString();
  const payload = `${method.toUpperCase()}\n${path}\n${timestamp}\n${body}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return {
    'X-Proxy-Timestamp': timestamp,
    'X-Proxy-Signature': signature,
  };
}

/**
 * Verify an incoming HMAC-SHA256 signature.
 * Returns { valid: true } or { valid: false, error: string }.
 */
export function verifyHmac(
  secret: string,
  method: string,
  path: string,
  body: string,
  timestamp: string,
  signature: string,
): { valid: boolean; error?: string } {
  // Check timestamp drift
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return { valid: false, error: 'Invalid timestamp' };
  const drift = Math.abs(Date.now() - ts);
  if (drift > MAX_DRIFT_MS) {
    return { valid: false, error: `Timestamp drift ${drift}ms exceeds ${MAX_DRIFT_MS}ms limit` };
  }

  // Recompute expected signature
  const payload = `${method.toUpperCase()}\n${path}\n${timestamp}\n${body}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Constant-time comparison
  const sigBuf = Buffer.from(signature, 'utf-8');
  const expBuf = Buffer.from(expected, 'utf-8');
  if (sigBuf.length !== expBuf.length) {
    return { valid: false, error: 'Signature mismatch' };
  }
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, error: 'Signature mismatch' };
  }

  return { valid: true };
}
