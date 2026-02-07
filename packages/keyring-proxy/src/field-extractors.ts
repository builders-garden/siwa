/**
 * field-extractors.ts
 *
 * Functions to extract field values from different contexts
 * for policy condition evaluation.
 */

import { decodeFunctionData, isAddress, type Abi } from 'viem';
import type {
  TransactionContext,
  CalldataContext,
  MessageContext,
  AuthorizationContext,
  SystemContext,
  FieldSource,
  EvaluationContext,
} from './types.js';

// ---------------------------------------------------------------------------
// Transaction Field Extraction
// ---------------------------------------------------------------------------

/**
 * Extract a field value from a transaction context.
 */
export function extractTransactionField(
  tx: TransactionContext,
  field: string
): unknown {
  switch (field) {
    case 'to':
      return tx.to?.toLowerCase();
    case 'value':
      return normalizeValue(tx.value);
    case 'chain_id':
      return tx.chain_id;
    case 'gas':
      return normalizeValue(tx.gas);
    case 'gas_price':
      return normalizeValue(tx.gas_price);
    case 'max_fee_per_gas':
      return normalizeValue(tx.max_fee_per_gas);
    case 'max_priority_fee_per_gas':
      return normalizeValue(tx.max_priority_fee_per_gas);
    case 'data':
      return tx.data;
    case 'nonce':
      return tx.nonce;
    default:
      return undefined;
  }
}

/**
 * Normalize a value that might be string, number, or bigint to string.
 */
function normalizeValue(value: string | number | bigint | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') return value.toString();
  // Handle hex strings
  if (typeof value === 'string' && value.startsWith('0x')) {
    try {
      return BigInt(value).toString();
    } catch {
      return value;
    }
  }
  return value;
}

// ---------------------------------------------------------------------------
// Calldata Field Extraction
// ---------------------------------------------------------------------------

/**
 * Decode calldata and extract function info using viem.
 * Returns a CalldataContext with function_name and parameter values.
 */
export function decodeCalldata(
  data: string | undefined,
  abi: Abi | object | undefined
): CalldataContext | undefined {
  if (!data || data === '0x' || !abi) {
    return undefined;
  }

  try {
    const decoded = decodeFunctionData({
      abi: abi as Abi,
      data: data as `0x${string}`,
    });

    const context: CalldataContext = {
      function_name: decoded.functionName,
    };

    // Add all arguments with index-based and name-based access
    // viem returns args as an array or object depending on the ABI
    if (decoded.args) {
      const args = decoded.args as unknown[];

      // Try to get parameter names from ABI
      const abiArray = abi as Abi;
      const funcAbi = abiArray.find(
        (item) => item.type === 'function' && item.name === decoded.functionName
      );

      if (funcAbi && funcAbi.type === 'function' && funcAbi.inputs) {
        for (let i = 0; i < funcAbi.inputs.length; i++) {
          const input = funcAbi.inputs[i];
          const value = args[i];
          const key = `${decoded.functionName}.${input.name}`;

          // Convert BigInt to string for comparison
          if (typeof value === 'bigint') {
            context[key] = value.toString();
          } else if (typeof value === 'string' && isAddress(value)) {
            context[key] = value.toLowerCase();
          } else {
            context[key] = value;
          }
        }
      }
    }

    return context;
  } catch {
    // Failed to decode - might be invalid calldata or wrong ABI
    return undefined;
  }
}

/**
 * Extract a field value from a calldata context.
 */
export function extractCalldataField(
  calldata: CalldataContext | undefined,
  field: string
): unknown {
  if (!calldata) return undefined;
  return calldata[field];
}

// ---------------------------------------------------------------------------
// Message Field Extraction
// ---------------------------------------------------------------------------

/**
 * Build a message context from a message string.
 */
export function buildMessageContext(message: string): MessageContext {
  return {
    content: message,
    length: message.length,
    is_hex: message.startsWith('0x'),
  };
}

/**
 * Extract a field value from a message context.
 */
export function extractMessageField(
  ctx: MessageContext,
  field: string
): unknown {
  switch (field) {
    case 'content':
      return ctx.content;
    case 'length':
      return ctx.length;
    case 'is_hex':
      return ctx.is_hex;
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Authorization Field Extraction
// ---------------------------------------------------------------------------

/**
 * Build an authorization context from an authorization request.
 */
export function buildAuthorizationContext(auth: {
  address: string;
  chainId?: number;
}): AuthorizationContext {
  return {
    contract: auth.address.toLowerCase(),
    chain_id: auth.chainId,
  };
}

/**
 * Extract a field value from an authorization context.
 */
export function extractAuthorizationField(
  ctx: AuthorizationContext,
  field: string
): unknown {
  switch (field) {
    case 'contract':
      return ctx.contract;
    case 'chain_id':
      return ctx.chain_id;
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// System Field Extraction
// ---------------------------------------------------------------------------

/**
 * Build a system context with current time info.
 */
export function buildSystemContext(): SystemContext {
  return {
    current_unix_timestamp: Math.floor(Date.now() / 1000),
  };
}

/**
 * Extract a field value from a system context.
 */
export function extractSystemField(
  ctx: SystemContext,
  field: string
): unknown {
  switch (field) {
    case 'current_unix_timestamp':
      return ctx.current_unix_timestamp;
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Unified Field Extraction
// ---------------------------------------------------------------------------

/**
 * Extract a field value from the evaluation context based on field_source.
 */
export function extractField(
  context: EvaluationContext,
  fieldSource: FieldSource,
  field: string,
  abi?: object
): unknown {
  switch (fieldSource) {
    case 'ethereum_transaction':
      if (!context.ethereum_transaction) return undefined;
      return extractTransactionField(context.ethereum_transaction, field);

    case 'ethereum_calldata':
      if (!context.ethereum_calldata) {
        // Try to decode from transaction data if we have ABI
        if (context.ethereum_transaction?.data && abi) {
          const decoded = decodeCalldata(context.ethereum_transaction.data, abi);
          if (decoded) {
            return extractCalldataField(decoded, field);
          }
        }
        return undefined;
      }
      return extractCalldataField(context.ethereum_calldata, field);

    case 'message':
      if (!context.message) return undefined;
      return extractMessageField(context.message, field);

    case 'ethereum_authorization':
      if (!context.ethereum_authorization) return undefined;
      return extractAuthorizationField(context.ethereum_authorization, field);

    case 'system':
      return extractSystemField(context.system, field);

    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Transaction Context Builder
// ---------------------------------------------------------------------------

/**
 * Build a transaction context from a viem TransactionRequest-like object.
 */
export function buildTransactionContext(tx: Record<string, unknown>): TransactionContext {
  return {
    to: tx.to as string | undefined,
    value: tx.value as string | bigint | undefined,
    chain_id: tx.chainId as number | undefined,
    gas: tx.gasLimit as number | bigint | undefined,
    gas_price: tx.gasPrice as string | bigint | undefined,
    max_fee_per_gas: tx.maxFeePerGas as string | bigint | undefined,
    max_priority_fee_per_gas: tx.maxPriorityFeePerGas as string | bigint | undefined,
    data: tx.data as string | undefined,
    nonce: tx.nonce as number | undefined,
  };
}
