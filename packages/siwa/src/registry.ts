/**
 * registry.ts
 *
 * Agent Identity Registry reader.
 * Provides functions to read agent profiles and reputation from on-chain registries.
 *
 * Dependencies:
 *   npm install ethers
 */

import { ethers } from 'ethers';

// ─── ERC-8004 Value Types ────────────────────────────────────────────

/** Service endpoint types defined in ERC-8004 */
export type ServiceType =
  | 'web'
  | 'A2A'
  | 'MCP'
  | 'OASF'
  | 'ENS'
  | 'DID'
  | 'email';

/** Trust models defined in ERC-8004 */
export type TrustModel =
  | 'reputation'
  | 'crypto-economic'
  | 'tee-attestation';

/** Predefined reputation feedback tags defined in ERC-8004 */
export type ReputationTag =
  | 'starred'
  | 'reachable'
  | 'ownerVerified'
  | 'uptime'
  | 'successRate'
  | 'responseTime'
  | 'blocktimeFreshness'
  | 'revenues'
  | 'tradingYield';

// ─── Types ───────────────────────────────────────────────────────────

export interface AgentService {
  name: ServiceType | (string & {});
  endpoint: string;
  version?: string;
}

export interface AgentRegistration {
  agentId: number;
  agentRegistry: string;
}

export interface AgentMetadata {
  name: string;
  description: string;
  image: string;
  services: AgentService[];
  active: boolean;
  x402Support?: boolean;
  supportedTrust?: (TrustModel | (string & {}))[];
  registrations?: AgentRegistration[];
}

export interface AgentProfile {
  agentId: number;
  owner: string;
  uri: string;
  agentWallet: string | null;
  metadata: AgentMetadata | null;
}

export interface GetAgentOptions {
  registryAddress: string;
  provider: ethers.Provider;
  fetchMetadata?: boolean; // default true
}

export interface ReputationSummary {
  count: number;
  score: number;
  rawValue: bigint;
  decimals: number;
}

export interface GetReputationOptions {
  reputationRegistryAddress: string;
  provider: ethers.Provider;
  clients?: string[];
  tag1?: ReputationTag | (string & {});
  tag2?: string;
}

// ─── ABI Fragments ──────────────────────────────────────────────────

const IDENTITY_REGISTRY_ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function getAgentWallet(uint256 agentId) view returns (address)',
];

const REPUTATION_REGISTRY_ABI = [
  'function getSummary(uint256 agentId, address[] clients, string tag1, string tag2) view returns (uint64 count, int128 summaryValue, uint8 valueDecimals)',
];

// ─── Internal Helpers ───────────────────────────────────────────────

const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

/**
 * Resolve a URI to its JSON content.
 * Supports ipfs://, data:application/json;base64, and http(s):// schemes.
 */
async function resolveURI(uri: string): Promise<unknown> {
  if (uri.startsWith('ipfs://')) {
    const cid = uri.slice('ipfs://'.length);
    const response = await fetch(`${IPFS_GATEWAY}${cid}`);
    if (!response.ok) throw new Error(`IPFS fetch failed: ${response.status}`);
    return response.json();
  }

  if (uri.startsWith('data:application/json;base64,')) {
    const base64 = uri.slice('data:application/json;base64,'.length);
    const json = Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(json);
  }

  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    const response = await fetch(uri);
    if (!response.ok) throw new Error(`HTTP fetch failed: ${response.status}`);
    return response.json();
  }

  throw new Error(`Unsupported URI scheme: ${uri}`);
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Read an agent from the Identity Registry and parse its profile.
 *
 * @param agentId  The on-chain agent token ID
 * @param options  Registry address, provider, and optional fetchMetadata flag
 */
export async function getAgent(
  agentId: number,
  options: GetAgentOptions
): Promise<AgentProfile> {
  const { registryAddress, provider, fetchMetadata = true } = options;

  const registry = new ethers.Contract(
    registryAddress,
    IDENTITY_REGISTRY_ABI,
    provider
  );

  const [owner, uri, walletAddr] = await Promise.all([
    registry.ownerOf(agentId) as Promise<string>,
    registry.tokenURI(agentId) as Promise<string>,
    registry.getAgentWallet(agentId) as Promise<string>,
  ]);

  const agentWallet =
    walletAddr === ethers.ZeroAddress ? null : walletAddr;

  let metadata: AgentMetadata | null = null;
  if (fetchMetadata) {
    try {
      const raw = await resolveURI(uri);
      metadata = raw as AgentMetadata;
    } catch {
      metadata = null;
    }
  }

  return { agentId, owner, uri, agentWallet, metadata };
}

/**
 * Read an agent's reputation summary from the Reputation Registry.
 *
 * @param agentId  The on-chain agent token ID
 * @param options  Reputation registry address, provider, and optional filters
 */
export async function getReputation(
  agentId: number,
  options: GetReputationOptions
): Promise<ReputationSummary> {
  const {
    reputationRegistryAddress,
    provider,
    clients = [],
    tag1 = '',
    tag2 = '',
  } = options;

  const reputation = new ethers.Contract(
    reputationRegistryAddress,
    REPUTATION_REGISTRY_ABI,
    provider
  );

  const [count, summaryValue, valueDecimals] = await reputation.getSummary(
    agentId,
    clients,
    tag1,
    tag2
  );

  const decimals = Number(valueDecimals);
  const rawValue = BigInt(summaryValue);
  const score = Number(rawValue) / 10 ** decimals;

  return { count: Number(count), score, rawValue, decimals };
}
