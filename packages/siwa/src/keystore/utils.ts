/**
 * keystore/utils.ts
 *
 * Shared utility functions for the keystore module.
 */

import type { Address, Hex } from "viem";
import type { TransactionLike } from "./types.js";

/**
 * Parse a numeric value from JSON (string/number) to bigint.
 * Returns undefined for null, undefined, or zero values.
 * Zero is returned as undefined so viem encodes it as empty (0x80 in RLP).
 */
export function parseBigIntFromJson(value: unknown): bigint | undefined {
  if (value === null || value === undefined) return undefined;

  let result: bigint;
  if (typeof value === "bigint") {
    result = value;
  } else if (typeof value === "number") {
    result = BigInt(value);
  } else if (typeof value === "string") {
    result = BigInt(value);
  } else {
    return undefined;
  }

  return result === 0n ? undefined : result;
}

/**
 * Parse a numeric value, keeping zero as 0n (for fields like nonce where 0 is valid).
 */
export function parseBigIntKeepZero(value: unknown): bigint | undefined {
  if (value === null || value === undefined) return undefined;

  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") return BigInt(value);

  return undefined;
}

/**
 * Build a viem-compatible transaction object from a TransactionLike.
 */
export function buildViemTx(tx: TransactionLike): any {
  const value = parseBigIntFromJson(tx.value);
  const gas = parseBigIntKeepZero(tx.gasLimit ?? tx.gas);
  const maxFeePerGas = parseBigIntKeepZero(tx.maxFeePerGas);
  const maxPriorityFeePerGas = parseBigIntKeepZero(tx.maxPriorityFeePerGas);
  const gasPrice = parseBigIntKeepZero(tx.gasPrice);

  const viemTx: any = {
    to: tx.to as Address | undefined,
    data: tx.data as Hex | undefined,
    value,
    nonce: tx.nonce,
    chainId: tx.chainId,
    gas,
  };

  if (tx.type === 2 || tx.maxFeePerGas !== undefined) {
    viemTx.type = "eip1559";
    viemTx.maxFeePerGas = maxFeePerGas;
    viemTx.maxPriorityFeePerGas = maxPriorityFeePerGas;
  } else if (tx.gasPrice !== undefined) {
    viemTx.type = "legacy";
    viemTx.gasPrice = gasPrice;
  }

  if (tx.accessList) {
    viemTx.accessList = tx.accessList;
  }

  return viemTx;
}
