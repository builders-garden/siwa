/**
 * openfort.ts
 *
 * Openfort backend wallet signer implementation.
 */

import Openfort from "@openfort/openfort-node";
import type { Address, Hex } from "viem";
import type { Signer } from "./types.js";

/**
 * Configuration for the Openfort SIWA signer.
 */
export interface OpenfortSiwaSignerConfig {
  /** Openfort API secret key (`sk_test_...` / `sk_live_...`) */
  apiKey: string;
  /** Wallet secret required for signing operations */
  walletSecret: string;
  /** Openfort account ID (`acc_...`) */
  accountId: string;
  /** Wallet address (optional - will be fetched from Openfort if not provided) */
  walletAddress?: Address;
  /** Optional API base URL override */
  basePath?: string;
}

/**
 * Configuration using an existing Openfort client.
 */
export interface OpenfortSiwaSignerClientConfig {
  /** Existing Openfort client instance */
  client: Openfort;
  /** Openfort account ID (`acc_...`) */
  accountId: string;
  /** Wallet address (optional - will be fetched from Openfort if not provided) */
  walletAddress?: Address;
}

/**
 * Creates a SIWA Signer that wraps Openfort's backend wallet SDK.
 *
 * This signer implements the core Signer interface for SIWA message signing.
 * It supports both standard message signing (EIP-191) and raw hex signing
 * for ERC-8128 HTTP message signatures.
 *
 * The wallet address can be provided explicitly or fetched automatically
 * from Openfort using the account ID.
 *
 * @param config - Openfort wallet configuration
 * @returns A Promise that resolves to a Signer compatible with SIWA's signSIWAMessage function
 *
 * @example
 * ```typescript
 * import { signSIWAMessage, generateNonce } from '@buildersgarden/siwa/siwa';
 * import { createOpenfortSiwaSigner } from '@buildersgarden/siwa/signer';
 *
 * // Address is fetched automatically from Openfort
 * const signer = await createOpenfortSiwaSigner({
 *   apiKey: process.env.OPENFORT_PROJECT_PUBLISHABLE_KEY!,
 *   walletSecret: process.env.OPENFORT_WALLET_SECRET!,
 *   accountId: 'acc_...',
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
export async function createOpenfortSiwaSigner(
  config: OpenfortSiwaSignerConfig
): Promise<Signer> {
  const client = new Openfort(config.apiKey, {
    walletSecret: config.walletSecret,
    ...(config.basePath && { basePath: config.basePath }),
  });

  return createOpenfortSiwaSignerFromClient({
    client,
    accountId: config.accountId,
    ...(config.walletAddress && { walletAddress: config.walletAddress }),
  });
}

/**
 * Creates a SIWA Signer from an existing Openfort client instance.
 *
 * Use this when you already have an Openfort client initialized and want
 * to reuse it for SIWA signing.
 *
 * @param config - Configuration with existing Openfort client
 * @returns A Promise that resolves to a Signer compatible with SIWA's signSIWAMessage function
 */
export async function createOpenfortSiwaSignerFromClient(
  config: OpenfortSiwaSignerClientConfig
): Promise<Signer> {
  const { client, accountId } = config;

  // Fetch account from Openfort (also resolves the address if not provided)
  const account = await client.accounts.evm.backend.get({ id: accountId });

  const walletAddress = config.walletAddress ?? (account.address as Address);

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
      return account.signMessage({ message });
    },

    /**
     * Signs raw hex bytes.
     * Used by ERC-8128 for HTTP message signatures.
     */
    async signRawMessage(rawHex: Hex): Promise<Hex> {
      return account.sign({ hash: rawHex });
    },
  };
}
