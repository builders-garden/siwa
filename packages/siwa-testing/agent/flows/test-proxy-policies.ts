/**
 * test-proxy-policies.ts
 *
 * Tests for the keyring proxy policy system.
 * Tests policy CRUD, wallet bindings, and signing enforcement.
 */

import chalk from 'chalk';
import { verifyMessage } from 'viem';
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

async function proxyRequest(
  proxyUrl: string,
  secret: string,
  method: string,
  path: string,
  body: Record<string, unknown> = {}
): Promise<{ status: number; data: any }> {
  // For GET requests, use empty string for body in HMAC computation
  const bodyStr = method === 'GET' ? '' : JSON.stringify(body);
  const hmacHeaders = computeHmac(secret, method, path, bodyStr);

  const res = await fetch(`${proxyUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...hmacHeaders,
    },
    body: method !== 'GET' ? bodyStr : undefined,
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

export async function testProxyPoliciesFlow(): Promise<boolean> {
  console.log(chalk.bold('Keyring Proxy Policy Tests'));
  console.log('\u{2500}'.repeat(40));

  const kc = getKeystoreConfig();
  const proxyUrl = kc.proxyUrl || process.env.KEYRING_PROXY_URL;
  const secret = kc.proxySecret || process.env.KEYRING_PROXY_SECRET;

  if (!proxyUrl || !secret) {
    fail('Config check', 'KEYRING_PROXY_URL and KEYRING_PROXY_SECRET must be set');
    return false;
  }

  // Use admin secret for policy write operations if configured (secret is string here)
  const policySecret: string = process.env.KEYRING_POLICY_ADMIN_SECRET || secret;

  // ── Test 1: Health check with policy info ────────────────────────────
  try {
    const res = await fetch(`${proxyUrl}/health`);
    const data = await res.json() as any;
    if (data.policies_enabled === true) {
      pass('Health check shows policies_enabled: true');
    } else {
      fail('Health check', `Expected policies_enabled: true, got ${JSON.stringify(data)}`);
    }
  } catch (err: any) {
    fail('Health check', err.message);
    return false;
  }

  // ── Test 2: Create wallet with default policy ─────────────────────────
  let walletAddress: string | null = null;
  let defaultPolicyId: string | null = null;
  try {
    const { status, data } = await proxyRequest(proxyUrl, secret, 'POST', '/create-wallet', {});
    if (status === 200 && data.address && data.policy_id) {
      walletAddress = data.address;
      defaultPolicyId = data.policy_id;
      pass(`Create wallet with default policy \u{2192} ${walletAddress?.slice(0, 10)}... policy: ${defaultPolicyId}`);
    } else {
      fail('Create wallet with default policy', JSON.stringify(data));
    }
  } catch (err: any) {
    fail('Create wallet with default policy', err.message);
  }

  if (!walletAddress) {
    console.log(chalk.yellow('Skipping remaining tests - no wallet created'));
    return false;
  }

  // ── Test 3: List wallet policies ───────────────────────────────────────
  try {
    const { status, data } = await proxyRequest(proxyUrl, secret, 'GET', `/wallets/${walletAddress}/policies`, {});
    if (status === 200 && Array.isArray(data.policies) && data.policies.length > 0) {
      pass(`List wallet policies \u{2192} ${data.policies.length} policy(ies)`);
    } else {
      fail('List wallet policies', JSON.stringify(data));
    }
  } catch (err: any) {
    fail('List wallet policies', err.message);
  }

  // ── Test 4: Sign message (should be allowed by default policy) ─────────
  try {
    const message = 'Test message for policy check';
    const { status, data } = await proxyRequest(proxyUrl, secret, 'POST', '/sign-message', { message });
    if (status === 200 && data.signature) {
      // Verify signature using viem
      const isValid = walletAddress ? await verifyMessage({
        address: walletAddress as `0x${string}`,
        message,
        signature: data.signature as `0x${string}`,
      }) : false;
      if (isValid) {
        pass('Sign message allowed by default policy');
      } else {
        fail('Sign message', `Signature verification failed`);
      }
    } else {
      fail('Sign message', JSON.stringify(data));
    }
  } catch (err: any) {
    fail('Sign message', err.message);
  }

  // ── Test 5: Sign small transaction (should be allowed) ─────────────────
  try {
    const tx = {
      to: '0x1234567890123456789012345678901234567890',
      value: '50000000000000000', // 0.05 ETH (under 0.1 ETH limit)
      chainId: 84532,
      type: 2, // EIP-1559 transaction type required by viem
      maxFeePerGas: '1000000000',
      maxPriorityFeePerGas: '1000000000',
    };
    const { status, data } = await proxyRequest(proxyUrl, secret, 'POST', '/sign-transaction', { tx });
    if (status === 200 && data.signedTx) {
      pass('Sign small transaction (0.05 ETH) allowed');
    } else {
      fail('Sign small transaction', JSON.stringify(data));
    }
  } catch (err: any) {
    fail('Sign small transaction', err.message);
  }

  // ── Test 6: Sign large transaction (should be denied by default policy) ─
  try {
    const tx = {
      to: '0x1234567890123456789012345678901234567890',
      value: '500000000000000000', // 0.5 ETH (over 0.1 ETH limit)
      chainId: 84532,
      type: 2, // EIP-1559 transaction type required by viem
      maxFeePerGas: '1000000000',
      maxPriorityFeePerGas: '1000000000',
    };
    const { status, data } = await proxyRequest(proxyUrl, secret, 'POST', '/sign-transaction', { tx });
    if (status === 403 && data.error === 'Policy violation') {
      pass('Sign large transaction (0.5 ETH) denied by policy');
    } else {
      fail('Sign large transaction should be denied', `Status: ${status}, Response: ${JSON.stringify(data)}`);
    }
  } catch (err: any) {
    fail('Sign large transaction', err.message);
  }

  // ── Test 7: Create custom policy ───────────────────────────────────────
  let customPolicyId: string | null = null;
  try {
    const policy = {
      name: 'Test Spending Limit',
      rules: [
        {
          name: 'Allow up to 1 ETH',
          method: 'sign_transaction',
          action: 'ALLOW',
          conditions: [
            {
              field_source: 'ethereum_transaction',
              field: 'value',
              operator: 'lte',
              value: '1000000000000000000', // 1 ETH
            },
          ],
        },
      ],
    };
    const { status, data } = await proxyRequest(proxyUrl, policySecret, 'POST', '/policies', policy);
    if (status === 201 && data.id) {
      customPolicyId = data.id;
      pass(`Create custom policy \u{2192} ${customPolicyId}`);
    } else {
      fail('Create custom policy', JSON.stringify(data));
    }
  } catch (err: any) {
    fail('Create custom policy', err.message);
  }

  // ── Test 8: List all policies ──────────────────────────────────────────
  try {
    const { status, data } = await proxyRequest(proxyUrl, secret, 'GET', '/policies', {});
    if (status === 200 && Array.isArray(data.policies)) {
      pass(`List all policies \u{2192} ${data.policies.length} policy(ies)`);
    } else {
      fail('List all policies', JSON.stringify(data));
    }
  } catch (err: any) {
    fail('List all policies', err.message);
  }

  // ── Test 9: Get policy by ID ───────────────────────────────────────────
  if (customPolicyId) {
    try {
      const { status, data } = await proxyRequest(proxyUrl, secret, 'GET', `/policies/${customPolicyId}`, {});
      if (status === 200 && data.policy && data.policy.id === customPolicyId) {
        pass(`Get policy by ID \u{2192} ${data.policy.name}`);
      } else {
        fail('Get policy by ID', JSON.stringify(data));
      }
    } catch (err: any) {
      fail('Get policy by ID', err.message);
    }
  }

  // ── Test 10: Attach custom policy to wallet ────────────────────────────
  if (customPolicyId) {
    try {
      const { status, data } = await proxyRequest(
        proxyUrl, policySecret, 'POST',
        `/wallets/${walletAddress}/policies/${customPolicyId}`,
        {}
      );
      if (status === 200 && data.attached === true) {
        pass('Attach custom policy to wallet');
      } else {
        fail('Attach custom policy', JSON.stringify(data));
      }
    } catch (err: any) {
      fail('Attach custom policy', err.message);
    }
  }

  // ── Test 11: Sign larger transaction (now allowed with new policy) ─────
  if (customPolicyId) {
    try {
      const tx = {
        to: '0x1234567890123456789012345678901234567890',
        value: '500000000000000000', // 0.5 ETH (now under 1 ETH limit)
        chainId: 84532,
        type: 2, // EIP-1559 transaction type required by viem
        maxFeePerGas: '1000000000',
        maxPriorityFeePerGas: '1000000000',
      };
      const { status, data } = await proxyRequest(proxyUrl, secret, 'POST', '/sign-transaction', { tx });
      if (status === 200 && data.signedTx) {
        pass('Sign 0.5 ETH transaction allowed with new policy');
      } else {
        fail('Sign 0.5 ETH with new policy', JSON.stringify(data));
      }
    } catch (err: any) {
      fail('Sign 0.5 ETH with new policy', err.message);
    }
  }

  // ── Test 12: Create DENY policy for message signing ────────────────────
  let denyMessagePolicyId: string | null = null;
  try {
    const policy = {
      name: 'Block all message signing',
      rules: [
        {
          name: 'Deny all messages',
          method: 'sign_message',
          action: 'DENY',
          conditions: [], // No conditions = always matches
        },
      ],
    };
    const { status, data } = await proxyRequest(proxyUrl, policySecret, 'POST', '/policies', policy);
    if (status === 201 && data.id) {
      denyMessagePolicyId = data.id;
      pass(`Create DENY message policy \u{2192} ${denyMessagePolicyId}`);
    } else {
      fail('Create DENY message policy', JSON.stringify(data));
    }
  } catch (err: any) {
    fail('Create DENY message policy', err.message);
  }

  // ── Test 13: Attach DENY policy and verify message signing blocked ─────
  if (denyMessagePolicyId) {
    try {
      await proxyRequest(
        proxyUrl, policySecret, 'POST',
        `/wallets/${walletAddress}/policies/${denyMessagePolicyId}`,
        {}
      );

      const message = 'This should be blocked';
      const { status, data } = await proxyRequest(proxyUrl, secret, 'POST', '/sign-message', { message });
      if (status === 403 && data.error === 'Policy violation') {
        pass('Message signing blocked by DENY policy');
      } else {
        fail('Message signing should be blocked', `Status: ${status}, Response: ${JSON.stringify(data)}`);
      }
    } catch (err: any) {
      fail('Message signing blocked', err.message);
    }
  }

  // ── Test 14: Detach DENY policy ────────────────────────────────────────
  if (denyMessagePolicyId) {
    try {
      const { status, data } = await proxyRequest(
        proxyUrl, policySecret, 'DELETE',
        `/wallets/${walletAddress}/policies/${denyMessagePolicyId}`,
        {}
      );
      if (status === 200 && data.detached === true) {
        pass('Detach DENY policy from wallet');
      } else {
        fail('Detach DENY policy', JSON.stringify(data));
      }
    } catch (err: any) {
      fail('Detach DENY policy', err.message);
    }
  }

  // ── Test 15: Message signing works again after detaching DENY ──────────
  try {
    const message = 'This should work now';
    const { status, data } = await proxyRequest(proxyUrl, secret, 'POST', '/sign-message', { message });
    if (status === 200 && data.signature) {
      pass('Message signing works after detaching DENY policy');
    } else {
      fail('Message signing after detach', JSON.stringify(data));
    }
  } catch (err: any) {
    fail('Message signing after detach', err.message);
  }

  // ── Test 16: Update policy ─────────────────────────────────────────────
  if (customPolicyId) {
    try {
      const { status, data } = await proxyRequest(proxyUrl, policySecret, 'PUT', `/policies/${customPolicyId}`, {
        name: 'Updated Spending Limit',
      });
      if (status === 200 && data.policy && data.policy.name === 'Updated Spending Limit') {
        pass('Update policy name');
      } else {
        fail('Update policy', JSON.stringify(data));
      }
    } catch (err: any) {
      fail('Update policy', err.message);
    }
  }

  // ── Test 17: Delete policy ─────────────────────────────────────────────
  if (denyMessagePolicyId) {
    try {
      const { status, data } = await proxyRequest(proxyUrl, policySecret, 'DELETE', `/policies/${denyMessagePolicyId}`, {});
      if (status === 200 && data.deleted === true) {
        pass('Delete policy');
      } else {
        fail('Delete policy', JSON.stringify(data));
      }
    } catch (err: any) {
      fail('Delete policy', err.message);
    }
  }

  // ── Test 18: Get non-existent policy returns 404 ───────────────────────
  try {
    const { status, data } = await proxyRequest(proxyUrl, secret, 'GET', '/policies/pol_nonexistent', {});
    if (status === 404) {
      pass('Get non-existent policy returns 404');
    } else {
      fail('Get non-existent policy', `Expected 404, got ${status}`);
    }
  } catch (err: any) {
    fail('Get non-existent policy', err.message);
  }

  // ── Test 19: Chain ID restriction policy ───────────────────────────────
  let chainPolicyId: string | null = null;
  try {
    const policy = {
      name: 'Base Sepolia Only',
      rules: [
        {
          name: 'Allow Base Sepolia',
          method: 'sign_transaction',
          action: 'ALLOW',
          conditions: [
            {
              field_source: 'ethereum_transaction',
              field: 'chain_id',
              operator: 'eq',
              value: 84532,
            },
          ],
        },
        {
          name: 'Deny other chains',
          method: 'sign_transaction',
          action: 'DENY',
          conditions: [
            {
              field_source: 'ethereum_transaction',
              field: 'chain_id',
              operator: 'neq',
              value: 84532,
            },
          ],
        },
      ],
    };
    const { status, data } = await proxyRequest(proxyUrl, policySecret, 'POST', '/policies', policy);
    if (status === 201 && data.id) {
      chainPolicyId = data.id;

      // Attach it
      await proxyRequest(proxyUrl, policySecret, 'POST', `/wallets/${walletAddress}/policies/${chainPolicyId}`, {});

      // Try transaction on wrong chain
      const tx = {
        to: '0x1234567890123456789012345678901234567890',
        value: '10000000000000000', // 0.01 ETH
        chainId: 1, // Mainnet - should be denied
        type: 2, // EIP-1559 transaction type required by viem
        maxFeePerGas: '1000000000',
        maxPriorityFeePerGas: '1000000000',
      };
      const txRes = await proxyRequest(proxyUrl, secret, 'POST', '/sign-transaction', { tx });
      if (txRes.status === 403) {
        pass('Chain restriction policy blocks wrong chain');
      } else {
        fail('Chain restriction', `Expected 403, got ${txRes.status}`);
      }
    } else {
      fail('Create chain policy', JSON.stringify(data));
    }
  } catch (err: any) {
    fail('Chain restriction policy', err.message);
  }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log('');
  console.log(chalk.bold(`Results: ${passed} passed, ${failed} failed`));

  if (failed === 0) {
    console.log(chalk.green.bold('\u{2705} All policy tests passed'));
  } else {
    console.log(chalk.red.bold(`\u{274C} ${failed} test(s) failed`));
  }

  return failed === 0;
}
