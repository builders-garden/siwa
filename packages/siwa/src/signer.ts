/**
 * signer.ts
 *
 * Wallet-agnostic signing abstraction for SIWA.
 *
 * This module provides a `Signer` interface that abstracts signing operations,
 * allowing developers to use any wallet provider without changing the SDK.
 *
 * Available signer implementations:
 *   - createKeyringProxySigner(config)    — Keyring proxy server (HMAC-authenticated)
 *   - createLocalAccountSigner(account)   — viem LocalAccount (privateKeyToAccount)
 *   - createWalletClientSigner(client)    — viem WalletClient (Privy, MetaMask, etc.)
 *
 * Usage:
 *   import { signSIWAMessage, createLocalAccountSigner } from '@buildersgarden/siwa';
 *   import { privateKeyToAccount } from 'viem/accounts';
 *
 *   const account = privateKeyToAccount('0x...');
 *   const signer = createLocalAccountSigner(account);
 *   const { message, signature } = await signSIWAMessage(fields, signer);
 */

import type { Address, Hex, WalletClient } from 'viem';
import type { LocalAccount } from 'viem/accounts';
import { computeHmac } from './proxy-auth.js';

// ─── Types ───────────────────────────────────────────────────────────

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

// ─── Internal: Keyring Proxy Request ─────────────────────────────────

async function proxyRequest(
  config: KeyringProxyConfig,
  endpoint: string,
  body: Record<string, unknown> = {}
): Promise<any> {
  const url = config.proxyUrl || process.env.KEYRING_PROXY_URL;
  const secret = config.proxySecret || process.env.KEYRING_PROXY_SECRET;

  if (!url) {
    throw new Error(
      'Keyring proxy requires KEYRING_PROXY_URL or config.proxyUrl'
    );
  }
  if (!secret) {
    throw new Error(
      'Keyring proxy requires KEYRING_PROXY_SECRET or config.proxySecret'
    );
  }

  const bodyStr = JSON.stringify(body, (_key, value) =>
    typeof value === 'bigint' ? '0x' + value.toString(16) : value
  );
  const hmacHeaders = computeHmac(secret, 'POST', endpoint, bodyStr);

  const res = await fetch(`${url}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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

// ─── Keyring Proxy Signer ────────────────────────────────────────────

/**
 * Create a signer backed by the keyring proxy server.
 *
 * The private key is stored securely in the proxy server and never
 * enters the calling process. All signing operations are performed
 * via HMAC-authenticated HTTP requests.
 *
 * @param config - Proxy URL and secret (or use env vars)
 * @returns A TransactionSigner that delegates to the keyring proxy
 *
 * @example
 * ```typescript
 * const signer = createKeyringProxySigner({
 *   proxyUrl: 'http://localhost:3100',
 *   proxySecret: 'my-secret',
 * });
 * const { message, signature } = await signSIWAMessage(fields, signer);
 * ```
 */
export function createKeyringProxySigner(
  config: KeyringProxyConfig = {}
): TransactionSigner {
  return {
    async getAddress(): Promise<Address> {
      const data = await proxyRequest(config, '/get-address');
      return data.address as Address;
    },

    async signMessage(message: string): Promise<Hex> {
      const data = await proxyRequest(config, '/sign-message', { message });
      return data.signature as Hex;
    },

    async signRawMessage(rawHex: Hex): Promise<Hex> {
      const data = await proxyRequest(config, '/sign-message', {
        message: rawHex,
        raw: true,
      });
      return data.signature as Hex;
    },

    async signTransaction(tx: TransactionRequest): Promise<Hex> {
      const data = await proxyRequest(config, '/sign-transaction', { tx });
      return data.signedTx as Hex;
    },
  };
}

// ─── Local Account Signer ────────────────────────────────────────────

/**
 * Create a signer from a viem LocalAccount.
 *
 * Use this when you have direct access to a private key via
 * viem's `privateKeyToAccount()` or similar.
 *
 * @param account - A viem LocalAccount (from privateKeyToAccount, mnemonicToAccount, etc.)
 * @returns A TransactionSigner that signs using the local account
 *
 * @example
 * ```typescript
 * import { privateKeyToAccount } from 'viem/accounts';
 *
 * const account = privateKeyToAccount('0x...');
 * const signer = createLocalAccountSigner(account);
 * const { message, signature } = await signSIWAMessage(fields, signer);
 * ```
 */
export function createLocalAccountSigner(
  account: LocalAccount
): TransactionSigner {
  return {
    async getAddress(): Promise<Address> {
      return account.address;
    },

    async signMessage(message: string): Promise<Hex> {
      return account.signMessage({ message });
    },

    async signRawMessage(rawHex: Hex): Promise<Hex> {
      return account.signMessage({ message: { raw: rawHex } });
    },

    async signTransaction(tx: TransactionRequest): Promise<Hex> {
      return account.signTransaction(tx as any);
    },
  };
}

// ─── WalletClient Signer ─────────────────────────────────────────────

/**
 * Create a signer from a viem WalletClient.
 *
 * Use this for browser wallets (MetaMask, etc.), embedded wallets (Privy),
 * WalletConnect, or any wallet that provides an EIP-1193 provider.
 *
 * @param client - A viem WalletClient
 * @param account - Optional specific account address to use
 * @returns A Signer that delegates to the WalletClient
 *
 * @example
 * ```typescript
 * // With Privy embedded wallet
 * const provider = await privyWallet.getEthereumProvider();
 * const walletClient = createWalletClient({
 *   chain: baseSepolia,
 *   transport: custom(provider),
 * });
 * const signer = createWalletClientSigner(walletClient);
 *
 * // With browser wallet (MetaMask)
 * const walletClient = createWalletClient({
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * });
 * const signer = createWalletClientSigner(walletClient);
 * ```
 */
export function createWalletClientSigner(
  client: WalletClient,
  account?: Address
): Signer {
  const resolveAccount = async (): Promise<Address> => {
    if (account) return account;
    const addresses = await client.getAddresses();
    if (!addresses || addresses.length === 0) {
      throw new Error('No address found in wallet');
    }
    return addresses[0];
  };

  return {
    async getAddress(): Promise<Address> {
      return resolveAccount();
    },

    async signMessage(message: string): Promise<Hex> {
      const addr = await resolveAccount();
      return client.signMessage({ account: addr, message });
    },

    async signRawMessage(rawHex: Hex): Promise<Hex> {
      const addr = await resolveAccount();
      return client.signMessage({ account: addr, message: { raw: rawHex } });
    },
  };
}
