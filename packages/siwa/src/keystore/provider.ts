/**
 * keystore/provider.ts
 *
 * WalletProvider interface — the contract every backend must implement.
 */

import type {
  WalletInfo,
  SignResult,
  TransactionLike,
  AuthorizationRequest,
  SignedAuthorization,
} from "./types.js";
import type { WalletClient, Transport, Chain, Account } from "viem";

// ---------------------------------------------------------------------------
// Capability flags
// ---------------------------------------------------------------------------

export interface ProviderCapabilities {
  /** Can import an externally-generated private key */
  canImport: boolean;
  /** Can delete the stored wallet */
  canDelete: boolean;
  /** Can sign EIP-7702 authorization tuples */
  canSignAuthorization: boolean;
  /** Can return a viem WalletClient (requires local key access) */
  canGetWalletClient: boolean;
}

// ---------------------------------------------------------------------------
// WalletProvider interface
// ---------------------------------------------------------------------------

export interface WalletProvider {
  /** Human-readable provider name (e.g. "encrypted-file", "cdp") */
  readonly name: string;

  /** Declares which optional operations this provider supports */
  readonly capabilities: ProviderCapabilities;

  // --- Required operations (every provider) ---------------------------------

  /** Create a new wallet and persist it. Returns public info only. */
  createWallet(): Promise<WalletInfo>;

  /** Check whether a wallet exists in this backend. */
  hasWallet(): Promise<boolean>;

  /** Get the wallet's public address, or null if no wallet exists. */
  getAddress(): Promise<string | null>;

  /** Sign a message (EIP-191). Returns signature + address. */
  signMessage(message: string): Promise<SignResult>;

  /** Sign a transaction. Returns the serialized signed tx + address. */
  signTransaction(
    tx: TransactionLike
  ): Promise<{ signedTx: string; address: string }>;

  // --- Optional operations (capability-dependent) ---------------------------

  /** Import an existing private key. Only if canImport === true. */
  importWallet?(privateKey: string): Promise<WalletInfo>;

  /** Delete the stored wallet. Only if canDelete === true. */
  deleteWallet?(): Promise<boolean>;

  /** Sign an EIP-7702 authorization. Only if canSignAuthorization === true. */
  signAuthorization?(
    auth: AuthorizationRequest
  ): Promise<SignedAuthorization>;

  /** Get a viem WalletClient. Only if canGetWalletClient === true. */
  getWalletClient?(
    rpcUrl: string
  ): Promise<WalletClient<Transport, Chain | undefined, Account>>;
}
