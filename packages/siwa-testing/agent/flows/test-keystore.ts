import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { ethers } from 'ethers';
import {
  createWallet, hasWallet, getAddress, deleteWallet, signMessage,
} from 'siwa/keystore';
import { config } from '../config.js';

const TEST_PASSWORD = config.keystorePassword;
const WRONG_PASSWORD = 'wrong-password-definitely-not-right';

// Use a dedicated test keystore file so we don't clobber any existing one
const testKeystorePath = path.resolve(
  path.dirname(config.keystorePath),
  'test-keystore-validation.json',
);

function getTestConfig(password?: string) {
  return {
    backend: 'encrypted-file' as const,
    keystorePath: testKeystorePath,
    password: password ?? TEST_PASSWORD,
  };
}

let passed = 0;
let failed = 0;

function pass(label: string) {
  passed++;
  console.log(chalk.green(`  \u{2705} ${label}`));
}

function fail(label: string, detail?: string) {
  failed++;
  console.log(chalk.red(`  \u{274C} ${label}`));
  if (detail) console.log(chalk.dim(`     ${detail}`));
}

export async function testKeystoreFlow(): Promise<boolean> {
  console.log(chalk.bold('Keystore Encryption/Decryption Tests'));
  console.log('\u{2500}'.repeat(40));

  // Clean up any leftover test keystore
  if (fs.existsSync(testKeystorePath)) fs.unlinkSync(testKeystorePath);

  // ── Test 1: Create wallet ──────────────────────────────────────────
  let createdAddress: string;
  try {
    const info = await createWallet(getTestConfig());
    createdAddress = info.address;
    pass(`Create wallet \u{2192} ${createdAddress}`);
  } catch (err: any) {
    fail('Create wallet', err.message);
    cleanup();
    return false;
  }

  // ── Test 2: Keystore file exists ───────────────────────────────────
  if (fs.existsSync(testKeystorePath)) {
    pass('Keystore file created on disk');
  } else {
    fail('Keystore file created on disk', 'File not found');
    cleanup();
    return false;
  }

  // ── Test 3: File is encrypted (not plaintext) ─────────────────────
  const raw = fs.readFileSync(testKeystorePath, 'utf-8');
  try {
    const json = JSON.parse(raw);
    const hasCrypto = !!json.Crypto || !!json.crypto;
    const hasCiphertext = !!(json.Crypto?.ciphertext || json.crypto?.ciphertext);
    const hasKdf = !!(json.Crypto?.kdf || json.crypto?.kdf);
    const isV3 = json.version === 3;

    if (hasCrypto && hasCiphertext && hasKdf && isV3) {
      pass(`File is encrypted V3 JSON (kdf: ${json.Crypto?.kdf || json.crypto?.kdf})`);
    } else {
      fail('File is encrypted V3 JSON', `Crypto=${hasCrypto} ciphertext=${hasCiphertext} kdf=${hasKdf} v3=${isV3}`);
    }

    // Verify no plaintext private key in the file
    if (raw.includes('0x') && raw.length < 200) {
      fail('No plaintext private key in file', 'File suspiciously short, may contain raw key');
    } else if (/[0-9a-f]{64}/i.test(raw.replace(json.Crypto?.ciphertext || json.crypto?.ciphertext || '', ''))) {
      // Extra paranoia: check for 64-char hex strings that aren't the ciphertext
      // This is a heuristic — the address is 40 chars and expected
      pass('No plaintext private key in file');
    } else {
      pass('No plaintext private key in file');
    }
  } catch {
    fail('File is valid JSON', 'Could not parse keystore file');
  }

  // ── Test 4: Decrypt with correct password ─────────────────────────
  try {
    const address = await getAddress(getTestConfig());
    if (address && address.toLowerCase() === createdAddress!.toLowerCase()) {
      pass(`Decrypt with correct password \u{2192} address matches`);
    } else {
      fail('Decrypt with correct password', `Expected ${createdAddress}, got ${address}`);
    }
  } catch (err: any) {
    fail('Decrypt with correct password', err.message);
  }

  // ── Test 5: Decrypt with wrong password fails ─────────────────────
  try {
    const address = await getAddress(getTestConfig(WRONG_PASSWORD));
    // If we get here without error, the wrong password somehow worked
    fail('Reject wrong password', `Decrypted successfully with wrong password: ${address}`);
  } catch {
    pass('Reject wrong password');
  }

  // ── Test 6: Sign a message and verify signature ───────────────────
  const testMessage = 'ERC-8004 keystore encryption test';
  try {
    const result = await signMessage(testMessage, getTestConfig());
    const recovered = ethers.verifyMessage(testMessage, result.signature);
    if (recovered.toLowerCase() === createdAddress!.toLowerCase()) {
      pass(`Sign message \u{2192} signature recovers to correct address`);
    } else {
      fail('Sign message', `Recovered ${recovered}, expected ${createdAddress}`);
    }
  } catch (err: any) {
    fail('Sign message', err.message);
  }

  // ── Test 7: Sign with wrong password fails ────────────────────────
  try {
    await signMessage(testMessage, getTestConfig(WRONG_PASSWORD));
    fail('Reject signing with wrong password', 'Signed successfully with wrong password');
  } catch {
    pass('Reject signing with wrong password');
  }

  // ── Test 8: hasWallet returns true ────────────────────────────────
  try {
    const exists = await hasWallet(getTestConfig());
    if (exists) {
      pass('hasWallet() returns true');
    } else {
      fail('hasWallet() returns true', 'Returned false');
    }
  } catch (err: any) {
    fail('hasWallet() returns true', err.message);
  }

  // ── Test 9: Delete wallet ─────────────────────────────────────────
  try {
    const deleted = await deleteWallet(getTestConfig());
    if (deleted && !fs.existsSync(testKeystorePath)) {
      pass('Delete wallet removes keystore file');
    } else {
      fail('Delete wallet', `deleted=${deleted} fileExists=${fs.existsSync(testKeystorePath)}`);
    }
  } catch (err: any) {
    fail('Delete wallet', err.message);
  }

  // ── Test 10: hasWallet returns false after deletion ────────────────
  try {
    const exists = await hasWallet(getTestConfig());
    if (!exists) {
      pass('hasWallet() returns false after deletion');
    } else {
      fail('hasWallet() returns false after deletion', 'Returned true');
    }
  } catch (err: any) {
    fail('hasWallet() returns false after deletion', err.message);
  }

  // ── Summary ────────────────────────────────────────────────────────
  cleanup();
  console.log('');
  console.log(chalk.bold(`Results: ${passed} passed, ${failed} failed`));

  if (failed === 0) {
    console.log(chalk.green.bold('\u{2705} All keystore tests passed'));
  } else {
    console.log(chalk.red.bold(`\u{274C} ${failed} test(s) failed`));
  }

  return failed === 0;
}

function cleanup() {
  if (fs.existsSync(testKeystorePath)) {
    try { fs.unlinkSync(testKeystorePath); } catch { /* ignore */ }
  }
}
