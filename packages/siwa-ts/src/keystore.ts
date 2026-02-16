/**
 * keystore.ts
 *
 * Keyring proxy administrative operations.
 *
 * This module provides admin functions for the keyring proxy server:
 *   - createWallet() - Create a new wallet
 *   - hasWallet() - Check if a wallet exists
 *   - signAuthorization() - Sign EIP-7702 authorizations
 *
 * For signing operations, use the Signer API instead:
 *
 * ```typescript
 * import { createKeyringProxySigner } from '@buildersgarden/siwa/signer';
 *
 * const signer = createKeyringProxySigner({ proxyUrl, proxySecret });
 * const address = await signer.getAddress();
 * const signature = await signer.signMessage(message);
 * const signedTx = await signer.signTransaction(tx);
 * ```
 */

import { computeHmac } from "./proxy-auth.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KeystoreConfig {
  proxyUrl?: string;
  proxySecret?: string;
}

export interface WalletInfo {
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

// ---------------------------------------------------------------------------
// Proxy backend
// ---------------------------------------------------------------------------

async function proxyRequest(
  config: KeystoreConfig,
  endpoint: string,
  body: Record<string, unknown> = {}
): Promise<any> {
  const url = config.proxyUrl || process.env.KEYRING_PROXY_URL;
  const secret = config.proxySecret || process.env.KEYRING_PROXY_SECRET;
  if (!url)
    throw new Error(
      "Keyring proxy requires KEYRING_PROXY_URL or config.proxyUrl"
    );
  if (!secret)
    throw new Error(
      "Keyring proxy requires KEYRING_PROXY_SECRET or config.proxySecret"
    );

  const bodyStr = JSON.stringify(body, (_key, value) =>
    typeof value === "bigint" ? "0x" + value.toString(16) : value
  );
  const hmacHeaders = computeHmac(secret, "POST", endpoint, bodyStr);

  const res = await fetch(`${url}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...hmacHeaders,
    },
    body: bodyStr,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Proxy ${endpoint} failed (${res.status}): ${text}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new random wallet via the keyring proxy.
 * Returns only the public address.
 */
export async function createWallet(
  config: KeystoreConfig = {}
): Promise<WalletInfo> {
  const data = await proxyRequest(config, "/create-wallet");
  return { address: data.address };
}

/**
 * Check if a wallet is available via the keyring proxy.
 */
export async function hasWallet(config: KeystoreConfig = {}): Promise<boolean> {
  const data = await proxyRequest(config, "/has-wallet");
  return data.hasWallet;
}

/**
 * Get the wallet's public address from the keyring proxy.
 */
export async function getAddress(
  config: KeystoreConfig = {}
): Promise<string | null> {
  const data = await proxyRequest(config, "/get-address");
  return data.address;
}

/**
 * Sign an EIP-7702 authorization for delegating the EOA to a contract.
 *
 * This allows the agent's EOA to temporarily act as a smart contract
 * during a type 4 transaction.
 */
export async function signAuthorization(
  auth: AuthorizationRequest,
  config: KeystoreConfig = {}
): Promise<SignedAuthorization> {
  const data = await proxyRequest(config, "/sign-authorization", { auth });
  return data as SignedAuthorization;
}
