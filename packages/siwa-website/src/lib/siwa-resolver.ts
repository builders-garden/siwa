import { createPublicClient, http, type PublicClient } from "viem";
import { createMemorySIWANonceStore } from "@buildersgarden/siwa";

/**
 * Built-in RPC endpoints (mirrors addresses.ts in the SDK).
 * After SDK publish, replace with: import { createClientResolver } from "@buildersgarden/siwa/client-resolver"
 */
const RPC_ENDPOINTS: Record<number, string> = {
  1: "https://cloudflare-eth.com",
  8453: "https://mainnet.base.org",
  84532: "https://sepolia.base.org",
  11155111: "https://rpc.sepolia.org",
  59141: "https://rpc.sepolia.linea.build",
  80002: "https://rpc-amoy.polygon.technology",
};

const clientCache = new Map<number, PublicClient>();

/** Extract chain ID from `eip155:{chainId}:{address}` format. */
export function parseChainId(agentRegistry: string): number | null {
  const parts = agentRegistry.split(":");
  if (parts.length !== 3 || parts[0] !== "eip155") return null;
  const id = parseInt(parts[1], 10);
  return Number.isFinite(id) ? id : null;
}

/** Get (or lazily create) a PublicClient for the given chain ID. */
export function getClient(chainId: number): PublicClient {
  let client = clientCache.get(chainId);
  if (!client) {
    const envKey = `RPC_URL_${chainId}`;
    const rpcUrl = process.env[envKey] || RPC_ENDPOINTS[chainId];
    if (!rpcUrl) {
      throw new Error(`No RPC endpoint for chain ${chainId}`);
    }
    client = createPublicClient({ transport: http(rpcUrl) });
    clientCache.set(chainId, client);
  }
  return client;
}

/** Singleton nonce store — shared across all chains (nonces are random, no collision risk). */
export const nonceStore = createMemorySIWANonceStore();
