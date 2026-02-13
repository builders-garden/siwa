/**
 * wallet-client.ts
 *
 * WalletClient signer implementation for browser wallets and embedded wallets.
 */

import type { Address, Hex, WalletClient } from 'viem';
import type { Signer } from './types.js';

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
