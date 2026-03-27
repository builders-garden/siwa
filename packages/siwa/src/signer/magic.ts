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

const DEFAULT_BASE_URL = "https://tee.express.magiclabs.com";

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
  /** Express API base URL (defaults to https://tee.express.magiclabs.com) */
  baseUrl?: string;
  /** Blockchain chain identifier (defaults to "ETH") */
  chain?: string;
}

interface ResolvedConfig {
  secretKey: string;
  jwt: string;
  providerId: string;
  baseUrl: string;
  chain: string;
}

function resolveConfig(config: MagicSiwaSignerConfig): ResolvedConfig {
  const secretKey = config.secretKey ?? process.env.MAGIC_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "Magic Secret Key is required. Provide secretKey in config or set MAGIC_SECRET_KEY env var."
    );
  }

  return {
    secretKey,
    jwt: config.jwt,
    providerId: config.providerId,
    baseUrl: (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
    chain: config.chain ?? "ETH",
  };
}

function buildHeaders(config: ResolvedConfig): Record<string, string> {
  return {
    "X-Magic-Secret-Key": config.secretKey,
    "X-Magic-Chain": config.chain,
    "X-OIDC-Provider-ID": config.providerId,
    Authorization: `Bearer ${config.jwt}`,
  };
}

/**
 * Fetches the wallet address from the Magic Express API.
 * POST /v1/wallet is idempotent — returns the existing wallet or creates one.
 */
async function fetchWalletAddress(config: ResolvedConfig): Promise<Address> {
  const response = await fetch(`${config.baseUrl}/v1/wallet`, {
    method: "POST",
    headers: buildHeaders(config),
  });

  if (!response.ok) {
    throw new Error(
      `Magic /v1/wallet failed: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  if (!data.public_address) {
    throw new Error("No public address returned from Magic Express API");
  }

  return data.public_address as Address;
}

/**
 * Signs a base64-encoded message via the Magic Express API.
 * The TEE performs EIP-191 personal_sign on the decoded payload.
 */
async function magicSign(
  config: ResolvedConfig,
  messageBase64: string
): Promise<Hex> {
  const response = await fetch(
    `${config.baseUrl}/v1/wallet/sign/message`,
    {
      method: "POST",
      headers: {
        ...buildHeaders(config),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message_base64: messageBase64 }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Magic sign failed: ${response.status} ${response.statusText}`
    );
  }

  const result = await response.json();
  if (!result.signature) {
    throw new Error("No signature returned from Magic Express API");
  }

  return result.signature as Hex;
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
  const resolved = resolveConfig(config);
  const walletAddress = await fetchWalletAddress(resolved);

  return {
    async getAddress(): Promise<Address> {
      return walletAddress;
    },

    async signMessage(message: string): Promise<Hex> {
      const messageBase64 = Buffer.from(message, "utf-8").toString("base64");
      return magicSign(resolved, messageBase64);
    },

    async signRawMessage(rawHex: Hex): Promise<Hex> {
      const bytes = Buffer.from(rawHex.slice(2), "hex");
      const messageBase64 = bytes.toString("base64");
      return magicSign(resolved, messageBase64);
    },
  };
}
