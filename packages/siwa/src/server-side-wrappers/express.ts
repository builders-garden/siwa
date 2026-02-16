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
import {
  X402_HEADERS,
  encodeX402Header,
  decodeX402Header,
  processX402Payment,
  type X402Config,
  type X402Payment,
  type PaymentPayload,
  type PaymentRequired,
} from '../x402.js';

export type { SiwaAgent };

// ---------------------------------------------------------------------------
// Module augmentation — adds agent + payment + rawBody to Express.Request
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      agent?: SiwaAgent;
      payment?: X402Payment;
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
  /** Optional x402 payment fallback. When set, unauthenticated requests get 402 instead of 401. */
  x402?: X402Config;
}

export interface SiwaCorsOptions {
  /** Allowed origin(s). Defaults to "*". */
  origin?: string;
  /** Allowed HTTP methods. */
  methods?: string;
  /** Allowed headers. */
  headers?: string;
  /** Include x402 payment headers in CORS. */
  x402?: boolean;
}

// ---------------------------------------------------------------------------
// CORS middleware
// ---------------------------------------------------------------------------

const DEFAULT_SIWA_HEADERS =
  'Content-Type, X-SIWA-Receipt, Signature, Signature-Input, Content-Digest';

const X402_CORS_HEADERS = `${X402_HEADERS.PAYMENT_SIGNATURE}, ${X402_HEADERS.PAYMENT_REQUIRED}`;
const X402_EXPOSE_HEADERS = `${X402_HEADERS.PAYMENT_REQUIRED}, ${X402_HEADERS.PAYMENT_RESPONSE}`;

/**
 * CORS middleware pre-configured with SIWA-specific headers.
 * Handles OPTIONS preflight automatically.
 *
 * When `x402: true` is set, also includes x402 payment headers.
 */
export function siwaCors(options?: SiwaCorsOptions): RequestHandler {
  const origin = options?.origin ?? '*';
  const methods = options?.methods ?? 'GET, POST, OPTIONS';
  let headers = options?.headers ?? DEFAULT_SIWA_HEADERS;
  if (options?.x402) {
    headers = `${headers}, ${X402_CORS_HEADERS}`;
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', methods);
    res.header('Access-Control-Allow-Headers', headers);

    if (options?.x402) {
      res.header('Access-Control-Expose-Headers', X402_EXPOSE_HEADERS);
    }

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
 * Express middleware that verifies ERC-8128 HTTP Message Signatures + SIWA receipt,
 * with optional composable x402 payment support.
 *
 * SIWA and x402 are checked independently — a request can carry both, and
 * both `req.agent` and `req.payment` will be populated.
 *
 * **Without x402** (existing behavior):
 *   - Valid SIWA headers → `req.agent` → `next()`
 *   - Missing/invalid → 401
 *
 * **With x402** (composable):
 *   - SIWA headers checked first → if valid, `req.agent` is set
 *   - Payment header checked next → if valid, `req.payment` is set
 *   - At least one must succeed to proceed; if neither → 402
 *   - Both can succeed on the same request (`req.agent` + `req.payment`)
 */
export function siwaMiddleware(options?: SiwaMiddlewareOptions): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const hasSiwaHeaders = req.headers['signature'] && req.headers['x-siwa-receipt'];
    let siwaError: string | undefined;

    // -----------------------------------------------------------------------
    // Step 1: Try SIWA ERC-8128 authentication
    // -----------------------------------------------------------------------
    if (hasSiwaHeaders) {
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

        if (result.valid) {
          req.agent = result.agent;
        } else {
          siwaError = result.error;
        }
      } catch (err: any) {
        siwaError = `ERC-8128 auth failed: ${err.message}`;
      }
    }

    // -----------------------------------------------------------------------
    // Step 2: Try x402 payment (if configured)
    // -----------------------------------------------------------------------
    if (options?.x402) {
      const { x402 } = options;
      const paymentHeader = req.headers[X402_HEADERS.PAYMENT_SIGNATURE.toLowerCase()] as
        | string
        | undefined;

      if (paymentHeader) {
        try {
          const payload = decodeX402Header<PaymentPayload>(paymentHeader);
          const result = await processX402Payment(payload, x402.accepts, x402.facilitator);

          if (result.valid) {
            const responseHeader = encodeX402Header(result.payment);
            res.setHeader(X402_HEADERS.PAYMENT_RESPONSE, responseHeader);
            req.payment = result.payment;
          } else {
            // Payment header present but invalid — if SIWA already succeeded,
            // we can still proceed; otherwise this error matters
            if (!req.agent) {
              res.status(402).json({ error: result.error });
              return;
            }
          }
        } catch (err: any) {
          if (!req.agent) {
            res.status(402).json({ error: `x402 payment processing failed: ${err.message}` });
            return;
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // Step 3: Decide outcome
    // -----------------------------------------------------------------------

    // At least one path succeeded → proceed
    if (req.agent || req.payment) {
      next();
      return;
    }

    // Neither succeeded — respond with appropriate error
    if (options?.x402) {
      // x402 configured: return 402 with payment requirements
      const paymentRequired: PaymentRequired = {
        accepts: options.x402.accepts,
        resource: options.x402.resource,
      };

      res.setHeader(X402_HEADERS.PAYMENT_REQUIRED, encodeX402Header(paymentRequired));
      res.status(402).json({
        error: 'Payment required',
        ...(siwaError ? { siwaError } : {}),
        accepts: options.x402.accepts,
        resource: options.x402.resource,
      });
      return;
    }

    // No x402 → standard 401
    res.status(401).json({
      error: siwaError ?? 'Unauthorized — provide ERC-8128 Signature + X-SIWA-Receipt headers',
    });
  };
}
