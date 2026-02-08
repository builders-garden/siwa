/**
 * keystore/providers/base-account.ts
 *
 * Base Smart Account provider (stub).
 * Passkey-based account abstraction via Base.
 *
 * This provider is experimental — the exact SDK and auth flow
 * are still being finalized by Base.
 */

import type { WalletProvider, ProviderCapabilities } from "../provider.js";
import type {
  WalletInfo,
  SignResult,
  TransactionLike,
  BaseAccountConfig,
} from "../types.js";
import { MissingSdkError } from "../errors.js";

export class BaseAccountProvider implements WalletProvider {
  readonly name = "base-account";
  readonly capabilities: ProviderCapabilities = {
    canImport: false,
    canDelete: false,
    canSignAuthorization: false,
    canGetWalletClient: false,
  };

  constructor(_config: BaseAccountConfig) {
    // No required env vars yet — TBD
  }

  private async getSdk(): Promise<any> {
    throw new MissingSdkError(
      "base-account",
      "@base/smart-account (not yet published)"
    );
  }

  async createWallet(): Promise<WalletInfo> {
    await this.getSdk();
    throw new Error("BaseAccountProvider is not yet implemented.");
  }

  async hasWallet(): Promise<boolean> {
    await this.getSdk();
    throw new Error("BaseAccountProvider is not yet implemented.");
  }

  async getAddress(): Promise<string | null> {
    await this.getSdk();
    throw new Error("BaseAccountProvider is not yet implemented.");
  }

  async signMessage(message: string): Promise<SignResult> {
    await this.getSdk();
    throw new Error("BaseAccountProvider is not yet implemented.");
  }

  async signTransaction(
    tx: TransactionLike
  ): Promise<{ signedTx: string; address: string }> {
    await this.getSdk();
    throw new Error("BaseAccountProvider is not yet implemented.");
  }
}
