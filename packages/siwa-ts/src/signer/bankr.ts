/**
 * bankr.ts
 *
 * Bankr wallet signer implementation.
 *
 * Uses the Bankr Agent API (https://api.bankr.bot) for signing operations.
 * Wallet address is fetched via GET /agent/me, messages are signed via POST /agent/sign.
 */

import type { Address, Hex } from "viem";
import type { Signer } from "./types.js";

/**
 * Configuration for the Bankr SIWA signer.
 */
export interface BankrSiwaSignerConfig {
  /** Bankr API key (or BANKR_API_KEY env var) */
  apiKey?: string;
  /** Bankr API base URL (defaults to https://api.bankr.bot) */
  baseUrl?: string;
}

/**
 * Resolved configuration with required fields.
 */
interface ResolvedConfig {
  apiKey: string;
  baseUrl: string;
}

function resolveConfig(config: BankrSiwaSignerConfig): ResolvedConfig {
  const apiKey = config.apiKey ?? process.env.BANKR_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Bankr API key is required. Provide apiKey in config or set BANKR_API_KEY env var."
    );
  }

  return {
    apiKey,
    baseUrl: config.baseUrl ?? "https://api.bankr.bot",
  };
}

/**
 * Fetches the EVM wallet address from the Bankr API.
 */
async function fetchWalletAddress(config: ResolvedConfig): Promise<Address> {
  const response = await fetch(`${config.baseUrl}/agent/me`, {
    headers: {
      "X-API-Key": config.apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Bankr API /agent/me failed: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const evmWallet = data.wallets?.find(
    (w: { chain: string; address: string }) => w.chain === "evm"
  );

  if (!evmWallet?.address) {
    throw new Error("No EVM wallet found in Bankr account");
  }

  return evmWallet.address as Address;
}

/**
 * Signs a message using the Bankr Agent API.
 */
async function bankrSign(
  config: ResolvedConfig,
  signatureType: string,
  payload: Record<string, unknown>
): Promise<{ signature: Hex; signer: Address }> {
  const response = await fetch(`${config.baseUrl}/agent/sign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": config.apiKey,
    },
    body: JSON.stringify({ signatureType, ...payload }),
  });

  if (!response.ok) {
    throw new Error(
      `Bankr sign failed: ${response.status} ${response.statusText}`
    );
  }

  const result = await response.json();

  if (!result.success || !result.signature) {
    throw new Error(
      `Bankr sign failed: ${result.error ?? "no signature returned"}`
    );
  }

  return {
    signature: result.signature as Hex,
    signer: result.signer as Address,
  };
}

/**
 * Creates a SIWA Signer that wraps the Bankr Agent API.
 *
 * This signer implements the core Signer interface for SIWA message signing.
 * It supports both standard message signing (EIP-191) and raw hex signing
 * for ERC-8128 HTTP message signatures.
 *
 * The wallet address is fetched from the Bankr API on creation.
 *
 * @param config - Bankr API configuration
 * @returns A Promise that resolves to a Signer compatible with SIWA's signSIWAMessage function
 *
 * @example
 * ```typescript
 * import { signSIWAMessage } from '@buildersgarden/siwa';
 * import { createBankrSiwaSigner } from '@buildersgarden/siwa/signer';
 *
 * const signer = await createBankrSiwaSigner({
 *   apiKey: process.env.BANKR_API_KEY!,
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
export async function createBankrSiwaSigner(
  config: BankrSiwaSignerConfig = {}
): Promise<Signer> {
  const resolved = resolveConfig(config);
  const walletAddress = await fetchWalletAddress(resolved);

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
      const result = await bankrSign(resolved, "personal_sign", { message });
      return result.signature;
    },

    /**
     * Signs raw hex bytes.
     * Used by ERC-8128 for HTTP message signatures.
     */
    async signRawMessage(rawHex: Hex): Promise<Hex> {
      const result = await bankrSign(resolved, "personal_sign", {
        message: rawHex,
      });
      return result.signature;
    },
  };
}
