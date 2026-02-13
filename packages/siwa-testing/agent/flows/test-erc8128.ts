/**
 * Direct integration test for ERC-8128 + Receipt pipeline.
 *
 * Bypasses sign-in (which requires onchain registration) and tests:
 *   1. signRawMessage via Signer interface (ERC-8128 signing support)
 *   2. Receipt creation + verification
 *   3. Full signAuthenticatedRequest → server verifyAuthenticatedRequest
 *   4. Receipt tampering rejection
 *   5. Missing signature rejection
 *   6. Receipt header swap post-signing (signature covers X-SIWA-Receipt)
 *   7. Replay rejection (nonce store prevents duplicate requests)
 *   8. SignerType in receipt round-trip
 *   9. allowedSignerTypes policy enforcement (reject + accept)
 *  10. signerAddress override in ERC-8128 signing
 */

import chalk from 'chalk';
import { spawn, type ChildProcess } from 'child_process';
import * as path from 'path';
import { createReceipt, verifyReceipt } from '@buildersgarden/siwa/receipt';
import {
  signAuthenticatedRequest,
  verifyAuthenticatedRequest,
  createErc8128Signer,
} from '@buildersgarden/siwa/erc8128';
import { createLocalAccountSigner } from '@buildersgarden/siwa/signer';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { config, getSigner } from '../config.js';

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

const RECEIPT_SECRET = process.env.RECEIPT_SECRET || process.env.SIWA_SECRET || 'test-secret-change-in-production';

export async function testErc8128Flow(): Promise<boolean> {
  console.log(chalk.bold('ERC-8128 Integration Tests'));
  console.log('\u{2500}'.repeat(40));

  // Use local account signer (no proxy needed) unless proxy is explicitly configured
  const useProxy = !!config.keyringProxyUrl;
  const signer = useProxy
    ? getSigner()
    : createLocalAccountSigner(privateKeyToAccount(generatePrivateKey()));
  const signerMode = useProxy ? 'keyring proxy' : 'local account';
  console.log(chalk.dim(`  Using ${signerMode} signer`));

  const address = await signer.getAddress();
  if (!address) {
    fail('Setup', 'Failed to get signer address.');
    return false;
  }

  // ── Test 1: signRawMessage via signer ─────────────────────────────
  try {
    const testHex = '0xdeadbeef' as `0x${string}`;
    const signature = await signer.signRawMessage!(testHex);
    if (signature && signature.startsWith('0x') && signature.length === 132) {
      pass(`signer.signRawMessage() \u{2192} valid 65-byte signature`);
    } else {
      fail('signer.signRawMessage()', `Unexpected signature: ${signature}`);
    }
  } catch (err: any) {
    fail('signer.signRawMessage()', err.message);
  }

  // ── Test 2: Receipt create + verify ──────────────────────────────
  let receipt: string | null = null;
  try {
    const result = createReceipt(
      {
        address,
        agentId: 999,
        agentRegistry: 'eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e',
        chainId: 84532,
        verified: 'onchain',
      },
      { secret: RECEIPT_SECRET },
    );
    receipt = result.receipt;

    const decoded = verifyReceipt(receipt, RECEIPT_SECRET);
    if (decoded && decoded.address.toLowerCase() === address.toLowerCase() && decoded.agentId === 999) {
      pass('createReceipt() + verifyReceipt() round-trip');
    } else {
      fail('Receipt round-trip', `Decoded: ${JSON.stringify(decoded)}`);
    }
  } catch (err: any) {
    fail('Receipt create/verify', err.message);
  }

  // ── Test 3: Receipt with wrong secret is rejected ────────────────
  if (receipt) {
    try {
      const decoded = verifyReceipt(receipt, 'wrong-secret');
      if (decoded === null) {
        pass('Receipt rejected with wrong secret');
      } else {
        fail('Receipt wrong secret', 'Should have returned null');
      }
    } catch (err: any) {
      fail('Receipt wrong secret check', err.message);
    }
  }

  // ── Test 4: signAuthenticatedRequest (GET) ─────────────────────
  if (receipt) {
    try {
      const request = new Request(`${config.serverUrl}/api/protected`, {
        method: 'GET',
      });
      const signed = await signAuthenticatedRequest(request, receipt, signer, 84532);

      // Check headers are present
      const hasSig = signed.headers.has('signature');
      const hasSigInput = signed.headers.has('signature-input');
      const hasReceipt = signed.headers.has('x-siwa-receipt');

      if (hasSig && hasSigInput && hasReceipt) {
        pass('signAuthenticatedRequest() adds Signature + Signature-Input + X-SIWA-Receipt');
      } else {
        fail('signAuthenticatedRequest() headers', `sig=${hasSig} sigInput=${hasSigInput} receipt=${hasReceipt}`);
      }
    } catch (err: any) {
      fail('signAuthenticatedRequest() GET', err.message);
    }
  }

  // ── Server-dependent tests (5-10) — auto-start server if not running ──
  let serverAvailable = false;
  let serverProcess: ChildProcess | null = null;

  try {
    const health = await fetch(`${config.serverUrl}/health`, { signal: AbortSignal.timeout(2000) });
    serverAvailable = health.ok;
  } catch { /* server not running, try to start it */ }

  if (!serverAvailable) {
    const rpcUrl = process.env.RPC_URL || 'https://sepolia.base.org';
    const serverDir = path.resolve(import.meta.dirname || __dirname, '..', '..');
    console.log(chalk.dim('  Starting test server...'));

    serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
      cwd: serverDir,
      env: {
        ...process.env,
        PORT: '3000',
        SERVER_DOMAIN: 'localhost:3000',
        RPC_URL: rpcUrl,
        RECEIPT_SECRET: RECEIPT_SECRET,
        SIWA_SECRET: RECEIPT_SECRET,
      },
      stdio: 'pipe',
    });

    // Wait for server to be ready (poll health endpoint)
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 500));
      try {
        const health = await fetch(`${config.serverUrl}/health`, { signal: AbortSignal.timeout(1000) });
        if (health.ok) { serverAvailable = true; break; }
      } catch { /* not ready yet */ }
    }

    if (serverAvailable) {
      console.log(chalk.dim('  Server started on ' + config.serverUrl));
    } else {
      console.log(chalk.yellow('  ⏭  Tests 5-10 skipped (server failed to start)'));
    }
  }

  // ── Test 5: Full round-trip: signed GET → server verifies ───────
  if (receipt && serverAvailable) {
    try {
      const request = new Request(`${config.serverUrl}/api/protected`, {
        method: 'GET',
      });
      const signed = await signAuthenticatedRequest(request, receipt, signer, 84532);
      const res = await fetch(signed);

      if (res.ok) {
        const data = await res.json() as any;
        if (data.message && data.agentId === 999) {
          pass(`Server verified GET \u{2192} "Hello Agent #999!"`);
        } else {
          fail('Server verified GET', `Unexpected response: ${JSON.stringify(data)}`);
        }
      } else {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as any;
        fail('Server verified GET', `${res.status}: ${err.error || JSON.stringify(err)}`);
      }
    } catch (err: any) {
      fail('Server verified GET round-trip', err.message);
    }
  }

  // ── Test 6: Full round-trip: signed POST → server verifies ──────
  if (receipt && serverAvailable) {
    try {
      const body = JSON.stringify({ action: 'test', data: { hello: 'world' } });
      const request = new Request(`${config.serverUrl}/api/agent-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const signed = await signAuthenticatedRequest(request, receipt, signer, 84532);
      const res = await fetch(signed);

      if (res.ok) {
        const data = await res.json() as any;
        if (data.agent?.agentId === 999 && data.received?.action === 'test') {
          pass(`Server verified POST \u{2192} agent-action processed`);
        } else {
          fail('Server verified POST', `Unexpected response: ${JSON.stringify(data)}`);
        }
      } else {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as any;
        fail('Server verified POST', `${res.status}: ${err.error || JSON.stringify(err)}`);
      }
    } catch (err: any) {
      fail('Server verified POST round-trip', err.message);
    }
  }

  // ── Test 7: Tampered receipt is rejected ─────────────────────────
  if (serverAvailable) try {
    // Modify the receipt payload by flipping a character
    const tamperedReceipt = receipt ? receipt.slice(0, 5) + 'X' + receipt.slice(6) : 'invalid.receipt';
    const request = new Request(`${config.serverUrl}/api/protected`, {
      method: 'GET',
      headers: { 'X-SIWA-Receipt': tamperedReceipt },
    });
    // Still sign the request so it has Signature headers
    const signed = await signAuthenticatedRequest(request, tamperedReceipt, signer, 84532);
    const res = await fetch(signed);

    if (res.status === 401) {
      pass('Tampered receipt rejected (401)');
    } else {
      fail('Tampered receipt rejection', `Expected 401, got ${res.status}`);
    }
  } catch (err: any) {
    fail('Tampered receipt rejection', err.message);
  }

  // ── Test 8: Request without Signature headers is rejected ────────
  if (serverAvailable) try {
    const request = new Request(`${config.serverUrl}/api/protected`, {
      method: 'GET',
      headers: receipt ? { 'X-SIWA-Receipt': receipt } : {},
    });
    const res = await fetch(request);

    if (res.status === 401) {
      pass('Request without Signature headers rejected (401)');
    } else {
      fail('Missing signature rejection', `Expected 401, got ${res.status}`);
    }
  } catch (err: any) {
    fail('Missing signature rejection', err.message);
  }

  // ── Test 9: Receipt header swapped after signing is rejected ────
  // The ERC-8128 signature now covers X-SIWA-Receipt (component binding).
  // Swapping the receipt header post-signing should break the signature.
  if (receipt && serverAvailable) {
    try {
      const request = new Request(`${config.serverUrl}/api/protected`, {
        method: 'GET',
      });
      const signed = await signAuthenticatedRequest(request, receipt, signer, 84532);

      // Create a different receipt for the same agent
      const altResult = createReceipt(
        {
          address,
          agentId: 888,
          agentRegistry: 'eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e',
          chainId: 84532,
          verified: 'onchain',
        },
        { secret: RECEIPT_SECRET },
      );

      // Replace the receipt header after signing — signature should no longer verify
      const headers = new Headers(signed.headers);
      headers.set('X-SIWA-Receipt', altResult.receipt);
      const tampered = new Request(signed.url, { method: signed.method, headers });

      const res = await fetch(tampered);

      if (res.status === 401) {
        pass('Receipt header swapped post-signing rejected (401)');
      } else {
        fail('Receipt swap rejection', `Expected 401, got ${res.status}`);
      }
    } catch (err: any) {
      fail('Receipt swap rejection', err.message);
    }
  }

  // ── Test 10: Replay of exact same signed request is rejected ────
  // The nonce store should prevent replaying the same signed request.
  if (receipt && serverAvailable) {
    try {
      const request = new Request(`${config.serverUrl}/api/protected`, {
        method: 'GET',
      });
      const signed = await signAuthenticatedRequest(request, receipt, signer, 84532);

      // First request should succeed
      const res1 = await fetch(signed.clone());
      // Second identical request should be rejected (nonce replay)
      const res2 = await fetch(signed.clone());

      if (res1.ok && res2.status === 401) {
        pass('Replay of identical signed request rejected (401)');
      } else if (!res1.ok) {
        fail('Replay rejection', `First request failed: ${res1.status}`);
      } else {
        fail('Replay rejection', `Replay was not rejected: ${res2.status}`);
      }
    } catch (err: any) {
      fail('Replay rejection', err.message);
    }
  }

  // ── Test 11: Receipt with signerType round-trips ─────────────────
  try {
    const typedResult = createReceipt(
      {
        address,
        agentId: 999,
        agentRegistry: 'eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e',
        chainId: 84532,
        verified: 'onchain',
        signerType: 'eoa',
      },
      { secret: RECEIPT_SECRET },
    );
    const decoded = verifyReceipt(typedResult.receipt, RECEIPT_SECRET);
    if (decoded && decoded.signerType === 'eoa') {
      pass('Receipt with signerType=eoa round-trips correctly');
    } else {
      fail('Receipt signerType round-trip', `Decoded signerType: ${decoded?.signerType}`);
    }
  } catch (err: any) {
    fail('Receipt signerType round-trip', err.message);
  }

  // ── Test 12: allowedSignerTypes rejects mismatched type ─────────
  try {
    // Create a receipt with signerType: 'eoa'
    const eoaReceipt = createReceipt(
      {
        address,
        agentId: 999,
        agentRegistry: 'eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e',
        chainId: 84532,
        verified: 'onchain',
        signerType: 'eoa',
      },
      { secret: RECEIPT_SECRET },
    );

    // Sign a request with this receipt
    const request = new Request(`${config.serverUrl}/api/protected`, { method: 'GET' });
    const signed = await signAuthenticatedRequest(request, eoaReceipt.receipt, signer, 84532);

    // Verify with allowedSignerTypes: ['sca'] — should reject EOA
    const result = await verifyAuthenticatedRequest(signed, {
      receiptSecret: RECEIPT_SECRET,
      allowedSignerTypes: ['sca'],
    });

    if (!result.valid && result.error.includes('not in allowed types')) {
      pass('allowedSignerTypes rejects EOA when only SCA allowed');
    } else {
      fail('allowedSignerTypes enforcement', `Expected rejection, got: ${JSON.stringify(result)}`);
    }
  } catch (err: any) {
    fail('allowedSignerTypes enforcement', err.message);
  }

  // ── Test 13: allowedSignerTypes accepts matching type ───────────
  try {
    const eoaReceipt = createReceipt(
      {
        address,
        agentId: 999,
        agentRegistry: 'eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e',
        chainId: 84532,
        verified: 'onchain',
        signerType: 'eoa',
      },
      { secret: RECEIPT_SECRET },
    );

    const request = new Request(`${config.serverUrl}/api/protected`, { method: 'GET' });
    const signed = await signAuthenticatedRequest(request, eoaReceipt.receipt, signer, 84532);

    // Verify with allowedSignerTypes: ['eoa'] — should pass
    const result = await verifyAuthenticatedRequest(signed, {
      receiptSecret: RECEIPT_SECRET,
      allowedSignerTypes: ['eoa'],
    });

    if (result.valid && result.agent.signerType === 'eoa') {
      pass('allowedSignerTypes accepts EOA when EOA is allowed');
    } else {
      fail('allowedSignerTypes accept', `Expected valid with signerType=eoa, got: ${JSON.stringify(result)}`);
    }
  } catch (err: any) {
    fail('allowedSignerTypes accept', err.message);
  }

  // ── Test 14: signerAddress override in createErc8128Signer ──────
  try {
    const fakeAddress = '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`;
    const erc8128Signer = await createErc8128Signer(signer, 84532, { signerAddress: fakeAddress });

    if (erc8128Signer.address.toLowerCase() === fakeAddress.toLowerCase()) {
      pass('createErc8128Signer with signerAddress override uses custom address');
    } else {
      fail('signerAddress override', `Expected ${fakeAddress}, got ${erc8128Signer.address}`);
    }
  } catch (err: any) {
    fail('signerAddress override', err.message);
  }

  // ── Test 15: signerAddress override propagates through signAuthenticatedRequest ─
  if (receipt) {
    try {
      const fakeAddress = '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`;
      const request = new Request(`${config.serverUrl}/api/protected`, { method: 'GET' });
      const signed = await signAuthenticatedRequest(request, receipt, signer, 84532, { signerAddress: fakeAddress });

      // Check signature-input contains the overridden address in keyid
      const sigInput = signed.headers.get('signature-input') || '';
      if (sigInput.toLowerCase().includes(fakeAddress.toLowerCase())) {
        pass('signAuthenticatedRequest with signerAddress puts custom address in keyid');
      } else {
        fail('signerAddress in signAuthenticatedRequest', `keyid not found in signature-input: ${sigInput}`);
      }
    } catch (err: any) {
      fail('signerAddress in signAuthenticatedRequest', err.message);
    }
  }

  // ── Cleanup: stop server if we started it ─────────────────────
  if (serverProcess) {
    serverProcess.kill();
    console.log(chalk.dim('  Server stopped'));
  }

  // ── Summary ─────────────────────────────────────────────────────
  console.log('');
  console.log(chalk.bold(`Results: ${passed} passed, ${failed} failed`));

  if (failed === 0) {
    console.log(chalk.green.bold('\u{2705} All ERC-8128 tests passed'));
  } else {
    console.log(chalk.red.bold(`\u{274C} ${failed} test(s) failed`));
  }

  return failed === 0;
}