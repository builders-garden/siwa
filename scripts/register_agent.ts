/**
 * register_agent.ts
 *
 * Registers an ERC-8004 agent on-chain.
 * Reads the wallet from the secure keystore (never from MEMORY.md),
 * uploads metadata, mints the agent NFT, and writes public results
 * to MEMORY.md.
 *
 * Environment variables:
 *   RPC_URL             — JSON-RPC endpoint for the target chain
 *   CHAIN_ID            — Target chain ID (default: 84532 for Base Sepolia)
 *   PINATA_JWT          — (Optional) Pinata JWT for IPFS upload
 *   STORAGE_MODE        — "ipfs" (default) or "base64"
 *   REGISTRATION_FILE   — Path to registration JSON (default: ./registration.json)
 *   KEYSTORE_BACKEND    — Override auto-detection
 *   KEYSTORE_PASSWORD   — Password for encrypted-file backend
 *   KEYSTORE_PATH       — Path to keystore file
 *
 * Usage:
 *   npx ts-node scripts/register_agent.ts [--memory ./MEMORY.md]
 *
 * Dependencies:
 *   npm install ethers
 */

import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import { getSigner, hasWallet, getAddress } from './keystore';
import {
  ensureMemoryExists, readMemory, writeMemoryField,
  appendToMemorySection, hasWalletRecord, isRegistered
} from './memory';

const memoryPath = process.argv.includes('--memory')
  ? process.argv[process.argv.indexOf('--memory') + 1]
  : './MEMORY.md';

// Registry addresses per chain
const REGISTRY_ADDRESSES: Record<number, string> = {
  8453: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',    // Base
  84532: '0x8004A818BFB912233c491871b3d84c89A494BD9e',   // Base Sepolia
  11155111: '0x8004a6090Cd10A7288092483047B097295Fb8847', // ETH Sepolia
  59141: '0x8004aa7C931bCE1233973a0C6A667f73F66282e7',   // Linea Sepolia
  80002: '0x8004ad19E14B9e0654f73353e8a0B600D46C2898',   // Polygon Amoy
};

const IDENTITY_REGISTRY_ABI = [
  'function register(string agentURI) external returns (uint256 agentId)',
  'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
];

async function uploadToIPFS(data: object, pinataJwt: string): Promise<string> {
  const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pinataJwt}`,
    },
    body: JSON.stringify({ pinataContent: data }),
  });
  if (!res.ok) throw new Error(`Pinata upload failed: ${res.status} ${await res.text()}`);
  const { IpfsHash } = await res.json();
  return `ipfs://${IpfsHash}`;
}

function encodeBase64(data: object): string {
  const json = JSON.stringify(data);
  return `data:application/json;base64,${Buffer.from(json).toString('base64')}`;
}

async function main() {
  const chainId = parseInt(process.env.CHAIN_ID || '84532');
  const storageMode = process.env.STORAGE_MODE || 'ipfs';
  const registrationPath = process.env.REGISTRATION_FILE || './registration.json';

  // --- Pre-flight checks ---

  ensureMemoryExists(memoryPath);

  if (!(await hasWallet())) {
    console.error('No wallet found in keystore. Run create_wallet.ts first.');
    process.exit(1);
  }

  if (isRegistered(memoryPath)) {
    const mem = readMemory(memoryPath);
    console.log(`Agent already registered (ID: ${mem['Agent ID']}, Registry: ${mem['Agent Registry']}).`);
    console.log('To re-register, clear the Registration section in MEMORY.md first.');
    process.exit(0);
  }

  const registryAddress = REGISTRY_ADDRESSES[chainId];
  if (!registryAddress) {
    console.error(`Unsupported chain ID: ${chainId}. Supported: ${Object.keys(REGISTRY_ADDRESSES).join(', ')}`);
    process.exit(1);
  }
  if (!process.env.RPC_URL) { console.error('RPC_URL is required'); process.exit(1); }

  // --- Get signer from secure keystore (private key stays inside keystore module) ---

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const signer = await getSigner(provider);
  const address = await signer.getAddress();
  console.log(`Using wallet: ${address}`);

  // --- Load registration file ---

  const regFilePath = path.resolve(registrationPath);
  if (!fs.existsSync(regFilePath)) {
    console.error(`Registration file not found: ${regFilePath}`);
    process.exit(1);
  }
  const registrationData = JSON.parse(fs.readFileSync(regFilePath, 'utf-8'));
  console.log(`Loaded registration: ${registrationData.name}`);

  // Persist agent profile (public data only) to MEMORY.md
  if (registrationData.name) writeMemoryField('Name', registrationData.name, memoryPath);
  if (registrationData.description) writeMemoryField('Description', registrationData.description.slice(0, 100), memoryPath);
  if (registrationData.image) writeMemoryField('Image', registrationData.image, memoryPath);

  // --- Upload metadata ---

  let agentURI: string;
  if (storageMode === 'base64') {
    agentURI = encodeBase64(registrationData);
    console.log('Encoded as base64 data URI');
  } else {
    if (!process.env.PINATA_JWT) { console.error('PINATA_JWT required for IPFS storage'); process.exit(1); }
    agentURI = await uploadToIPFS(registrationData, process.env.PINATA_JWT);
    console.log(`Uploaded to IPFS: ${agentURI}`);
  }

  // --- Register on-chain ---

  const registry = new ethers.Contract(registryAddress, IDENTITY_REGISTRY_ABI, signer);
  console.log(`Registering on chain ${chainId}...`);
  const tx = await registry.register(agentURI);
  console.log(`Tx sent: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`Confirmed in block ${receipt.blockNumber}`);

  // --- Parse event and persist PUBLIC results to MEMORY.md ---

  const iface = new ethers.Interface(IDENTITY_REGISTRY_ABI);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === 'Registered') {
        const agentId = parsed.args.agentId.toString();
        const agentRegistry = `eip155:${chainId}:${registryAddress}`;

        writeMemoryField('Status', 'registered', memoryPath);
        writeMemoryField('Agent ID', agentId, memoryPath);
        writeMemoryField('Agent Registry', agentRegistry, memoryPath);
        writeMemoryField('Agent URI', agentURI, memoryPath);
        writeMemoryField('Chain ID', chainId.toString(), memoryPath);
        writeMemoryField('Registered At', new Date().toISOString(), memoryPath);

        if (registrationData.services) {
          for (const svc of registrationData.services) {
            appendToMemorySection('Services', `- **${svc.name}**: \`${svc.endpoint}\``, memoryPath);
          }
        }

        appendToMemorySection('Notes', `- Registered via tx \`${tx.hash}\` on block ${receipt.blockNumber}`, memoryPath);

        console.log('');
        console.log('=== Agent Registered — MEMORY.md Updated ===');
        console.log(`Agent ID:       ${agentId}`);
        console.log(`Agent Registry: ${agentRegistry}`);
        console.log(`Agent URI:      ${agentURI}`);
        console.log(`Owner:          ${address}`);
        return;
      }
    } catch { /* skip non-matching logs */ }
  }

  console.log('Registration tx succeeded but could not parse event.');
}

main().catch(console.error);
