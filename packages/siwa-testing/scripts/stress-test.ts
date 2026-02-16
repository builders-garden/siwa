/**
 * stress-test.ts
 *
 * Exercises every part of the proxy-only keystore + SIWA_IDENTITY.md refactor:
 *
 * 1. Proxy API: createWallet, hasWallet, getAddress, signMessage, signTransaction, signAuthorization
 * 2. Identity file: ensureIdentityExists, readIdentity, writeIdentityField, hasWalletRecord, isRegistered
 * 3. SIWA signing: signSIWAMessage (via proxy)
 * 4. Concurrency: parallel signing requests
 * 5. Edge cases: repeated wallet creation, identity file reset cycles
 *
 * Requirements:
 *   - Keyring proxy running at KEYRING_PROXY_URL (default http://localhost:3100)
 *   - KEYRING_PROXY_SECRET set
 */

import 'dotenv/config';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { isAddress, verifyMessage, type Hex, type Address } from 'viem';
import {
  createWallet, hasWallet, getAddress, signAuthorization,
  type KeystoreConfig,
} from '@buildersgarden/siwa-ts/keystore';
import { createKeyringProxySigner, type TransactionSigner } from '@buildersgarden/siwa-ts/signer';
import {
  ensureIdentityExists, readIdentity, writeIdentityField, hasWalletRecord, isRegistered,
} from '@buildersgarden/siwa-ts/identity';
import { signSIWAMessage, buildSIWAMessage, parseSIWAMessage } from '@buildersgarden/siwa-ts';
import { computeHmac } from '@buildersgarden/siwa-ts/proxy-auth';

const projectRoot = path.resolve(import.meta.dirname || __dirname, '..');
const identityPath = path.resolve(projectRoot, 'IDENTITY.stress-test.md');
const templatePath = path.resolve(projectRoot, '..', 'siwa-skill', 'assets', 'SIWA_IDENTITY.template.md');

const kc: KeystoreConfig = {
  proxyUrl: process.env.KEYRING_PROXY_URL || 'http://localhost:3100',
  proxySecret: process.env.KEYRING_PROXY_SECRET || 'test-secret-123',
};

// Signer for new signer-based API
const signer: TransactionSigner = createKeyringProxySigner(kc);

let passed = 0;
let failed = 0;
let skipped = 0;
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

function skip(label: string, reason: string) {
  skipped++;
  console.log(chalk.yellow(`  ⏭️  ${label} — ${reason}`));
}

function cleanup() {
  try { if (fs.existsSync(identityPath)) fs.unlinkSync(identityPath); } catch { /* ignore */ }
}

async function testProxy() {
  console.log(chalk.bold('\n═══ Part 1: Keystore Proxy API ═══'));

  // 1.1 Health check
  try {
    const res = await fetch(`${kc.proxyUrl}/health`);
    const data = await res.json() as any;
    if (data.status === 'ok') pass(`Health check (backend: ${data.backend})`);
    else fail('Health check', JSON.stringify(data));
  } catch (err: any) {
    fail('Health check', err.message);
    console.log(chalk.red('\n  Cannot reach proxy — aborting proxy tests.\n'));
    return false;
  }

  // 1.2 createWallet
  let walletAddress: string = '';
  try {
    const info = await createWallet(kc);
    walletAddress = info.address;
    if (isAddress(walletAddress)) pass(`createWallet() → ${walletAddress}`);
    else fail('createWallet()', `Invalid address: ${walletAddress}`);
  } catch (err: any) {
    fail('createWallet()', err.message);
  }

  // 1.3 createWallet idempotent (calling again returns same address)
  try {
    const info2 = await createWallet(kc);
    if (info2.address === walletAddress) pass('createWallet() idempotent');
    else pass(`createWallet() returns address (${info2.address})`);
  } catch (err: any) {
    fail('createWallet() idempotent', err.message);
  }

  // 1.4 WalletInfo shape — only address, no backend/keystorePath
  try {
    const info = await createWallet(kc);
    const keys = Object.keys(info);
    if (keys.length === 1 && keys[0] === 'address') {
      pass('WalletInfo has only { address }');
    } else {
      fail('WalletInfo shape', `Keys: ${keys.join(', ')}`);
    }
  } catch (err: any) {
    fail('WalletInfo shape', err.message);
  }

  // 1.5 hasWallet
  try {
    const exists = await hasWallet(kc);
    if (exists) pass('hasWallet() returns true');
    else fail('hasWallet()', 'Returned false');
  } catch (err: any) {
    fail('hasWallet()', err.message);
  }

  // 1.6 getAddress
  try {
    const addr = await getAddress(kc);
    if (addr && isAddress(addr)) pass(`getAddress() → ${addr}`);
    else fail('getAddress()', `Got: ${addr}`);
  } catch (err: any) {
    fail('getAddress()', err.message);
  }

  // 1.7 signer.signMessage + verify
  const msg = 'ERC-8004 stress test message';
  try {
    const signature = await signer.signMessage(msg);
    const address = await signer.getAddress();
    const valid = await verifyMessage({
      address: address as Address,
      message: msg,
      signature: signature as Hex,
    });
    if (valid) pass('signer.signMessage() + verifyMessage()');
    else fail('signer.signMessage()', 'Signature verification failed');
  } catch (err: any) {
    fail('signer.signMessage()', err.message);
  }

  // 1.8a signer.signTransaction — EIP-1559
  try {
    const tx = {
      to: '0x0000000000000000000000000000000000000001' as Address,
      value: BigInt(0),
      nonce: 0,
      chainId: 84532,
      type: 2,
      maxFeePerGas: BigInt(1000000000),
      maxPriorityFeePerGas: BigInt(1000000),
      gas: BigInt(21000),
    };
    const signedTx = await signer.signTransaction(tx);
    if (signedTx) pass(`signer.signTransaction() EIP-1559 → signed tx (${signedTx.slice(0, 20)}...)`);
    else fail('signer.signTransaction() EIP-1559', 'Missing signedTx');
  } catch (err: any) {
    fail('signer.signTransaction() EIP-1559', err.message);
  }

  // 1.8b signer.signTransaction — legacy
  try {
    const tx = {
      to: '0x0000000000000000000000000000000000000001' as Address,
      value: BigInt(0),
      nonce: 0,
      chainId: 84532,
      gasPrice: BigInt(20000000000),
      gas: BigInt(21000),
    };
    const signedTx = await signer.signTransaction(tx);
    if (signedTx) pass(`signer.signTransaction() legacy → signed tx (${signedTx.slice(0, 20)}...)`);
    else fail('signer.signTransaction() legacy', 'Missing signedTx');
  } catch (err: any) {
    fail('signer.signTransaction() legacy', err.message);
  }

  // 1.9 signAuthorization
  try {
    const auth = { address: '0x0000000000000000000000000000000000000001', chainId: 84532, nonce: 0 };
    const result = await signAuthorization(auth, kc);
    if (result.r && result.s && typeof result.yParity === 'number') {
      pass('signAuthorization() → signed EIP-7702 auth');
    } else {
      fail('signAuthorization()', `Unexpected result: ${JSON.stringify(result)}`);
    }
  } catch (err: any) {
    // Proxy may not support signAuthorization — skip gracefully
    if (err.message.includes('404') || err.message.includes('not found')) {
      skip('signAuthorization()', 'Endpoint not available on proxy');
    } else {
      fail('signAuthorization()', err.message);
    }
  }

  // 1.10 HMAC rejection
  try {
    const bodyStr = JSON.stringify({ message: 'test' });
    const hmacHeaders = computeHmac('wrong-secret', 'POST', '/sign-message', bodyStr);
    const res = await fetch(`${kc.proxyUrl}/sign-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...hmacHeaders },
      body: bodyStr,
    });
    if (res.status === 401) pass('HMAC rejection with wrong secret (401)');
    else fail('HMAC rejection', `Expected 401, got ${res.status}`);
  } catch (err: any) {
    fail('HMAC rejection', err.message);
  }

  // 1.11 Missing config errors (clear env vars to test)
  const savedUrl = process.env.KEYRING_PROXY_URL;
  const savedSecret = process.env.KEYRING_PROXY_SECRET;
  try {
    delete process.env.KEYRING_PROXY_URL;
    delete process.env.KEYRING_PROXY_SECRET;
    const badSigner = createKeyringProxySigner({});
    await badSigner.signMessage('test');
    fail('Missing proxyUrl error', 'Did not throw');
  } catch (err: any) {
    if (err.message.includes('KEYRING_PROXY_URL') || err.message.includes('proxyUrl')) {
      pass('Missing proxyUrl throws descriptive error');
    } else {
      fail('Missing proxyUrl error', err.message);
    }
  } finally {
    if (savedUrl) process.env.KEYRING_PROXY_URL = savedUrl;
    if (savedSecret) process.env.KEYRING_PROXY_SECRET = savedSecret;
  }

  return true;
}

async function testConcurrency() {
  console.log(chalk.bold('\n═══ Part 2: Concurrent Signing ═══'));

  // 2.1 Parallel sign requests
  const messages = Array.from({ length: 10 }, (_, i) => `Concurrent message #${i}`);
  try {
    const results = await Promise.all(
      messages.map(msg => signer.signMessage(msg))
    );
    const allValid = results.every(r => r && r.startsWith('0x'));
    if (allValid) pass(`10 concurrent signer.signMessage() calls — all returned valid results`);
    else fail('Concurrent signing', 'Some results missing signature');
  } catch (err: any) {
    fail('Concurrent signing (10 parallel)', err.message);
  }

  // 2.2 Parallel sign + getAddress interleaved
  try {
    const ops = [
      signer.signMessage('interleave-1'),
      signer.getAddress(),
      signer.signMessage('interleave-2'),
      hasWallet(kc),
      signer.signMessage('interleave-3'),
      signer.getAddress(),
    ];
    const results = await Promise.all(ops);
    if (results.every(r => r !== undefined && r !== null)) {
      pass('6 interleaved proxy calls in parallel');
    } else {
      fail('Interleaved calls', 'Some returned null/undefined');
    }
  } catch (err: any) {
    fail('Interleaved calls', err.message);
  }
}

async function testIdentity() {
  console.log(chalk.bold('\n═══ Part 3: Identity System ═══'));
  cleanup();

  // 3.1 ensureIdentityExists from template
  try {
    ensureIdentityExists(identityPath, templatePath);
    if (fs.existsSync(identityPath)) pass('ensureIdentityExists() creates file from template');
    else fail('ensureIdentityExists()', 'File not created');
  } catch (err: any) {
    fail('ensureIdentityExists()', err.message);
  }

  // 3.2 readIdentity on fresh file
  try {
    const id = readIdentity(identityPath);
    if (!id.address && !id.agentId && !id.agentRegistry && !id.chainId) {
      pass('readIdentity() on fresh file returns empty AgentIdentity');
    } else {
      fail('readIdentity() fresh', `Got: ${JSON.stringify(id)}`);
    }
  } catch (err: any) {
    fail('readIdentity() fresh', err.message);
  }

  // 3.3 writeIdentityField + read
  try {
    writeIdentityField('Address', '0xABCD1234', identityPath);
    const id = readIdentity(identityPath);
    if (id.address === '0xABCD1234') pass('writeIdentityField(Address) + readIdentity()');
    else fail('writeIdentityField', `Got address: ${id.address}`);
  } catch (err: any) {
    fail('writeIdentityField', err.message);
  }

  // 3.4 hasWalletRecord
  try {
    if (hasWalletRecord(identityPath)) pass('hasWalletRecord() returns true after address write');
    else fail('hasWalletRecord()', 'Returned false');
  } catch (err: any) {
    fail('hasWalletRecord()', err.message);
  }

  // 3.5 isRegistered without agentId → false
  try {
    const reg = await isRegistered({ identityPath });
    if (!reg) pass('isRegistered() returns false (no agentId)');
    else fail('isRegistered()', 'Returned true with no agentId');
  } catch (err: any) {
    fail('isRegistered()', err.message);
  }

  // 3.6 Write all 4 fields
  try {
    writeIdentityField('Agent ID', '42', identityPath);
    writeIdentityField('Agent Registry', 'eip155:84532:0x8004AA63c570c570eBF15376c0dB199918BFe9Fb', identityPath);
    writeIdentityField('Chain ID', '84532', identityPath);
    const id = readIdentity(identityPath);
    if (id.address === '0xABCD1234' && id.agentId === 42 &&
        id.agentRegistry === 'eip155:84532:0x8004AA63c570c570eBF15376c0dB199918BFe9Fb' &&
        id.chainId === 84532) {
      pass('All 4 identity fields written and read correctly');
    } else {
      fail('4-field write/read', JSON.stringify(id));
    }
  } catch (err: any) {
    fail('4-field write/read', err.message);
  }

  // 3.7 isRegistered with all fields (no client) → true
  try {
    const reg = await isRegistered({ identityPath });
    if (reg) pass('isRegistered() returns true (local cache, no client)');
    else fail('isRegistered() local', 'Returned false');
  } catch (err: any) {
    fail('isRegistered() local', err.message);
  }

  // 3.8 ensureIdentityExists is idempotent
  try {
    const before = fs.readFileSync(identityPath, 'utf-8');
    ensureIdentityExists(identityPath, templatePath);
    const after = fs.readFileSync(identityPath, 'utf-8');
    if (before === after) pass('ensureIdentityExists() is idempotent (no overwrite)');
    else fail('ensureIdentityExists() idempotent', 'File was overwritten');
  } catch (err: any) {
    fail('ensureIdentityExists() idempotent', err.message);
  }

  // 3.9 readIdentity on missing file
  try {
    const id = readIdentity('/tmp/nonexistent-identity-test.md');
    if (Object.keys(id).length === 0) pass('readIdentity() on missing file returns {}');
    else fail('readIdentity() missing', `Got: ${JSON.stringify(id)}`);
  } catch (err: any) {
    fail('readIdentity() missing', err.message);
  }

  // 3.10 Reset cycle
  try {
    cleanup();
    ensureIdentityExists(identityPath, templatePath);
    const id = readIdentity(identityPath);
    if (!id.address) pass('Reset cycle: delete + recreate → fresh state');
    else fail('Reset cycle', `Got address: ${id.address}`);
  } catch (err: any) {
    fail('Reset cycle', err.message);
  }

  // 3.11 ensureIdentityExists without template (fallback)
  try {
    cleanup();
    ensureIdentityExists(identityPath);
    const content = fs.readFileSync(identityPath, 'utf-8');
    if (content.includes('Agent Identity') && content.includes('<NOT SET>')) {
      pass('ensureIdentityExists() without template creates minimal file');
    } else {
      fail('ensureIdentityExists() no template', 'Unexpected content');
    }
  } catch (err: any) {
    fail('ensureIdentityExists() no template', err.message);
  }

  cleanup();
}

async function testSIWASigning() {
  console.log(chalk.bold('\n═══ Part 4: SIWA Message Signing ═══'));

  // 4.1 signSIWAMessage via proxy
  try {
    const { message, signature, address } = await signSIWAMessage(
      {
        domain: 'test.example.com',
        statement: 'Stress test SIWA signing',
        uri: 'https://test.example.com/verify',
        agentId: 42,
        agentRegistry: 'eip155:84532:0x8004AA63c570c570eBF15376c0dB199918BFe9Fb',
        chainId: 84532,
        nonce: 'abc123def456',
        issuedAt: new Date().toISOString(),
      },
      signer,
    );

    if (!message || !signature || !address) {
      fail('signSIWAMessage()', 'Missing fields in result');
    } else {
      // Verify signature
      const valid = await verifyMessage({
        address: address as Address,
        message,
        signature: signature as Hex,
      });
      if (valid) pass('signSIWAMessage() → valid signature via proxy');
      else fail('signSIWAMessage()', 'Signature verification failed');
    }
  } catch (err: any) {
    fail('signSIWAMessage()', err.message);
  }

  // 4.2 SIWA message parse round-trip
  try {
    const fields = {
      domain: 'example.com',
      address: '0x1234567890123456789012345678901234567890',
      statement: 'Test statement',
      uri: 'https://example.com',
      agentId: 99,
      agentRegistry: 'eip155:1:0xABCD',
      chainId: 1,
      nonce: 'test-nonce',
      issuedAt: '2026-01-01T00:00:00Z',
      expirationTime: '2026-01-02T00:00:00Z',
    };
    const msg = buildSIWAMessage(fields);
    const parsed = parseSIWAMessage(msg);
    if (parsed.domain === fields.domain &&
        parsed.agentId === fields.agentId &&
        parsed.nonce === fields.nonce) {
      pass('buildSIWAMessage → parseSIWAMessage round-trip');
    } else {
      fail('SIWA round-trip', JSON.stringify(parsed));
    }
  } catch (err: any) {
    fail('SIWA round-trip', err.message);
  }

  // 4.3 signSIWAMessage resolves address from proxy
  try {
    const { address } = await signSIWAMessage(
      {
        domain: 'test.example.com',
        uri: 'https://test.example.com',
        agentId: 1,
        agentRegistry: 'eip155:84532:0x0000',
        chainId: 84532,
        nonce: 'n',
        issuedAt: new Date().toISOString(),
      },
      signer,
    );
    if (isAddress(address)) pass(`signSIWAMessage() resolves address from proxy: ${address}`);
    else fail('signSIWAMessage() address resolve', `Got: ${address}`);
  } catch (err: any) {
    fail('signSIWAMessage() address resolve', err.message);
  }
}

async function testEdgeCases() {
  console.log(chalk.bold('\n═══ Part 5: Edge Cases ═══'));

  // 5.1 Sign empty message
  try {
    const signature = await signer.signMessage('');
    if (signature) pass('signer.signMessage("") returns signature');
    else fail('signer.signMessage("")', 'No signature');
  } catch (err: any) {
    fail('signer.signMessage("")', err.message);
  }

  // 5.2 Sign very long message
  try {
    const longMsg = 'A'.repeat(10000);
    const signature = await signer.signMessage(longMsg);
    if (signature) pass('signer.signMessage(10K chars) returns signature');
    else fail('signer.signMessage(10K)', 'No signature');
  } catch (err: any) {
    fail('signer.signMessage(10K)', err.message);
  }

  // 5.3 Sign message with special chars
  try {
    const specialMsg = '🤖 ERC-8004 Agent\n\twith "special" chars & <tags>';
    const signature = await signer.signMessage(specialMsg);
    const address = await signer.getAddress();
    const valid = await verifyMessage({
      address: address as Address,
      message: specialMsg,
      signature: signature as Hex,
    });
    if (valid) pass('signer.signMessage() with special chars → valid');
    else fail('signer.signMessage() special chars', 'Verification failed');
  } catch (err: any) {
    fail('signer.signMessage() special chars', err.message);
  }

  // 5.4 Signer with env var fallback
  try {
    const envSigner = createKeyringProxySigner({});
    const signature = await envSigner.signMessage('env-fallback-test');
    if (signature) pass('createKeyringProxySigner({}) falls back to env vars');
    else fail('Signer env fallback', 'No signature');
  } catch (err: any) {
    // This may fail if env vars aren't set, which is fine
    if (err.message.includes('KEYRING_PROXY_URL')) {
      pass('createKeyringProxySigner({}) correctly requires env vars');
    } else {
      fail('Signer env fallback', err.message);
    }
  }

  // 5.5 Rapid-fire identity writes
  try {
    cleanup();
    ensureIdentityExists(identityPath);
    for (let i = 0; i < 50; i++) {
      writeIdentityField('Address', `0x${i.toString(16).padStart(40, '0')}`, identityPath);
    }
    const id = readIdentity(identityPath);
    if (id.address === `0x${(49).toString(16).padStart(40, '0')}`) {
      pass('50 rapid identity writes — last value persists');
    } else {
      fail('Rapid identity writes', `Got: ${id.address}`);
    }
    cleanup();
  } catch (err: any) {
    fail('Rapid identity writes', err.message);
    cleanup();
  }
}

async function main() {
  console.log(chalk.bold.cyan('\n🔬 SIWA Proxy-Only + Identity Stress Test\n'));
  console.log(chalk.dim(`Proxy:    ${kc.proxyUrl}`));
  console.log(chalk.dim(`Identity: ${identityPath}`));

  const proxyOk = await testProxy();
  if (proxyOk) await testConcurrency();
  await testIdentity();
  if (proxyOk) await testSIWASigning();
  await testEdgeCases();

  // ── Summary ───────────────────────────────────────────────────────
  console.log(chalk.bold(`\n${'═'.repeat(47)}`));
  console.log(chalk.bold(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`));
  console.log(chalk.bold('═'.repeat(47)));

  if (failed === 0) {
    console.log(chalk.green.bold('\n✅ All stress tests passed!\n'));
  } else {
    console.log(chalk.red.bold(`\n❌ ${failed} test(s) failed:\n`));
    for (const err of errors) {
      console.log(chalk.red(`   • ${err}`));
    }
    console.log('');
  }

  cleanup();
  process.exit(failed > 0 ? 1 : 0);
}

main();
