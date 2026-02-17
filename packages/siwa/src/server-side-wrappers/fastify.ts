/**
 * fastify.ts
 *
 * Server-side wrappers for Fastify applications.
 * Uses preHandler hooks for authentication.
 *
 * @example
 * ```ts
 * import Fastify from "fastify";
 * import { siwaPlugin, siwaAuth } from "@buildersgarden/siwa/fastify";
 *
 * const fastify = Fastify();
 * await fastify.register(siwaPlugin);
 *
 * fastify.post("/api/protected", { preHandler: siwaAuth() }, async (req) => {
 *   return { agent: req.agent };
 * });
 * ```
 */

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
  preHandlerHookHandler,
} from 'fastify';
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
// Module augmentation — adds agent + payment to FastifyRequest
// ---------------------------------------------------------------------------

declare module 'fastify' {
  interface FastifyRequest {
    agent?: SiwaAgent;
    payment?: X402Payment;
  }
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface SiwaAuthOptions {
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

export interface SiwaPluginOptions {
  /** CORS allowed origin(s). Defaults to true (reflect origin). */
  origin?: boolean | string | string[];
  /** Allowed headers including SIWA-specific ones. */
  allowedHeaders?: string[];
  /** Include x402 payment headers in CORS. */
  x402?: boolean;
}

// ---------------------------------------------------------------------------
// CORS headers
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

// ---------------------------------------------------------------------------
// Request conversion helper
// ---------------------------------------------------------------------------

/**
 * Convert a Fastify request to a Fetch Request for verification.
 */
function toFetchRequest(req: FastifyRequest): Request {
  // Use req.host (includes port) rather than req.hostname (strips port in Fastify v5)
  const url = `${req.protocol}://${req.host}${req.url}`;
  return new Request(url, {
    method: req.method,
    headers: req.headers as HeadersInit,
    body:
      req.method !== 'GET' && req.method !== 'HEAD'
        ? JSON.stringify(req.body)
        : undefined,
  });
}

// ---------------------------------------------------------------------------
// Fastify plugin
// ---------------------------------------------------------------------------

/**
 * Fastify plugin that sets up CORS with SIWA-specific headers.
 * Requires @fastify/cors to be installed.
 */
export const siwaPlugin: FastifyPluginAsync<SiwaPluginOptions> = async (
  fastify: FastifyInstance,
  options?: SiwaPluginOptions
) => {
  let allowedHeaders = options?.allowedHeaders ?? DEFAULT_SIWA_HEADERS;
  if (options?.x402) {
    allowedHeaders = [...allowedHeaders, ...X402_CORS_ALLOW];
  }

  const exposeHeaders = options?.x402 ? X402_EXPOSE : undefined;

  // Try to register @fastify/cors if available
  try {
    const cors = await import('@fastify/cors');
    await fastify.register(cors.default ?? cors, {
      origin: options?.origin ?? true,
      allowedHeaders,
      exposedHeaders: exposeHeaders,
    });
  } catch {
    // @fastify/cors not installed, set headers manually
    fastify.addHook('onSend', async (req, reply) => {
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      reply.header('Access-Control-Allow-Headers', allowedHeaders.join(', '));
      if (exposeHeaders) {
        reply.header('Access-Control-Expose-Headers', exposeHeaders.join(', '));
      }
    });

    // Handle OPTIONS preflight
    fastify.options('*', async (req, reply) => {
      reply.status(204).send();
    });
  }
};

// ---------------------------------------------------------------------------
// Auth preHandler
// ---------------------------------------------------------------------------

/**
 * Fastify preHandler that verifies ERC-8128 HTTP Message Signatures + SIWA receipt.
 *
 * On success, sets `req.agent` with the verified agent identity.
 * When x402 is configured and payment succeeds, also sets `req.payment`.
 * On failure, responds with 401 (auth) or 402 (payment).
 */
export function siwaAuth(options?: SiwaAuthOptions): preHandlerHookHandler {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const hasSignature =
      req.headers['signature'] && req.headers['x-siwa-receipt'];

    if (!hasSignature) {
      return reply.status(401).send({
        error: 'Unauthorized — provide ERC-8128 Signature + X-SIWA-Receipt headers',
      });
    }

    try {
      const secret = resolveReceiptSecret(options?.receiptSecret);

      const result = await verifyAuthenticatedRequest(toFetchRequest(req), {
        receiptSecret: secret,
        rpcUrl: options?.rpcUrl,
        verifyOnchain: options?.verifyOnchain,
        publicClient: options?.publicClient,
        allowedSignerTypes: options?.allowedSignerTypes,
      });

      if (!result.valid) {
        return reply.status(401).send({ error: result.error });
      }

      req.agent = result.agent;
    } catch (err: any) {
      return reply.status(401).send({ error: `ERC-8128 auth failed: ${err.message}` });
    }

    // -----------------------------------------------------------------
    // x402 payment gate
    // -----------------------------------------------------------------
    if (options?.x402) {
      const { x402 } = options;
      const agentAddress = req.agent!.address.toLowerCase();

      // Session check
      if (x402.session) {
        const existing = await x402.session.store.get(agentAddress, x402.resource.url);
        if (existing) {
          // Active session — skip payment
          return;
        }
      }

      // Payment header
      const paymentHeader = req.headers[X402_HEADERS.PAYMENT_SIGNATURE.toLowerCase()] as
        | string
        | undefined;
      if (!paymentHeader) {
        const paymentRequired: PaymentRequired = {
          accepts: x402.accepts,
          resource: x402.resource,
        };
        reply.header(X402_HEADERS.PAYMENT_REQUIRED, encodeX402Header(paymentRequired));
        return reply.status(402).send({
          error: 'Payment required',
          accepts: x402.accepts,
          resource: x402.resource,
        });
      }

      // Process payment
      try {
        const payload = decodeX402Header<PaymentPayload>(paymentHeader);
        const payResult = await processX402Payment(payload, x402.accepts, x402.facilitator);

        if (!payResult.valid) {
          return reply.status(402).send({ error: payResult.error });
        }

        reply.header(X402_HEADERS.PAYMENT_RESPONSE, encodeX402Header(payResult.payment));
        req.payment = payResult.payment;

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
        return reply.status(402).send({ error: `x402 payment processing failed: ${err.message}` });
      }
    }
  };
}
