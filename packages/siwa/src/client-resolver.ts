/**
 * client-resolver.ts
 *
 * Dynamic PublicClient resolution for multi-chain SIWA servers.
 * Lazily creates and caches viem PublicClient instances per chain ID.
 */

import { createPublicClient, http, type PublicClient } from 'viem';
import { RPC_ENDPOINTS, CHAIN_NAMES } from './addresses.js';

// ─── Types ───────────────────────────────────────────────────────────

export interface ClientResolverOptions {
  /** Explicit RPC URL overrides per chain ID. */
  rpcOverrides?: Record<number, string>;
  /** Restrict which chain IDs are accepted. When set, only these chains can be resolved. */
  allowedChainIds?: number[];
}

export interface ClientResolver {
  /** Get (or lazily create) a PublicClient for the given chain ID. Throws if unsupported. */
  getClient(chainId: number): PublicClient;
  /** Check whether a chain ID can be resolved. */
  isSupported(chainId: number): boolean;
  /** List all chain IDs that can be resolved. */
  supportedChainIds(): number[];
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Extract the chain ID from an `eip155:{chainId}:{address}` agent registry string.
 * Returns `null` if the format is invalid.
 */
export function parseChainId(agentRegistry: string): number | null {
  const parts = agentRegistry.split(':');
  if (parts.length !== 3 || parts[0] !== 'eip155') return null;
  const id = parseInt(parts[1], 10);
  return Number.isFinite(id) ? id : null;
}

// ─── Factory ─────────────────────────────────────────────────────────

/**
 * Create a ClientResolver that lazily creates and caches PublicClient instances.
 *
 * RPC resolution order:
 * 1. Explicit `rpcOverrides` map
 * 2. Environment variable `RPC_URL_{chainId}` (e.g. `RPC_URL_42161`)
 * 3. Built-in `RPC_ENDPOINTS` from addresses.ts
 * 4. Throw with a helpful error listing supported chains
 */
export function createClientResolver(options?: ClientResolverOptions): ClientResolver {
  const cache = new Map<number, PublicClient>();
  const overrides = options?.rpcOverrides ?? {};
  const allowed = options?.allowedChainIds
    ? new Set(options.allowedChainIds)
    : null;

  function resolveRpcUrl(chainId: number): string {
    // 1. Explicit override
    if (overrides[chainId]) return overrides[chainId];

    // 2. Environment variable
    const envKey = `RPC_URL_${chainId}`;
    const envVal = typeof process !== 'undefined' ? process.env?.[envKey] : undefined;
    if (envVal) return envVal;

    // 3. Built-in defaults
    if (RPC_ENDPOINTS[chainId]) return RPC_ENDPOINTS[chainId];

    // 4. Not found
    const supported = getSupportedChainIds();
    const names = supported.map((id) => `${id} (${CHAIN_NAMES[id] || 'unknown'})`).join(', ');
    throw new Error(
      `No RPC endpoint for chain ${chainId}. Supported chains: ${names}. ` +
      `Set RPC_URL_${chainId} or pass rpcOverrides to createClientResolver().`,
    );
  }

  function getSupportedChainIds(): number[] {
    const ids = new Set<number>([
      ...Object.keys(overrides).map(Number),
      ...Object.keys(RPC_ENDPOINTS).map(Number),
    ]);
    if (allowed) {
      return [...ids].filter((id) => allowed.has(id));
    }
    return [...ids];
  }

  return {
    getClient(chainId: number): PublicClient {
      if (allowed && !allowed.has(chainId)) {
        const names = [...allowed].map((id) => `${id} (${CHAIN_NAMES[id] || 'unknown'})`).join(', ');
        throw new Error(`Chain ${chainId} is not in the allowed list. Allowed: ${names}`);
      }

      let client = cache.get(chainId);
      if (!client) {
        const rpcUrl = resolveRpcUrl(chainId);
        client = createPublicClient({ transport: http(rpcUrl) });
        cache.set(chainId, client);
      }
      return client;
    },

    isSupported(chainId: number): boolean {
      if (allowed && !allowed.has(chainId)) return false;
      try {
        resolveRpcUrl(chainId);
        return true;
      } catch {
        return false;
      }
    },

    supportedChainIds: getSupportedChainIds,
  };
}
