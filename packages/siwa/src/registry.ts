/**
 * registry.ts
 *
 * Agent Identity Registry reader.
 * Provides functions to read agent profiles and reputation from on-chain registries.
 *
 * Dependencies:
 *   npm install viem
 */

import {
  type PublicClient,
  type Address,
  type Hex,
  zeroAddress,
  createPublicClient,
  http,
  encodeFunctionData,
  parseEventLogs,
} from 'viem';

import { getRegistryAddress, getAgentRegistryString, RPC_ENDPOINTS } from './addresses.js';
import type { TransactionSigner } from './signer/index.js';

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
  client: PublicClient;
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
  client: PublicClient;
  clients?: string[];
  tag1?: ReputationTag | (string & {});
  tag2?: string;
}

// ─── ABI Fragments ──────────────────────────────────────────────────

const IDENTITY_REGISTRY_ABI = [
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'tokenURI',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'getAgentWallet',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'register',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  {
    name: 'Registered',
    type: 'event',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'agentURI', type: 'string', indexed: false },
      { name: 'owner', type: 'address', indexed: true },
    ],
  },
] as const;

const REPUTATION_REGISTRY_ABI = [
  {
    name: 'getSummary',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clients', type: 'address[]' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
    ],
    outputs: [
      { name: 'count', type: 'uint64' },
      { name: 'summaryValue', type: 'int128' },
      { name: 'valueDecimals', type: 'uint8' },
    ],
  },
] as const;

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
 * @param options  Registry address, client, and optional fetchMetadata flag
 */
export async function getAgent(
  agentId: number,
  options: GetAgentOptions
): Promise<AgentProfile> {
  const { registryAddress, client, fetchMetadata = true } = options;

  const [owner, uri, walletAddr] = await Promise.all([
    client.readContract({
      address: registryAddress as Address,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'ownerOf',
      args: [BigInt(agentId)],
    }),
    client.readContract({
      address: registryAddress as Address,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'tokenURI',
      args: [BigInt(agentId)],
    }),
    client.readContract({
      address: registryAddress as Address,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'getAgentWallet',
      args: [BigInt(agentId)],
    }),
  ]);

  const agentWallet =
    walletAddr === zeroAddress ? null : walletAddr;

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
 * @param options  Reputation registry address, client, and optional filters
 */
export async function getReputation(
  agentId: number,
  options: GetReputationOptions
): Promise<ReputationSummary> {
  const {
    reputationRegistryAddress,
    client,
    clients = [],
    tag1 = '',
    tag2 = '',
  } = options;

  const result = await client.readContract({
    address: reputationRegistryAddress as Address,
    abi: REPUTATION_REGISTRY_ABI,
    functionName: 'getSummary',
    args: [BigInt(agentId), clients as Address[], tag1, tag2],
  });

  const [count, summaryValue, valueDecimals] = result;

  const decimals = Number(valueDecimals);
  const rawValue = BigInt(summaryValue);
  const score = Number(rawValue) / 10 ** decimals;

  return { count: Number(count), score, rawValue, decimals };
}

// ─── Agent Registration ─────────────────────────────────────────────

export interface RegisterAgentOptions {
  /** The agent metadata URI (IPFS, HTTP, or data URL) */
  agentURI: string;
  /** The chain ID to register on */
  chainId: number;
  /** Optional RPC URL (defaults to chain's default endpoint) */
  rpcUrl?: string;
  /** A TransactionSigner for signing the registration transaction */
  signer: TransactionSigner;
}

export interface RegisterAgentResult {
  agentId: string;
  txHash: string;
  registryAddress: string;
  agentRegistry: string;
}

/**
 * Register an agent on the ERC-8004 Identity Registry in a single call.
 *
 * Builds, signs (via the provided signer), and broadcasts the `register(agentURI)`
 * transaction, then waits for confirmation and parses the `Registered` event.
 *
 * @example
 * ```typescript
 * import { registerAgent, createLocalAccountSigner } from '@buildersgarden/siwa';
 * import { privateKeyToAccount } from 'viem/accounts';
 *
 * const account = privateKeyToAccount('0x...');
 * const signer = createLocalAccountSigner(account);
 *
 * const result = await registerAgent({
 *   agentURI: 'ipfs://...',
 *   chainId: 84532,
 *   signer,
 * });
 * ```
 */
export async function registerAgent(
  options: RegisterAgentOptions
): Promise<RegisterAgentResult> {
  const { agentURI, chainId, signer } = options;

  const registryAddress = getRegistryAddress(chainId);
  const rpcUrl = options.rpcUrl || RPC_ENDPOINTS[chainId];
  if (!rpcUrl) {
    throw new Error(`No RPC URL provided and no default endpoint for chain ${chainId}.`);
  }

  const publicClient = createPublicClient({ transport: http(rpcUrl) });

  const address = await signer.getAddress();

  const data = encodeFunctionData({
    abi: IDENTITY_REGISTRY_ABI,
    functionName: 'register',
    args: [agentURI],
  });

  const nonce = await publicClient.getTransactionCount({ address });
  const feeData = await publicClient.estimateFeesPerGas();
  const gasEstimate = await publicClient.estimateGas({
    to: registryAddress as Address,
    data,
    account: address,
  });
  const gas = (gasEstimate * 120n) / 100n;

  const txReq = {
    to: registryAddress as Address,
    data,
    nonce,
    chainId,
    type: 2,
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    gas,
  };

  const signedTx = await signer.signTransaction(txReq);
  const txHash = await publicClient.sendRawTransaction({
    serializedTransaction: signedTx,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  const logs = parseEventLogs({
    abi: IDENTITY_REGISTRY_ABI,
    logs: receipt.logs,
    eventName: 'Registered',
  });

  if (logs.length === 0) {
    throw new Error(
      `Registration tx ${txHash} succeeded but no Registered event was found.`
    );
  }

  const agentId = logs[0].args.agentId.toString();
  const agentRegistry = getAgentRegistryString(chainId);

  return { agentId, txHash, registryAddress, agentRegistry };
}
