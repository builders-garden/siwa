/**
 * circle.ts
 *
 * Circle developer-controlled wallet signer implementation.
 */

import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import type { CircleDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import type { Address, Hex } from "viem";
import type { Signer } from "./types.js";

/**
 * Configuration for the Circle SIWA signer.
 */
export interface CircleSiwaSignerConfig {
  /** Circle API key */
  apiKey: string;
  /** Circle entity secret */
  entitySecret: string;
  /** Circle wallet ID */
  walletId: string;
  /** Wallet address (optional - will be fetched from Circle if not provided) */
  walletAddress?: Address;
}

/**
 * Configuration using an existing Circle client.
 */
export interface CircleSiwaSignerClientConfig {
  /** Existing Circle client instance */
  client: CircleDeveloperControlledWalletsClient;
  /** Circle wallet ID */
  walletId: string;
  /** Wallet address (optional - will be fetched from Circle if not provided) */
  walletAddress?: Address;
}

/**
 * Fetches wallet address from Circle API using the wallet ID.
 */
async function fetchWalletAddress(
  client: CircleDeveloperControlledWalletsClient,
  walletId: string
): Promise<Address> {
  const response = await client.getWallet({ id: walletId });
  const address = response.data?.wallet?.address;

  if (!address) {
    throw new Error(`Failed to fetch wallet address for wallet ID: ${walletId}`);
  }

  return address as Address;
}

/**
 * Creates a SIWA Signer that wraps Circle's developer-controlled wallet SDK.
 *
 * This signer implements the core Signer interface for SIWA message signing.
 * It supports both standard message signing (EIP-191) and raw hex signing
 * for ERC-8128 HTTP message signatures.
 *
 * The wallet address can be provided explicitly or fetched automatically
 * from Circle using the wallet ID.
 *
 * @param config - Circle wallet configuration
 * @returns A Promise that resolves to a Signer compatible with SIWA's signSIWAMessage function
 *
 * @example
 * ```typescript
 * import { signSIWAMessage, generateNonce } from '@buildersgarden/siwa/siwa';
 * import { createCircleSiwaSigner } from '@buildersgarden/siwa/signer';
 *
 * // Address is fetched automatically from Circle
 * const signer = await createCircleSiwaSigner({
 *   apiKey: process.env.CIRCLE_API_KEY!,
 *   entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
 *   walletId: 'your-wallet-id',
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
export async function createCircleSiwaSigner(
  config: CircleSiwaSignerConfig
): Promise<Signer> {
  const client = initiateDeveloperControlledWalletsClient({
    apiKey: config.apiKey,
    entitySecret: config.entitySecret,
  });

  return createCircleSiwaSignerFromClient({
    client,
    walletId: config.walletId,
    ...(config.walletAddress && { walletAddress: config.walletAddress }),
  });
}

/**
 * Creates a SIWA Signer from an existing Circle client instance.
 *
 * Use this when you already have a Circle client initialized and want
 * to reuse it for SIWA signing.
 *
 * @param config - Configuration with existing Circle client
 * @returns A Promise that resolves to a Signer compatible with SIWA's signSIWAMessage function
 */
export async function createCircleSiwaSignerFromClient(
  config: CircleSiwaSignerClientConfig
): Promise<Signer> {
  const { client, walletId } = config;

  // Fetch wallet address from Circle if not provided
  const walletAddress =
    config.walletAddress ?? (await fetchWalletAddress(client, walletId));

  return {
    /**
     * Returns the wallet address.
     */
    async getAddress(): Promise<Address> {
      return walletAddress;
    },

    /**
     * Signs a message using EIP-191 personal_sign.
     * Used for standard SIWA message signing.
     */
    async signMessage(message: string): Promise<Hex> {
      const response = await client.signMessage({
        walletId,
        message,
        encodedByHex: false,
      });

      const signature = response.data?.signature;
      if (!signature) {
        throw new Error("Circle signMessage failed: no signature returned");
      }

      return signature as Hex;
    },

    /**
     * Signs raw hex bytes.
     * Used by ERC-8128 for HTTP message signatures.
     */
    async signRawMessage(rawHex: Hex): Promise<Hex> {
      // Strip 0x prefix if present for Circle API
      const hexMessage = rawHex.startsWith("0x") ? rawHex.slice(2) : rawHex;

      const response = await client.signMessage({
        walletId,
        message: hexMessage,
        encodedByHex: true,
      });

      const signature = response.data?.signature;
      if (!signature) {
        throw new Error("Circle signRawMessage failed: no signature returned");
      }

      return signature as Hex;
    },
  };
}
