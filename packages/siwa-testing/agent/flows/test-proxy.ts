import chalk from 'chalk';
import { ethers } from 'ethers';
import {
  hasWallet, getAddress, signMessage, getSigner, createWallet,
} from '@buildersgarden/siwa/keystore';
import { computeHmac } from '@buildersgarden/siwa/proxy-auth';
import { config, getKeystoreConfig } from '../config.js';

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

export async function testProxyFlow(): Promise<boolean> {
  console.log(chalk.bold('Keyring Proxy Tests'));
  console.log('\u{2500}'.repeat(40));

  const kc = getKeystoreConfig();

  if (kc.backend !== 'proxy') {
    fail('Backend check', `Expected "proxy", got "${kc.backend}". Set KEYSTORE_BACKEND=proxy`);
    return false;
  }

  const proxyUrl = kc.proxyUrl || process.env.KEYRING_PROXY_URL;
  if (!proxyUrl) {
    fail('Config check', 'KEYRING_PROXY_URL is not set');
    return false;
  }

  // ── Test 1: Proxy health check ────────────────────────────────────
  try {
    const res = await fetch(`${proxyUrl}/health`);
    const data = await res.json() as any;
    if (data.status === 'ok') {
      pass(`Proxy health check (backend: ${data.backend})`);
    } else {
      fail('Proxy health check', JSON.stringify(data));
    }
  } catch (err: any) {
    fail('Proxy health check', `Cannot reach ${proxyUrl}: ${err.message}`);
    return false;
  }

  // ── Test 2: createWallet() via proxy ──────────────────────────────
  let createdAddress: string | null = null;
  try {
    const info = await createWallet(kc);
    createdAddress = info.address;
    if (ethers.isAddress(createdAddress)) {
      pass(`createWallet() via proxy \u{2192} ${createdAddress}`);
    } else {
      fail('createWallet() via proxy', `Invalid address: ${createdAddress}`);
    }
  } catch (err: any) {
    fail('createWallet() via proxy', err.message);
  }

  // ── Test 3: hasWallet() via proxy ─────────────────────────────────
  try {
    const exists = await hasWallet(kc);
    if (exists) {
      pass('hasWallet() via proxy returns true');
    } else {
      fail('hasWallet() via proxy', 'Returned false');
    }
  } catch (err: any) {
    fail('hasWallet() via proxy', err.message);
  }

  // ── Test 4: getAddress() via proxy ────────────────────────────────
  try {
    const address = await getAddress(kc);
    if (address && ethers.isAddress(address)) {
      pass(`getAddress() via proxy \u{2192} ${address}`);
    } else {
      fail('getAddress() via proxy', `Got: ${address}`);
    }
  } catch (err: any) {
    fail('getAddress() via proxy', err.message);
  }

  // ── Test 5: signMessage() via proxy + verify recovered address ────
  const testMessage = 'ERC-8004 proxy signing test';
  try {
    const result = await signMessage(testMessage, kc);
    const recovered = ethers.verifyMessage(testMessage, result.signature);
    if (recovered.toLowerCase() === result.address.toLowerCase()) {
      pass('signMessage() via proxy \u{2192} signature recovers to correct address');
    } else {
      fail('signMessage() via proxy', `Recovered ${recovered}, expected ${result.address}`);
    }
  } catch (err: any) {
    fail('signMessage() via proxy', err.message);
  }

  // ── Test 6: HMAC rejection with wrong secret ──────────────────────
  try {
    const wrongSecret = 'definitely-wrong-secret';
    const bodyStr = JSON.stringify({ message: 'test' });
    const hmacHeaders = computeHmac(wrongSecret, 'POST', '/sign-message', bodyStr);

    const res = await fetch(`${proxyUrl}/sign-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...hmacHeaders,
      },
      body: bodyStr,
    });

    if (res.status === 401) {
      pass('HMAC rejection with wrong secret (401)');
    } else {
      fail('HMAC rejection with wrong secret', `Expected 401, got ${res.status}`);
    }
  } catch (err: any) {
    fail('HMAC rejection with wrong secret', err.message);
  }

  // ── Test 7: getSigner() throws for proxy backend ──────────────────
  try {
    const fakeProvider = new ethers.JsonRpcProvider('http://localhost:1234');
    await getSigner(fakeProvider, kc);
    fail('getSigner() throws for proxy', 'Did not throw');
  } catch (err: any) {
    if (err.message.includes('not supported via proxy')) {
      pass('getSigner() throws for proxy backend');
    } else {
      fail('getSigner() throws for proxy', `Unexpected error: ${err.message}`);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────
  console.log('');
  console.log(chalk.bold(`Results: ${passed} passed, ${failed} failed`));

  if (failed === 0) {
    console.log(chalk.green.bold('\u{2705} All proxy tests passed'));
  } else {
    console.log(chalk.red.bold(`\u{274C} ${failed} test(s) failed`));
  }

  return failed === 0;
}
