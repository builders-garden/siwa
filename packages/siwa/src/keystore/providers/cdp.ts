/**
 * keystore/providers/cdp.ts
 *
 * Coinbase Developer Platform (CDP) provider.
 * Requires: npm install @coinbase/cdp-sdk
 *
 * Env vars:
 *   CDP_API_KEY_ID     — CDP API key ID
 *   CDP_API_KEY_SECRET — CDP API key secret
 *   CDP_WALLET_SECRET  — CDP wallet secret for server-side signing
 *   CDP_ACCOUNT_NAME   — Account name for idempotent retrieval (default: "siwa-agent")
 */

import type { WalletProvider, ProviderCapabilities } from "../provider.js";
import type {
  WalletInfo,
  SignResult,
  TransactionLike,
  CdpConfig,
} from "../types.js";
import { MissingSdkError } from "../errors.js";
import { buildViemTx } from "../utils.js";

export class CdpProvider implements WalletProvider {
  readonly name = "cdp";
  readonly capabilities: ProviderCapabilities = {
    canImport: false,
    canDelete: false,
    canSignAuthorization: false,
    canGetWalletClient: false,
  };

  private readonly apiKeyId: string;
  private readonly apiKeySecret: string;
  private readonly walletSecret: string;
  private readonly accountName: string;
  private client: any = null;
  private cachedAccount: any = null;

  constructor(config: CdpConfig) {
    this.apiKeyId = config.apiKeyId || process.env.CDP_API_KEY_ID || "";
    this.apiKeySecret =
      config.apiKeySecret || process.env.CDP_API_KEY_SECRET || "";
    this.walletSecret =
      config.walletSecret || process.env.CDP_WALLET_SECRET || "";
    this.accountName =
      config.accountName || process.env.CDP_ACCOUNT_NAME || "siwa-agent";
  }

  private async getClient(): Promise<any> {
    if (this.client) return this.client;
    try {
      // @ts-ignore — optional peer dependency, may not be installed
      const { CdpClient } = await import("@coinbase/cdp-sdk");
      const opts: Record<string, string> = {};
      if (this.apiKeyId) opts.apiKeyId = this.apiKeyId;
      if (this.apiKeySecret) opts.apiKeySecret = this.apiKeySecret;
      if (this.walletSecret) opts.walletSecret = this.walletSecret;
      this.client = new CdpClient(opts);
      return this.client;
    } catch {
      throw new MissingSdkError("cdp", "@coinbase/cdp-sdk");
    }
  }

  private async getAccount(): Promise<any> {
    if (this.cachedAccount) return this.cachedAccount;
    const cdp = await this.getClient();
    this.cachedAccount = await cdp.evm.getOrCreateAccount({
      name: this.accountName,
    });
    return this.cachedAccount;
  }

  async createWallet(): Promise<WalletInfo> {
    const cdp = await this.getClient();
    const account = await cdp.evm.createAccount({ name: this.accountName });
    this.cachedAccount = account;
    return { address: account.address, backend: "cdp" };
  }

  async hasWallet(): Promise<boolean> {
    const address = await this.getAddress();
    return address !== null;
  }

  async getAddress(): Promise<string | null> {
    try {
      const account = await this.getAccount();
      return account.address;
    } catch {
      return null;
    }
  }

  async signMessage(message: string): Promise<SignResult> {
    const account = await this.getAccount();
    const signature = await account.signMessage({ message });
    return { signature, address: account.address };
  }

  async signTransaction(
    tx: TransactionLike
  ): Promise<{ signedTx: string; address: string }> {
    const account = await this.getAccount();
    const viemTx = buildViemTx(tx);
    const signedTx = await account.signTransaction(viemTx);
    return { signedTx, address: account.address };
  }
}
