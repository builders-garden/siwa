import chalk from 'chalk';
import { isAddress, verifyMessage, parseTransaction, type Hex, type Address } from 'viem';
import {
  hasWallet, getAddress, createWallet, signAuthorization,
} from '@buildersgarden/siwa/keystore';
import { createKeyringProxySigner } from '@buildersgarden/siwa/signer';
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
    // Wallet may already exist from previous runs - that's OK
    if (err.message.includes('already exists')) {
      pass('createWallet() via proxy (wallet already exists)');
    } else {
      fail('createWallet() via proxy', err.message);
    }
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

  // Create signer for signing tests
  const signer = createKeyringProxySigner({
    proxyUrl: kc.proxyUrl,
    proxySecret: kc.proxySecret,
  });

  // ── Test 5: signer.signMessage() via proxy + verify ───────────────
  const testMessage = 'ERC-8004 proxy signing test';
  try {
    const signature = await signer.signMessage(testMessage);
    const address = await signer.getAddress();
    const isValid = await verifyMessage({
      address: address as Address,
      message: testMessage,
      signature: signature as Hex,
    });
    if (isValid) {
      pass('signer.signMessage() via proxy \u{2192} signature verified');
    } else {
      fail('signer.signMessage() via proxy', `Signature verification failed for ${address}`);
    }
  } catch (err: any) {
    fail('signer.signMessage() via proxy', err.message);
  }

  // ── Test 6a: signer.signTransaction() — legacy tx ─────────────────
  try {
    const legacyTx = {
      to: '0x0000000000000000000000000000000000000000' as Address,
      value: BigInt(0),
      nonce: 0,
      chainId: 1,
      gasPrice: BigInt(20000000000),
      gas: BigInt(21000),
    };

    const signedTx = await signer.signTransaction(legacyTx);
    if (signedTx && signedTx.startsWith('0x')) {
      const parsed = parseTransaction(signedTx as Hex);
      if (parsed.to?.toLowerCase() !== legacyTx.to.toLowerCase()) {
        fail('signer.signTransaction() legacy', `Parsed tx has wrong 'to' address`);
      } else if (parsed.type !== 'legacy') {
        fail('signer.signTransaction() legacy', `Expected type 'legacy', got '${parsed.type}'`);
      } else {
        pass(`signer.signTransaction() legacy \u{2192} valid signed tx (type=${parsed.type})`);
      }
    } else {
      fail('signer.signTransaction() legacy', `Invalid signedTx: ${signedTx}`);
    }
  } catch (err: any) {
    fail('signer.signTransaction() legacy', err.message);
  }

  // ── Test 6b: signer.signTransaction() — EIP-1559 tx ───────────────
  try {
    const eip1559Tx = {
      to: '0x0000000000000000000000000000000000000001' as Address,
      value: BigInt(0),
      nonce: 0,
      chainId: 1,
      type: 2,
      maxFeePerGas: BigInt(1000000000),
      maxPriorityFeePerGas: BigInt(1000000),
      gas: BigInt(21000),
    };

    const signedTx = await signer.signTransaction(eip1559Tx);
    if (signedTx && signedTx.startsWith('0x')) {
      const parsed = parseTransaction(signedTx as Hex);
      if (parsed.to?.toLowerCase() !== eip1559Tx.to.toLowerCase()) {
        fail('signer.signTransaction() EIP-1559', `Parsed tx has wrong 'to' address`);
      } else if (parsed.type !== 'eip1559') {
        fail('signer.signTransaction() EIP-1559', `Expected type 'eip1559', got '${parsed.type}'`);
      } else if (parsed.maxFeePerGas !== eip1559Tx.maxFeePerGas) {
        fail('signer.signTransaction() EIP-1559', `maxFeePerGas mismatch: ${parsed.maxFeePerGas}`);
      } else {
        pass(`signer.signTransaction() EIP-1559 \u{2192} valid signed tx (type=${parsed.type})`);
      }
    } else {
      fail('signer.signTransaction() EIP-1559', `Invalid signedTx: ${signedTx}`);
    }
  } catch (err: any) {
    fail('signer.signTransaction() EIP-1559', err.message);
  }

  // ── Test 7: signAuthorization() via proxy (EIP-7702) ───────────────
  try {
    const testAuth = {
      address: '0x0000000000000000000000000000000000000001',
      chainId: 1,
      nonce: 0,
    };

    const result = await signAuthorization(testAuth, kc);
    if (
      result.chainId !== undefined &&
      result.nonce !== undefined &&
      result.r &&
      result.s &&
      result.yParity !== undefined
    ) {
      pass(`signAuthorization() via proxy \u{2192} valid signed authorization`);
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
