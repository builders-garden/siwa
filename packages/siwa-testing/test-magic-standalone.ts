/**
 * test-magic-standalone.ts
 *
 * Standalone verification script for the Magic SIWA signer.
 *
 * Requires env vars:
 *   MAGIC_SECRET_KEY    — Magic secret key (sk-live-...)
 *   MAGIC_PROVIDER_ID   — OIDC Provider ID from Magic dashboard
 *   MAGIC_JWT           — Valid JWT from the OIDC provider
 */

import 'dotenv/config';
import chalk from 'chalk';
import { isAddress, verifyMessage, type Address, type Hex } from 'viem';
import { createMagicSiwaSigner } from '@buildersgarden/siwa/signer';
import { signSIWAMessage, generateNonce } from '@buildersgarden/siwa';

const MAGIC_SECRET_KEY = process.env.MAGIC_SECRET_KEY;
const MAGIC_PROVIDER_ID = process.env.MAGIC_PROVIDER_ID;
const MAGIC_JWT = process.env.MAGIC_JWT;

if (!MAGIC_SECRET_KEY || !MAGIC_PROVIDER_ID || !MAGIC_JWT) {
  console.error(chalk.red('Missing required env vars: MAGIC_SECRET_KEY, MAGIC_PROVIDER_ID, MAGIC_JWT'));
  process.exit(1);
}

// Test helpers

let passed = 0;
let failed = 0;
const errors: string[] = [];

function pass(label: string) {
  passed++;
  console.log(chalk.green(`  \u2705 ${label}`));
}

function fail(label: string, detail?: string) {
  failed++;
  const msg = detail ? `${label}: ${detail}` : label;
  errors.push(msg);
  console.log(chalk.red(`  \u274C ${label}`));
  if (detail) console.log(chalk.dim(`     ${detail}`));
}

// Tests

async function main() {
  console.log(chalk.bold.cyan('\n Magic SIWA Signer \u2014 Standalone Test\n'));
  console.log(chalk.dim(`Secret Key: ${MAGIC_SECRET_KEY!.slice(0, 12)}...`));
  console.log(chalk.dim(`Provider:   ${MAGIC_PROVIDER_ID}`));
  console.log(chalk.dim(`JWT:        ${MAGIC_JWT!.slice(0, 20)}...`));

  // 1. Create signer (this also fetches/creates the wallet)
  let signer: Awaited<ReturnType<typeof createMagicSiwaSigner>>;
  try {
    signer = await createMagicSiwaSigner({
      secretKey: MAGIC_SECRET_KEY!,
      jwt: MAGIC_JWT!,
      providerId: MAGIC_PROVIDER_ID!,
    });
    pass('createMagicSiwaSigner() \u2014 signer created');
  } catch (err: any) {
    fail('createMagicSiwaSigner()', err.message);
    printSummary();
    return;
  }

  // 2. Get wallet address
  let address: Address;
  try {
    address = await signer.getAddress();
    if (isAddress(address)) {
      pass(`getAddress() \u2192 ${address}`);
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
        domain: 'test.magic.link',
        statement: 'Magic signer standalone test',
        uri: 'https://test.magic.link/verify',
        agentId: 1,
        agentRegistry: 'eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e',
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
      pass('signSIWAMessage() + verifyMessage() \u2014 signature valid');
    } else {
      fail('signSIWAMessage()', 'Signature verification failed');
    }
  } catch (err: any) {
    fail('signSIWAMessage()', err.message);
  }

  // 4. Sign a plain message and verify
  try {
    const msg = 'Hello from Magic signer test';
    const signature = await signer.signMessage(msg);

    const valid = await verifyMessage({
      address,
      message: msg,
      signature: signature as Hex,
    });

    if (valid) {
      pass('signMessage() + verifyMessage() \u2014 plain message signature valid');
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
        pass(`signRawMessage() \u2192 ${signature.slice(0, 20)}... (ERC-8128 compatible)`);
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
  console.log(chalk.bold(`\n${'\u2550'.repeat(47)}`));
  console.log(chalk.bold(`Results: ${passed} passed, ${failed} failed`));
  console.log(chalk.bold('\u2550'.repeat(47)));

  if (failed === 0) {
    console.log(chalk.green.bold('\n\u2705 All Magic signer tests passed!\n'));
  } else {
    console.log(chalk.red.bold(`\n\u274C ${failed} test(s) failed:\n`));
    for (const err of errors) {
      console.log(chalk.red(`   \u2022 ${err}`));
    }
    console.log('');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
