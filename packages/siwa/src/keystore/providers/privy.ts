/**
 * keystore/providers/privy.ts
 *
 * Privy server-side wallet provider.
 * Requires: npm install @privy-io/server-auth
 *
 * Env vars:
 *   PRIVY_APP_ID     — Privy application ID
 *   PRIVY_APP_SECRET — Privy application secret
 *   PRIVY_WALLET_ID  — Privy wallet ID (for pre-created wallets)
 */

import type { WalletProvider, ProviderCapabilities } from "../provider.js";
import type {
  WalletInfo,
  SignResult,
  TransactionLike,
  PrivyConfig,
} from "../types.js";
import { MissingSdkError } from "../errors.js";

export class PrivyProvider implements WalletProvider {
  readonly name = "privy";
  readonly capabilities: ProviderCapabilities = {
    canImport: false,
    canDelete: false,
    canSignAuthorization: false,
    canGetWalletClient: false,
  };

  private readonly appId: string;
  private readonly appSecret: string;
  private walletId: string;
  private cachedAddress: string | null = null;
  private client: any = null;

  constructor(config: PrivyConfig) {
    this.appId = config.appId || process.env.PRIVY_APP_ID || "";
    this.appSecret = config.appSecret || process.env.PRIVY_APP_SECRET || "";
    this.walletId = config.walletId || process.env.PRIVY_WALLET_ID || "";

    if (!this.appId) {
      throw new Error(
        "Privy provider requires PRIVY_APP_ID or config.appId"
      );
    }
    if (!this.appSecret) {
      throw new Error(
        "Privy provider requires PRIVY_APP_SECRET or config.appSecret"
      );
    }
  }

  private async getClient(): Promise<any> {
    if (this.client) return this.client;
    try {
      // @ts-ignore — optional peer dependency, may not be installed
      const { PrivyClient } = await import("@privy-io/server-auth");
      this.client = new PrivyClient(this.appId, this.appSecret);
      return this.client;
    } catch {
      throw new MissingSdkError("privy", "@privy-io/server-auth");
    }
  }

  async createWallet(): Promise<WalletInfo> {
    const privy = await this.getClient();
    const wallet = await privy.walletApi.createWallet({
      chainType: "ethereum",
    });
    this.walletId = wallet.id;
    this.cachedAddress = wallet.address;
    return { address: wallet.address, backend: "privy" };
  }

  async hasWallet(): Promise<boolean> {
    return !!this.walletId;
  }

  async getAddress(): Promise<string | null> {
    if (this.cachedAddress) return this.cachedAddress;
    if (!this.walletId) return null;
    try {
      const privy = await this.getClient();
      const wallet = await privy.walletApi.getWallet({
        walletId: this.walletId,
      });
      this.cachedAddress = wallet.address;
      return wallet.address;
    } catch {
      return null;
    }
  }

  async signMessage(message: string): Promise<SignResult> {
    const privy = await this.getClient();
    const address = await this.requireAddress();
    const result = await privy.walletApi.ethereum.signMessage({
      walletId: this.walletId,
      message,
    });
    return { signature: result.signature, address };
  }

  async signTransaction(
    tx: TransactionLike
  ): Promise<{ signedTx: string; address: string }> {
    const privy = await this.getClient();
    const address = await this.requireAddress();

    const transaction: Record<string, unknown> = {};
    if (tx.to) transaction.to = tx.to;
    if (tx.value !== undefined)
      transaction.value = `0x${tx.value.toString(16)}`;
    if (tx.data) transaction.data = tx.data;
    if (tx.nonce !== undefined) transaction.nonce = tx.nonce;
    if (tx.chainId !== undefined) transaction.chainId = tx.chainId;
    if (tx.gas !== undefined) transaction.gas = `0x${tx.gas.toString(16)}`;
    if (tx.gasLimit !== undefined)
      transaction.gasLimit = `0x${tx.gasLimit.toString(16)}`;
    if (tx.maxFeePerGas !== undefined && tx.maxFeePerGas !== null)
      transaction.maxFeePerGas = `0x${tx.maxFeePerGas.toString(16)}`;
    if (tx.maxPriorityFeePerGas !== undefined && tx.maxPriorityFeePerGas !== null)
      transaction.maxPriorityFeePerGas = `0x${tx.maxPriorityFeePerGas.toString(16)}`;

    const result = await privy.walletApi.ethereum.signTransaction({
      walletId: this.walletId,
      transaction,
    });
    return { signedTx: result.signedTransaction, address };
  }

  // ---- Private helpers ---------------------------------------------------

  private async requireAddress(): Promise<string> {
    const address = await this.getAddress();
    if (!address) {
      throw new Error(
        "No Privy wallet found. Set PRIVY_WALLET_ID or call createWallet() first."
      );
    }
    return address;
  }
}
