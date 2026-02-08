/**
 * keystore/providers/encrypted-file.ts
 *
 * Ethereum V3 Encrypted JSON Keystore provider.
 * Password-encrypted file on disk using AES-128-CTR + scrypt.
 */

import * as fs from "fs";
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
  EncryptedFileConfig,
} from "../types.js";
import {
  encryptKeystore,
  decryptKeystore,
  deriveMachinePassword,
} from "../crypto.js";
import { buildViemTx } from "../utils.js";

const DEFAULT_KEYSTORE_PATH = "./agent-keystore.json";

export class EncryptedFileProvider implements WalletProvider {
  readonly name = "encrypted-file";
  readonly capabilities: ProviderCapabilities = {
    canImport: true,
    canDelete: true,
    canSignAuthorization: true,
    canGetWalletClient: true,
  };

  private readonly keystorePath: string;
  private readonly password: string;

  constructor(config: EncryptedFileConfig = { backend: "encrypted-file" }) {
    this.keystorePath =
      config.keystorePath ||
      process.env.KEYSTORE_PATH ||
      DEFAULT_KEYSTORE_PATH;
    this.password =
      config.password ||
      process.env.KEYSTORE_PASSWORD ||
      deriveMachinePassword();
  }

  async createWallet(): Promise<WalletInfo> {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    const json = await encryptKeystore(privateKey, this.password);
    fs.writeFileSync(this.keystorePath, json, { mode: 0o600 });

    return {
      address: account.address,
      backend: this.name,
      keystorePath: this.keystorePath,
    };
  }

  async hasWallet(): Promise<boolean> {
    return fs.existsSync(this.keystorePath);
  }

  async getAddress(): Promise<string | null> {
    const pk = await this.loadKey();
    if (!pk) return null;
    return privateKeyToAccount(pk).address;
  }

  async signMessage(message: string): Promise<SignResult> {
    const pk = await this.requireKey();
    const account = privateKeyToAccount(pk);
    const signature = await account.signMessage({ message });
    return { signature, address: account.address };
  }

  async signTransaction(
    tx: TransactionLike
  ): Promise<{ signedTx: string; address: string }> {
    const pk = await this.requireKey();
    const account = privateKeyToAccount(pk);
    const viemTx = buildViemTx(tx);
    const signedTx = await account.signTransaction(viemTx);
    return { signedTx, address: account.address };
  }

  async importWallet(privateKey: string): Promise<WalletInfo> {
    const hexKey = (
      privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`
    ) as Hex;
    const account = privateKeyToAccount(hexKey);

    const json = await encryptKeystore(hexKey, this.password);
    fs.writeFileSync(this.keystorePath, json, { mode: 0o600 });

    return {
      address: account.address,
      backend: this.name,
      keystorePath: this.keystorePath,
    };
  }

  async deleteWallet(): Promise<boolean> {
    if (fs.existsSync(this.keystorePath)) {
      fs.unlinkSync(this.keystorePath);
      return true;
    }
    return false;
  }

  async signAuthorization(
    auth: AuthorizationRequest
  ): Promise<SignedAuthorization> {
    const pk = await this.requireKey();
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
    const pk = await this.requireKey();
    const account = privateKeyToAccount(pk);
    return createWalletClient({ account, transport: http(rpcUrl) });
  }

  // ---- Private helpers ---------------------------------------------------

  private async loadKey(): Promise<Hex | null> {
    if (!fs.existsSync(this.keystorePath)) return null;
    const json = fs.readFileSync(this.keystorePath, "utf-8");
    return decryptKeystore(json, this.password);
  }

  private async requireKey(): Promise<Hex> {
    const pk = await this.loadKey();
    if (!pk) throw new Error("No wallet found. Run createWallet() first.");
    return pk;
  }
}
