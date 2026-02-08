/**
 * keystore/providers/proxy.ts
 *
 * HMAC-authenticated HTTP proxy provider.
 * The private key never enters the agent process — all signing
 * is delegated to a remote keyring proxy server.
 */

import type { WalletProvider, ProviderCapabilities } from "../provider.js";
import type {
  WalletInfo,
  SignResult,
  TransactionLike,
  AuthorizationRequest,
  SignedAuthorization,
  ProxyConfig,
} from "../types.js";
import { UnsupportedOperationError } from "../errors.js";
import { computeHmac } from "../../proxy-auth.js";

export class ProxyProvider implements WalletProvider {
  readonly name = "proxy";
  readonly capabilities: ProviderCapabilities = {
    canImport: false,
    canDelete: false,
    canSignAuthorization: true,
    canGetWalletClient: false,
  };

  private readonly proxyUrl: string;
  private readonly proxySecret: string;

  constructor(config: ProxyConfig = { backend: "proxy" }) {
    const url = config.proxyUrl || process.env.KEYRING_PROXY_URL;
    const secret = config.proxySecret || process.env.KEYRING_PROXY_SECRET;

    if (!url) {
      throw new Error(
        "Proxy backend requires KEYRING_PROXY_URL or config.proxyUrl"
      );
    }
    if (!secret) {
      throw new Error(
        "Proxy backend requires KEYRING_PROXY_SECRET or config.proxySecret"
      );
    }

    this.proxyUrl = url;
    this.proxySecret = secret;
  }

  async createWallet(): Promise<WalletInfo> {
    const data = await this.request("/create-wallet");
    return { address: data.address, backend: this.name };
  }

  async hasWallet(): Promise<boolean> {
    const data = await this.request("/has-wallet");
    return data.hasWallet;
  }

  async getAddress(): Promise<string | null> {
    const data = await this.request("/get-address");
    return data.address;
  }

  async signMessage(message: string): Promise<SignResult> {
    const data = await this.request("/sign-message", { message });
    return { signature: data.signature, address: data.address };
  }

  async signTransaction(
    tx: TransactionLike
  ): Promise<{ signedTx: string; address: string }> {
    const data = await this.request("/sign-transaction", {
      tx: tx as Record<string, unknown>,
    });
    return { signedTx: data.signedTx, address: data.address };
  }

  async signAuthorization(
    auth: AuthorizationRequest
  ): Promise<SignedAuthorization> {
    const data = await this.request("/sign-authorization", { auth });
    return data as SignedAuthorization;
  }

  // importWallet and deleteWallet are not supported
  // getWalletClient is not supported — key can't be serialized over HTTP

  // ---- Private helpers ---------------------------------------------------

  private async request(
    endpoint: string,
    body: Record<string, unknown> = {}
  ): Promise<any> {
    const bodyStr = JSON.stringify(body, (_key, value) =>
      typeof value === "bigint" ? "0x" + value.toString(16) : value
    );
    const hmacHeaders = computeHmac(
      this.proxySecret,
      "POST",
      endpoint,
      bodyStr
    );

    const res = await fetch(`${this.proxyUrl}${endpoint}`, {
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
}
