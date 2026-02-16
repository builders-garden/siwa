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

export type { SiwaAgent };

// ---------------------------------------------------------------------------
// Module augmentation — adds agent to FastifyRequest
// ---------------------------------------------------------------------------

declare module 'fastify' {
  interface FastifyRequest {
    agent?: SiwaAgent;
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
}

export interface SiwaPluginOptions {
  /** CORS allowed origin(s). Defaults to true (reflect origin). */
  origin?: boolean | string | string[];
  /** Allowed headers including SIWA-specific ones. */
  allowedHeaders?: string[];
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

// ---------------------------------------------------------------------------
// Request conversion helper
// ---------------------------------------------------------------------------

/**
 * Convert a Fastify request to a Fetch Request for verification.
 */
function toFetchRequest(req: FastifyRequest): Request {
  const url = `${req.protocol}://${req.hostname}${req.url}`;
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
  // Try to register @fastify/cors if available
  try {
    const cors = await import('@fastify/cors');
    await fastify.register(cors.default ?? cors, {
      origin: options?.origin ?? true,
      allowedHeaders: options?.allowedHeaders ?? DEFAULT_SIWA_HEADERS,
    });
  } catch {
    // @fastify/cors not installed, set headers manually
    fastify.addHook('onSend', async (req, reply) => {
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      reply.header(
        'Access-Control-Allow-Headers',
        (options?.allowedHeaders ?? DEFAULT_SIWA_HEADERS).join(', ')
      );
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
 * On failure, responds with 401.
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
  };
}
