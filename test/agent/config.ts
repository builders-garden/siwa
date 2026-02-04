import type { KeystoreBackend } from '../../scripts/keystore.js';
import * as path from 'path';

const projectRoot = path.resolve(import.meta.dirname, '..');

// Registry addresses per chain (must match contracts in references/contract-addresses.md)
export const REGISTRY_ADDRESSES: Record<number, string> = {
  8453: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',    // Base
  84532: '0x8004A818BFB912233c491871b3d84c89A494BD9e',   // Base Sepolia
  11155111: '0x8004a6090Cd10A7288092483047B097295Fb8847', // ETH Sepolia
  59141: '0x8004aa7C931bCE1233973a0C6A667f73F66282e7',   // Linea Sepolia
  80002: '0x8004ad19E14B9e0654f73353e8a0B600D46C2898',   // Polygon Amoy
};

export const RPC_ENDPOINTS: Record<number, string> = {
  8453: 'https://mainnet.base.org',
  84532: 'https://sepolia.base.org',
  11155111: 'https://rpc.sepolia.org',
  59141: 'https://rpc.sepolia.linea.build',
  80002: 'https://rpc-amoy.polygon.technology',
};

export const BLOCK_EXPLORERS: Record<number, string> = {
  8453: 'https://basescan.org',
  84532: 'https://sepolia.basescan.org',
  11155111: 'https://sepolia.etherscan.io',
  59141: 'https://sepolia.lineascan.build',
  80002: 'https://amoy.polygonscan.com',
};

export function txUrl(chainId: number, txHash: string): string {
  const base = BLOCK_EXPLORERS[chainId];
  return base ? `${base}/tx/${txHash}` : txHash;
}

export function addressUrl(chainId: number, address: string): string {
  const base = BLOCK_EXPLORERS[chainId];
  return base ? `${base}/address/${address}` : address;
}

export const config = {
  serverUrl: process.env.SERVER_URL || 'http://localhost:3000',
  serverDomain: process.env.SERVER_DOMAIN || 'localhost:3000',
  memoryPath: process.env.MEMORY_PATH || path.resolve(projectRoot, 'MEMORY.md'),
  keystorePath: process.env.KEYSTORE_PATH || path.resolve(projectRoot, 'agent-keystore.json'),
  keystorePassword: process.env.KEYSTORE_PASSWORD || 'test-password-local-only',
  keystoreBackend: (process.env.KEYSTORE_BACKEND || 'encrypted-file') as KeystoreBackend,
  templatePath: path.resolve(projectRoot, '..', 'assets', 'MEMORY.md.template'),
  registrationFile: process.env.REGISTRATION_FILE || path.resolve(projectRoot, '..', 'assets', 'registration-template.json'),

  // Onchain settings
  rpcUrl: process.env.RPC_URL || '',
  chainId: parseInt(process.env.CHAIN_ID || '84532'),
  storageMode: (process.env.STORAGE_MODE || 'base64') as 'ipfs' | 'base64',
  pinataJwt: process.env.PINATA_JWT || '',

  // Mock registration defaults (used when --live is not set)
  mockAgentId: parseInt(process.env.MOCK_AGENT_ID || '1'),
  mockAgentRegistry: process.env.MOCK_AGENT_REGISTRY || 'eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e',
  mockChainId: parseInt(process.env.MOCK_CHAIN_ID || '84532'),
};

export function getKeystoreConfig() {
  return {
    backend: config.keystoreBackend,
    keystorePath: config.keystorePath,
    password: config.keystorePassword,
  };
}

export function isLiveMode(): boolean {
  return process.argv.includes('--live') || !!config.rpcUrl;
}
