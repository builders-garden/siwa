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
import { signRawMessage, getAddress, type KeystoreConfig } from './keystore.js';
import { verifyReceipt, type ReceiptPayload } from './receipt.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VerifyOptions {
  receiptSecret: string;
  rpcUrl?: string;
  verifyOnchain?: boolean;
  publicClient?: PublicClient;
}

export type AuthResult =
  | {
      valid: true;
      agent: {
        address: string;
        agentId: number;
        agentRegistry: string;
        chainId: number;
      };
    }
  | { valid: false; error: string };

/** Header name for the verification receipt */
export const RECEIPT_HEADER = 'X-SIWA-Receipt';

// ---------------------------------------------------------------------------
// Agent-side: signer creation
// ---------------------------------------------------------------------------

/**
 * Create an ERC-8128 signer backed by the keyring proxy.
 *
 * The `signMessage` callback converts the RFC 9421 signature base
 * (Uint8Array) to a hex string and delegates to the proxy via
 * `signRawMessage`, which signs with `{ raw: true }`.
 */
export async function createProxySigner(
  config: KeystoreConfig,
  chainId: number,
): Promise<EthHttpSigner> {
  const address = await getAddress(config);
  if (!address) throw new Error('No wallet found in keystore');

  return {
    address: address as Address,
    chainId,
    signMessage: async (message: Uint8Array): Promise<Hex> => {
      const hex = ('0x' + Array.from(message).map(b => b.toString(16).padStart(2, '0')).join('')) as Hex;
      const result = await signRawMessage(hex, config);
      return result.signature as Hex;
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
 *   2. Creates a proxy-backed ERC-8128 signer
 *   3. Signs the request with HTTP Message Signatures (RFC 9421)
 *
 * @param request  The outgoing Request object
 * @param receipt  Verification receipt from SIWA sign-in
 * @param config   Keystore config (proxy URL + secret)
 * @param chainId  Chain ID for the ERC-8128 keyid
 * @returns        A new Request with Signature, Signature-Input, Content-Digest, and X-SIWA-Receipt headers
 */
export async function signAuthenticatedRequest(
  request: Request,
  receipt: string,
  config: KeystoreConfig,
  chainId: number,
): Promise<Request> {
  // 1. Attach receipt header
  const withReceipt = attachReceipt(request, receipt);

  // 2. Create proxy-backed signer
  const signer = await createProxySigner(config, chainId);

  // 3. Sign with ERC-8128 (includes Content-Digest for bodies)
  return signRequest(withReceipt, signer);
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
    nonceStore,
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

  return {
    valid: true,
    agent: {
      address: receipt.address,
      agentId: receipt.agentId,
      agentRegistry: receipt.agentRegistry,
      chainId: receipt.chainId,
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
 * Lazily create a viem PublicClient from an RPC URL.
 */
async function createOnchainClient(rpcUrl?: string): Promise<PublicClient | null> {
  if (!rpcUrl) return null;
  const { createPublicClient, http } = await import('viem');
  return createPublicClient({ transport: http(rpcUrl) });
}
