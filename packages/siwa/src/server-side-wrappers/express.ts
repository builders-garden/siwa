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
import { CHALLENGE_HEADER, type CaptchaPolicy, type CaptchaOptions } from '../captcha.js';
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
  /** Captcha policy for per-request challenges. */
  captchaPolicy?: CaptchaPolicy;
  /** Captcha options (secret, topics, formats). Secret defaults to receiptSecret. */
  captchaOptions?: CaptchaOptions;
  /** Optional x402 payment gate. When set, both SIWA auth AND a valid payment are required. */
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
  'Content-Type, X-SIWA-Receipt, X-SIWA-Challenge-Response, Signature, Signature-Input, Content-Digest';

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
    res.header('Access-Control-Expose-Headers', 'X-SIWA-Challenge');

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
 * with optional x402 payment gate.
 *
 * **Without x402** (SIWA only):
 *   - Valid SIWA headers → `req.agent` → `next()`
 *   - Missing/invalid → 401
 *
 * **With x402** (SIWA + payment):
 *   - SIWA must succeed → otherwise 401
 *   - Payment must also succeed → otherwise 402 with payment requirements
 *   - Both succeed → `req.agent` + `req.payment` → `next()`
 */
export function siwaMiddleware(options?: SiwaMiddlewareOptions): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // -----------------------------------------------------------------------
    // Step 1: SIWA ERC-8128 authentication (always required)
    // -----------------------------------------------------------------------
    const hasSiwaHeaders = req.headers['signature'] && req.headers['x-siwa-receipt'];

    if (!hasSiwaHeaders) {
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
        captchaPolicy: options?.captchaPolicy,
        captchaOptions: options?.captchaOptions,
      });

      if (!result.valid) {
        if ('captchaRequired' in result && result.captchaRequired) {
          res.header(CHALLENGE_HEADER, result.challengeToken);
          res.status(401).json({
            error: result.error,
            challenge: result.challenge,
            challengeToken: result.challengeToken,
            captchaRequired: true,
          });
          return;
        }
        res.status(401).json({ error: result.error });
        return;
      }

      req.agent = result.agent;
    } catch (err: any) {
      res.status(401).json({ error: `ERC-8128 auth failed: ${err.message}` });
      return;
    }

    // -----------------------------------------------------------------------
    // Step 2: x402 payment (required only when x402 is configured)
    // -----------------------------------------------------------------------
    if (options?.x402) {
      const { x402 } = options;
      const agentAddress = req.agent!.address.toLowerCase();

      // Step 2a: Check session store (SIWX pay-once mode)
      if (x402.session) {
        const existing = await x402.session.store.get(agentAddress, x402.resource.url);
        if (existing) {
          // Active session — skip payment entirely
          next();
          return;
        }
      }

      const paymentHeader = req.headers[X402_HEADERS.PAYMENT_SIGNATURE.toLowerCase()] as
        | string
        | undefined;

      if (!paymentHeader) {
        // No payment header — return 402 with requirements
        const paymentRequired: PaymentRequired = {
          accepts: x402.accepts,
          resource: x402.resource,
        };
        res.setHeader(X402_HEADERS.PAYMENT_REQUIRED, encodeX402Header(paymentRequired));
        res.status(402).json({
          error: 'Payment required',
          accepts: x402.accepts,
          resource: x402.resource,
        });
        return;
      }

      try {
        const payload = decodeX402Header<PaymentPayload>(paymentHeader);
        const result = await processX402Payment(payload, x402.accepts, x402.facilitator);

        if (!result.valid) {
          res.status(402).json({ error: result.error });
          return;
        }

        const responseHeader = encodeX402Header(result.payment);
        res.setHeader(X402_HEADERS.PAYMENT_RESPONSE, responseHeader);
        req.payment = result.payment;

        // Step 2b: Store session after successful payment (SIWX)
        if (x402.session) {
          await x402.session.store.set(
            agentAddress,
            x402.resource.url,
            { paidAt: Date.now(), txHash: result.payment.txHash },
            x402.session.ttl,
          );
        }
      } catch (err: any) {
        res.status(402).json({ error: `x402 payment processing failed: ${err.message}` });
        return;
      }
    }

    // -----------------------------------------------------------------------
    // Step 3: All checks passed
    // -----------------------------------------------------------------------
    next();
  };
}

// ---------------------------------------------------------------------------
// Factory: pre-configured middleware
// ---------------------------------------------------------------------------

/**
 * Create a pre-configured `siwaMiddleware` with shared defaults.
 *
 * Use this to apply the same captcha policy and options globally,
 * with optional per-route overrides.
 *
 * @param defaults  Shared options applied to all routes
 * @returns         A `siwaMiddleware`-like function that bakes in the defaults
 *
 * @example
 * ```typescript
 * import { createSiwaMiddleware, siwaJsonParser, siwaCors } from "@buildersgarden/siwa/express";
 *
 * const auth = createSiwaMiddleware({
 *   captchaPolicy: async ({ address }) => {
 *     const known = await db.agents.exists(address);
 *     return known ? null : 'medium';
 *   },
 *   captchaOptions: { secret: process.env.SIWA_SECRET! },
 * });
 *
 * app.use(siwaJsonParser());
 * app.use(siwaCors());
 *
 * // Apply globally
 * app.use(auth());
 *
 * // Or per-route with overrides
 * app.post('/api/transfer', auth({ captchaPolicy: () => 'hard' }), handler);
 * ```
 */
export function createSiwaMiddleware(defaults: SiwaMiddlewareOptions) {
  return (overrides?: Partial<SiwaMiddlewareOptions>): RequestHandler =>
    siwaMiddleware({ ...defaults, ...overrides });
}
