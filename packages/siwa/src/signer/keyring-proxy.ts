/**
 * keyring-proxy.ts
 *
 * Keyring proxy signer implementation.
 * Delegates signing to a secure keyring proxy server via HMAC-authenticated HTTP requests.
 */

import type { Address, Hex } from 'viem';
import { computeHmac } from '../proxy-auth.js';
import type {
  KeyringProxyConfig,
  TransactionRequest,
  TransactionSigner,
} from './types.js';

/**
 * Internal helper for HMAC-authenticated proxy requests.
 */
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
