import chalk from 'chalk';
import * as fs from 'fs';
import {
  createPublicClient,
  http,
  formatEther,
  encodeFunctionData,
  parseEventLogs,
  type Address,
  type Hex,
} from 'viem';
import { hasWallet, getAddress, signTransaction } from '@buildersgarden/siwa/keystore';
import {
  isRegistered, readIdentity, writeIdentityField,
} from '@buildersgarden/siwa/identity';
import {
  config, getKeystoreConfig, isLiveMode, REGISTRY_ADDRESSES, RPC_ENDPOINTS, CHAIN_NAMES, FAUCETS, txUrl, addressUrl,
} from '../config.js';

const IDENTITY_REGISTRY_ABI = [
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

export async function registerFlow(confirmed = false): Promise<void> {
  const kc = getKeystoreConfig();

  // Check if already registered
  if (await isRegistered({ identityPath: config.identityPath })) {
    const identity = readIdentity(config.identityPath);
    console.log(chalk.yellow(`\u{1F4DD} Already registered`));
    console.log(chalk.dim(`   Agent ID:       ${identity.agentId}`));
    console.log(chalk.dim(`   Agent Registry: ${identity.agentRegistry}`));
    return;
  }

  // Check wallet exists
  if (!(await hasWallet(kc))) {
    console.log(chalk.red(`\u{274C} No wallet found. Run create-wallet first.`));
    process.exit(1);
  }

  if (isLiveMode()) {
    await registerLive(confirmed);
  } else {
    await registerMock();
  }
}

async function registerMock(): Promise<void> {
  // Write mock registration data to IDENTITY.md
  writeIdentityField('Agent ID', String(config.mockAgentId), config.identityPath);
  writeIdentityField('Agent Registry', config.mockAgentRegistry, config.identityPath);
  writeIdentityField('Chain ID', String(config.mockChainId), config.identityPath);

  console.log(chalk.green(`\u{1F4DD} Mock registration complete`));
  console.log(chalk.dim(`   Agent ID:       ${config.mockAgentId}`));
  console.log(chalk.dim(`   Agent Registry: ${config.mockAgentRegistry}`));
  console.log(chalk.dim(`   Chain ID:       ${config.mockChainId}`));
  console.log(chalk.yellow(`   \u{2139}\u{FE0F}  This is a mock \u{2014} no onchain transaction was made.`));
  console.log(chalk.yellow(`   \u{2139}\u{FE0F}  Use --live with RPC_URL for real registration.`));
}

function printRegistrationSummary(data: Record<string, any>, filePath: string): void {
  const border = '\u{2500}'.repeat(60);
  console.log('');
  console.log(chalk.bold('  ERC-8004 Registration Data'));
  console.log(chalk.dim(`  ${border}`));
  console.log(chalk.dim(`  File: ${filePath}`));
  console.log(chalk.dim(`  ${border}`));
  console.log(`  ${chalk.bold('Name:')}            ${data.name || chalk.red('(missing)')}`);
  console.log(`  ${chalk.bold('Description:')}     ${data.description || chalk.red('(missing)')}`);
  console.log(`  ${chalk.bold('Image:')}           ${data.image || chalk.dim('(none)')}`);
  console.log(`  ${chalk.bold('Active:')}          ${data.active ?? true}`);
  console.log(`  ${chalk.bold('x402 Support:')}    ${data.x402Support ?? false}`);
  console.log(`  ${chalk.bold('Supported Trust:')} ${(data.supportedTrust || []).join(', ') || chalk.dim('(none)')}`);

  const services = data.services || [];
  if (services.length > 0) {
    console.log(`  ${chalk.bold('Services:')}`);
    for (const svc of services) {
      console.log(chalk.dim(`    - ${svc.name || '?'} (v${svc.version || '?'}): ${svc.endpoint || chalk.red('(missing)')}`));
    }
  } else {
    console.log(`  ${chalk.bold('Services:')}        ${chalk.dim('(none)')}`);
  }

  const registrations = data.registrations || [];
  if (registrations.length > 0) {
    console.log(`  ${chalk.bold('Registrations:')}   ${registrations.join(', ')}`);
  }
  console.log(chalk.dim(`  ${border}`));
  console.log('');
}

async function registerLive(confirmed: boolean): Promise<void> {
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

  // Create public client
  const publicClient = createPublicClient({
    transport: http(rpcUrl),
  });

  const address = await getAddress(kc);
  if (!address) {
    console.log(chalk.red(`\u{274C} Could not resolve wallet address.`));
    process.exit(1);
  }

  console.log(chalk.cyan(`\u{1F310} Connecting to chain ${chainId} via ${rpcUrl}`));
  console.log(chalk.dim(`   Wallet:  ${address}`));
  console.log(chalk.dim(`   ${addressUrl(chainId, address)}`));

  const balance = await publicClient.getBalance({ address: address as Address });
  const balanceEth = formatEther(balance);
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

  // Show registration data and require --confirm
  printRegistrationSummary(registrationData, config.registrationFile);

  if (!confirmed) {
    console.log(chalk.yellow.bold('  Please review the registration data above.'));
    console.log(chalk.yellow('  This will be recorded onchain and cannot be changed.'));
    console.log('');
    console.log(chalk.cyan(`  To update: edit ${config.registrationFile}`));
    console.log(chalk.cyan('  To proceed: re-run with --confirm'));
    console.log('');
    process.exit(0);
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

  // Build + sign tx via proxy, then broadcast raw
  const data = encodeFunctionData({
    abi: IDENTITY_REGISTRY_ABI,
    functionName: 'register',
    args: [agentURI],
  });

  const nonce = await publicClient.getTransactionCount({ address: address as Address });
  const feeData = await publicClient.estimateFeesPerGas();

  const gasEstimate = await publicClient.estimateGas({
    to: registryAddress as Address,
    data,
    account: address as Address,
  });
  const gas = gasEstimate * 120n / 100n; // 20% buffer

  const txReq = {
    to: registryAddress,
    data,
    nonce,
    chainId,
    type: 2,
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    gas,
  };

  console.log(chalk.dim(`   Nonce:     ${nonce}`));
  console.log(chalk.dim(`   Gas:       ${txReq.gas}`));
  console.log(chalk.dim(`   MaxFee:    ${feeData.maxFeePerGas} wei`));

  const { signedTx } = await signTransaction(txReq, kc);
  const txHash = await publicClient.sendRawTransaction({ serializedTransaction: signedTx as Hex });
  console.log(chalk.dim(`   Tx hash: ${txHash}`));
  console.log(chalk.cyan(`   ${txUrl(chainId, txHash)}`));
  console.log(chalk.dim(`   Waiting for confirmation...`));

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as Hex });
  console.log(chalk.dim(`   Confirmed in block ${receipt.blockNumber}`));

  // Parse event
  const logs = parseEventLogs({
    abi: IDENTITY_REGISTRY_ABI,
    logs: receipt.logs,
    eventName: 'Registered',
  });

  if (logs.length > 0) {
    const log = logs[0];
    const agentId = log.args.agentId.toString();
    const agentRegistry = `eip155:${chainId}:${registryAddress}`;

    writeIdentityField('Agent ID', agentId, config.identityPath);
    writeIdentityField('Agent Registry', agentRegistry, config.identityPath);
    writeIdentityField('Chain ID', chainId.toString(), config.identityPath);

    console.log(chalk.green.bold(`\u{2705} Onchain registration complete`));
    console.log(chalk.dim(`   Agent ID:       ${agentId}`));
    console.log(chalk.dim(`   Agent Registry: ${agentRegistry}`));
    console.log(chalk.dim(`   Chain ID:       ${chainId}`));
    console.log(chalk.cyan(`   Tx:             ${txUrl(chainId, txHash)}`));
    console.log(chalk.cyan(`   8004scan:       https://www.8004scan.io/`));
    return;
  }

  console.log(chalk.yellow(`\u{26A0}\u{FE0F}  Registration tx succeeded but could not parse Registered event.`));
  console.log(chalk.cyan(`   Tx: ${txUrl(chainId, txHash)}`));
}
