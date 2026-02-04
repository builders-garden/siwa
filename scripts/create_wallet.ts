/**
 * create_wallet.ts
 *
 * Creates a new Ethereum wallet and stores the private key securely
 * in the keystore (OS keychain or encrypted V3 JSON file).
 * Only the public address is written to MEMORY.md.
 *
 * Usage:
 *   npx ts-node scripts/create_wallet.ts [--memory ./MEMORY.md] [--backend os-keychain|encrypted-file|env]
 *
 * Environment variables:
 *   KEYSTORE_BACKEND    — Override auto-detection
 *   KEYSTORE_PASSWORD   — Password for encrypted-file backend
 *   KEYSTORE_PATH       — Path to keystore file (default: ./agent-keystore.json)
 *   RPC_URL             — (Optional) Check wallet balance
 *
 * Dependencies:
 *   npm install ethers
 *   npm install keytar  (optional, for OS keychain)
 */

import { ethers } from 'ethers';
import { createWallet, hasWallet, getAddress, KeystoreBackend } from './keystore';
import { ensureMemoryExists, readMemory, writeMemoryField, hasWalletRecord } from './memory';

const memoryPath = process.argv.includes('--memory')
  ? process.argv[process.argv.indexOf('--memory') + 1]
  : './MEMORY.md';

const backendOverride = process.argv.includes('--backend')
  ? process.argv[process.argv.indexOf('--backend') + 1] as KeystoreBackend
  : undefined;

async function main() {
  ensureMemoryExists(memoryPath);

  // Check if wallet already exists in keystore
  if (await hasWallet({ backend: backendOverride })) {
    const address = await getAddress({ backend: backendOverride });
    console.log('=== Existing Wallet Found in Keystore ===');
    console.log(`Address: ${address}`);
    console.log(`Backend: ${readMemory(memoryPath)['Keystore Backend'] || 'auto-detected'}`);
    await checkBalance(address!);
    return;
  }

  // Create new wallet — key goes directly into secure keystore
  const info = await createWallet({ backend: backendOverride });

  // Write ONLY public data to MEMORY.md
  writeMemoryField('Address', info.address, memoryPath);
  writeMemoryField('Keystore Backend', info.backend, memoryPath);
  if (info.keystorePath) {
    writeMemoryField('Keystore Path', info.keystorePath, memoryPath);
  }
  writeMemoryField('Created At', new Date().toISOString(), memoryPath);

  console.log('=== New Wallet Created ===');
  console.log(`Address:  ${info.address}`);
  console.log(`Backend:  ${info.backend}`);
  if (info.keystorePath) {
    console.log(`Keystore: ${info.keystorePath}`);
  }
  console.log('');
  console.log('✅ Private key stored securely in keystore — NOT in MEMORY.md');
  console.log('   MEMORY.md contains only the public address.');
  console.log('');
  console.log('Next: Fund this address with testnet ETH, then run register_agent.ts');

  await checkBalance(info.address);
}

async function checkBalance(address: string) {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    console.log('\nSet RPC_URL to check wallet balance.');
    return;
  }
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const balance = await provider.getBalance(address);
    console.log(`\nBalance: ${ethers.formatEther(balance)} ETH`);
    if (balance === 0n) {
      console.log('⚠️  Wallet has no funds. Fund with testnet ETH before registering.');
    }
  } catch {
    console.log('\nCould not check balance (RPC connection failed).');
  }
}

main().catch(console.error);
