/**
 * hono.ts
 *
 * Server-side wrappers for Hono applications.
 * Uses web standard Request/Response APIs.
 *
 * @example
 * ```ts
 * import { Hono } from "hono";
 * import { siwaMiddleware, siwaCors } from "@buildersgarden/siwa/hono";
 *
 * const app = new Hono();
 * app.use("*", siwaCors());
 * app.post("/api/protected", siwaMiddleware(), (c) => {
 *   return c.json({ agent: c.get("agent") });
 * });
 * ```
 */

import type { Context, MiddlewareHandler } from 'hono';
import {
  verifyAuthenticatedRequest,
  resolveReceiptSecret,
  type SiwaAgent,
  type VerifyOptions,
} from '../erc8128.js';
import type { SignerType } from '../signer/index.js';

export type { SiwaAgent };

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface SiwaMiddlewareOptions {
  /** HMAC secret for receipt verification. Defaults to RECEIPT_SECRET or SIWA_SECRET env. */
  receiptSecret?: string;
  /** RPC URL for optional onchain verification. */
  rpcUrl?: string;
  /** Enable onchain ownerOf check. */
  verifyOnchain?: boolean;
  /** Public client for ERC-1271 or onchain checks. */
  publicClient?: VerifyOptions['publicClient'];
  /** Allowed signer types. Omit to accept all. */
  allowedSignerTypes?: SignerType[];
}

export interface SiwaCorsOptions {
  /** Allowed origin(s). Defaults to "*". */
  origin?: string;
  /** Allowed HTTP methods. */
  methods?: string[];
  /** Allowed headers. */
  headers?: string[];
}

// ---------------------------------------------------------------------------
// CORS middleware
// ---------------------------------------------------------------------------

const DEFAULT_SIWA_HEADERS = [
  'Content-Type',
  'X-SIWA-Receipt',
  'Signature',
  'Signature-Input',
  'Content-Digest',
];

/**
 * CORS middleware pre-configured with SIWA-specific headers.
 * Handles OPTIONS preflight automatically.
 */
export function siwaCors(options?: SiwaCorsOptions): MiddlewareHandler {
  const origin = options?.origin ?? '*';
  const methods = options?.methods ?? ['GET', 'POST', 'OPTIONS'];
  const headers = options?.headers ?? DEFAULT_SIWA_HEADERS;

  return async (c: Context, next) => {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Methods', methods.join(', '));
    c.header('Access-Control-Allow-Headers', headers.join(', '));

    if (c.req.method === 'OPTIONS') {
      return c.body(null, 204);
    }

    await next();
  };
}

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

/**
 * Hono middleware that verifies ERC-8128 HTTP Message Signatures + SIWA receipt.
 *
 * On success, sets `c.set("agent", agent)` with the verified agent identity.
 * On failure, responds with 401.
 */
export function siwaMiddleware(options?: SiwaMiddlewareOptions): MiddlewareHandler {
  return async (c: Context, next) => {
    const hasSignature =
      c.req.header('signature') && c.req.header('x-siwa-receipt');

    if (!hasSignature) {
      return c.json(
        { error: 'Unauthorized — provide ERC-8128 Signature + X-SIWA-Receipt headers' },
        401
      );
    }

    try {
      const secret = resolveReceiptSecret(options?.receiptSecret);

      const result = await verifyAuthenticatedRequest(c.req.raw, {
        receiptSecret: secret,
        rpcUrl: options?.rpcUrl,
        verifyOnchain: options?.verifyOnchain,
        publicClient: options?.publicClient,
        allowedSignerTypes: options?.allowedSignerTypes,
      });

      if (!result.valid) {
        return c.json({ error: result.error }, 401);
      }

      c.set('agent', result.agent);
      await next();
    } catch (err: any) {
      return c.json({ error: `ERC-8128 auth failed: ${err.message}` }, 401);
    }
  };
}
