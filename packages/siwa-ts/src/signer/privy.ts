/**
 * privy.ts
 *
 * Privy server wallet signer implementation.
 */

import type { PrivyClient } from "@privy-io/node";
import type { Address, Hex } from "viem";
import type { Signer } from "./types.js";

/**
 * Configuration for the Privy SIWA signer.
 */
export interface PrivySiwaSignerConfig {
  /** Privy client instance */
  client: PrivyClient;
  /** Privy wallet ID */
  walletId: string;
  /** Wallet address */
  walletAddress: Address;
}

/**
 * Creates a SIWA Signer that wraps Privy's server wallet SDK.
 *
 * This signer implements the core Signer interface for SIWA message signing.
 * It supports both standard message signing (EIP-191) and raw hex signing
 * for ERC-8128 HTTP message signatures.
 *
 * @param config - Privy wallet configuration
 * @returns A Signer compatible with SIWA's signSIWAMessage function
 *
 * @example
 * ```typescript
 * import { PrivyClient } from '@privy-io/node';
 * import { signSIWAMessage, generateNonce } from '@buildersgarden/siwa/siwa';
 * import { createPrivySiwaSigner } from '@buildersgarden/siwa/signer';
 *
 * const privy = new PrivyClient({
 *   appId: process.env.PRIVY_APP_ID!,
 *   appSecret: process.env.PRIVY_APP_SECRET!,
 * });
 *
 * const signer = createPrivySiwaSigner({
 *   client: privy,
 *   walletId: 'your-wallet-id',
 *   walletAddress: '0x...',
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
export function createPrivySiwaSigner(config: PrivySiwaSignerConfig): Signer {
  const { client, walletId, walletAddress } = config;

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
      const result = await client.wallets().ethereum().signMessage(walletId, {
        message,
      });
      return result.signature as Hex;
    },

    /**
     * Signs raw hex bytes.
     * Used by ERC-8128 for HTTP message signatures.
     */
    async signRawMessage(rawHex: Hex): Promise<Hex> {
      const result = await client.wallets().ethereum().signMessage(walletId, {
        message: rawHex,
      });
      return result.signature as Hex;
    },
  };
}
