import chalk from 'chalk';
import * as fs from 'fs';
import { ethers } from 'ethers';
import { hasWallet, getSigner, getAddress, signTransaction, type KeystoreConfig } from 'siwa/keystore';
import {
  isRegistered, readMemory, writeMemoryField, appendToMemorySection,
} from 'siwa/memory';
import {
  config, getKeystoreConfig, isLiveMode, REGISTRY_ADDRESSES, RPC_ENDPOINTS, CHAIN_NAMES, FAUCETS, txUrl, addressUrl,
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
  console.log(chalk.yellow(`   \u{2139}\u{FE0F}  This is a mock \u{2014} no onchain transaction was made.`));
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

  // Connect provider and resolve address
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const address = await getAddress(kc);
  if (!address) {
    console.log(chalk.red(`\u{274C} Could not resolve wallet address.`));
    process.exit(1);
  }

  console.log(chalk.cyan(`\u{1F310} Connecting to chain ${chainId} via ${rpcUrl}`));
  console.log(chalk.dim(`   Wallet:  ${address}`));
  console.log(chalk.dim(`   ${addressUrl(chainId, address)}`));

  const balance = await provider.getBalance(address);
  const balanceEth = ethers.formatEther(balance);
  console.log(chalk.dim(`   Balance: ${balanceEth} ETH`));

  if (balance === 0n) {
    const chainName = CHAIN_NAMES[chainId] || `Chain ${chainId}`;
    const faucetUrl = FAUCETS[chainId];
    console.log(chalk.red(`\u{274C} Wallet has no ETH — cannot send transactions.`));
    console.log('');
    console.log(chalk.yellow(`   Please fund this wallet before registering:`));
    console.log('');
    console.log(chalk.white(`   Address:  ${address}`));
    console.log(chalk.white(`   Chain:    ${chainName} (Chain ID: ${chainId})`));
    console.log(chalk.dim(`   Explorer: ${addressUrl(chainId, address)}`));
    if (faucetUrl) {
      console.log('');
      console.log(chalk.yellow(`   Faucet:   ${faucetUrl}`));
    }
    console.log('');
    console.log(chalk.dim(`   After funding, re-run this command to continue registration.`));
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

  // Register onchain
  console.log(chalk.cyan(`\u{1F310} Registering on chain ${chainId}...`));
  console.log(chalk.dim(`   Registry:  ${registryAddress}`));
  console.log(chalk.dim(`   From:      ${address}`));
  console.log(chalk.dim(`   AgentURI:  ${agentURI.slice(0, 80)}...`));

  let receipt: ethers.TransactionReceipt;
  let txHash: string;

  if (kc.backend === 'proxy') {
    // Proxy path: build + sign tx via proxy, then broadcast raw
    const iface = new ethers.Interface(IDENTITY_REGISTRY_ABI);
    const data = iface.encodeFunctionData('register', [agentURI]);
    const nonce = await provider.getTransactionCount(address);
    const feeData = await provider.getFeeData();

    const gasEstimate = await provider.estimateGas({ to: registryAddress, data, from: address });
    const gasLimit = gasEstimate * 120n / 100n; // 20% buffer

    const txReq: ethers.TransactionLike = {
      to: registryAddress,
      data,
      nonce,
      chainId,
      type: 2,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      gasLimit,
    };

    console.log(chalk.dim(`   Nonce:     ${nonce}`));
    console.log(chalk.dim(`   GasLimit:  ${txReq.gasLimit}`));
    console.log(chalk.dim(`   MaxFee:    ${feeData.maxFeePerGas} wei`));
    console.log(chalk.dim(`   register(agentURI) where agentURI =`));
    console.log(chalk.dim(`   ${agentURI}`));

    const { signedTx } = await signTransaction(txReq, kc);
    const txResponse = await provider.broadcastTransaction(signedTx);
    txHash = txResponse.hash;
    console.log(chalk.dim(`   Tx hash: ${txHash}`));
    console.log(chalk.cyan(`   ${txUrl(chainId, txHash)}`));
    console.log(chalk.dim(`   Waiting for confirmation...`));
    receipt = (await txResponse.wait())!;
  } else {
    // Direct signer path
    const signer = await getSigner(provider, kc);
    const registry = new ethers.Contract(registryAddress, IDENTITY_REGISTRY_ABI, signer);
    const tx = await registry.register(agentURI);
    txHash = tx.hash;
    console.log(chalk.dim(`   Tx hash: ${txHash}`));
    console.log(chalk.cyan(`   ${txUrl(chainId, txHash)}`));
    console.log(chalk.dim(`   Waiting for confirmation...`));
    receipt = (await tx.wait())!;
  }
  console.log(chalk.dim(`   Confirmed in block ${receipt.blockNumber}`));

  // Parse event
  const eventIface = new ethers.Interface(IDENTITY_REGISTRY_ABI);
  for (const log of receipt.logs) {
    try {
      const parsed = eventIface.parseLog({ topics: log.topics as string[], data: log.data });
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

        appendToMemorySection('Notes', `- Registered via tx \`${txHash}\` on block ${receipt.blockNumber}`, config.memoryPath);

        console.log(chalk.green.bold(`\u{2705} Onchain registration complete`));
        console.log(chalk.dim(`   Agent ID:       ${agentId}`));
        console.log(chalk.dim(`   Agent Registry: ${agentRegistry}`));
        console.log(chalk.dim(`   Chain ID:       ${chainId}`));
        console.log(chalk.cyan(`   Tx:             ${txUrl(chainId, txHash)}`));
        console.log(chalk.cyan(`   8004scan:       https://www.8004scan.io/`));
        return;
      }
    } catch { /* skip non-matching logs */ }
  }

  console.log(chalk.yellow(`\u{26A0}\u{FE0F}  Registration tx succeeded but could not parse Registered event.`));
  console.log(chalk.cyan(`   Tx: ${txUrl(chainId, txHash)}`));
}
