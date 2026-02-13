/**
 * next.ts
 *
 * Server-side wrappers for Next.js App Router route handlers.
 * Uses only web standard APIs (Request, Response, Headers) — no `next` dependency needed.
 *
 * @example
 * ```ts
 * import { withSiwa, siwaOptions } from "@buildersgarden/siwa/next";
 *
 * export const POST = withSiwa(async (agent, req) => {
 *   const body = await req.json();
 *   return { received: body, agent: { address: agent.address, agentId: agent.agentId } };
 * });
 *
 * export { siwaOptions as OPTIONS };
 * ```
 */

import {
  verifyAuthenticatedRequest,
  nextjsToFetchRequest,
  resolveReceiptSecret,
  type SiwaAgent,
  type VerifyOptions,
} from './erc8128.js';
import { CHALLENGE_HEADER, type CaptchaPolicy, type CaptchaOptions } from './captcha.js';
import type { SignerType } from './signer.js';

export type { SiwaAgent };

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface WithSiwaOptions {
  /** HMAC secret for receipt verification. Defaults to RECEIPT_SECRET or SIWA_SECRET env. */
  receiptSecret?: string;
  /** RPC URL for optional onchain verification. */
  rpcUrl?: string;
  /** Enable onchain ownerOf check. */
  verifyOnchain?: boolean;
  /** Allowed signer types. Omit to accept all. */
  allowedSignerTypes?: SignerType[];
  /** Captcha policy for per-request challenges. */
  captchaPolicy?: CaptchaPolicy;
  /** Captcha options (secret, topics, formats). Secret defaults to receiptSecret. */
  captchaOptions?: CaptchaOptions;
}

// ---------------------------------------------------------------------------
// CORS helpers
// ---------------------------------------------------------------------------

/** CORS headers required by SIWA-authenticated requests. */
export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, X-SIWA-Receipt, X-SIWA-Challenge-Response, Signature, Signature-Input, Content-Digest',
    'Access-Control-Expose-Headers': 'X-SIWA-Challenge',
  };
}

/** Return a JSON Response with CORS headers. */
export function corsJson(data: unknown, init?: { status?: number }): Response {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

/** Return a 204 OPTIONS response with CORS headers. */
export function siwaOptions(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// ---------------------------------------------------------------------------
// withSiwa wrapper
// ---------------------------------------------------------------------------

export type SiwaHandler = (
  agent: SiwaAgent,
  req: Request,
) => Promise<Record<string, unknown> | Response> | Record<string, unknown> | Response;

/**
 * Wrap a Next.js route handler with SIWA ERC-8128 authentication.
 *
 * - Clones POST/PUT/PATCH requests so the body is available after verification
 * - Normalizes the request URL for reverse-proxy environments
 * - Returns 401 with CORS headers on auth failure
 * - If the handler returns a plain object, it is auto-wrapped in a JSON Response with CORS headers
 */
export function withSiwa(handler: SiwaHandler, options?: WithSiwaOptions) {
  return async (req: Request): Promise<Response> => {
    const secret = resolveReceiptSecret(options?.receiptSecret);

    // Clone for body-consuming methods so handler can still read the body
    const hasBody = !['GET', 'HEAD'].includes(req.method);
    const verifyReq = hasBody ? req.clone() : req;

    const verifyOptions: VerifyOptions = {
      receiptSecret: secret,
      rpcUrl: options?.rpcUrl,
      verifyOnchain: options?.verifyOnchain,
      allowedSignerTypes: options?.allowedSignerTypes,
      captchaPolicy: options?.captchaPolicy,
      captchaOptions: options?.captchaOptions,
    };

    const result = await verifyAuthenticatedRequest(
      nextjsToFetchRequest(verifyReq),
      verifyOptions,
    );

    if (!result.valid) {
      if ('captchaRequired' in result && result.captchaRequired) {
        const response = corsJson(
          { error: result.error, challenge: result.challenge, challengeToken: result.challengeToken },
          { status: 401 },
        );
        response.headers.set(CHALLENGE_HEADER, result.challengeToken);
        return response;
      }
      return corsJson({ error: result.error }, { status: 401 });
    }

    const response = await handler(result.agent, req);

    if (response instanceof Response) {
      // Merge CORS headers into existing response
      const headers = new Headers(response.headers);
      for (const [k, v] of Object.entries(corsHeaders())) {
        headers.set(k, v);
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return corsJson(response);
  };
}

// ---------------------------------------------------------------------------
// Factory: pre-configured withSiwa
// ---------------------------------------------------------------------------

/**
 * Create a pre-configured `withSiwa` wrapper with shared defaults.
 *
 * Use this to apply the same captcha policy, signer type restrictions,
 * and other options across all your route handlers without repeating them.
 * Per-handler overrides are still supported.
 *
 * @param defaults  Shared options applied to all handlers
 * @returns         A `withSiwa`-like function that bakes in the defaults
 *
 * @example
 * ```typescript
 * // lib/siwa.ts — define once
 * import { createWithSiwa } from "@buildersgarden/siwa/next";
 *
 * export const withAuth = createWithSiwa({
 *   captchaPolicy: async ({ address }) => {
 *     const known = await db.agents.exists(address);
 *     return known ? null : 'medium';
 *   },
 *   captchaOptions: { secret: process.env.SIWA_SECRET! },
 * });
 *
 * // app/api/action/route.ts — use everywhere
 * import { withAuth } from "@/lib/siwa";
 *
 * export const POST = withAuth(async (agent, req) => {
 *   return { ok: true };
 * });
 * ```
 */
export function createWithSiwa(defaults: WithSiwaOptions) {
  return (handler: SiwaHandler, overrides?: Partial<WithSiwaOptions>) =>
    withSiwa(handler, { ...defaults, ...overrides });
}
