/**
 * addresses.ts
 *
 * Canonical ERC-8004 contract addresses, chain metadata, and helpers.
 * Published as part of the SDK so consumers don't need to hard-code addresses.
 */

// ---------------------------------------------------------------------------
// Identity Registries
// ---------------------------------------------------------------------------

export const REGISTRY_ADDRESSES: Record<number, string> = {
  8453: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',    // Base
  84532: '0x8004A818BFB912233c491871b3d84c89A494BD9e',   // Base Sepolia
  11155111: '0x8004a6090Cd10A7288092483047B097295Fb8847', // ETH Sepolia
  59141: '0x8004aa7C931bCE1233973a0C6A667f73F66282e7',   // Linea Sepolia
  80002: '0x8004ad19E14B9e0654f73353e8a0B600D46C2898',   // Polygon Amoy
};

// ---------------------------------------------------------------------------
// Reputation Registries
// ---------------------------------------------------------------------------

export const REPUTATION_ADDRESSES: Record<number, string> = {
  8453: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',    // Base
  84532: '0x8004B663056A597Dffe9eCcC1965A193B7388713',   // Base Sepolia
};

// ---------------------------------------------------------------------------
// RPC Endpoints (public, rate-limited)
// ---------------------------------------------------------------------------

export const RPC_ENDPOINTS: Record<number, string> = {
  8453: 'https://mainnet.base.org',
  84532: 'https://sepolia.base.org',
  11155111: 'https://rpc.sepolia.org',
  59141: 'https://rpc.sepolia.linea.build',
  80002: 'https://rpc-amoy.polygon.technology',
};

// ---------------------------------------------------------------------------
// Chain Names
// ---------------------------------------------------------------------------

export const CHAIN_NAMES: Record<number, string> = {
  8453: 'Base',
  84532: 'Base Sepolia',
  11155111: 'Ethereum Sepolia',
  59141: 'Linea Sepolia',
  80002: 'Polygon Amoy',
};

// ---------------------------------------------------------------------------
// Faucets (testnets only)
// ---------------------------------------------------------------------------

export const FAUCETS: Record<number, string> = {
  84532: 'https://www.alchemy.com/faucets/base-sepolia',
  11155111: 'https://www.alchemy.com/faucets/ethereum-sepolia',
  59141: 'https://faucets.chain.link/linea-sepolia',
  80002: 'https://faucet.polygon.technology/',
};

// ---------------------------------------------------------------------------
// Block Explorers
// ---------------------------------------------------------------------------

export const BLOCK_EXPLORERS: Record<number, string> = {
  8453: 'https://basescan.org',
  84532: 'https://sepolia.basescan.org',
  11155111: 'https://sepolia.etherscan.io',
  59141: 'https://sepolia.lineascan.build',
  80002: 'https://amoy.polygonscan.com',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get the identity registry address for a chain, or throw if unsupported.
 */
export function getRegistryAddress(chainId: number): string {
  const addr = REGISTRY_ADDRESSES[chainId];
  if (!addr) {
    const supported = Object.keys(REGISTRY_ADDRESSES).join(', ');
    throw new Error(`No identity registry for chainId ${chainId}. Supported: ${supported}`);
  }
  return addr;
}

/**
 * Get the agent registry string in `eip155:{chainId}:{address}` format.
 */
export function getAgentRegistryString(chainId: number): string {
  return `eip155:${chainId}:${getRegistryAddress(chainId)}`;
}
