import chalk from 'chalk';
import { isAddress, verifyMessage, parseTransaction, recoverAddress, keccak256, type Hex, type Address } from 'viem';
import {
  hasWallet, getAddress, signMessage, signTransaction, signAuthorization, createWallet,
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
    if (isAddress(createdAddress)) {
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
    if (address && isAddress(address)) {
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
    const isValid = await verifyMessage({
      address: result.address as Address,
      message: testMessage,
      signature: result.signature as Hex,
    });
    if (isValid) {
      pass('signMessage() via proxy \u{2192} signature recovers to correct address');
    } else {
      fail('signMessage() via proxy', `Signature verification failed for ${result.address}`);
    }
  } catch (err: any) {
    fail('signMessage() via proxy', err.message);
  }

  // ── Test 6: signTransaction() via proxy ─────────────────────────────
  try {
    const testTx = {
      to: '0x0000000000000000000000000000000000000000' as Address,
      value: BigInt(0),
      nonce: 0,
      chainId: 1,
      gasPrice: BigInt(20000000000),
      gas: BigInt(21000),
    };

    const result = await signTransaction(testTx, kc);
    if (result.signedTx && result.signedTx.startsWith('0x')) {
      // Parse the signed transaction to verify it's valid
      const parsed = parseTransaction(result.signedTx as Hex);
      if (parsed.to?.toLowerCase() === testTx.to.toLowerCase()) {
        pass(`signTransaction() via proxy → valid signed tx`);
      } else {
        fail('signTransaction() via proxy', `Parsed tx has wrong 'to' address`);
      }
    } else {
      fail('signTransaction() via proxy', `Invalid signedTx: ${result.signedTx}`);
    }
  } catch (err: any) {
    fail('signTransaction() via proxy', err.message);
  }

  // ── Test 7: signAuthorization() via proxy (EIP-7702) ───────────────
  try {
    const testAuth = {
      address: '0x0000000000000000000000000000000000000001',
      chainId: 1,
      nonce: 0,
    };

    const result = await signAuthorization(testAuth, kc);
    // Check that the result has the expected EIP-7702 fields
    if (
      result.chainId !== undefined &&
      result.nonce !== undefined &&
      result.r &&
      result.s &&
      result.yParity !== undefined
    ) {
      pass(`signAuthorization() via proxy → valid signed authorization`);
    } else {
      fail('signAuthorization() via proxy', `Missing fields in result: ${JSON.stringify(result)}`);
    }
  } catch (err: any) {
    fail('signAuthorization() via proxy', err.message);
  }

  // ── Test 8: HMAC rejection with wrong secret ──────────────────────
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
