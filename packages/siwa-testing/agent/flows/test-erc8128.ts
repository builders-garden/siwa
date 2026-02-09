/**
 * Direct integration test for ERC-8128 + Receipt pipeline.
 *
 * Bypasses sign-in (which requires onchain registration) and tests:
 *   1. signRawMessage via keyring proxy (new ERC-8128 signing support)
 *   2. Receipt creation + verification
 *   3. Full signAuthenticatedRequest → server verifyAuthenticatedRequest
 *   4. Receipt tampering rejection
 *   5. Missing signature rejection
 */

import chalk from 'chalk';
import { getAddress, signRawMessage } from '@buildersgarden/siwa/keystore';
import { createReceipt, verifyReceipt } from '@buildersgarden/siwa/receipt';
import { signAuthenticatedRequest } from '@buildersgarden/siwa/erc8128';
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

const RECEIPT_SECRET = process.env.RECEIPT_SECRET || process.env.SIWA_SECRET || 'test-secret-change-in-production';

export async function testErc8128Flow(): Promise<boolean> {
  console.log(chalk.bold('ERC-8128 Integration Tests'));
  console.log('\u{2500}'.repeat(40));

  const kc = getKeystoreConfig();
  const address = await getAddress(kc);
  if (!address) {
    fail('Setup', 'No wallet found. Run test-proxy first to create one.');
    return false;
  }

  // ── Test 1: signRawMessage via proxy ─────────────────────────────
  try {
    const testHex = '0xdeadbeef';
    const result = await signRawMessage(testHex, kc);
    if (result.signature && result.signature.startsWith('0x') && result.signature.length === 132) {
      pass(`signRawMessage() via proxy \u{2192} valid 65-byte signature`);
    } else {
      fail('signRawMessage() via proxy', `Unexpected signature: ${result.signature}`);
    }
  } catch (err: any) {
    fail('signRawMessage() via proxy', err.message);
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
      const signed = await signAuthenticatedRequest(request, receipt, kc, 84532);

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

  // ── Test 5: Full round-trip: signed GET → server verifies ───────
  if (receipt) {
    try {
      const request = new Request(`${config.serverUrl}/api/protected`, {
        method: 'GET',
      });
      const signed = await signAuthenticatedRequest(request, receipt, kc, 84532);
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
  if (receipt) {
    try {
      const body = JSON.stringify({ action: 'test', data: { hello: 'world' } });
      const request = new Request(`${config.serverUrl}/api/agent-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const signed = await signAuthenticatedRequest(request, receipt, kc, 84532);
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
  try {
    // Modify the receipt payload by flipping a character
    const tamperedReceipt = receipt ? receipt.slice(0, 5) + 'X' + receipt.slice(6) : 'invalid.receipt';
    const request = new Request(`${config.serverUrl}/api/protected`, {
      method: 'GET',
      headers: { 'X-SIWA-Receipt': tamperedReceipt },
    });
    // Still sign the request so it has Signature headers
    const signed = await signAuthenticatedRequest(request, tamperedReceipt, kc, 84532);
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
  try {
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
