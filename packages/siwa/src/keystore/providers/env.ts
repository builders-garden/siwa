/**
 * keystore/providers/env.ts
 *
 * Environment variable provider.
 * Reads AGENT_PRIVATE_KEY from the environment.
 * Least secure — for CI/testing only.
 */

import {
  type Hex,
  createWalletClient,
  http,
  type WalletClient,
  type Transport,
  type Chain,
  type Account,
  type Address,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { hashAuthorization } from "viem/experimental";
import type { WalletProvider, ProviderCapabilities } from "../provider.js";
import type {
  WalletInfo,
  SignResult,
  TransactionLike,
  AuthorizationRequest,
  SignedAuthorization,
} from "../types.js";
import { buildViemTx } from "../utils.js";

export class EnvProvider implements WalletProvider {
  readonly name = "env";
  readonly capabilities: ProviderCapabilities = {
    canImport: false,
    canDelete: false,
    canSignAuthorization: true,
    canGetWalletClient: true,
  };

  async createWallet(): Promise<WalletInfo> {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    // For env backend, print the key ONCE for the operator to capture.
    // This is the ONLY time the raw key is ever exposed.
    console.log("=== ENV BACKEND (testing only) ===");
    console.log(`Set this in your environment:`);
    console.log(`  export AGENT_PRIVATE_KEY="${privateKey}"`);
    console.log("=================================");

    return { address: account.address, backend: this.name };
  }

  async hasWallet(): Promise<boolean> {
    return !!process.env.AGENT_PRIVATE_KEY;
  }

  async getAddress(): Promise<string | null> {
    const pk = this.loadKey();
    if (!pk) return null;
    return privateKeyToAccount(pk).address;
  }

  async signMessage(message: string): Promise<SignResult> {
    const pk = this.requireKey();
    const account = privateKeyToAccount(pk);
    const signature = await account.signMessage({ message });
    return { signature, address: account.address };
  }

  async signTransaction(
    tx: TransactionLike
  ): Promise<{ signedTx: string; address: string }> {
    const pk = this.requireKey();
    const account = privateKeyToAccount(pk);
    const viemTx = buildViemTx(tx);
    const signedTx = await account.signTransaction(viemTx);
    return { signedTx, address: account.address };
  }

  async signAuthorization(
    auth: AuthorizationRequest
  ): Promise<SignedAuthorization> {
    const pk = this.requireKey();
    const account = privateKeyToAccount(pk);

    const chainId = auth.chainId ?? 1;
    const nonce = auth.nonce ?? 0;

    const authHash = hashAuthorization({
      contractAddress: auth.address as Address,
      chainId,
      nonce,
    });

    const signature = await account.sign({ hash: authHash });

    const r = signature.slice(0, 66) as Hex;
    const s = `0x${signature.slice(66, 130)}` as Hex;
    const v = parseInt(signature.slice(130, 132), 16);
    const yParity = v - 27;

    return { address: auth.address, nonce, chainId, yParity, r, s };
  }

  async getWalletClient(
    rpcUrl: string
  ): Promise<WalletClient<Transport, Chain | undefined, Account>> {
    const pk = this.requireKey();
    const account = privateKeyToAccount(pk);
    return createWalletClient({ account, transport: http(rpcUrl) });
  }

  // ---- Private helpers ---------------------------------------------------

  private loadKey(): Hex | null {
    const envKey = process.env.AGENT_PRIVATE_KEY || null;
    if (!envKey) return null;
    return (envKey.startsWith("0x") ? envKey : `0x${envKey}`) as Hex;
  }

  private requireKey(): Hex {
    const pk = this.loadKey();
    if (!pk) throw new Error("No wallet found. Run createWallet() first.");
    return pk;
  }
}
