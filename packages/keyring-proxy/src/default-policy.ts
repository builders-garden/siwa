/**
 * default-policy.ts
 *
 * Default policy template that gets attached to new wallets.
 * Provides sensible defaults while being permissive enough for basic operations.
 */

import type { Policy } from './types.js';
import { generatePolicyId } from './policy-store.js';

/**
 * Create a new default policy with a unique ID.
 * This policy is attached to wallets when they are created.
 *
 * Default rules:
 * - Allow transactions up to 0.1 ETH
 * - Allow all message signing
 * - Allow all EIP-7702 authorizations
 */
export function createDefaultPolicy(): Policy {
  const now = new Date().toISOString();

  return {
    id: generatePolicyId(),
    version: '1.0',
    name: 'Default Agent Policy',
    chain_type: 'ethereum',
    rules: [
      {
        name: 'Allow small transactions',
        method: 'sign_transaction',
        action: 'ALLOW',
        conditions: [
          {
            field_source: 'ethereum_transaction',
            field: 'value',
            operator: 'lte',
            value: '100000000000000000', // 0.1 ETH in wei
          },
        ],
      },
      {
        name: 'Allow message signing',
        method: 'sign_message',
        action: 'ALLOW',
        conditions: [], // No conditions = always allow
      },
      {
        name: 'Allow EIP-7702 authorization',
        method: 'sign_authorization',
        action: 'ALLOW',
        conditions: [], // No conditions = always allow
      },
    ],
    created_at: now,
    updated_at: now,
  };
}

/**
 * Create a restrictive policy that denies all operations.
 * Useful as a starting point for high-security wallets.
 */
export function createRestrictivePolicy(): Policy {
  const now = new Date().toISOString();

  return {
    id: generatePolicyId(),
    version: '1.0',
    name: 'Restrictive Policy',
    chain_type: 'ethereum',
    rules: [
      {
        name: 'Deny all transactions',
        method: 'sign_transaction',
        action: 'DENY',
        conditions: [],
      },
      {
        name: 'Deny message signing',
        method: 'sign_message',
        action: 'DENY',
        conditions: [],
      },
      {
        name: 'Deny EIP-7702 authorization',
        method: 'sign_authorization',
        action: 'DENY',
        conditions: [],
      },
    ],
    created_at: now,
    updated_at: now,
  };
}

/**
 * Example policy templates for common use cases.
 */
export const POLICY_TEMPLATES = {
  /**
   * Spending limit policy - only allows transactions under a certain value.
   */
  spendingLimit: (maxWei: string, name?: string): Policy => {
    const now = new Date().toISOString();
    return {
      id: generatePolicyId(),
      version: '1.0',
      name: name || `Max ${formatWei(maxWei)} ETH per tx`,
      chain_type: 'ethereum',
      rules: [
        {
          name: 'Allow transactions within limit',
          method: 'sign_transaction',
          action: 'ALLOW',
          conditions: [
            {
              field_source: 'ethereum_transaction',
              field: 'value',
              operator: 'lte',
              value: maxWei,
            },
          ],
        },
      ],
      created_at: now,
      updated_at: now,
    };
  },

  /**
   * Chain restriction policy - only allows transactions on specific chains.
   */
  chainRestriction: (chainIds: number[], name?: string): Policy => {
    const now = new Date().toISOString();
    return {
      id: generatePolicyId(),
      version: '1.0',
      name: name || `Chain restriction: ${chainIds.join(', ')}`,
      chain_type: 'ethereum',
      rules: chainIds.map(chainId => ({
        name: `Allow chain ${chainId}`,
        method: 'sign_transaction' as const,
        action: 'ALLOW' as const,
        conditions: [
          {
            field_source: 'ethereum_transaction' as const,
            field: 'chain_id',
            operator: 'eq' as const,
            value: chainId,
          },
        ],
      })),
      created_at: now,
      updated_at: now,
    };
  },

  /**
   * Contract allowlist policy - only allows interactions with specific contracts.
   */
  contractAllowlist: (addresses: string[], name?: string): Policy => {
    const now = new Date().toISOString();
    return {
      id: generatePolicyId(),
      version: '1.0',
      name: name || 'Contract allowlist',
      chain_type: 'ethereum',
      rules: [
        {
          name: 'Allow listed contracts',
          method: 'sign_transaction',
          action: 'ALLOW',
          conditions: [
            {
              field_source: 'ethereum_transaction',
              field: 'to',
              operator: 'in',
              value: addresses.map(a => a.toLowerCase()),
            },
          ],
        },
      ],
      created_at: now,
      updated_at: now,
    };
  },

  /**
   * SIWA-only message signing - only allow signing SIWA messages.
   */
  siwaOnly: (name?: string): Policy => {
    const now = new Date().toISOString();
    return {
      id: generatePolicyId(),
      version: '1.0',
      name: name || 'SIWA messages only',
      chain_type: 'ethereum',
      rules: [
        {
          name: 'Allow SIWA messages',
          method: 'sign_message',
          action: 'ALLOW',
          conditions: [
            {
              field_source: 'message',
              field: 'content',
              operator: 'matches',
              value: 'wants you to sign in with your Agent account',
            },
          ],
        },
      ],
      created_at: now,
      updated_at: now,
    };
  },

  /**
   * 7702 delegate allowlist - only allow delegation to specific contracts.
   */
  delegateAllowlist: (contracts: string[], name?: string): Policy => {
    const now = new Date().toISOString();
    return {
      id: generatePolicyId(),
      version: '1.0',
      name: name || 'EIP-7702 delegate allowlist',
      chain_type: 'ethereum',
      rules: [
        {
          name: 'Allow listed delegates',
          method: 'sign_authorization',
          action: 'ALLOW',
          conditions: [
            {
              field_source: 'ethereum_authorization',
              field: 'contract',
              operator: 'in',
              value: contracts.map(a => a.toLowerCase()),
            },
          ],
        },
      ],
      created_at: now,
      updated_at: now,
    };
  },
};

/**
 * Format wei to ETH string for display.
 */
function formatWei(wei: string): string {
  try {
    const ethValue = BigInt(wei) / BigInt(10 ** 18);
    const remainder = BigInt(wei) % BigInt(10 ** 18);
    if (remainder === BigInt(0)) {
      return ethValue.toString();
    }
    // Simple decimal representation
    const decimal = (Number(wei) / 10 ** 18).toFixed(4);
    return decimal.replace(/\.?0+$/, '');
  } catch {
    return wei;
  }
}
