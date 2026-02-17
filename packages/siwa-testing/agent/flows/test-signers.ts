/**
 * Test suite for SIWA signer implementations.
 *
 * Tests sign-in and verify flows with:
 *   1. Keyring Proxy Signer (createKeyringProxySigner)
 *   2. viem Private Key Signer (createLocalAccountSigner)
 *
 * Each test validates:
 *   - signSIWAMessage produces valid message and signature
 *   - parseSIWAMessage correctly parses the message back
 *   - verifyMessage confirms signature validity (offline)
 *   - verifySIWA with mocked PublicClient (ERC-8004 onchain logic)
 *   - signAuthenticatedRequest (ERC-8128) works correctly
 */

import chalk from 'chalk';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { verifyMessage, type Hex, type Address, type PublicClient } from 'viem';
import {
  signSIWAMessage,
  parseSIWAMessage,
  buildSIWAMessage,
  generateNonce,
  verifySIWA,
  SIWAErrorCode,
} from '@buildersgarden/siwa';
import {
  createKeyringProxySigner,
  createLocalAccountSigner,
  type Signer,
} from '@buildersgarden/siwa/signer';
import { createReceipt, verifyReceipt } from '@buildersgarden/siwa/receipt';
import { signAuthenticatedRequest } from '@buildersgarden/siwa/erc8128';
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

function section(title: string) {
  console.log('');
  console.log(chalk.bold.cyan(title));
  console.log('\u{2500}'.repeat(50));
}

const TEST_DOMAIN = 'test.example.com';
const TEST_URI = 'https://test.example.com/siwa/verify';
const TEST_AGENT_ID = 999;
const TEST_AGENT_REGISTRY = 'eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e';
const TEST_CHAIN_ID = 84532;
const RECEIPT_SECRET = process.env.RECEIPT_SECRET || process.env.SIWA_SECRET || 'test-secret-change-in-production';

interface SignerTestConfig {
  name: string;
  getSigner: () => Promise<Signer>;
  skipIfUnavailable?: boolean;
}

/**
 * Run sign + verify tests for a given signer
 */
async function testSigner(config: SignerTestConfig): Promise<{ passed: number; failed: number }> {
  let localPassed = 0;
  let localFailed = 0;

  const localPass = (label: string) => {
    localPassed++;
    pass(label);
  };

  const localFail = (label: string, detail?: string) => {
    localFailed++;
    fail(label, detail);
  };

  section(`Testing: ${config.name}`);

  let signer: Signer;
  let address: Address;

  // ── Setup: Get signer and address ────────────────────────────────
  try {
    signer = await config.getSigner();
    address = await signer.getAddress();
    localPass(`getAddress() \u{2192} ${address.slice(0, 10)}...`);
  } catch (err: any) {
    if (config.skipIfUnavailable) {
      console.log(chalk.yellow(`  \u{26A0}\u{FE0F} Skipped: ${err.message}`));
      return { passed: localPassed, failed: localFailed };
    }
    localFail('getAddress()', err.message);
    return { passed: localPassed, failed: localFailed };
  }

  // ── Test 1: signSIWAMessage produces valid output ────────────────
  const nonce = generateNonce();
  const issuedAt = new Date().toISOString();
  const expirationTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  let signedMessage: { message: string; signature: string; address: string } | null = null;

  try {
    signedMessage = await signSIWAMessage(
      {
        domain: TEST_DOMAIN,
        statement: 'Sign in to test application.',
        uri: TEST_URI,
        agentId: TEST_AGENT_ID,
        agentRegistry: TEST_AGENT_REGISTRY,
        chainId: TEST_CHAIN_ID,
        nonce,
        issuedAt,
        expirationTime,
      },
      signer
    );

    if (
      signedMessage.message &&
      signedMessage.signature &&
      signedMessage.signature.startsWith('0x') &&
      signedMessage.signature.length === 132 &&
      signedMessage.address.toLowerCase() === address.toLowerCase()
    ) {
      localPass('signSIWAMessage() \u{2192} valid message + 65-byte signature');
    } else {
      localFail('signSIWAMessage()', `Unexpected output: sig length ${signedMessage.signature.length}`);
    }
  } catch (err: any) {
    localFail('signSIWAMessage()', err.message);
  }

  // ── Test 2: parseSIWAMessage correctly parses the message ────────
  if (signedMessage) {
    try {
      const parsed = parseSIWAMessage(signedMessage.message);

      const checks = [
        parsed.domain === TEST_DOMAIN,
        parsed.address.toLowerCase() === address.toLowerCase(),
        parsed.agentId === TEST_AGENT_ID,
        parsed.agentRegistry === TEST_AGENT_REGISTRY,
        parsed.chainId === TEST_CHAIN_ID,
        parsed.nonce === nonce,
        parsed.statement === 'Sign in to test application.',
      ];

      if (checks.every(Boolean)) {
        localPass('parseSIWAMessage() \u{2192} all fields correctly parsed');
      } else {
        localFail('parseSIWAMessage()', `Some fields mismatch: ${JSON.stringify(parsed)}`);
      }
    } catch (err: any) {
      localFail('parseSIWAMessage()', err.message);
    }
  }

  // ── Test 3: verifyMessage confirms signature validity ────────────
  if (signedMessage) {
    try {
      const isValid = await verifyMessage({
        address: signedMessage.address as Address,
        message: signedMessage.message,
        signature: signedMessage.signature as Hex,
      });

      if (isValid) {
        localPass('verifyMessage() \u{2192} signature verified');
      } else {
        localFail('verifyMessage()', 'Signature verification returned false');
      }
    } catch (err: any) {
      localFail('verifyMessage()', err.message);
    }
  }

  // ── Test 4: verifyMessage rejects tampered message ───────────────
  if (signedMessage) {
    try {
      const tamperedMessage = signedMessage.message.replace(TEST_DOMAIN, 'evil.com');
      const isValid = await verifyMessage({
        address: signedMessage.address as Address,
        message: tamperedMessage,
        signature: signedMessage.signature as Hex,
      });

      if (!isValid) {
        localPass('verifyMessage() \u{2192} rejects tampered message');
      } else {
        localFail('verifyMessage() tampered', 'Should have rejected tampered message');
      }
    } catch (err: any) {
      // Some implementations throw, which is also correct
      localPass('verifyMessage() \u{2192} rejects tampered message (threw)');
    }
  }

  // ── Test 5: verifyMessage rejects wrong address ──────────────────
  if (signedMessage) {
    try {
      // Use a different address
      const wrongAddress = '0x0000000000000000000000000000000000000001' as Address;
      const isValid = await verifyMessage({
        address: wrongAddress,
        message: signedMessage.message,
        signature: signedMessage.signature as Hex,
      });

      if (!isValid) {
        localPass('verifyMessage() \u{2192} rejects wrong address');
      } else {
        localFail('verifyMessage() wrong address', 'Should have rejected wrong address');
      }
    } catch (err: any) {
      localPass('verifyMessage() \u{2192} rejects wrong address (threw)');
    }
  }

  // ── Test 6: signMessage (raw) for ERC-8128 ───────────────────────
  try {
    const testMessage = 'Test raw message for ERC-8128';
    const signature = await signer.signMessage(testMessage);

    if (signature && signature.startsWith('0x') && signature.length === 132) {
      // Verify the signature
      const isValid = await verifyMessage({
        address,
        message: testMessage,
        signature: signature as Hex,
      });

      if (isValid) {
        localPass('signMessage() \u{2192} raw message signed and verified');
      } else {
        localFail('signMessage() raw', 'Signature verification failed');
      }
    } else {
      localFail('signMessage() raw', `Unexpected signature format: ${signature}`);
    }
  } catch (err: any) {
    localFail('signMessage() raw', err.message);
  }

  // ── Test 7: signRawMessage (if available) ────────────────────────
  if (signer.signRawMessage) {
    try {
      const testHex = '0xdeadbeef' as Hex;
      const signature = await signer.signRawMessage(testHex);

      if (signature && signature.startsWith('0x') && signature.length === 132) {
        localPass('signRawMessage() \u{2192} valid 65-byte signature');
      } else {
        localFail('signRawMessage()', `Unexpected signature: ${signature}`);
      }
    } catch (err: any) {
      localFail('signRawMessage()', err.message);
    }
  } else {
    console.log(chalk.dim(`  \u{2139}\u{FE0F} signRawMessage() not implemented (optional)`));
  }

  // ── Test 8: Receipt creation + ERC-8128 signing ──────────────────
  try {
    const receiptResult = createReceipt(
      {
        address,
        agentId: TEST_AGENT_ID,
        agentRegistry: TEST_AGENT_REGISTRY,
        chainId: TEST_CHAIN_ID,
        verified: 'onchain',
      },
      { secret: RECEIPT_SECRET }
    );

    const decoded = verifyReceipt(receiptResult.receipt, RECEIPT_SECRET);
    if (decoded && decoded.address.toLowerCase() === address.toLowerCase()) {
      localPass('createReceipt() + verifyReceipt() \u{2192} round-trip successful');
    } else {
      localFail('Receipt round-trip', 'Decoded receipt mismatch');
    }

    // Test signAuthenticatedRequest with this receipt
    const request = new Request('https://example.com/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test' }),
    });

    const signedRequest = await signAuthenticatedRequest(
      request,
      receiptResult.receipt,
      signer,
      TEST_CHAIN_ID
    );

    const hasSignature = signedRequest.headers.has('signature');
    const hasSignatureInput = signedRequest.headers.has('signature-input');
    const hasReceipt = signedRequest.headers.has('x-siwa-receipt');

    if (hasSignature && hasSignatureInput && hasReceipt) {
      localPass('signAuthenticatedRequest() \u{2192} all ERC-8128 headers present');
    } else {
      localFail('signAuthenticatedRequest()', `Missing headers: sig=${hasSignature} input=${hasSignatureInput} receipt=${hasReceipt}`);
    }
  } catch (err: any) {
    localFail('ERC-8128 signing', err.message);
  }

  // ── Test 9: buildSIWAMessage + parseSIWAMessage round-trip ───────
  try {
    const fields = {
      domain: TEST_DOMAIN,
      address,
      statement: 'Multi-line\nstatement test.',
      uri: TEST_URI,
      agentId: TEST_AGENT_ID,
      agentRegistry: TEST_AGENT_REGISTRY,
      chainId: TEST_CHAIN_ID,
      nonce: 'test-nonce-123',
      issuedAt,
      expirationTime,
      notBefore: issuedAt,
      requestId: 'req-456',
    };

    const message = buildSIWAMessage(fields);
    const parsed = parseSIWAMessage(message);

    const allMatch =
      parsed.domain === fields.domain &&
      parsed.address.toLowerCase() === fields.address.toLowerCase() &&
      parsed.agentId === fields.agentId &&
      parsed.agentRegistry === fields.agentRegistry &&
      parsed.chainId === fields.chainId &&
      parsed.nonce === fields.nonce &&
      parsed.expirationTime === fields.expirationTime &&
      parsed.notBefore === fields.notBefore &&
      parsed.requestId === fields.requestId;

    if (allMatch) {
      localPass('buildSIWAMessage() + parseSIWAMessage() \u{2192} full round-trip');
    } else {
      localFail('Message round-trip', `Fields mismatch`);
    }
  } catch (err: any) {
    localFail('Message round-trip', err.message);
  }

  return { passed: localPassed, failed: localFailed };
}

/**
 * Create a mock PublicClient that returns specific ownerOf results
 * and supports verifyMessage for ERC-1271 compatible verification
 */
function createMockPublicClient(ownerOfResult: Address | 'throw'): PublicClient {
  return {
    readContract: async ({ functionName, args }: any) => {
      if (functionName === 'ownerOf') {
        if (ownerOfResult === 'throw') {
          throw new Error('Token does not exist');
        }
        return ownerOfResult;
      }
      throw new Error(`Unexpected contract call: ${functionName}`);
    },
    // Support client.verifyMessage for EOA + ERC-1271 verification
    verifyMessage: async ({ address, message, signature }: { address: Address; message: string; signature: Hex }) => {
      // Use viem's verifyMessage utility for EOA verification
      return verifyMessage({ address, message, signature });
    },
    // Return '0x' (no code) so verifySIWA treats the signer as EOA
    getCode: async () => '0x',
  } as unknown as PublicClient;
}

/**
 * Test verifySIWA with mocked PublicClient (ERC-8004 onchain verification logic)
 */
async function testVerifySIWA(signer: Signer): Promise<{ passed: number; failed: number }> {
  let localPassed = 0;
  let localFailed = 0;

  const localPass = (label: string) => {
    localPassed++;
    pass(label);
  };

  const localFail = (label: string, detail?: string) => {
    localFailed++;
    fail(label, detail);
  };

  section('Testing: verifySIWA (ERC-8004 onchain verification with mocked client)');

  const address = await signer.getAddress();
  const nonce = generateNonce();
  const issuedAt = new Date().toISOString();
  const expirationTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  // Sign a message for testing
  const { message, signature } = await signSIWAMessage(
    {
      domain: TEST_DOMAIN,
      statement: 'Sign in to test application.',
      uri: TEST_URI,
      agentId: TEST_AGENT_ID,
      agentRegistry: TEST_AGENT_REGISTRY,
      chainId: TEST_CHAIN_ID,
      nonce,
      issuedAt,
      expirationTime,
    },
    signer
  );

  // ── Test 1: verifySIWA succeeds when ownerOf returns signer address ──
  try {
    const mockClient = createMockPublicClient(address);
    const result = await verifySIWA(
      message,
      signature,
      TEST_DOMAIN,
      () => true, // nonce always valid
      mockClient
    );

    if (result.valid && result.address.toLowerCase() === address.toLowerCase()) {
      localPass('verifySIWA() \u{2192} success when ownerOf matches signer');
    } else {
      localFail('verifySIWA() success case', `Expected valid=true, got: ${JSON.stringify(result)}`);
    }
  } catch (err: any) {
    localFail('verifySIWA() success case', err.message);
  }

  // ── Test 2: verifySIWA fails when ownerOf returns different address ──
  try {
    const differentAddress = '0x0000000000000000000000000000000000000001' as Address;
    const mockClient = createMockPublicClient(differentAddress);
    const result = await verifySIWA(
      message,
      signature,
      TEST_DOMAIN,
      () => true,
      mockClient
    );

    if (!result.valid && result.code === SIWAErrorCode.NOT_OWNER) {
      localPass('verifySIWA() \u{2192} rejects when ownerOf returns different address (NOT_OWNER)');
    } else {
      localFail('verifySIWA() NOT_OWNER', `Expected NOT_OWNER, got: ${result.code}`);
    }
  } catch (err: any) {
    localFail('verifySIWA() NOT_OWNER', err.message);
  }

  // ── Test 3: verifySIWA fails when ownerOf throws (not registered) ────
  try {
    const mockClient = createMockPublicClient('throw');
    const result = await verifySIWA(
      message,
      signature,
      TEST_DOMAIN,
      () => true,
      mockClient
    );

    if (!result.valid && result.code === SIWAErrorCode.NOT_REGISTERED) {
      localPass('verifySIWA() \u{2192} rejects when ownerOf throws (NOT_REGISTERED)');
    } else {
      localFail('verifySIWA() NOT_REGISTERED', `Expected NOT_REGISTERED, got: ${result.code}`);
    }
  } catch (err: any) {
    localFail('verifySIWA() NOT_REGISTERED', err.message);
  }

  // ── Test 4: verifySIWA fails with invalid nonce ──────────────────────
  try {
    const mockClient = createMockPublicClient(address);
    const result = await verifySIWA(
      message,
      signature,
      TEST_DOMAIN,
      () => false, // nonce invalid
      mockClient
    );

    if (!result.valid && result.code === SIWAErrorCode.INVALID_NONCE) {
      localPass('verifySIWA() \u{2192} rejects invalid nonce (INVALID_NONCE)');
    } else {
      localFail('verifySIWA() INVALID_NONCE', `Expected INVALID_NONCE, got: ${result.code}`);
    }
  } catch (err: any) {
    localFail('verifySIWA() INVALID_NONCE', err.message);
  }

  // ── Test 5: verifySIWA fails with domain mismatch ────────────────────
  try {
    const mockClient = createMockPublicClient(address);
    const result = await verifySIWA(
      message,
      signature,
      'different.domain.com', // wrong domain
      () => true,
      mockClient
    );

    if (!result.valid && result.code === SIWAErrorCode.DOMAIN_MISMATCH) {
      localPass('verifySIWA() \u{2192} rejects domain mismatch (DOMAIN_MISMATCH)');
    } else {
      localFail('verifySIWA() DOMAIN_MISMATCH', `Expected DOMAIN_MISMATCH, got: ${result.code}`);
    }
  } catch (err: any) {
    localFail('verifySIWA() DOMAIN_MISMATCH', err.message);
  }

  // ── Test 6: verifySIWA fails with expired message ────────────────────
  try {
    // Create an expired message
    const expiredMessage = buildSIWAMessage({
      domain: TEST_DOMAIN,
      address,
      statement: 'Sign in to test application.',
      uri: TEST_URI,
      agentId: TEST_AGENT_ID,
      agentRegistry: TEST_AGENT_REGISTRY,
      chainId: TEST_CHAIN_ID,
      nonce,
      issuedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago
      expirationTime: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // expired 5 min ago
    });
    const expiredSig = await signer.signMessage(expiredMessage);

    const mockClient = createMockPublicClient(address);
    const result = await verifySIWA(
      expiredMessage,
      expiredSig,
      TEST_DOMAIN,
      () => true,
      mockClient
    );

    if (!result.valid && result.code === SIWAErrorCode.MESSAGE_EXPIRED) {
      localPass('verifySIWA() \u{2192} rejects expired message (MESSAGE_EXPIRED)');
    } else {
      localFail('verifySIWA() MESSAGE_EXPIRED', `Expected MESSAGE_EXPIRED, got: ${result.code}`);
    }
  } catch (err: any) {
    localFail('verifySIWA() MESSAGE_EXPIRED', err.message);
  }

  // ── Test 7: verifySIWA fails with tampered signature ─────────────────
  try {
    const mockClient = createMockPublicClient(address);
    // Tamper with the signature
    const tamperedSig = signature.slice(0, -4) + 'ffff';
    const result = await verifySIWA(
      message,
      tamperedSig,
      TEST_DOMAIN,
      () => true,
      mockClient
    );

    // Accept either INVALID_SIGNATURE or VERIFICATION_FAILED (viem may throw on invalid sigs)
    if (!result.valid && (result.code === SIWAErrorCode.INVALID_SIGNATURE || result.code === SIWAErrorCode.VERIFICATION_FAILED)) {
      localPass('verifySIWA() \u{2192} rejects tampered signature');
    } else {
      localFail('verifySIWA() tampered signature', `Expected rejection, got: valid=${result.valid}, code=${result.code}`);
    }
  } catch (err: any) {
    localFail('verifySIWA() tampered signature', err.message);
  }

  // ── Test 8: verifySIWA with stateless nonce token ────────────────────
  try {
    const mockClient = createMockPublicClient(address);
    const secret = 'test-secret-for-nonce-token';

    // Create a valid stateless nonce token
    const payload = { nonce, address, iat: Date.now(), exp: Date.now() + 300000 };
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const crypto = await import('crypto');
    const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    const nonceToken = `${data}.${sig}`;

    const result = await verifySIWA(
      message,
      signature,
      TEST_DOMAIN,
      { nonceToken, secret },
      mockClient
    );

    if (result.valid) {
      localPass('verifySIWA() \u{2192} success with stateless nonce token');
    } else {
      localFail('verifySIWA() stateless nonce', `Expected valid=true, got: ${result.code}`);
    }
  } catch (err: any) {
    localFail('verifySIWA() stateless nonce', err.message);
  }

  return { passed: localPassed, failed: localFailed };
}

/**
 * Main test flow: runs tests for all signer types
 */
export async function testSignersFlow(): Promise<boolean> {
  console.log(chalk.bold('SIWA Signer Test Suite'));
  console.log('\u{2550}'.repeat(50));

  passed = 0;
  failed = 0;

  // ── Test 1: viem Private Key Signer ──────────────────────────────
  const privateKey = generatePrivateKey();
  const privateKeyAccount = privateKeyToAccount(privateKey);
  const viemSigner = createLocalAccountSigner(privateKeyAccount);

  const privateKeyResult = await testSigner({
    name: 'createLocalAccountSigner (viem privateKeyToAccount)',
    getSigner: async () => viemSigner,
  });

  passed += privateKeyResult.passed;
  failed += privateKeyResult.failed;

  // ── Test 2: verifySIWA with mocked PublicClient (viem signer) ────
  const verifyResult = await testVerifySIWA(viemSigner);
  passed += verifyResult.passed;
  failed += verifyResult.failed;

  // ── Test 3: Keyring Proxy Signer ─────────────────────────────────
  const keyringResult = await testSigner({
    name: 'createKeyringProxySigner (keyring proxy)',
    getSigner: async () => getSigner(),
    skipIfUnavailable: true,
  });

  passed += keyringResult.passed;
  failed += keyringResult.failed;

  // If keyring proxy is available, also run verifySIWA tests with it
  if (keyringResult.passed > 0) {
    try {
      const keyringSigner = getSigner();
      const keyringVerifyResult = await testVerifySIWA(keyringSigner);
      passed += keyringVerifyResult.passed;
      failed += keyringVerifyResult.failed;
    } catch {
      // Keyring not available, skip
    }
  }

  // ── Summary ──────────────────────────────────────────────────────
  console.log('');
  console.log('\u{2550}'.repeat(50));
  console.log(chalk.bold(`Total Results: ${passed} passed, ${failed} failed`));

  if (failed === 0) {
    console.log(chalk.green.bold('\u{2705} All signer tests passed!'));
    return true;
  } else {
    console.log(chalk.red.bold(`\u{274C} ${failed} test(s) failed`));
    return false;
  }
}

/**
 * Focused test: only viem private key (no external dependencies)
 */
export async function testViemSignerFlow(): Promise<boolean> {
  console.log(chalk.bold('SIWA Signer Test Suite (viem only)'));
  console.log('\u{2550}'.repeat(50));

  passed = 0;
  failed = 0;

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const signer = createLocalAccountSigner(account);

  console.log(chalk.dim(`Generated test account: ${account.address}`));

  const result = await testSigner({
    name: 'createLocalAccountSigner (viem privateKeyToAccount)',
    getSigner: async () => signer,
  });

  passed = result.passed;
  failed = result.failed;

  // Also run verifySIWA tests
  const verifyResult = await testVerifySIWA(signer);
  passed += verifyResult.passed;
  failed += verifyResult.failed;

  console.log('');
  console.log('\u{2550}'.repeat(50));
  console.log(chalk.bold(`Results: ${passed} passed, ${failed} failed`));

  if (failed === 0) {
    console.log(chalk.green.bold('\u{2705} All viem signer tests passed!'));
    return true;
  } else {
    console.log(chalk.red.bold(`\u{274C} ${failed} test(s) failed`));
    return false;
  }
}

/**
 * Focused test: only keyring proxy
 */
export async function testKeyringSignerFlow(): Promise<boolean> {
  console.log(chalk.bold('SIWA Signer Test Suite (keyring proxy only)'));
  console.log('\u{2550}'.repeat(50));

  passed = 0;
  failed = 0;

  const signer = getSigner();

  const result = await testSigner({
    name: 'createKeyringProxySigner (keyring proxy)',
    getSigner: async () => signer,
    skipIfUnavailable: false,
  });

  passed = result.passed;
  failed = result.failed;

  // If signer tests passed, also run verifySIWA tests
  if (result.passed > 0) {
    const verifyResult = await testVerifySIWA(signer);
    passed += verifyResult.passed;
    failed += verifyResult.failed;
  }

  console.log('');
  console.log('\u{2550}'.repeat(50));
  console.log(chalk.bold(`Results: ${passed} passed, ${failed} failed`));

  if (failed === 0) {
    console.log(chalk.green.bold('\u{2705} All keyring signer tests passed!'));
    return true;
  } else {
    console.log(chalk.red.bold(`\u{274C} ${failed} test(s) failed`));
    return false;
  }
}
