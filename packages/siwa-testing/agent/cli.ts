import 'dotenv/config';
import chalk from 'chalk';
import { createWalletFlow } from './flows/create-wallet.js';
import { registerFlow } from './flows/register.js';
import { signInFlow, callApiFlow } from './flows/sign-in.js';
import { testProxyFlow } from './flows/test-proxy.js';
import { hasWallet, getAddress } from '@buildersgarden/siwa/keystore';
import { isRegistered, readIdentity } from '@buildersgarden/siwa/identity';
import { config, getKeystoreConfig } from './config.js';

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
  console.log('  create-wallet  Create wallet via keyring proxy, write address to IDENTITY.md');
  console.log('  register       Mock-register the agent (write mock data to IDENTITY.md)');
  console.log('  sign-in        Full SIWA flow against the local server');
  console.log('  call-api       Make an authenticated call using SIWA');
  console.log('  full-flow      Run all steps sequentially');
  console.log('  status         Print current IDENTITY.md state + keystore status');
  console.log('  test-proxy     Run keyring proxy tests (requires running proxy server)');
  console.log('');
}

async function statusCommand(): Promise<void> {
  const kc = getKeystoreConfig();
  const identity = readIdentity(config.identityPath);
  const walletExists = await hasWallet(kc);
  const address = walletExists ? await getAddress(kc) : null;

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
  let token: string | null = null;
  try {
    token = await signInFlow();
  } catch (err: any) {
    console.log(chalk.red(`\u{274C} Sign-in failed: ${err.message}`));
    return;
  }
  console.log('');
  await sleep(1000);

  // Step 4
  console.log(chalk.bold('Step 4/4: Authenticated API Call'));
  console.log('\u{2500}'.repeat(33));
  if (token) {
    try {
      console.log(chalk.cyan(`\u{1F310} POST /api/agent-action`));
      const res = await fetch(`${config.serverUrl}/api/agent-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'test', data: { hello: 'world' } }),
      });
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
    console.log(chalk.red(`\u{274C} No token available (sign-in failed)`));
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
