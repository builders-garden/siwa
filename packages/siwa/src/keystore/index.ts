/**
 * keystore/index.ts
 *
 * Public API barrel — same function signatures as the original keystore.ts.
 * Each function delegates to the active WalletProvider via getProvider().
 *
 * Backward compatibility:
 *   - All functions accept an optional config parameter (defaults to {})
 *   - If initKeystore() was called, that provider is used by default
 *   - If not, auto-detection from env vars works as before
 */

// Re-export types
export type {
  KeystoreBackend,
  KeystoreConfig,
  LegacyKeystoreConfig,
  KeystoreProviderConfig,
  EncryptedFileConfig,
  EnvConfig,
  ProxyConfig,
  CircleConfig,
  CdpConfig,
  BaseAccountConfig,
  PrivyConfig,
  WalletInfo,
  SignResult,
  AuthorizationRequest,
  SignedAuthorization,
  TransactionLike,
} from "./types.js";

// Re-export provider interface
export type { WalletProvider, ProviderCapabilities } from "./provider.js";

// Re-export errors
export { UnsupportedOperationError, MissingSdkError } from "./errors.js";

// Re-export state management
export { initKeystore, resetKeystore } from "./state.js";

// Re-export detectBackend
export { detectBackend } from "./detect.js";

// ---------------------------------------------------------------------------
// Imports for wrapper functions
// ---------------------------------------------------------------------------

import type {
  KeystoreConfig,
  WalletInfo,
  SignResult,
  TransactionLike,
  AuthorizationRequest,
  SignedAuthorization,
} from "./types.js";
import type { WalletClient, Transport, Chain, Account } from "viem";
import { getProvider } from "./state.js";
import { UnsupportedOperationError } from "./errors.js";

// ---------------------------------------------------------------------------
// Public API — wrapper functions that delegate to the active provider
// ---------------------------------------------------------------------------

/**
 * Create a new random wallet and store it securely.
 * Returns only the public address — NEVER the private key.
 */
export async function createWallet(
  config: KeystoreConfig = {}
): Promise<WalletInfo> {
  const provider = await getProvider(config);
  return provider.createWallet();
}

/**
 * Import an existing private key into the secure store.
 * After calling this, the caller should discard its copy of the key.
 * Returns only the public address.
 */
export async function importWallet(
  privateKey: string,
  config: KeystoreConfig = {}
): Promise<WalletInfo> {
  const provider = await getProvider(config);
  if (!provider.importWallet) {
    throw new UnsupportedOperationError("importWallet", provider.name);
  }
  return provider.importWallet(privateKey);
}

/**
 * Check if a wallet is available in any backend.
 */
export async function hasWallet(
  config: KeystoreConfig = {}
): Promise<boolean> {
  const provider = await getProvider(config);
  return provider.hasWallet();
}

/**
 * Get the wallet's public address (no private key exposed).
 */
export async function getAddress(
  config: KeystoreConfig = {}
): Promise<string | null> {
  const provider = await getProvider(config);
  return provider.getAddress();
}

/**
 * Sign a message (EIP-191 personal_sign).
 * The private key is loaded, used, and immediately discarded.
 * Only the signature is returned.
 */
export async function signMessage(
  message: string,
  config: KeystoreConfig = {}
): Promise<SignResult> {
  const provider = await getProvider(config);
  return provider.signMessage(message);
}

/**
 * Sign a transaction.
 * The private key is loaded, used, and immediately discarded.
 * Only the signed transaction is returned.
 */
export async function signTransaction(
  tx: TransactionLike,
  config: KeystoreConfig = {}
): Promise<{ signedTx: string; address: string }> {
  const provider = await getProvider(config);
  return provider.signTransaction(tx);
}

/**
 * Sign an EIP-7702 authorization for delegating the EOA to a contract.
 */
export async function signAuthorization(
  auth: AuthorizationRequest,
  config: KeystoreConfig = {}
): Promise<SignedAuthorization> {
  const provider = await getProvider(config);
  if (!provider.signAuthorization) {
    throw new UnsupportedOperationError("signAuthorization", provider.name);
  }
  return provider.signAuthorization(auth);
}

/**
 * Get a wallet client for contract interactions.
 * NOTE: This creates a client with the private key in memory.
 * Use only within a narrow scope and discard immediately.
 */
export async function getWalletClient(
  rpcUrl: string,
  config: KeystoreConfig = {}
): Promise<WalletClient<Transport, Chain | undefined, Account>> {
  const provider = await getProvider(config);
  if (!provider.getWalletClient) {
    throw new UnsupportedOperationError("getWalletClient", provider.name);
  }
  return provider.getWalletClient(rpcUrl);
}

/**
 * Delete the stored wallet from the active backend.
 * DESTRUCTIVE — the identity is lost if no backup exists.
 */
export async function deleteWallet(
  config: KeystoreConfig = {}
): Promise<boolean> {
  const provider = await getProvider(config);
  if (!provider.deleteWallet) {
    throw new UnsupportedOperationError("deleteWallet", provider.name);
  }
  return provider.deleteWallet();
}
