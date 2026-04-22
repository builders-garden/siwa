/**
 * magic.ts
 *
 * Magic server-wallet signer implementation.
 *
 * Uses the Magic Server Wallet Express API for wallet operations, message signing,
 * and transaction signing. Wallet address is fetched via POST /v1/wallet, messages
 * are signed via POST /v1/wallet/sign/message, and transactions are signed via
 * POST /v1/wallet/sign/data (all within the TEE).
 */

import {
  type Address,
  type Hex,
  type TransactionSerializable,
  serializeTransaction,
  keccak256,
} from "viem";
import type { TransactionSigner, TransactionRequest } from "./types.js";

const DEFAULT_BASE_URL = "https://tee.express.magiclabs.com";

/**
 * Configuration for the Magic SIWA signer.
 */
export interface MagicSiwaSignerConfig {
  /** Magic Secret Key (or MAGIC_SECRET_KEY env var) */
  secretKey?: string;
  /** JWT bearer token for user authentication */
  jwt: string;
  /** OIDC Provider ID for your Magic application */
  providerId: string;
  /** Override the Magic Express API base URL (defaults to production TEE). */
  baseUrl?: string;
}

/**
 * Creates a SIWA Signer backed by Magic server-side wallets.
 *
 * The signer delegates all cryptographic operations to the Magic Server Wallet
 * Express API, which proxies signing to a Trusted Execution Environment (TEE).
 * No private keys leave the TEE.
 *
 * The wallet address is fetched eagerly on creation to validate the
 * credentials and cache the address for subsequent calls.
 *
 * @param config - Magic Express API configuration
 * @returns A Promise that resolves to a TransactionSigner compatible with SIWA's signSIWAMessage function and capable of signing transactions
 *
 * @example
 * ```typescript
 * import { signSIWAMessage } from '@buildersgarden/siwa';
 * import { createMagicSiwaSigner } from '@buildersgarden/siwa/signer';
 *
 * const signer = await createMagicSiwaSigner({
 *   secretKey: process.env.MAGIC_SECRET_KEY!,
 *   jwt: agentJwt,
 *   providerId: process.env.MAGIC_PROVIDER_ID!,
 * });
 *
 * const { message, signature, address } = await signSIWAMessage({
 *   domain: 'example.com',
 *   uri: 'https://example.com/login',
 *   agentId: 123,
 *   agentRegistry: 'eip155:84532:0x...',
 *   chainId: 84532,
 *   nonce: generateNonce(),
 *   issuedAt: new Date().toISOString(),
 * }, signer);
 * ```
 */
export async function createMagicSiwaSigner(
  config: MagicSiwaSignerConfig
): Promise<TransactionSigner> {
  const secretKey = config.secretKey ?? process.env.MAGIC_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "Magic Secret Key is required. Provide secretKey in config or set MAGIC_SECRET_KEY env var."
    );
  }

  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;

  /** Read a failed response's body (best effort) and format a detailed error message. */
  async function errorMessage(prefix: string, res: Response): Promise<string> {
    let body = "";
    try {
      body = await res.text();
    } catch {
      // ignore — body is best-effort
    }
    const suffix = body ? ` — ${body}` : "";
    return `${prefix}: ${res.status} ${res.statusText}${suffix}`;
  }

  const headers: Record<string, string> = {
    "X-Magic-Secret-Key": secretKey,
    "X-Magic-Chain": "ETH",
    "X-OIDC-Provider-ID": config.providerId,
    Authorization: `Bearer ${config.jwt}`,
  };

  // Fetch wallet address eagerly to validate credentials.
  // POST /v1/wallet is idempotent — returns the existing wallet or creates one.
  const walletRes = await fetch(`${baseUrl}/v1/wallet`, {
    method: "POST",
    headers,
  });
  if (!walletRes.ok) {
    throw new Error(await errorMessage("Magic /v1/wallet failed", walletRes));
  }
  const { public_address } = await walletRes.json();
  if (!public_address) {
    throw new Error("No public address returned from Magic Express API");
  }
  const walletAddress = public_address as Address;

  /** Sign a base64-encoded message via Magic's sign/message endpoint. */
  async function signMsg(messageBase64: string): Promise<Hex> {
    const res = await fetch(`${baseUrl}/v1/wallet/sign/message`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ message_base64: messageBase64 }),
    });
    if (!res.ok) {
      throw new Error(await errorMessage("Magic sign failed", res));
    }
    const { signature } = await res.json();
    if (!signature) {
      throw new Error("No signature returned from Magic Express API");
    }
    return signature as Hex;
  }

  /** Sign a raw data hash via Magic's sign/data endpoint (returns decimal r/s and legacy v). */
  async function signData(rawDataHash: Hex): Promise<{ signature: Hex; v: string; r: string; s: string }> {
    const res = await fetch(`${baseUrl}/v1/wallet/sign/data`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ raw_data_hash: rawDataHash }),
    });
    if (!res.ok) {
      throw new Error(await errorMessage("Magic sign/data failed", res));
    }
    const data = await res.json();
    if (
      typeof data.signature !== "string" ||
      typeof data.r !== "string" ||
      typeof data.s !== "string" ||
      typeof data.v !== "string" ||
      !data.signature ||
      !data.r ||
      !data.s ||
      !data.v
    ) {
      throw new Error("Missing or invalid signature/r/s/v in Magic sign/data response");
    }
    return data as { signature: Hex; v: string; r: string; s: string };
  }

  return {
    /** Returns the cached wallet address. */
    async getAddress(): Promise<Address> {
      return walletAddress;
    },

    /** Sign a UTF-8 message using EIP-191 personal_sign. */
    async signMessage(message: string): Promise<Hex> {
      return signMsg(Buffer.from(message, "utf-8").toString("base64"));
    },

    /** Sign raw hex bytes using EIP-191 personal_sign (used by ERC-8128). */
    async signRawMessage(rawHex: Hex): Promise<Hex> {
      if (typeof rawHex !== "string" || !rawHex.startsWith("0x")) {
        throw new Error("signRawMessage expects 0x-prefixed hex");
      }
      return signMsg(Buffer.from(rawHex.slice(2), "hex").toString("base64"));
    },

    /** Sign a transaction via Magic's sign/data endpoint and return the serialized signed transaction. */
    async signTransaction(tx: TransactionRequest): Promise<Hex> {
      // Prefer an explicit tx.type; otherwise infer from fee fields.
      // Current behavior: default to legacy when no fee fields are provided.
      let txType: "legacy" | "eip2930" | "eip1559";
      if (tx.type !== undefined) {
        if (tx.type === 0 || tx.type === "legacy" || tx.type === "0x0") {
          txType = "legacy";
        } else if (tx.type === 1 || tx.type === "eip2930" || tx.type === "0x1") {
          txType = "eip2930";
        } else if (tx.type === 2 || tx.type === "eip1559" || tx.type === "0x2") {
          txType = "eip1559";
        } else {
          throw new Error(`Unsupported transaction type: ${tx.type}`);
        }
      } else if (tx.maxFeePerGas !== undefined || tx.maxPriorityFeePerGas !== undefined) {
        txType = "eip1559";
      } else if (tx.accessList !== undefined && tx.gasPrice !== undefined) {
        txType = "eip2930";
      } else {
        txType = "legacy";
      }

      const common = {
        to: tx.to,
        data: tx.data,
        value: tx.value,
        nonce: tx.nonce,
        chainId: tx.chainId,
        gas: tx.gas,
      };

      let serializable: TransactionSerializable;
      if (txType === "legacy") {
        serializable = {
          ...common,
          type: "legacy",
          gasPrice: tx.gasPrice,
        } as TransactionSerializable;
      } else if (txType === "eip2930") {
        serializable = {
          ...common,
          type: "eip2930",
          gasPrice: tx.gasPrice,
          accessList: tx.accessList,
        } as TransactionSerializable;
      } else {
        serializable = {
          ...common,
          type: "eip1559",
          maxFeePerGas: tx.maxFeePerGas,
          maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
          accessList: tx.accessList,
        } as TransactionSerializable;
      }

      // Serialize the unsigned transaction and hash it
      const unsignedSerialized = serializeTransaction(serializable);
      const txHash = keccak256(unsignedSerialized);

      // Sign the hash via Magic's sign/data endpoint
      // Note: sign/data returns r, s as decimal strings and v as legacy (27/28)
      const { r, s, v } = await signData(txHash);
      const rHex = ("0x" + BigInt(r).toString(16).padStart(64, "0")) as Hex;
      const sHex = ("0x" + BigInt(s).toString(16).padStart(64, "0")) as Hex;
      const parsedV = parseInt(v, 10);
      const yParity = parsedV >= 27 ? parsedV - 27 : parsedV;

      // Re-serialize with the signature to produce the signed transaction
      return serializeTransaction(serializable, {
        r: rHex,
        s: sHex,
        yParity,
      });
    },
  };
}
