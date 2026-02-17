/**
 * local-account.ts
 *
 * Local account signer implementation using viem LocalAccount.
 */

import type { Address, Hex } from 'viem';
import type { LocalAccount } from 'viem/accounts';
import type { TransactionRequest, TransactionSigner } from './types.js';

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
