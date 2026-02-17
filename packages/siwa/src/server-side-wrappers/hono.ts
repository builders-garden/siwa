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

export type { SiwaAgent, X402Payment };

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
  /** Optional x402 payment gate. When set, both SIWA auth AND a valid payment are required. */
  x402?: X402Config;
}

export interface SiwaCorsOptions {
  /** Allowed origin(s). Defaults to "*". */
  origin?: string;
  /** Allowed HTTP methods. */
  methods?: string[];
  /** Allowed headers. */
  headers?: string[];
  /** Include x402 payment headers in CORS. */
  x402?: boolean;
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

const X402_CORS_ALLOW = [
  X402_HEADERS.PAYMENT_SIGNATURE,
  X402_HEADERS.PAYMENT_REQUIRED,
];

const X402_EXPOSE = [
  X402_HEADERS.PAYMENT_REQUIRED,
  X402_HEADERS.PAYMENT_RESPONSE,
];

/**
 * CORS middleware pre-configured with SIWA-specific headers.
 * Handles OPTIONS preflight automatically.
 */
export function siwaCors(options?: SiwaCorsOptions): MiddlewareHandler {
  const origin = options?.origin ?? '*';
  const methods = options?.methods ?? ['GET', 'POST', 'OPTIONS'];
  let headers = options?.headers ?? DEFAULT_SIWA_HEADERS;
  if (options?.x402) {
    headers = [...headers, ...X402_CORS_ALLOW];
  }

  return async (c: Context, next) => {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Methods', methods.join(', '));
    c.header('Access-Control-Allow-Headers', headers.join(', '));

    if (options?.x402) {
      c.header('Access-Control-Expose-Headers', X402_EXPOSE.join(', '));
    }

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
 * When x402 is configured and payment succeeds, also sets `c.set("payment", payment)`.
 * On failure, responds with 401 (auth) or 402 (payment).
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

    let agent: SiwaAgent;
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

      agent = result.agent;
      c.set('agent', agent);
    } catch (err: any) {
      return c.json({ error: `ERC-8128 auth failed: ${err.message}` }, 401);
    }

    // -----------------------------------------------------------------
    // x402 payment gate
    // -----------------------------------------------------------------
    if (options?.x402) {
      const { x402 } = options;
      const agentAddress = agent.address.toLowerCase();

      // Session check
      if (x402.session) {
        const existing = await x402.session.store.get(agentAddress, x402.resource.url);
        if (existing) {
          // Active session — skip payment
          await next();
          return;
        }
      }

      // Payment header
      const paymentHeader = c.req.header(X402_HEADERS.PAYMENT_SIGNATURE.toLowerCase())
        ?? c.req.header(X402_HEADERS.PAYMENT_SIGNATURE);
      if (!paymentHeader) {
        const paymentRequired: PaymentRequired = {
          accepts: x402.accepts,
          resource: x402.resource,
        };
        c.header(X402_HEADERS.PAYMENT_REQUIRED, encodeX402Header(paymentRequired));
        return c.json(
          { error: 'Payment required', accepts: x402.accepts, resource: x402.resource },
          402,
        );
      }

      // Process payment
      try {
        const payload = decodeX402Header<PaymentPayload>(paymentHeader);
        const payResult = await processX402Payment(payload, x402.accepts, x402.facilitator);

        if (!payResult.valid) {
          return c.json({ error: payResult.error }, 402);
        }

        c.header(X402_HEADERS.PAYMENT_RESPONSE, encodeX402Header(payResult.payment));
        c.set('payment', payResult.payment);

        // Store session after successful payment
        if (x402.session) {
          await x402.session.store.set(
            agentAddress,
            x402.resource.url,
            { paidAt: Date.now(), txHash: payResult.payment.txHash },
            x402.session.ttl,
          );
        }
      } catch (err: any) {
        return c.json({ error: `x402 payment processing failed: ${err.message}` }, 402);
      }
    }

    await next();
  };
}
