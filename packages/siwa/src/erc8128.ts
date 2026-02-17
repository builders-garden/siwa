/**
 * erc8128.ts
 *
 * Full ERC-8128 HTTP Message Signatures integration for SIWA.
 *
 * The SDK fully abstracts `@slicekit/erc8128`. Platform developers call:
 *   - signAuthenticatedRequest()   — agent-side: attach receipt + sign request
 *   - verifyAuthenticatedRequest() — server-side: verify signature + receipt + optional onchain
 *
 * These are the two main entry points. Everything else is internal.
 */

import type { Address, Hex, PublicClient } from 'viem';
import {
  signRequest,
  verifyRequest,
  type EthHttpSigner,
  type VerifyResult,
  type NonceStore,
} from '@slicekit/erc8128';
import type { Signer, SignerType } from './signer/index.js';
import { verifyReceipt, type ReceiptPayload } from './receipt.js';
import {
  createCaptchaChallenge,
  unpackCaptchaResponse,
  verifyCaptchaSolution,
  packCaptchaResponse,
  CHALLENGE_RESPONSE_HEADER,
  type CaptchaChallenge,
  type CaptchaPolicy,
  type CaptchaOptions,
  type CaptchaSolver,
} from './captcha.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VerifyOptions {
  receiptSecret: string;
  rpcUrl?: string;
  verifyOnchain?: boolean;
  publicClient?: PublicClient;
  nonceStore?: NonceStore;
  allowedSignerTypes?: SignerType[];
  captchaPolicy?: CaptchaPolicy;
  captchaOptions?: CaptchaOptions;
}

/** Verified agent identity returned from a successful auth check. */
export interface SiwaAgent {
  address: string;
  agentId: number;
  agentRegistry: string;
  chainId: number;
  signerType?: SignerType;
}

export type AuthResult =
  | { valid: true; agent: SiwaAgent }
  | { valid: false; error: string }
  | { valid: false; error: string; captchaRequired: true; challenge: CaptchaChallenge; challengeToken: string };

/**
 * Resolve the receipt secret from an explicit value or environment variables.
 *
 * Checks (in order): `explicit` → `RECEIPT_SECRET` env → `SIWA_SECRET` env → throws.
 */
export function resolveReceiptSecret(explicit?: string): string {
  const secret = explicit || process.env.RECEIPT_SECRET || process.env.SIWA_SECRET;
  if (!secret) {
    throw new Error(
      'Missing receipt secret: pass receiptSecret option, or set RECEIPT_SECRET / SIWA_SECRET env var',
    );
  }
  return secret;
}

/** Header name for the verification receipt */
export const RECEIPT_HEADER = 'X-SIWA-Receipt';

// ---------------------------------------------------------------------------
// Agent-side: signer creation
// ---------------------------------------------------------------------------

/**
 * Create an ERC-8128 HTTP signer from a SIWA Signer.
 *
 * The `signMessage` callback converts the RFC 9421 signature base
 * (Uint8Array) to a hex string and delegates to the signer.
 *
 * @param signer - A SIWA Signer (createKeyringProxySigner, createLocalAccountSigner, etc.)
 * @param chainId - Chain ID for the ERC-8128 keyid
 * @param options - Optional overrides (e.g. signerAddress for TBA identity)
 * @returns An EthHttpSigner for use with @slicekit/erc8128
 */
export async function createErc8128Signer(
  signer: Signer,
  chainId: number,
  options?: { signerAddress?: Address },
): Promise<EthHttpSigner> {
  const address = options?.signerAddress ?? await signer.getAddress();

  return {
    address,
    chainId,
    signMessage: async (message: Uint8Array): Promise<Hex> => {
      const hex = ('0x' + Array.from(message).map(b => b.toString(16).padStart(2, '0')).join('')) as Hex;

      // Use signRawMessage if available (preferred for raw bytes)
      if (signer.signRawMessage) {
        return signer.signRawMessage(hex);
      }

      // Fallback to signMessage for signers without signRawMessage
      return signer.signMessage(hex);
    },
  };
}

// ---------------------------------------------------------------------------
// Agent-side: high-level request signing
// ---------------------------------------------------------------------------

/**
 * Attach a verification receipt to a request.
 *
 * Sets the `X-SIWA-Receipt` header.
 */
export function attachReceipt(request: Request, receipt: string): Request {
  const headers = new Headers(request.headers);
  headers.set(RECEIPT_HEADER, receipt);
  return new Request(request, { headers });
}

/**
 * Sign an authenticated request: attach receipt + ERC-8128 signature.
 *
 * This is the main function platform developers use on the agent side.
 * One call does everything:
 *   1. Attaches the receipt header
 *   2. Creates an ERC-8128 signer from the SIWA signer
 *   3. Signs the request with HTTP Message Signatures (RFC 9421)
 *
 * @param request  The outgoing Request object
 * @param receipt  Verification receipt from SIWA sign-in
 * @param signer   A SIWA Signer (createKeyringProxySigner, createLocalAccountSigner, etc.)
 * @param chainId  Chain ID for the ERC-8128 keyid
 * @param options  Optional overrides (e.g. signerAddress for TBA identity)
 * @returns        A new Request with Signature, Signature-Input, Content-Digest, and X-SIWA-Receipt headers
 *
 * @example
 * ```typescript
 * import { signAuthenticatedRequest, createLocalAccountSigner } from '@buildersgarden/siwa';
 * import { privateKeyToAccount } from 'viem/accounts';
 *
 * const account = privateKeyToAccount('0x...');
 * const signer = createLocalAccountSigner(account);
 *
 * const signedRequest = await signAuthenticatedRequest(
 *   new Request('https://api.example.com/data'),
 *   receipt,
 *   signer,
 *   84532
 * );
 * ```
 */
export async function signAuthenticatedRequest(
  request: Request,
  receipt: string,
  signer: Signer,
  chainId: number,
  options?: { signerAddress?: Address },
): Promise<Request> {
  // 1. Attach receipt header
  const withReceipt = attachReceipt(request, receipt);

  // 2. Create ERC-8128 signer from SIWA signer
  const erc8128Signer = await createErc8128Signer(signer, chainId, options);

  // 3. Sign with ERC-8128 (includes Content-Digest for bodies and receipt header)
  return signRequest(withReceipt, erc8128Signer, {
    components: [RECEIPT_HEADER],
  });
}

// ---------------------------------------------------------------------------
// Agent-side: captcha retry helper
// ---------------------------------------------------------------------------

/**
 * Detect a captcha challenge in a server response and build a re-signed retry request.
 *
 * When a server returns 401 with `{ captchaRequired: true, challenge, challengeToken }`,
 * this function:
 *   1. Extracts the challenge from the response body
 *   2. Calls the solver to generate solution text
 *   3. Packs the solution into the `X-SIWA-Challenge-Response` header
 *   4. Re-signs the request with ERC-8128 (binding the challenge response into the signature)
 *   5. Returns the new signed request ready for retry
 *
 * **Important:** The `request` parameter must be a fresh, unconsumed Request
 * (not the one already sent via `fetch`). Keep the original URL, method, headers,
 * and body around so you can reconstruct it for the retry.
 *
 * @param response  The server's 401 response (body is read via `.clone()`, so the original stays readable)
 * @param request   A fresh, unconsumed Request matching the original call
 * @param receipt   Verification receipt from SIWA sign-in
 * @param signer    A SIWA Signer
 * @param chainId   Chain ID for the ERC-8128 keyid
 * @param solver    Callback that generates solution text from a challenge
 * @param options   Optional overrides (e.g. signerAddress for TBA identity)
 * @returns `{ retry: true, request }` with the signed retry request, or `{ retry: false }` if no captcha
 *
 * @example
 * ```typescript
 * import { signAuthenticatedRequest, retryWithCaptcha } from '@buildersgarden/siwa/erc8128';
 *
 * const url = 'https://api.example.com/action';
 * const body = JSON.stringify({ key: 'value' });
 *
 * // First attempt
 * const signed = await signAuthenticatedRequest(
 *   new Request(url, { method: 'POST', body }),
 *   receipt, signer, 84532,
 * );
 * const response = await fetch(signed);
 *
 * // Handle captcha if required
 * const result = await retryWithCaptcha(
 *   response,
 *   new Request(url, { method: 'POST', body }), // fresh request
 *   receipt, signer, 84532,
 *   async (challenge) => generateText(challenge), // your LLM solver
 * );
 *
 * if (result.retry) {
 *   const retryResponse = await fetch(result.request);
 * }
 * ```
 */
export async function retryWithCaptcha(
  response: Response,
  request: Request,
  receipt: string,
  signer: Signer,
  chainId: number,
  solver: CaptchaSolver,
  options?: { signerAddress?: Address },
): Promise<{ retry: true; request: Request } | { retry: false }> {
  // Only handle 401 responses
  if (response.status !== 401) return { retry: false };

  // Read from a clone so the original response stays readable for the caller
  let body: any;
  try {
    body = await response.clone().json();
  } catch {
    return { retry: false };
  }

  if (!body.captchaRequired || !body.challenge || !body.challengeToken) {
    return { retry: false };
  }

  // Solve the challenge
  const text = await solver(body.challenge);
  const packed = packCaptchaResponse(body.challengeToken, text);

  // Rebuild the request with receipt + challenge response headers
  const headers = new Headers(request.headers);
  headers.set(RECEIPT_HEADER, receipt);
  headers.set(CHALLENGE_RESPONSE_HEADER, packed);

  const rebuiltRequest = new Request(request, { headers });

  // Create ERC-8128 signer and sign with both headers bound into the signature
  const erc8128Signer = await createErc8128Signer(signer, chainId, options);
  const signedRequest = await signRequest(rebuiltRequest, erc8128Signer, {
    components: [RECEIPT_HEADER, CHALLENGE_RESPONSE_HEADER],
  });

  return { retry: true, request: signedRequest };
}

// ---------------------------------------------------------------------------
// Server-side: high-level request verification
// ---------------------------------------------------------------------------

/**
 * In-memory nonce store for ERC-8128 replay protection.
 *
 * Uses a Map with TTL-based expiry. For production, replace with Redis
 * or another persistent store via the NonceStore interface.
 */
function createMemoryNonceStore(): NonceStore {
  const seen = new Map<string, number>(); // key → expiry timestamp (ms)

  return {
    async consume(key: string, ttlSeconds: number): Promise<boolean> {
      // Lazy cleanup of expired entries
      const now = Date.now();
      for (const [k, expiry] of seen) {
        if (expiry < now) seen.delete(k);
      }

      if (seen.has(key)) return false; // replay
      seen.set(key, now + ttlSeconds * 1000);
      return true;
    },
  };
}

/** Singleton nonce store — shared across the server process */
const nonceStore = createMemoryNonceStore();

/**
 * Verify an authenticated request: ERC-8128 signature + receipt + optional onchain check.
 *
 * This is the main function platform developers use on the server side.
 * One call does everything:
 *   1. Extracts and verifies the HMAC receipt
 *   2. Verifies the ERC-8128 HTTP signature (recovers signer address)
 *   3. Checks that the signer address matches the receipt address
 *   4. Optionally does an onchain ownerOf check
 *
 * @param request  The incoming Request object (with Signature + X-SIWA-Receipt headers)
 * @param options  Verification options (receipt secret, optional onchain settings)
 * @returns        `{ valid: true, agent }` or `{ valid: false, error }`
 */
export async function verifyAuthenticatedRequest(
  request: Request,
  options: VerifyOptions,
): Promise<AuthResult> {
  // 1. Extract and verify receipt
  const receiptToken = request.headers.get(RECEIPT_HEADER);
  if (!receiptToken) {
    return { valid: false, error: 'Missing X-SIWA-Receipt header' };
  }

  const receipt = verifyReceipt(receiptToken, options.receiptSecret);
  if (!receipt) {
    return { valid: false, error: 'Invalid or expired receipt' };
  }

  // 1b. Enforce signer type policy
  if (options.allowedSignerTypes?.length && !options.allowedSignerTypes.includes(receipt.signerType as any)) {
    return { valid: false, error: `Signer type '${receipt.signerType || 'unknown'}' is not in allowed types [${options.allowedSignerTypes.join(', ')}]` };
  }

  // 2. Verify ERC-8128 signature
  const { verifyMessage } = await import('viem');

  const verifyResult: VerifyResult = await verifyRequest(
    request,
    async (args) => {
      // If a publicClient is provided, use it for ERC-1271 support
      if (options.publicClient) {
        return options.publicClient.verifyMessage({
          address: args.address,
          message: args.message,
          signature: args.signature,
        });
      }
      // Fallback to pure EOA verification
      return verifyMessage({
        address: args.address,
        message: args.message,
        signature: args.signature,
      });
    },
    options.nonceStore ?? nonceStore,
    {
      additionalRequestBoundComponents: [RECEIPT_HEADER], 
      classBoundPolicies: [RECEIPT_HEADER]
    }
  );

  if (!verifyResult.ok) {
    return { valid: false, error: `ERC-8128 verification failed: ${verifyResult.reason}${verifyResult.detail ? ` (${verifyResult.detail})` : ''}` };
  }

  // 3. Address match: signer must match receipt
  if (verifyResult.address.toLowerCase() !== receipt.address.toLowerCase()) {
    return { valid: false, error: 'Signer address does not match receipt address' };
  }

  // 4. Optional onchain check
  if (options.verifyOnchain) {
    const client = options.publicClient ?? (await createOnchainClient(options.rpcUrl));
    if (!client) {
      return { valid: false, error: 'Onchain verification requested but no RPC URL or publicClient provided' };
    }

    const registryParts = receipt.agentRegistry.split(':');
    if (registryParts.length !== 3 || registryParts[0] !== 'eip155') {
      return { valid: false, error: 'Invalid agentRegistry format in receipt' };
    }

    const registryAddress = registryParts[2] as Address;

    try {
      const owner = await client.readContract({
        address: registryAddress,
        abi: [{
          name: 'ownerOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'tokenId', type: 'uint256' }],
          outputs: [{ name: '', type: 'address' }],
        }] as const,
        functionName: 'ownerOf',
        args: [BigInt(receipt.agentId)],
      }) as string;

      if (owner.toLowerCase() !== receipt.address.toLowerCase()) {
        return { valid: false, error: 'Onchain ownership check failed: signer is not the NFT owner' };
      }
    } catch {
      return { valid: false, error: 'Onchain ownership check failed: agent not registered' };
    }
  }

  // 5. Captcha evaluation (after successful auth, server-defined policy)
  if (options.captchaPolicy) {
    const captchaSecret = options.captchaOptions?.secret ?? options.receiptSecret;
    const difficulty = await options.captchaPolicy({
      address: receipt.address,
      agentId: receipt.agentId,
      agentRegistry: receipt.agentRegistry,
      request,
    });

    if (difficulty) {
      const responseHeader = request.headers.get(CHALLENGE_RESPONSE_HEADER);
      if (responseHeader) {
        // Agent submitted a challenge response — verify it
        const unpacked = unpackCaptchaResponse(responseHeader);
        if (!unpacked) {
          return { valid: false, error: 'Invalid captcha response format' };
        }
        const verification = await verifyCaptchaSolution(
          unpacked.challengeToken, unpacked.solution, captchaSecret, options.captchaOptions?.verify,
        );
        if (!verification || !verification.overallPass) {
          return { valid: false, error: `Captcha verification failed: ${verification?.verdict ?? 'invalid token'}` };
        }
        // Captcha passed — fall through to return success
      } else {
        // No challenge response — issue a new challenge
        const captchaOpts: CaptchaOptions = {
          secret: captchaSecret,
          topics: options.captchaOptions?.topics,
          formats: options.captchaOptions?.formats,
          difficulties: options.captchaOptions?.difficulties,
        };
        const { challenge, challengeToken } = createCaptchaChallenge(difficulty, captchaOpts);
        return {
          valid: false,
          error: 'Captcha required',
          captchaRequired: true,
          challenge,
          challengeToken,
        };
      }
    }
  }

  return {
    valid: true,
    agent: {
      address: receipt.address,
      agentId: receipt.agentId,
      agentRegistry: receipt.agentRegistry,
      chainId: receipt.chainId,
      ...(receipt.signerType ? { signerType: receipt.signerType } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Convert an Express request to a Fetch API Request.
 *
 * Needed because ERC-8128 operates on the Fetch `Request` object,
 * but Express uses its own request type.
 *
 * @param req  Express request object (must have `rawBody` for Content-Digest verification)
 */
export function expressToFetchRequest(req: {
  method: string;
  protocol: string;
  get: (name: string) => string | undefined;
  originalUrl: string;
  headers: Record<string, string | string[] | undefined>;
  rawBody?: string;
}): Request {
  const host = req.get('host') || 'localhost';
  const url = `${req.protocol}://${host}${req.originalUrl}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';

  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? (req.rawBody ?? null) : null,
  });
}

/**
 * Normalize a Next.js/serverless Request for ERC-8128 verification.
 *
 * Behind reverse proxies (Vercel, Railway, Cloudflare), the request URL
 * may reflect internal routing instead of the public origin. This helper
 * reads X-Forwarded-Host / X-Forwarded-Proto headers and reconstructs
 * the URL to match what the agent signed.
 */
export function nextjsToFetchRequest(req: Request): Request {
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';

  if (!forwardedHost) return req; // no proxy headers, return as-is

  const url = new URL(req.url);
  const publicUrl = `${forwardedProto}://${forwardedHost}${url.pathname}${url.search}`;

  return new Request(publicUrl, {
    method: req.method,
    headers: req.headers,
    body: req.body,
    // @ts-ignore - duplex required for streaming bodies in Node 18+
    duplex: 'half',
  });
}

/**
 * Lazily create a viem PublicClient from an RPC URL.
 */
async function createOnchainClient(rpcUrl?: string): Promise<PublicClient | null> {
  if (!rpcUrl) return null;
  const { createPublicClient, http } = await import('viem');
  return createPublicClient({ transport: http(rpcUrl) });
}
