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

export interface WithSiwaOptions {
  /** HMAC secret for receipt verification. Defaults to RECEIPT_SECRET or SIWA_SECRET env. */
  receiptSecret?: string;
  /** RPC URL for optional onchain verification. */
  rpcUrl?: string;
  /** Enable onchain ownerOf check. */
  verifyOnchain?: boolean;
  /** Allowed signer types. Omit to accept all. */
  allowedSignerTypes?: SignerType[];
  /** Optional x402 payment gate. When set, both SIWA auth AND a valid payment are required. */
  x402?: X402Config;
}

export interface CorsOptions {
  /** Include x402 payment headers in CORS. */
  x402?: boolean;
}

// ---------------------------------------------------------------------------
// CORS helpers
// ---------------------------------------------------------------------------

const DEFAULT_SIWA_HEADERS =
  'Content-Type, X-SIWA-Receipt, Signature, Signature-Input, Content-Digest';

const X402_CORS_HEADERS = `${X402_HEADERS.PAYMENT_SIGNATURE}, ${X402_HEADERS.PAYMENT_REQUIRED}`;
const X402_EXPOSE_HEADERS = `${X402_HEADERS.PAYMENT_REQUIRED}, ${X402_HEADERS.PAYMENT_RESPONSE}`;

/** CORS headers required by SIWA-authenticated requests. */
export function corsHeaders(options?: CorsOptions): Record<string, string> {
  let allowHeaders = DEFAULT_SIWA_HEADERS;
  if (options?.x402) {
    allowHeaders = `${allowHeaders}, ${X402_CORS_HEADERS}`;
  }

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': allowHeaders,
  };

  if (options?.x402) {
    headers['Access-Control-Expose-Headers'] = X402_EXPOSE_HEADERS;
  }

  return headers;
}

/** Return a JSON Response with CORS headers. */
export function corsJson(
  data: unknown,
  init?: { status?: number; headers?: Record<string, string> },
  corsOpts?: CorsOptions,
): Response {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(corsOpts),
      ...init?.headers,
    },
  });
}

/** Return a 204 OPTIONS response with CORS headers. */
export function siwaOptions(corsOpts?: CorsOptions): Response {
  return new Response(null, { status: 204, headers: corsHeaders(corsOpts) });
}

// ---------------------------------------------------------------------------
// withSiwa wrapper
// ---------------------------------------------------------------------------

type SiwaHandler = (
  agent: SiwaAgent,
  req: Request,
  payment?: X402Payment,
) => Promise<Record<string, unknown> | Response> | Record<string, unknown> | Response;

/**
 * Wrap a Next.js route handler with SIWA ERC-8128 authentication.
 *
 * - Clones POST/PUT/PATCH requests so the body is available after verification
 * - Normalizes the request URL for reverse-proxy environments
 * - Returns 401 with CORS headers on auth failure
 * - If the handler returns a plain object, it is auto-wrapped in a JSON Response with CORS headers
 * - When x402 is configured, requires payment after SIWA auth succeeds
 */
export function withSiwa(handler: SiwaHandler, options?: WithSiwaOptions) {
  const corsOpts: CorsOptions | undefined = options?.x402 ? { x402: true } : undefined;

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
    };

    const result = await verifyAuthenticatedRequest(
      nextjsToFetchRequest(verifyReq),
      verifyOptions,
    );

    if (!result.valid) {
      return corsJson({ error: result.error }, { status: 401 }, corsOpts);
    }

    // -----------------------------------------------------------------
    // x402 payment gate
    // -----------------------------------------------------------------
    let payment: X402Payment | undefined;

    if (options?.x402) {
      const { x402 } = options;
      const agentAddress = result.agent.address.toLowerCase();

      // Session check
      if (x402.session) {
        const existing = await x402.session.store.get(agentAddress, x402.resource.url);
        if (existing) {
          // Active session — skip payment, call handler without payment arg
          const response = await handler(result.agent, req);
          return wrapResponse(response, corsOpts);
        }
      }

      // Payment header
      const paymentHeader = req.headers.get(X402_HEADERS.PAYMENT_SIGNATURE.toLowerCase())
        ?? req.headers.get(X402_HEADERS.PAYMENT_SIGNATURE);
      if (!paymentHeader) {
        const paymentRequired: PaymentRequired = {
          accepts: x402.accepts,
          resource: x402.resource,
        };
        return corsJson(
          { error: 'Payment required', accepts: x402.accepts, resource: x402.resource },
          {
            status: 402,
            headers: { [X402_HEADERS.PAYMENT_REQUIRED]: encodeX402Header(paymentRequired) },
          },
          corsOpts,
        );
      }

      // Process payment
      try {
        const payload = decodeX402Header<PaymentPayload>(paymentHeader);
        const payResult = await processX402Payment(payload, x402.accepts, x402.facilitator);

        if (!payResult.valid) {
          return corsJson({ error: payResult.error }, { status: 402 }, corsOpts);
        }

        payment = payResult.payment;

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
        return corsJson(
          { error: `x402 payment processing failed: ${err.message}` },
          { status: 402 },
          corsOpts,
        );
      }
    }

    // -----------------------------------------------------------------
    // Call handler
    // -----------------------------------------------------------------
    const response = await handler(result.agent, req, payment);

    const wrapped = wrapResponse(response, corsOpts);

    // Add Payment-Response header if payment was processed
    if (payment) {
      const headers = new Headers(wrapped.headers);
      headers.set(X402_HEADERS.PAYMENT_RESPONSE, encodeX402Header(payment));
      return new Response(wrapped.body, {
        status: wrapped.status,
        statusText: wrapped.statusText,
        headers,
      });
    }

    return wrapped;
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function wrapResponse(
  response: Record<string, unknown> | Response,
  corsOpts?: CorsOptions,
): Response {
  if (response instanceof Response) {
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(corsHeaders(corsOpts))) {
      headers.set(k, v);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
  return corsJson(response, undefined, corsOpts);
}
