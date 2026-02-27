/**
 * test-openfort-standalone.ts
 *
 * Standalone verification script for the Openfort SIWA signer.
 *
 * Requires env vars:
 *   OPENFORT_PROJECT_PUBLISHABLE_KEY       — Openfort API secret key (sk_test_...)
 *   OPENFORT_WALLET_SECRET                 — Wallet secret for signing
 *   OPENFORT_BACKEND_WALLET_ACCOUNT_ID     — Openfort account ID (acc_...)
 *
 */

import 'dotenv/config';
import chalk from 'chalk';
import { isAddress, verifyMessage, type Address, type Hex } from 'viem';
import { createOpenfortSiwaSigner } from '@buildersgarden/siwa/signer';
import { signSIWAMessage, generateNonce } from '@buildersgarden/siwa';


const OPENFORT_PROJECT_PUBLISHABLE_KEY = process.env.OPENFORT_PROJECT_PUBLISHABLE_KEY;
const OPENFORT_WALLET_SECRET = process.env.OPENFORT_WALLET_SECRET;
const OPENFORT_BACKEND_WALLET_ACCOUNT_ID = process.env.OPENFORT_BACKEND_WALLET_ACCOUNT_ID;

if (!OPENFORT_PROJECT_PUBLISHABLE_KEY || !OPENFORT_WALLET_SECRET || !OPENFORT_BACKEND_WALLET_ACCOUNT_ID) {
  console.error(chalk.red('Missing required env vars: OPENFORT_PROJECT_PUBLISHABLE_KEY, OPENFORT_WALLET_SECRET, OPENFORT_BACKEND_WALLET_ACCOUNT_ID'));
  process.exit(1);
}

// Test helpers 

let passed = 0;
let failed = 0;
const errors: string[] = [];

function pass(label: string) {
  passed++;
  console.log(chalk.green(`  ✅ ${label}`));
}

function fail(label: string, detail?: string) {
  failed++;
  const msg = detail ? `${label}: ${detail}` : label;
  errors.push(msg);
  console.log(chalk.red(`  ❌ ${label}`));
  if (detail) console.log(chalk.dim(`     ${detail}`));
}

// Tests

async function main() {
  console.log(chalk.bold.cyan('\n Openfort SIWA Signer — Standalone Test\n'));
  console.log(chalk.dim(`Account: ${OPENFORT_BACKEND_WALLET_ACCOUNT_ID}`));
  console.log(chalk.dim(`API Key: ${OPENFORT_PROJECT_PUBLISHABLE_KEY!.slice(0, 12)}...`));

  // 1. Create signer
  let signer: Awaited<ReturnType<typeof createOpenfortSiwaSigner>>;
  try {
    signer = await createOpenfortSiwaSigner({
      apiKey: OPENFORT_PROJECT_PUBLISHABLE_KEY!,
      walletSecret: OPENFORT_WALLET_SECRET!,
      accountId: OPENFORT_BACKEND_WALLET_ACCOUNT_ID!,
    });
    pass('createOpenfortSiwaSigner() — signer created');
  } catch (err: any) {
    fail('createOpenfortSiwaSigner()', err.message);
    printSummary();
    return;
  }

  // 2. Get wallet address
  let address: Address;
  try {
    address = await signer.getAddress();
    if (isAddress(address)) {
      pass(`getAddress() → ${address}`);
    } else {
      fail('getAddress()', `Invalid address: ${address}`);
      printSummary();
      return;
    }
  } catch (err: any) {
    fail('getAddress()', err.message);
    printSummary();
    return;
  }

  // 3. Sign a SIWA message and verify the signature
  try {
    const nonce = generateNonce();
    const { message, signature, address: signerAddr } = await signSIWAMessage(
      {
        domain: 'test.openfort.xyz',
        statement: 'Openfort signer standalone test',
        uri: 'https://test.openfort.xyz/verify',
        agentId: 1,
        agentRegistry: 'eip155:84532:0x8004AA63c570c570eBF15376c0dB199918BFe9Fb',
        chainId: 84532,
        nonce,
        issuedAt: new Date().toISOString(),
      },
      signer,
    );

    const valid = await verifyMessage({
      address: signerAddr as Address,
      message,
      signature: signature as Hex,
    });

    if (valid) {
      pass('signSIWAMessage() + verifyMessage() — signature valid');
    } else {
      fail('signSIWAMessage()', 'Signature verification failed');
    }
  } catch (err: any) {
    fail('signSIWAMessage()', err.message);
  }

  // 4. Sign a plain message and verify
  try {
    const msg = 'Hello from Openfort signer test';
    const signature = await signer.signMessage(msg);

    const valid = await verifyMessage({
      address,
      message: msg,
      signature: signature as Hex,
    });

    if (valid) {
      pass('signMessage() + verifyMessage() — plain message signature valid');
    } else {
      fail('signMessage()', 'Plain message signature verification failed');
    }
  } catch (err: any) {
    fail('signMessage()', err.message);
  }

  // 5. signRawMessage for ERC-8128 compatibility
  try {
    if (!signer.signRawMessage) {
      fail('signRawMessage()', 'Method not implemented on signer');
    } else {
      const rawHex: Hex = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const signature = await signer.signRawMessage(rawHex);
      if (signature && signature.startsWith('0x') && signature.length > 2) {
        pass(`signRawMessage() → ${signature.slice(0, 20)}... (ERC-8128 compatible)`);
      } else {
        fail('signRawMessage()', `Unexpected result: ${signature}`);
      }
    }
  } catch (err: any) {
    fail('signRawMessage()', err.message);
  }

  printSummary();
}

function printSummary() {
  console.log(chalk.bold(`\n${'═'.repeat(47)}`));
  console.log(chalk.bold(`Results: ${passed} passed, ${failed} failed`));
  console.log(chalk.bold('═'.repeat(47)));

  if (failed === 0) {
    console.log(chalk.green.bold('\n✅ All Openfort signer tests passed!\n'));
  } else {
    console.log(chalk.red.bold(`\n❌ ${failed} test(s) failed:\n`));
    for (const err of errors) {
      console.log(chalk.red(`   • ${err}`));
    }
    console.log('');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
