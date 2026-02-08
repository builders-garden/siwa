/**
 * keystore/types.ts
 *
 * Type definitions for the keystore module.
 * Includes the discriminated union config types for all backends,
 * plus legacy config type for backward compatibility.
 */

import type { WalletClient, Transport, Chain, Account } from "viem";

// ---------------------------------------------------------------------------
// Backend identifiers
// ---------------------------------------------------------------------------

/** Legacy backends (shipped since v0.0.1) */
export type LegacyKeystoreBackend = "encrypted-file" | "env" | "proxy";

/** New provider backends */
export type NewKeystoreBackend = "circle" | "cdp" | "base-account" | "privy";

/** All supported backends */
export type KeystoreBackend = LegacyKeystoreBackend | NewKeystoreBackend;

// ---------------------------------------------------------------------------
// Per-backend config (discriminated union)
// ---------------------------------------------------------------------------

export interface EncryptedFileConfig {
  backend: "encrypted-file";
  keystorePath?: string;
  password?: string;
}

export interface EnvConfig {
  backend: "env";
}

export interface ProxyConfig {
  backend: "proxy";
  proxyUrl?: string;
  proxySecret?: string;
}

export interface CircleConfig {
  backend: "circle";
  apiKey?: string;
  entitySecret?: string;
  walletSetId?: string;
  walletId?: string;
  blockchain?: string;
}

export interface CdpConfig {
  backend: "cdp";
  apiKeyId?: string;
  apiKeySecret?: string;
  walletSecret?: string;
  accountName?: string;
}

export interface BaseAccountConfig {
  backend: "base-account";
}

export interface PrivyConfig {
  backend: "privy";
  appId?: string;
  appSecret?: string;
  walletId?: string;
}

/** Discriminated union of all backend configs */
export type KeystoreProviderConfig =
  | EncryptedFileConfig
  | EnvConfig
  | ProxyConfig
  | CircleConfig
  | CdpConfig
  | BaseAccountConfig
  | PrivyConfig;

// ---------------------------------------------------------------------------
// Legacy config (backward-compatible flat shape)
// ---------------------------------------------------------------------------

/**
 * Legacy flat config shape from v0.0.x.
 * Still accepted by all public API functions for backward compatibility.
 */
export interface LegacyKeystoreConfig {
  backend?: KeystoreBackend;
  keystorePath?: string;
  password?: string;
  proxyUrl?: string;
  proxySecret?: string;
}

/**
 * Config accepted by public API functions.
 * Supports both the new discriminated union and the legacy flat shape.
 */
export type KeystoreConfig = KeystoreProviderConfig | LegacyKeystoreConfig;

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface WalletInfo {
  address: string;
  backend: KeystoreBackend;
  keystorePath?: string;
}

export interface SignResult {
  signature: string;
  address: string;
}

export interface AuthorizationRequest {
  address: string;
  chainId?: number;
  nonce?: number;
}

export interface SignedAuthorization {
  address: string;
  nonce: number;
  chainId: number;
  yParity: number;
  r: string;
  s: string;
}

export interface TransactionLike {
  to?: string;
  data?: string;
  value?: bigint;
  nonce?: number;
  chainId?: number;
  type?: number;
  maxFeePerGas?: bigint | null;
  maxPriorityFeePerGas?: bigint | null;
  gasLimit?: bigint;
  gas?: bigint;
  gasPrice?: bigint | null;
  accessList?: any[];
}

// ---------------------------------------------------------------------------
// V3 Keystore file format
// ---------------------------------------------------------------------------

export interface V3Keystore {
  version: 3;
  id: string;
  address: string;
  crypto: {
    ciphertext: string;
    cipherparams: { iv: string };
    cipher: string;
    kdf: string;
    kdfparams: {
      dklen: number;
      salt: string;
      n: number;
      r: number;
      p: number;
    };
    mac: string;
  };
}
