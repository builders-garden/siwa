/**
 * express.ts
 *
 * Server-side wrappers for Express applications.
 *
 * @example
 * ```ts
 * import { siwaMiddleware, siwaJsonParser, siwaCors } from "@buildersgarden/siwa/express";
 *
 * app.use(siwaJsonParser());
 * app.use(siwaCors());
 * app.get('/api/protected', siwaMiddleware(), (req, res) => {
 *   res.json({ agent: req.agent });
 * });
 * ```
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import express from 'express';
import {
  verifyAuthenticatedRequest,
  expressToFetchRequest,
  resolveReceiptSecret,
  type SiwaAgent,
  type VerifyOptions,
} from '../erc8128.js';
import type { SignerType } from '../signer/index.js';

export type { SiwaAgent };

// ---------------------------------------------------------------------------
// Module augmentation — adds agent + rawBody to Express.Request
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      agent?: SiwaAgent;
      rawBody?: string;
    }
  }
}

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
  methods?: string;
  /** Allowed headers. */
  headers?: string;
}

// ---------------------------------------------------------------------------
// CORS middleware
// ---------------------------------------------------------------------------

const DEFAULT_SIWA_HEADERS =
  'Content-Type, X-SIWA-Receipt, Signature, Signature-Input, Content-Digest';

/**
 * CORS middleware pre-configured with SIWA-specific headers.
 * Handles OPTIONS preflight automatically.
 */
export function siwaCors(options?: SiwaCorsOptions): RequestHandler {
  const origin = options?.origin ?? '*';
  const methods = options?.methods ?? 'GET, POST, OPTIONS';
  const headers = options?.headers ?? DEFAULT_SIWA_HEADERS;

  return (req: Request, res: Response, next: NextFunction): void => {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', methods);
    res.header('Access-Control-Allow-Headers', headers);

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// JSON parser with rawBody capture
// ---------------------------------------------------------------------------

/**
 * `express.json()` pre-configured with rawBody capture for Content-Digest verification.
 */
export function siwaJsonParser(): RequestHandler {
  return express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString();
    },
  });
}

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

/**
 * Express middleware that verifies ERC-8128 HTTP Message Signatures + SIWA receipt.
 *
 * On success, sets `req.agent` with the verified agent identity.
 * On failure, responds with 401.
 */
export function siwaMiddleware(options?: SiwaMiddlewareOptions): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const hasSignature = req.headers['signature'] && req.headers['x-siwa-receipt'];

    if (!hasSignature) {
      res.status(401).json({
        error: 'Unauthorized — provide ERC-8128 Signature + X-SIWA-Receipt headers',
      });
      return;
    }

    try {
      const secret = resolveReceiptSecret(options?.receiptSecret);

      const fetchReq = expressToFetchRequest(req as any);
      const result = await verifyAuthenticatedRequest(fetchReq, {
        receiptSecret: secret,
        rpcUrl: options?.rpcUrl,
        verifyOnchain: options?.verifyOnchain,
        publicClient: options?.publicClient,
        allowedSignerTypes: options?.allowedSignerTypes,
      });

      if (!result.valid) {
        res.status(401).json({ error: result.error });
        return;
      }

      req.agent = result.agent;
      next();
    } catch (err: any) {
      res.status(401).json({ error: `ERC-8128 auth failed: ${err.message}` });
    }
  };
}
