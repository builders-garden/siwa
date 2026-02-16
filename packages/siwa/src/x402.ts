/**
 * x402.ts
 *
 * Framework-agnostic x402 payment protocol integration.
 *
 * Provides types, header constants, base64 encode/decode helpers,
 * a facilitator HTTP client, and a high-level processX402Payment function.
 *
 * No framework imports. No `@x402/*` dependency — the facilitator API
 * is just 2 HTTP POSTs (verify + settle).
 */

// ---------------------------------------------------------------------------
// Header constants
// ---------------------------------------------------------------------------

export const X402_HEADERS = {
  PAYMENT_REQUIRED: 'Payment-Required',
  PAYMENT_SIGNATURE: 'Payment-Signature',
  PAYMENT_RESPONSE: 'Payment-Response',
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Network identifier (e.g. "eip155:84532") */
export type Network = string;

/** Resource being paid for */
export interface ResourceInfo {
  url: string;
  description?: string;
}

/** A single payment option the server accepts */
export interface PaymentRequirements {
  scheme: string;
  network: Network;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds?: number;
}

/** Full 402 response payload (base64-encoded in header) */
export interface PaymentRequired {
  accepts: PaymentRequirements[];
  resource: ResourceInfo;
}

/** Client-side payment payload (base64-encoded in header) */
export interface PaymentPayload {
  signature: string;
  payment: {
    scheme: string;
    network: Network;
    amount: string;
    asset: string;
    payTo: string;
    nonce?: string;
  };
  resource: ResourceInfo;
}

/** Facilitator verify response */
export interface VerifyResponse {
  valid: boolean;
  reason?: string;
}

/** Facilitator settle response */
export interface SettleResponse {
  success: boolean;
  txHash?: string;
  reason?: string;
}

/** Result of processing an x402 payment */
export type X402Result =
  | { valid: true; payment: X402Payment }
  | { valid: false; error: string };

/** Verified payment info attached to the request */
export interface X402Payment {
  scheme: string;
  network: Network;
  amount: string;
  asset: string;
  payTo: string;
  txHash?: string;
}

/** Facilitator client with verify + settle methods */
export interface FacilitatorClient {
  verify(payload: PaymentPayload, requirements: PaymentRequirements[]): Promise<VerifyResponse>;
  settle(payload: PaymentPayload, requirements: PaymentRequirements[]): Promise<SettleResponse>;
}

/** x402 configuration for middleware */
export interface X402Config {
  facilitator: FacilitatorClient;
  resource: ResourceInfo;
  accepts: PaymentRequirements[];
}

// ---------------------------------------------------------------------------
// Base64 JSON encode / decode
// ---------------------------------------------------------------------------

/**
 * Encode data as a base64 JSON string for use in HTTP headers.
 */
export function encodeX402Header(data: unknown): string {
  const json = JSON.stringify(data);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(json).toString('base64');
  }
  return btoa(json);
}

/**
 * Decode a base64 JSON header value.
 */
export function decodeX402Header<T = unknown>(header: string): T {
  let json: string;
  if (typeof Buffer !== 'undefined') {
    json = Buffer.from(header, 'base64').toString('utf-8');
  } else {
    json = atob(header);
  }
  return JSON.parse(json) as T;
}

// ---------------------------------------------------------------------------
// Facilitator client
// ---------------------------------------------------------------------------

/**
 * Create a facilitator client that communicates via HTTP.
 *
 * The x402 facilitator exposes two endpoints:
 *   - POST /verify — validates a payment signature
 *   - POST /settle — settles the payment on-chain
 */
export function createFacilitatorClient(options: { url: string }): FacilitatorClient {
  const baseUrl = options.url.replace(/\/+$/, '');

  return {
    async verify(payload, requirements) {
      const res = await fetch(`${baseUrl}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload, requirements }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`Facilitator verify failed (${res.status}): ${text}`);
      }

      return res.json() as Promise<VerifyResponse>;
    },

    async settle(payload, requirements) {
      const res = await fetch(`${baseUrl}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload, requirements }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`Facilitator settle failed (${res.status}): ${text}`);
      }

      return res.json() as Promise<SettleResponse>;
    },
  };
}

// ---------------------------------------------------------------------------
// Payment processing
// ---------------------------------------------------------------------------

/**
 * Verify and settle an x402 payment in one call.
 *
 * 1. Calls facilitator.verify() to validate the payment signature
 * 2. If valid, calls facilitator.settle() to execute the on-chain transfer
 * 3. Returns the payment details with transaction hash
 */
export async function processX402Payment(
  payload: PaymentPayload,
  accepts: PaymentRequirements[],
  facilitator: FacilitatorClient,
): Promise<X402Result> {
  // 1. Verify the payment signature
  const verifyResult = await facilitator.verify(payload, accepts);

  if (!verifyResult.valid) {
    return {
      valid: false,
      error: `Payment verification failed: ${verifyResult.reason ?? 'unknown'}`,
    };
  }

  // 2. Settle the payment on-chain
  const settleResult = await facilitator.settle(payload, accepts);

  if (!settleResult.success) {
    return {
      valid: false,
      error: `Payment settlement failed: ${settleResult.reason ?? 'unknown'}`,
    };
  }

  return {
    valid: true,
    payment: {
      scheme: payload.payment.scheme,
      network: payload.payment.network,
      amount: payload.payment.amount,
      asset: payload.payment.asset,
      payTo: payload.payment.payTo,
      txHash: settleResult.txHash,
    },
  };
}
