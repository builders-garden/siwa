import chalk from 'chalk';
import * as fs from 'fs';
import { ethers } from 'ethers';
import { hasWallet, getSigner } from '../../../scripts/keystore.js';
import {
  isRegistered, readMemory, writeMemoryField, appendToMemorySection,
} from '../../../scripts/memory.js';
import {
  config, getKeystoreConfig, isLiveMode, REGISTRY_ADDRESSES, RPC_ENDPOINTS, txUrl, addressUrl,
} from '../config.js';

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
  const { IpfsHash } = (await res.json()) as { IpfsHash: string };
  return `ipfs://${IpfsHash}`;
}

export async function registerFlow(): Promise<void> {
  const kc = getKeystoreConfig();

  // Check if already registered
  if (isRegistered(config.memoryPath)) {
    const mem = readMemory(config.memoryPath);
    console.log(chalk.yellow(`\u{1F4DD} Already registered`));
    console.log(chalk.dim(`   Agent ID:       ${mem['Agent ID']}`));
    console.log(chalk.dim(`   Agent Registry: ${mem['Agent Registry']}`));
    return;
  }

  // Check wallet exists
  if (!(await hasWallet(kc))) {
    console.log(chalk.red(`\u{274C} No wallet found. Run create-wallet first.`));
    process.exit(1);
  }

  if (isLiveMode()) {
    await registerLive();
  } else {
    await registerMock();
  }
}

async function registerMock(): Promise<void> {
  // Build mock metadata
  const mockMetadata = {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: 'Test Agent',
    description: 'Local test agent for SIWA development',
    services: [],
    active: true,
  };
  const agentURI = `data:application/json;base64,${Buffer.from(JSON.stringify(mockMetadata)).toString('base64')}`;

  // Write mock registration data to MEMORY.md
  writeMemoryField('Status', 'registered', config.memoryPath);
  writeMemoryField('Agent ID', String(config.mockAgentId), config.memoryPath);
  writeMemoryField('Agent Registry', config.mockAgentRegistry, config.memoryPath);
  writeMemoryField('Agent URI', agentURI, config.memoryPath);
  writeMemoryField('Chain ID', String(config.mockChainId), config.memoryPath);
  writeMemoryField('Registered At', new Date().toISOString(), config.memoryPath);

  // Write mock profile
  writeMemoryField('Name', 'Test Agent', config.memoryPath);
  writeMemoryField('Description', 'Local test agent for SIWA development', config.memoryPath);

  console.log(chalk.green(`\u{1F4DD} Mock registration complete`));
  console.log(chalk.dim(`   Agent ID:       ${config.mockAgentId}`));
  console.log(chalk.dim(`   Agent Registry: ${config.mockAgentRegistry}`));
  console.log(chalk.dim(`   Chain ID:       ${config.mockChainId}`));
  console.log(chalk.yellow(`   \u{2139}\u{FE0F}  This is a mock \u{2014} no on-chain transaction was made.`));
  console.log(chalk.yellow(`   \u{2139}\u{FE0F}  Use --live with RPC_URL for real registration.`));
}

async function registerLive(): Promise<void> {
  const kc = getKeystoreConfig();
  const chainId = config.chainId;
  const rpcUrl = config.rpcUrl || RPC_ENDPOINTS[chainId];

  if (!rpcUrl) {
    console.log(chalk.red(`\u{274C} No RPC_URL set and no default endpoint for chain ${chainId}.`));
    process.exit(1);
  }

  const registryAddress = REGISTRY_ADDRESSES[chainId];
  if (!registryAddress) {
    console.log(chalk.red(`\u{274C} Unsupported chain ID: ${chainId}. Supported: ${Object.keys(REGISTRY_ADDRESSES).join(', ')}`));
    process.exit(1);
  }

  // Connect provider and check balance
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = await getSigner(provider, kc);
  const address = await signer.getAddress();

  console.log(chalk.cyan(`\u{1F310} Connecting to chain ${chainId} via ${rpcUrl}`));
  console.log(chalk.dim(`   Wallet:  ${address}`));
  console.log(chalk.dim(`   ${addressUrl(chainId, address)}`));

  const balance = await provider.getBalance(address);
  const balanceEth = ethers.formatEther(balance);
  console.log(chalk.dim(`   Balance: ${balanceEth} ETH`));

  if (balance === 0n) {
    console.log(chalk.red(`\u{274C} Wallet has no ETH. Fund it with testnet ETH first.`));
    console.log(chalk.yellow(`   Faucets for chain ${chainId}:`));
    if (chainId === 84532) console.log(chalk.dim(`   https://www.alchemy.com/faucets/base-sepolia`));
    if (chainId === 11155111) console.log(chalk.dim(`   https://www.alchemy.com/faucets/ethereum-sepolia`));
    if (chainId === 80002) console.log(chalk.dim(`   https://faucet.polygon.technology/`));
    process.exit(1);
  }

  // Load registration metadata
  let registrationData: Record<string, any>;
  if (fs.existsSync(config.registrationFile)) {
    registrationData = JSON.parse(fs.readFileSync(config.registrationFile, 'utf-8'));
    console.log(chalk.dim(`   Registration file: ${config.registrationFile}`));
  } else {
    // Use inline defaults if no registration file
    registrationData = {
      type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
      name: 'Test Agent',
      description: 'Local test agent for SIWA development',
      services: [],
      active: true,
    };
    console.log(chalk.yellow(`   No registration file found, using defaults`));
  }

  // Upload metadata
  let agentURI: string;
  if (config.storageMode === 'ipfs') {
    if (!config.pinataJwt) {
      console.log(chalk.red(`\u{274C} PINATA_JWT required for IPFS storage. Set it or use STORAGE_MODE=base64.`));
      process.exit(1);
    }
    console.log(chalk.cyan(`\u{1F310} Uploading metadata to IPFS via Pinata...`));
    agentURI = await uploadToIPFS(registrationData, config.pinataJwt);
    console.log(chalk.dim(`   IPFS URI: ${agentURI}`));
  } else {
    agentURI = `data:application/json;base64,${Buffer.from(JSON.stringify(registrationData)).toString('base64')}`;
    console.log(chalk.dim(`   Encoded as base64 data URI`));
  }

  // Register on-chain
  const registry = new ethers.Contract(registryAddress, IDENTITY_REGISTRY_ABI, signer);
  console.log(chalk.cyan(`\u{1F310} Registering on chain ${chainId}...`));

  const tx = await registry.register(agentURI);
  console.log(chalk.dim(`   Tx hash: ${tx.hash}`));
  console.log(chalk.cyan(`   ${txUrl(chainId, tx.hash)}`));
  console.log(chalk.dim(`   Waiting for confirmation...`));

  const receipt = await tx.wait();
  console.log(chalk.dim(`   Confirmed in block ${receipt.blockNumber}`));

  // Parse event
  const iface = new ethers.Interface(IDENTITY_REGISTRY_ABI);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === 'Registered') {
        const agentId = parsed.args.agentId.toString();
        const agentRegistry = `eip155:${chainId}:${registryAddress}`;

        writeMemoryField('Status', 'registered', config.memoryPath);
        writeMemoryField('Agent ID', agentId, config.memoryPath);
        writeMemoryField('Agent Registry', agentRegistry, config.memoryPath);
        writeMemoryField('Agent URI', agentURI, config.memoryPath);
        writeMemoryField('Chain ID', chainId.toString(), config.memoryPath);
        writeMemoryField('Registered At', new Date().toISOString(), config.memoryPath);

        if (registrationData.name) writeMemoryField('Name', registrationData.name, config.memoryPath);
        if (registrationData.description) writeMemoryField('Description', registrationData.description.slice(0, 100), config.memoryPath);

        if (registrationData.services) {
          for (const svc of registrationData.services) {
            appendToMemorySection('Services', `- **${svc.name}**: \`${svc.endpoint}\``, config.memoryPath);
          }
        }

        appendToMemorySection('Notes', `- Registered via tx \`${tx.hash}\` on block ${receipt.blockNumber}`, config.memoryPath);

        console.log(chalk.green.bold(`\u{2705} On-chain registration complete`));
        console.log(chalk.dim(`   Agent ID:       ${agentId}`));
        console.log(chalk.dim(`   Agent Registry: ${agentRegistry}`));
        console.log(chalk.dim(`   Chain ID:       ${chainId}`));
        console.log(chalk.cyan(`   Tx:             ${txUrl(chainId, tx.hash)}`));
        console.log(chalk.cyan(`   8004scan:       https://www.8004scan.io/`));
        return;
      }
    } catch { /* skip non-matching logs */ }
  }

  console.log(chalk.yellow(`\u{26A0}\u{FE0F}  Registration tx succeeded but could not parse Registered event.`));
  console.log(chalk.cyan(`   Tx: ${txUrl(chainId, tx.hash)}`));
}
