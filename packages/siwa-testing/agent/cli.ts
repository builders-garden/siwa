import 'dotenv/config';
import chalk from 'chalk';
import { createWalletFlow } from './flows/create-wallet.js';
import { registerFlow } from './flows/register.js';
import { signInFlow, callApiFlow } from './flows/sign-in.js';
import { testProxyFlow } from './flows/test-proxy.js';
import { testErc8128Flow } from './flows/test-erc8128.js';
import { testSignersFlow, testViemSignerFlow, testKeyringSignerFlow } from './flows/test-signers.js';
import { testNonceStoreFlow } from './flows/test-nonce-store.js';
import { testX402Flow } from './flows/test-x402.js';
import { hasWallet } from '@buildersgarden/siwa/keystore';
import { isRegistered, readIdentity } from '@buildersgarden/siwa/identity';
import { signAuthenticatedRequest } from '@buildersgarden/siwa/erc8128';
import { config, getSigner, getKeystoreConfig } from './config.js';

const command = process.argv[2];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printUsage(): void {
  console.log(chalk.bold('ERC-8004 Agent CLI'));
  console.log('');
  console.log('Usage: tsx agent/cli.ts <command>');
  console.log('');
  console.log('Commands:');
  console.log('  create-wallet  Create wallet via keyring proxy, write address to SIWA_IDENTITY.md');
  console.log('  register       Mock-register the agent (write mock data to SIWA_IDENTITY.md)');
  console.log('  sign-in        Full SIWA flow against the local server');
  console.log('  call-api       Make an authenticated call using ERC-8128 signed requests');
  console.log('  full-flow      Run all steps sequentially');
  console.log('  status         Print current SIWA_IDENTITY.md state + keystore status');
  console.log('  test-proxy     Run keyring proxy tests (requires running proxy server)');
  console.log('  test-erc8128   Run ERC-8128 integration tests (requires proxy + server)');
  console.log('  test-signers   Run signer tests (both viem private key and keyring proxy)');
  console.log('  test-viem      Run signer tests with viem private key only (no proxy needed)');
  console.log('  test-keyring   Run signer tests with keyring proxy only');
  console.log('  test-nonce     Run nonce store adapter tests (pure, no server needed)');
  console.log('  test-x402      Run x402 payment protocol tests (pure, no server needed)');
  console.log('');
}

async function statusCommand(): Promise<void> {
  const kc = getKeystoreConfig();
  const signer = getSigner();
  const identity = readIdentity(config.identityPath);
  const walletExists = await hasWallet(kc);
  let address: string | null = null;
  if (walletExists) {
    try {
      address = await signer.getAddress();
    } catch {
      // Ignore - wallet might not be accessible
    }
  }

  console.log(chalk.bold('Agent Status'));
  console.log('\u{2500}'.repeat(40));
  console.log(`Wallet:       ${address || chalk.dim('not created')}`);

  if (await isRegistered({ identityPath: config.identityPath })) {
    console.log(`Registered:   ${chalk.green('yes')} (Agent #${identity.agentId})`);
    console.log(`Registry:     ${identity.agentRegistry}`);
    console.log(`Chain:        ${identity.chainId}`);
  } else {
    console.log(`Registered:   ${chalk.yellow('no')}`);
  }
}

async function fullFlow(): Promise<void> {
  const signer = getSigner();
  const sep = '\u{2550}'.repeat(47);
  console.log(sep);
  console.log('  ERC-8004 Agent \u{2014} Local Test Flow');
  console.log(sep);
  console.log('');

  // Step 1
  console.log(chalk.bold('Step 1/4: Create Wallet'));
  console.log('\u{2500}'.repeat(24));
  try {
    await createWalletFlow();
  } catch (err: any) {
    console.log(chalk.red(`\u{274C} Create wallet failed: ${err.message}`));
    return;
  }
  console.log('');
  await sleep(1000);

  // Step 2
  console.log(chalk.bold('Step 2/4: Mock Registration'));
  console.log('\u{2500}'.repeat(28));
  try {
    await registerFlow();
  } catch (err: any) {
    console.log(chalk.red(`\u{274C} Registration failed: ${err.message}`));
    return;
  }
  console.log('');
  await sleep(1000);

  // Step 3
  console.log(chalk.bold('Step 3/4: SIWA Sign-In'));
  console.log('\u{2500}'.repeat(24));
  let result: { receipt: string } | null = null;
  try {
    result = await signInFlow();
  } catch (err: any) {
    console.log(chalk.red(`\u{274C} Sign-in failed: ${err.message}`));
    return;
  }
  console.log('');
  await sleep(1000);

  // Step 4
  console.log(chalk.bold('Step 4/4: Authenticated API Call (ERC-8128)'));
  console.log('\u{2500}'.repeat(44));
  if (result) {
    try {
      const identity = readIdentity(config.identityPath);
      const chainId = identity.chainId!;

      console.log(chalk.cyan(`\u{1F310} POST /api/agent-action`));
      const body = JSON.stringify({ action: 'test', data: { hello: 'world' } });
      const request = new Request(`${config.serverUrl}/api/agent-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const signedRequest = await signAuthenticatedRequest(request, result.receipt, signer, chainId);
      const res = await fetch(signedRequest);

      if (res.ok) {
        const data = await res.json();
        console.log(chalk.green.bold(`\u{2705} Response:`));
        console.log(chalk.dim(JSON.stringify(data, null, 2)));
      } else {
        console.log(chalk.red(`\u{274C} API call failed: ${res.status}`));
      }
    } catch (err: any) {
      console.log(chalk.red(`\u{274C} API call failed: ${err.message}`));
    }
  } else {
    console.log(chalk.red(`\u{274C} No receipt available (sign-in failed)`));
  }

  console.log('');
  console.log(sep);
  console.log(chalk.green.bold('  \u{2705} All steps completed successfully!'));
  console.log(chalk.dim(`  \u{1F4CB} Dashboard: http://localhost:3000`));
  console.log(sep);
}

async function main(): Promise<void> {
  try {
    switch (command) {
      case 'create-wallet':
        await createWalletFlow();
        break;
      case 'register':
        await registerFlow();
        break;
      case 'sign-in':
        await signInFlow();
        break;
      case 'call-api':
        await callApiFlow();
        break;
      case 'full-flow':
        await fullFlow();
        break;
      case 'status':
        await statusCommand();
        break;
      case 'test-proxy': {
        const ok = await testProxyFlow();
        if (!ok) process.exit(1);
        break;
      }
      case 'test-erc8128': {
        const ok = await testErc8128Flow();
        if (!ok) process.exit(1);
        break;
      }
      case 'test-signers': {
        const ok = await testSignersFlow();
        if (!ok) process.exit(1);
        break;
      }
      case 'test-viem': {
        const ok = await testViemSignerFlow();
        if (!ok) process.exit(1);
        break;
      }
      case 'test-keyring': {
        const ok = await testKeyringSignerFlow();
        if (!ok) process.exit(1);
        break;
      }
      case 'test-nonce': {
        const ok = await testNonceStoreFlow();
        if (!ok) process.exit(1);
        break;
      }
      case 'test-x402': {
        const ok = await testX402Flow();
        if (!ok) process.exit(1);
        break;
      }
      default:
        printUsage();
        break;
    }
  } catch (err: any) {
    console.log(chalk.red(`\u{274C} Error: ${err.message}`));
    process.exit(1);
  }
}

main();
