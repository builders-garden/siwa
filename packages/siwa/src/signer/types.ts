/**
 * types.ts
 *
 * Core signer types and interfaces for SIWA.
 */

import type { Address, Hex } from 'viem';

/**
 * Signer type detected during SIWA sign-in.
 *
 * - `'eoa'` — Externally Owned Account (ECDSA key pair)
 * - `'sca'` — Smart Contract Account (ERC-1271, e.g. Safe, TBA, Kernel)
 */
export type SignerType = 'eoa' | 'sca';

/**
 * Core signer interface for message signing.
 *
 * Implement this interface to add support for new wallet providers.
 */
export interface Signer {
  /** Get the signer's address */
  getAddress(): Promise<Address>;

  /** Sign a message (EIP-191 personal_sign) */
  signMessage(message: string): Promise<Hex>;

  /**
   * Sign raw bytes (optional).
   * Used by ERC-8128 for HTTP message signatures.
   * If not implemented, signMessage will be used as fallback.
   */
  signRawMessage?(rawHex: Hex): Promise<Hex>;
}

/**
 * Extended signer with transaction signing capabilities.
 *
 * Required for onchain operations like agent registration.
 */
export interface TransactionSigner extends Signer {
  /** Sign a transaction and return the serialized signed transaction */
  signTransaction(tx: TransactionRequest): Promise<Hex>;
}

/** Transaction request compatible with viem */
export interface TransactionRequest {
  to?: Address;
  data?: Hex;
  value?: bigint;
  nonce?: number;
  chainId?: number;
  gas?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  gasPrice?: bigint;
  type?: number | string;
  accessList?: any[];
}

/** Configuration for the keyring proxy signer */
export interface KeyringProxyConfig {
  /** URL of the keyring proxy server (or KEYRING_PROXY_URL env var) */
  proxyUrl?: string;
  /** HMAC shared secret (or KEYRING_PROXY_SECRET env var) */
  proxySecret?: string;
}
