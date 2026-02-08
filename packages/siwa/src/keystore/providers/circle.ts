/**
 * keystore/providers/circle.ts
 *
 * Circle Programmable Wallets provider (developer-controlled).
 * Requires: npm install @circle-fin/developer-controlled-wallets
 *
 * Env vars:
 *   CIRCLE_API_KEY         — Circle API key
 *   CIRCLE_ENTITY_SECRET   — Circle entity secret (ciphertext)
 *   CIRCLE_WALLET_SET_ID   — Wallet set ID for wallet creation
 *   CIRCLE_WALLET_ID       — Pre-created wallet ID
 */

import type { WalletProvider, ProviderCapabilities } from "../provider.js";
import type {
  WalletInfo,
  SignResult,
  TransactionLike,
  CircleConfig,
} from "../types.js";
import { MissingSdkError } from "../errors.js";

export class CircleProvider implements WalletProvider {
  readonly name = "circle";
  readonly capabilities: ProviderCapabilities = {
    canImport: false,
    canDelete: false,
    canSignAuthorization: false,
    canGetWalletClient: false,
  };

  private readonly apiKey: string;
  private readonly entitySecret: string;
  private walletSetId: string;
  private walletId: string;
  private readonly blockchain: string;
  private client: any = null;
  private cachedAddress: string | null = null;

  constructor(config: CircleConfig) {
    this.apiKey = config.apiKey || process.env.CIRCLE_API_KEY || "";
    this.entitySecret =
      config.entitySecret || process.env.CIRCLE_ENTITY_SECRET || "";
    this.walletSetId =
      config.walletSetId || process.env.CIRCLE_WALLET_SET_ID || "";
    this.walletId = config.walletId || process.env.CIRCLE_WALLET_ID || "";
    this.blockchain = config.blockchain || "ETH-SEPOLIA";

    if (!this.apiKey) {
      throw new Error(
        "Circle provider requires CIRCLE_API_KEY or config.apiKey"
      );
    }
    if (!this.entitySecret) {
      throw new Error(
        "Circle provider requires CIRCLE_ENTITY_SECRET or config.entitySecret"
      );
    }
  }

  private async getClient(): Promise<any> {
    if (this.client) return this.client;
    try {
      // @ts-ignore — optional peer dependency, may not be installed
      const mod = await import("@circle-fin/developer-controlled-wallets");
      const initiateDeveloperControlledWalletsClient = mod.initiateDeveloperControlledWalletsClient;
      this.client = initiateDeveloperControlledWalletsClient({
        apiKey: this.apiKey,
        entitySecret: this.entitySecret,
      });
      return this.client;
    } catch {
      throw new MissingSdkError(
        "circle",
        "@circle-fin/developer-controlled-wallets"
      );
    }
  }

  async createWallet(): Promise<WalletInfo> {
    const circle = await this.getClient();

    // Create a wallet set if none specified
    if (!this.walletSetId) {
      const setResponse = await circle.createWalletSet({
        name: "siwa-agents",
      });
      this.walletSetId = setResponse.data?.walletSet?.id;
    }

    const response = await circle.createWallets({
      blockchains: [this.blockchain],
      count: 1,
      walletSetId: this.walletSetId,
    });

    const wallet = response.data?.wallets?.[0];
    this.walletId = wallet.id;
    this.cachedAddress = wallet.address;
    return { address: wallet.address, backend: "circle" };
  }

  async hasWallet(): Promise<boolean> {
    return !!this.walletId;
  }

  async getAddress(): Promise<string | null> {
    if (this.cachedAddress) return this.cachedAddress;
    if (!this.walletId) return null;
    try {
      const circle = await this.getClient();
      const response = await circle.getWallet({ id: this.walletId });
      this.cachedAddress = response.data?.wallet?.address;
      return this.cachedAddress;
    } catch {
      return null;
    }
  }

  async signMessage(message: string): Promise<SignResult> {
    const circle = await this.getClient();
    const address = await this.requireAddress();
    const response = await circle.signMessage({
      walletId: this.walletId,
      message,
    });
    return { signature: response.data?.signature, address };
  }

  async signTransaction(
    tx: TransactionLike
  ): Promise<{ signedTx: string; address: string }> {
    const circle = await this.getClient();
    const address = await this.requireAddress();

    const txObj: Record<string, unknown> = {};
    if (tx.to) txObj.to = tx.to;
    if (tx.value !== undefined) txObj.value = `0x${tx.value.toString(16)}`;
    if (tx.data) txObj.data = tx.data;
    if (tx.nonce !== undefined) txObj.nonce = `0x${tx.nonce.toString(16)}`;
    if (tx.chainId !== undefined) txObj.chainId = `0x${tx.chainId.toString(16)}`;
    if (tx.gas !== undefined) txObj.gas = `0x${tx.gas.toString(16)}`;
    if (tx.gasLimit !== undefined) txObj.gas = `0x${tx.gasLimit.toString(16)}`;
    if (tx.maxFeePerGas !== undefined && tx.maxFeePerGas !== null)
      txObj.maxFeePerGas = `0x${tx.maxFeePerGas.toString(16)}`;
    if (tx.maxPriorityFeePerGas !== undefined && tx.maxPriorityFeePerGas !== null)
      txObj.maxPriorityFeePerGas = `0x${tx.maxPriorityFeePerGas.toString(16)}`;

    // Circle uses walletID (capital D) for signTransaction
    const response = await circle.signTransaction({
      walletID: this.walletId,
      transaction: JSON.stringify(txObj),
    });
    return {
      signedTx: response.data?.signedTransaction,
      address,
    };
  }

  // ---- Private helpers ---------------------------------------------------

  private async requireAddress(): Promise<string> {
    const address = await this.getAddress();
    if (!address) {
      throw new Error(
        "No Circle wallet found. Set CIRCLE_WALLET_ID or call createWallet() first."
      );
    }
    return address;
  }
}
