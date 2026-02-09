/**
 * keystore.ts
 *
 * Secure signing abstraction for ERC-8004 agents.
 *
 * All signing is delegated to a **keyring proxy server** — a separate process
 * that holds the encrypted private key and exposes only HMAC-authenticated
 * signing endpoints. The private key NEVER enters the agent process.
 *
 * External code interacts only through:
 *   - createWallet()          → returns { address } (no private key)
 *   - signMessage(msg)        → returns { signature, address }
 *   - signTransaction(tx)     → returns { signedTx, address }
 *   - signAuthorization(auth) → returns signed EIP-7702 authorization
 *   - getAddress()            → returns the public address
 *   - hasWallet()             → returns boolean
 *
 * Configuration (via env vars or passed options):
 *   KEYRING_PROXY_URL     — URL of the keyring proxy server
 *   KEYRING_PROXY_SECRET  — HMAC shared secret
 */

import type { Hex, Address } from "viem";
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

export interface SignResult {
  signature: string;
  address: string;
}

export interface AuthorizationRequest {
  address: string; // Contract address to delegate to
  chainId?: number; // Optional; auto-detected if omitted
  nonce?: number; // Optional; use current_nonce + 1 for self-sent txns
}

export interface SignedAuthorization {
  address: string; // Delegated contract address
  nonce: number;
  chainId: number;
  yParity: number;
  r: string;
  s: string;
}

// Transaction type compatible with viem
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
// Proxy backend — HMAC-authenticated HTTP to a keyring proxy server
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
      "Keystore requires KEYRING_PROXY_URL or config.proxyUrl"
    );
  if (!secret)
    throw new Error(
      "Keystore requires KEYRING_PROXY_SECRET or config.proxySecret"
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
 * Returns only the public address — NEVER the private key.
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
 * Get the wallet's public address (no private key exposed).
 */
export async function getAddress(
  config: KeystoreConfig = {}
): Promise<string | null> {
  const data = await proxyRequest(config, "/get-address");
  return data.address;
}

/**
 * Sign a message (EIP-191 personal_sign) via the keyring proxy.
 * Only the signature is returned.
 */
export async function signMessage(
  message: string,
  config: KeystoreConfig = {}
): Promise<SignResult> {
  if (typeof message !== "string") {
    throw new Error("signMessage() requires a string message, got " + typeof message);
  }
  const data = await proxyRequest(config, "/sign-message", { message });
  return { signature: data.signature, address: data.address };
}

/**
 * Sign a transaction via the keyring proxy.
 * Only the signed transaction is returned.
 */
export async function signTransaction(
  tx: TransactionLike,
  config: KeystoreConfig = {}
): Promise<{ signedTx: string; address: string }> {
  const data = await proxyRequest(config, "/sign-transaction", {
    tx: tx as Record<string, unknown>,
  });
  return { signedTx: data.signedTx, address: data.address };
}

/**
 * Sign an EIP-7702 authorization for delegating the EOA to a contract.
 *
 * This allows the agent's EOA to temporarily act as a smart contract
 * during a type 4 transaction. Only the signed authorization tuple is returned.
 */
export async function signAuthorization(
  auth: AuthorizationRequest,
  config: KeystoreConfig = {}
): Promise<SignedAuthorization> {
  const data = await proxyRequest(config, "/sign-authorization", { auth });
  return data as SignedAuthorization;
}
