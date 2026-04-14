/**
 * magic.ts
 *
 * Magic server-wallet signer implementation.
 *
 * Uses the Magic Server Wallet Express API for wallet operations and message signing.
 * Wallet address is fetched via POST /v1/wallet, messages are signed
 * via POST /v1/wallet/sign/message (EIP-191 personal_sign in the TEE).
 */

import type { Address, Hex } from "viem";
import type { Signer } from "./types.js";

const BASE_URL = "https://tee.express.magiclabs.com";

/**
 * Configuration for the Magic SIWA signer.
 */
export interface MagicSiwaSignerConfig {
  /** Magic Secret Key (or MAGIC_SECRET_KEY env var) */
  secretKey?: string;
  /** JWT bearer token for user authentication */
  jwt: string;
  /** OIDC Provider ID for your Magic application */
  providerId: string;
}

/**
 * Creates a SIWA Signer backed by Magic server-side wallets.
 *
 * The signer delegates all cryptographic operations to the Magic Server Wallet
 * Express API, which proxies signing to a Trusted Execution Environment (TEE).
 * No private keys leave the TEE.
 *
 * The wallet address is fetched eagerly on creation to validate the
 * credentials and cache the address for subsequent calls.
 *
 * @param config - Magic Express API configuration
 * @returns A Promise that resolves to a Signer compatible with SIWA's signSIWAMessage function
 *
 * @example
 * ```typescript
 * import { signSIWAMessage } from '@buildersgarden/siwa';
 * import { createMagicSiwaSigner } from '@buildersgarden/siwa/signer';
 *
 * const signer = await createMagicSiwaSigner({
 *   secretKey: process.env.MAGIC_SECRET_KEY!,
 *   jwt: agentJwt,
 *   providerId: process.env.MAGIC_PROVIDER_ID!,
 * });
 *
 * const { message, signature, address } = await signSIWAMessage({
 *   domain: 'example.com',
 *   uri: 'https://example.com/login',
 *   agentId: 123,
 *   agentRegistry: 'eip155:84532:0x...',
 *   chainId: 84532,
 *   nonce: generateNonce(),
 *   issuedAt: new Date().toISOString(),
 * }, signer);
 * ```
 */
export async function createMagicSiwaSigner(
  config: MagicSiwaSignerConfig
): Promise<Signer> {
  const secretKey = config.secretKey ?? process.env.MAGIC_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "Magic Secret Key is required. Provide secretKey in config or set MAGIC_SECRET_KEY env var."
    );
  }

  const headers: Record<string, string> = {
    "X-Magic-Secret-Key": secretKey,
    "X-Magic-Chain": "ETH",
    "X-OIDC-Provider-ID": config.providerId,
    Authorization: `Bearer ${config.jwt}`,
  };

  // Fetch wallet address eagerly to validate credentials.
  // POST /v1/wallet is idempotent — returns the existing wallet or creates one.
  const walletRes = await fetch(`${BASE_URL}/v1/wallet`, {
    method: "POST",
    headers,
  });
  if (!walletRes.ok) {
    throw new Error(`Magic /v1/wallet failed: ${walletRes.status} ${walletRes.statusText}`);
  }
  const { public_address } = await walletRes.json();
  if (!public_address) {
    throw new Error("No public address returned from Magic Express API");
  }
  const walletAddress = public_address as Address;

  async function sign(messageBase64: string): Promise<Hex> {
    const res = await fetch(`${BASE_URL}/v1/wallet/sign/message`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ message_base64: messageBase64 }),
    });
    if (!res.ok) {
      throw new Error(`Magic sign failed: ${res.status} ${res.statusText}`);
    }
    const { signature } = await res.json();
    if (!signature) {
      throw new Error("No signature returned from Magic Express API");
    }
    return signature as Hex;
  }

  return {
    async getAddress(): Promise<Address> {
      return walletAddress;
    },

    async signMessage(message: string): Promise<Hex> {
      return sign(Buffer.from(message, "utf-8").toString("base64"));
    },

    async signRawMessage(rawHex: Hex): Promise<Hex> {
      return sign(Buffer.from(rawHex.slice(2), "hex").toString("base64"));
    },
  };
}
