/**
 * Pure unit tests for x402 payment protocol integration.
 *
 * Tests:
 *   1. x402 core — encode/decode, processX402Payment with mock facilitator
 *   2. Express middleware — SIWA gate (always required), x402 payment gate, CORS
 *
 * Uses a local viem account for real SIWA signatures (no server needed).
 */

import chalk from 'chalk';
import { privateKeyToAccount } from 'viem/accounts';
import { createLocalAccountSigner } from '@buildersgarden/siwa/signer';
import { createReceipt } from '@buildersgarden/siwa/receipt';
import { signAuthenticatedRequest } from '@buildersgarden/siwa/erc8128';
import {
  X402_HEADERS,
  encodeX402Header,
  decodeX402Header,
  processX402Payment,
  type PaymentPayload,
  type PaymentRequirements,
  type FacilitatorClient,
} from '@buildersgarden/siwa/x402';
import {
  siwaMiddleware,
  siwaCors,
} from '@buildersgarden/siwa/express';

let passed = 0;
let failed = 0;

function pass(label: string) {
  passed++;
  console.log(chalk.green(`  \u2705 ${label}`));
}

function fail(label: string, detail?: string) {
  failed++;
  console.log(chalk.red(`  \u274C ${label}`));
  if (detail) console.log(chalk.dim(`     ${detail}`));
}

// ─── Crypto fixtures ────────────────────────────────────────────────

// Hardhat account #0 — deterministic, no real funds
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const TEST_SECRET = 'test-receipt-secret';
const TEST_CHAIN_ID = 84532;
const TEST_REGISTRY = 'eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e';

const account = privateKeyToAccount(TEST_PRIVATE_KEY as `0x${string}`);
const signer = createLocalAccountSigner(account);

/**
 * Create a mock Express request with valid SIWA headers (real signatures).
 * Optionally includes x402 payment header.
 */
async function createSignedMockReq(options?: {
  paymentHeader?: string;
  method?: string;
  path?: string;
  body?: string;
}): Promise<any> {
  const method = options?.method ?? 'GET';
  const path = options?.path ?? '/api/data';
  const url = `http://localhost:3000${path}`;

  const { receipt } = createReceipt(
    {
      address: account.address,
      agentId: 1,
      agentRegistry: TEST_REGISTRY,
      chainId: TEST_CHAIN_ID,
      verified: 'offline',
    },
    { secret: TEST_SECRET },
  );

  const init: RequestInit = { method };
  if (options?.body) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = options.body;
  }

  const request = new Request(url, init);
  const signedRequest = await signAuthenticatedRequest(request, receipt, signer, TEST_CHAIN_ID);

  // Extract headers into plain object for mock Express req
  const headers: Record<string, string> = {};
  signedRequest.headers.forEach((value, key) => {
    headers[key] = value;
  });

  // Add payment header if provided
  if (options?.paymentHeader) {
    headers[X402_HEADERS.PAYMENT_SIGNATURE.toLowerCase()] = options.paymentHeader;
  }

  // Add host header
  headers['host'] = 'localhost:3000';

  return {
    method,
    protocol: 'http',
    originalUrl: path,
    headers,
    rawBody: options?.body,
    get(name: string) {
      const lower = name.toLowerCase();
      for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase() === lower) return v;
      }
      return undefined;
    },
  };
}

// ─── Test fixtures ──────────────────────────────────────────────────

const MOCK_ACCEPTS: PaymentRequirements[] = [
  {
    scheme: 'exact',
    network: 'eip155:84532',
    amount: '10000',
    asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    payTo: '0x1234567890abcdef1234567890abcdef12345678',
    maxTimeoutSeconds: 60,
  },
];

const MOCK_PAYLOAD: PaymentPayload = {
  signature: '0xdeadbeef',
  payment: {
    scheme: 'exact',
    network: 'eip155:84532',
    amount: '10000',
    asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    payTo: '0x1234567890abcdef1234567890abcdef12345678',
    nonce: 'abc123',
  },
  resource: { url: '/api/data', description: 'Premium data' },
};

function createMockFacilitator(overrides?: {
  verifyValid?: boolean;
  verifyReason?: string;
  settleSuccess?: boolean;
  settleReason?: string;
  txHash?: string;
}): FacilitatorClient {
  return {
    async verify() {
      return {
        valid: overrides?.verifyValid ?? true,
        reason: overrides?.verifyReason,
      };
    },
    async settle() {
      return {
        success: overrides?.settleSuccess ?? true,
        txHash: overrides?.txHash ?? '0xtxhash123',
        reason: overrides?.settleReason,
      };
    },
  };
}

// ─── Mock Express res / next ────────────────────────────────────────

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  headersSent: boolean;
  status(code: number): MockResponse;
  json(data: any): void;
  setHeader(name: string, value: string): void;
  header(name: string, value: string): void;
  sendStatus(code: number): void;
}

function createMockRes(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    headers: {},
    body: null,
    headersSent: false,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: any) {
      res.body = data;
      res.headersSent = true;
    },
    setHeader(name: string, value: string) {
      res.headers[name] = value;
    },
    header(name: string, value: string) {
      res.headers[name] = value;
    },
    sendStatus(code: number) {
      res.statusCode = code;
      res.headersSent = true;
    },
  };
  return res;
}

function createMockReq(overrides?: {
  method?: string;
  headers?: Record<string, string | undefined>;
  protocol?: string;
  originalUrl?: string;
  rawBody?: string;
}): any {
  const headers = overrides?.headers ?? {};
  return {
    method: overrides?.method ?? 'GET',
    protocol: overrides?.protocol ?? 'http',
    originalUrl: overrides?.originalUrl ?? '/api/data',
    headers,
    rawBody: overrides?.rawBody,
    get(name: string) {
      const lower = name.toLowerCase();
      for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase() === lower) return v;
      }
      return undefined;
    },
  };
}

// ─── x402 Core Tests ────────────────────────────────────────────────

async function testEncodeDecodeRoundTrip() {
  try {
    const data = { foo: 'bar', num: 42, nested: { a: [1, 2, 3] } };
    const encoded = encodeX402Header(data);
    const decoded = decodeX402Header(encoded);
    JSON.stringify(decoded) === JSON.stringify(data)
      ? pass('encodeX402Header / decodeX402Header round-trip')
      : fail('encode/decode round-trip', `Got ${JSON.stringify(decoded)}`);
  } catch (err: any) {
    fail('encode/decode round-trip', err.message);
  }
}

async function testDecodeTyped() {
  try {
    const original = { scheme: 'exact', amount: '1000' };
    const encoded = encodeX402Header(original);
    const decoded = decodeX402Header<{ scheme: string; amount: string }>(encoded);
    decoded.scheme === 'exact' && decoded.amount === '1000'
      ? pass('decodeX402Header with typed generic')
      : fail('decode typed', `scheme=${decoded.scheme}, amount=${decoded.amount}`);
  } catch (err: any) {
    fail('decode typed', err.message);
  }
}

async function testDecodeInvalid() {
  try {
    decodeX402Header('not-valid-base64!!!');
    fail('decodeX402Header rejects invalid input', 'Expected throw');
  } catch {
    pass('decodeX402Header rejects invalid input');
  }
}

async function testHeaderConstants() {
  try {
    const ok =
      X402_HEADERS.PAYMENT_REQUIRED === 'Payment-Required' &&
      X402_HEADERS.PAYMENT_SIGNATURE === 'Payment-Signature' &&
      X402_HEADERS.PAYMENT_RESPONSE === 'Payment-Response';
    ok ? pass('X402_HEADERS constants are correct') : fail('X402_HEADERS', JSON.stringify(X402_HEADERS));
  } catch (err: any) {
    fail('X402_HEADERS', err.message);
  }
}

async function testProcessPaymentSuccess() {
  try {
    const facilitator = createMockFacilitator({ txHash: '0xabc' });
    const result = await processX402Payment(MOCK_PAYLOAD, MOCK_ACCEPTS, facilitator);

    if (!result.valid) {
      fail('processX402Payment success', result.error);
      return;
    }

    const ok =
      result.payment.scheme === 'exact' &&
      result.payment.network === 'eip155:84532' &&
      result.payment.amount === '10000' &&
      result.payment.txHash === '0xabc';

    ok
      ? pass('processX402Payment succeeds with correct payment fields')
      : fail('processX402Payment success', JSON.stringify(result.payment));
  } catch (err: any) {
    fail('processX402Payment success', err.message);
  }
}

async function testProcessPaymentVerifyFails() {
  try {
    const facilitator = createMockFacilitator({ verifyValid: false, verifyReason: 'bad sig' });
    const result = await processX402Payment(MOCK_PAYLOAD, MOCK_ACCEPTS, facilitator);

    !result.valid && result.error.includes('bad sig')
      ? pass('processX402Payment returns error when verify fails')
      : fail('processX402Payment verify fail', `valid=${result.valid}`);
  } catch (err: any) {
    fail('processX402Payment verify fail', err.message);
  }
}

async function testProcessPaymentSettleFails() {
  try {
    const facilitator = createMockFacilitator({
      verifyValid: true,
      settleSuccess: false,
      settleReason: 'insufficient funds',
    });
    const result = await processX402Payment(MOCK_PAYLOAD, MOCK_ACCEPTS, facilitator);

    !result.valid && result.error.includes('insufficient funds')
      ? pass('processX402Payment returns error when settle fails')
      : fail('processX402Payment settle fail', `valid=${result.valid}`);
  } catch (err: any) {
    fail('processX402Payment settle fail', err.message);
  }
}

async function testProcessPaymentPreservesPayTo() {
  try {
    const facilitator = createMockFacilitator();
    const result = await processX402Payment(MOCK_PAYLOAD, MOCK_ACCEPTS, facilitator);

    if (!result.valid) {
      fail('processX402Payment preserves payTo', result.error);
      return;
    }

    result.payment.payTo === MOCK_PAYLOAD.payment.payTo
      ? pass('processX402Payment preserves payTo address')
      : fail('processX402Payment payTo', `Expected ${MOCK_PAYLOAD.payment.payTo}, got ${result.payment.payTo}`);
  } catch (err: any) {
    fail('processX402Payment payTo', err.message);
  }
}

// ─── Express middleware: SIWA gate tests ─────────────────────────────

async function testMiddlewareNoHeaders401() {
  try {
    const middleware = siwaMiddleware({ receiptSecret: TEST_SECRET });
    const req = createMockReq();
    const res = createMockRes();
    let nextCalled = false;

    await (middleware as any)(req, res, () => { nextCalled = true; });

    res.statusCode === 401 && !nextCalled
      ? pass('no headers → 401 (SIWA only)')
      : fail('no headers 401', `status=${res.statusCode}, next=${nextCalled}`);
  } catch (err: any) {
    fail('no headers 401', err.message);
  }
}

async function testMiddlewareNoHeadersWithX402Still401() {
  try {
    const facilitator = createMockFacilitator();
    const middleware = siwaMiddleware({
      receiptSecret: TEST_SECRET,
      x402: {
        facilitator,
        resource: { url: '/api/data', description: 'Premium' },
        accepts: MOCK_ACCEPTS,
      },
    });

    const req = createMockReq();
    const res = createMockRes();
    let nextCalled = false;

    await (middleware as any)(req, res, () => { nextCalled = true; });

    // SIWA gate comes first — no headers means 401, not 402
    res.statusCode === 401 && !nextCalled
      ? pass('no headers + x402 configured → 401 (SIWA gate first)')
      : fail('no headers x402 401', `status=${res.statusCode}, next=${nextCalled}`);
  } catch (err: any) {
    fail('no headers x402 401', err.message);
  }
}

async function testMiddlewareInvalidSiwaWithX402Still401() {
  try {
    const facilitator = createMockFacilitator();
    const middleware = siwaMiddleware({
      receiptSecret: TEST_SECRET,
      x402: {
        facilitator,
        resource: { url: '/api/data', description: 'Premium' },
        accepts: MOCK_ACCEPTS,
      },
    });

    // Invalid SIWA headers — verification will fail
    const req = createMockReq({
      headers: {
        signature: 'invalid-sig',
        'x-siwa-receipt': 'invalid-receipt',
        host: 'localhost:3000',
      },
    });
    const res = createMockRes();
    let nextCalled = false;

    await (middleware as any)(req, res, () => { nextCalled = true; });

    res.statusCode === 401 && !nextCalled
      ? pass('invalid SIWA + x402 configured → 401 (SIWA gate rejects)')
      : fail('invalid SIWA x402 401', `status=${res.statusCode}, next=${nextCalled}`);
  } catch (err: any) {
    fail('invalid SIWA x402 401', err.message);
  }
}

async function testMiddlewarePaymentOnlyNoSiwa401() {
  try {
    const facilitator = createMockFacilitator();
    const middleware = siwaMiddleware({
      receiptSecret: TEST_SECRET,
      x402: {
        facilitator,
        resource: { url: '/api/data', description: 'Premium' },
        accepts: MOCK_ACCEPTS,
      },
    });

    // Payment header present but no SIWA headers
    const paymentHeader = encodeX402Header(MOCK_PAYLOAD);
    const req = createMockReq({
      headers: {
        [X402_HEADERS.PAYMENT_SIGNATURE.toLowerCase()]: paymentHeader,
        host: 'localhost:3000',
      },
    });
    const res = createMockRes();
    let nextCalled = false;

    await (middleware as any)(req, res, () => { nextCalled = true; });

    res.statusCode === 401 && !nextCalled
      ? pass('payment header only (no SIWA) → 401 (SIWA required)')
      : fail('payment only 401', `status=${res.statusCode}, next=${nextCalled}`);
  } catch (err: any) {
    fail('payment only 401', err.message);
  }
}

// ─── Express middleware: SIWA-only mode ──────────────────────────────

async function testMiddlewareSiwaOnlySuccess() {
  try {
    const middleware = siwaMiddleware({ receiptSecret: TEST_SECRET });
    const req = await createSignedMockReq();
    const res = createMockRes();
    let nextCalled = false;

    await (middleware as any)(req, res, () => { nextCalled = true; });

    if (!nextCalled) {
      fail('valid SIWA → next() (SIWA only)', `status=${res.statusCode}, body=${JSON.stringify(res.body)}`);
      return;
    }

    req.agent?.address?.toLowerCase() === account.address.toLowerCase()
      ? pass('valid SIWA → req.agent set + next() (SIWA only)')
      : fail('valid SIWA agent', `agent=${JSON.stringify(req.agent)}`);
  } catch (err: any) {
    fail('valid SIWA only', err.message);
  }
}

// ─── Express middleware: SIWA + x402 mode ────────────────────────────

async function testMiddlewareSiwaOkNoPayment402() {
  try {
    const facilitator = createMockFacilitator();
    const middleware = siwaMiddleware({
      receiptSecret: TEST_SECRET,
      x402: {
        facilitator,
        resource: { url: '/api/data', description: 'Premium' },
        accepts: MOCK_ACCEPTS,
      },
    });

    // Valid SIWA but no payment header
    const req = await createSignedMockReq();
    const res = createMockRes();
    let nextCalled = false;

    await (middleware as any)(req, res, () => { nextCalled = true; });

    if (res.statusCode !== 402 || nextCalled) {
      fail('valid SIWA + no payment → 402', `status=${res.statusCode}, next=${nextCalled}`);
      return;
    }

    // Should have Payment-Required header
    const prHeader = res.headers[X402_HEADERS.PAYMENT_REQUIRED];
    if (!prHeader) {
      fail('valid SIWA + no payment → 402', 'Missing Payment-Required header');
      return;
    }

    const decoded = decodeX402Header<{ accepts: any[]; resource: any }>(prHeader);
    decoded.accepts.length === 1 && decoded.resource.url === '/api/data'
      ? pass('valid SIWA + no payment → 402 + Payment-Required header')
      : fail('SIWA ok no payment 402 payload', JSON.stringify(decoded));
  } catch (err: any) {
    fail('valid SIWA no payment 402', err.message);
  }
}

async function testMiddlewareSiwaOkValidPaymentSuccess() {
  try {
    const facilitator = createMockFacilitator({ txHash: '0xsettled' });
    const middleware = siwaMiddleware({
      receiptSecret: TEST_SECRET,
      x402: {
        facilitator,
        resource: { url: '/api/data', description: 'Premium' },
        accepts: MOCK_ACCEPTS,
      },
    });

    const paymentHeader = encodeX402Header(MOCK_PAYLOAD);
    const req = await createSignedMockReq({ paymentHeader });
    const res = createMockRes();
    let nextCalled = false;

    await (middleware as any)(req, res, () => { nextCalled = true; });

    if (!nextCalled) {
      fail('valid SIWA + valid payment → next()', `status=${res.statusCode}, body=${JSON.stringify(res.body)}`);
      return;
    }

    const hasAgent = req.agent?.address?.toLowerCase() === account.address.toLowerCase();
    const hasPayment = req.payment?.scheme === 'exact' && req.payment?.txHash === '0xsettled';

    hasAgent && hasPayment
      ? pass('valid SIWA + valid payment → req.agent + req.payment + next()')
      : fail('SIWA+payment success', `agent=${JSON.stringify(req.agent)}, payment=${JSON.stringify(req.payment)}`);
  } catch (err: any) {
    fail('valid SIWA + valid payment', err.message);
  }
}

async function testMiddlewarePaymentResponseHeader() {
  try {
    const facilitator = createMockFacilitator({ txHash: '0xresp' });
    const middleware = siwaMiddleware({
      receiptSecret: TEST_SECRET,
      x402: {
        facilitator,
        resource: { url: '/api/data', description: 'Premium' },
        accepts: MOCK_ACCEPTS,
      },
    });

    const paymentHeader = encodeX402Header(MOCK_PAYLOAD);
    const req = await createSignedMockReq({ paymentHeader });
    const res = createMockRes();

    await (middleware as any)(req, res, () => {});

    const responseHeader = res.headers[X402_HEADERS.PAYMENT_RESPONSE];
    if (!responseHeader) {
      fail('Payment-Response header set on success', 'Header not set');
      return;
    }

    const decoded = decodeX402Header<{ txHash?: string }>(responseHeader);
    decoded.txHash === '0xresp'
      ? pass('Payment-Response header contains txHash')
      : fail('Payment-Response header', JSON.stringify(decoded));
  } catch (err: any) {
    fail('Payment-Response header', err.message);
  }
}

async function testMiddlewareSiwaOkInvalidPayment402() {
  try {
    const facilitator = createMockFacilitator({ verifyValid: false, verifyReason: 'bad signature' });
    const middleware = siwaMiddleware({
      receiptSecret: TEST_SECRET,
      x402: {
        facilitator,
        resource: { url: '/api/data', description: 'Premium' },
        accepts: MOCK_ACCEPTS,
      },
    });

    const paymentHeader = encodeX402Header(MOCK_PAYLOAD);
    const req = await createSignedMockReq({ paymentHeader });
    const res = createMockRes();
    let nextCalled = false;

    await (middleware as any)(req, res, () => { nextCalled = true; });

    res.statusCode === 402 && !nextCalled && res.body?.error?.includes('bad signature')
      ? pass('valid SIWA + invalid payment → 402 with error')
      : fail('SIWA ok invalid payment', `status=${res.statusCode}, body=${JSON.stringify(res.body)}`);
  } catch (err: any) {
    fail('SIWA ok invalid payment 402', err.message);
  }
}

async function testMiddlewareSiwaOkMalformedPayment402() {
  try {
    const facilitator = createMockFacilitator();
    const middleware = siwaMiddleware({
      receiptSecret: TEST_SECRET,
      x402: {
        facilitator,
        resource: { url: '/api/data', description: 'Premium' },
        accepts: MOCK_ACCEPTS,
      },
    });

    const req = await createSignedMockReq({ paymentHeader: 'not-valid-base64!!!' });
    const res = createMockRes();
    let nextCalled = false;

    await (middleware as any)(req, res, () => { nextCalled = true; });

    res.statusCode === 402 && !nextCalled
      ? pass('valid SIWA + malformed payment → 402')
      : fail('SIWA ok malformed payment', `status=${res.statusCode}, next=${nextCalled}`);
  } catch (err: any) {
    fail('SIWA ok malformed payment 402', err.message);
  }
}

// ─── CORS tests ─────────────────────────────────────────────────────

async function testCorsWithoutX402() {
  try {
    const middleware = siwaCors();
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();
    let nextCalled = false;

    (middleware as any)(req, res, () => { nextCalled = true; });

    const allowHeaders = res.headers['Access-Control-Allow-Headers'] ?? '';
    const hasNoPaymentHeaders = !allowHeaders.includes('Payment-Signature');

    hasNoPaymentHeaders && nextCalled
      ? pass('siwaCors without x402 → no payment headers')
      : fail('siwaCors no x402', `headers=${allowHeaders}, next=${nextCalled}`);
  } catch (err: any) {
    fail('siwaCors no x402', err.message);
  }
}

async function testCorsWithX402() {
  try {
    const middleware = siwaCors({ x402: true });
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();
    let nextCalled = false;

    (middleware as any)(req, res, () => { nextCalled = true; });

    const allowHeaders = res.headers['Access-Control-Allow-Headers'] ?? '';
    const exposeHeaders = res.headers['Access-Control-Expose-Headers'] ?? '';

    const hasPaymentSig = allowHeaders.includes('Payment-Signature');
    const hasPaymentRequired = exposeHeaders.includes('Payment-Required');
    const hasPaymentResponse = exposeHeaders.includes('Payment-Response');

    hasPaymentSig && hasPaymentRequired && hasPaymentResponse && nextCalled
      ? pass('siwaCors with x402 → includes payment + expose headers')
      : fail('siwaCors x402', `allow=${allowHeaders}, expose=${exposeHeaders}`);
  } catch (err: any) {
    fail('siwaCors x402', err.message);
  }
}

async function testCorsOptionsPreflight() {
  try {
    const middleware = siwaCors({ x402: true });
    const req = createMockReq({ method: 'OPTIONS' });
    const res = createMockRes();
    let nextCalled = false;

    (middleware as any)(req, res, () => { nextCalled = true; });

    res.statusCode === 204 && !nextCalled
      ? pass('siwaCors OPTIONS preflight → 204, no next()')
      : fail('siwaCors OPTIONS', `status=${res.statusCode}, next=${nextCalled}`);
  } catch (err: any) {
    fail('siwaCors OPTIONS', err.message);
  }
}

// ─── Entry point ────────────────────────────────────────────────────

export async function testX402Flow(): Promise<boolean> {
  console.log(chalk.bold('x402 Payment Protocol Tests'));
  console.log('\u2500'.repeat(40));

  // ── Core module ──
  console.log(chalk.cyan('\n  x402 Core'));
  await testEncodeDecodeRoundTrip();
  await testDecodeTyped();
  await testDecodeInvalid();
  await testHeaderConstants();
  await testProcessPaymentSuccess();
  await testProcessPaymentVerifyFails();
  await testProcessPaymentSettleFails();
  await testProcessPaymentPreservesPayTo();

  // ── Middleware: SIWA gate ──
  console.log(chalk.cyan('\n  Middleware: SIWA Gate'));
  await testMiddlewareNoHeaders401();
  await testMiddlewareNoHeadersWithX402Still401();
  await testMiddlewareInvalidSiwaWithX402Still401();
  await testMiddlewarePaymentOnlyNoSiwa401();

  // ── Middleware: SIWA only ──
  console.log(chalk.cyan('\n  Middleware: SIWA Only'));
  await testMiddlewareSiwaOnlySuccess();

  // ── Middleware: SIWA + x402 ──
  console.log(chalk.cyan('\n  Middleware: SIWA + x402'));
  await testMiddlewareSiwaOkNoPayment402();
  await testMiddlewareSiwaOkValidPaymentSuccess();
  await testMiddlewarePaymentResponseHeader();
  await testMiddlewareSiwaOkInvalidPayment402();
  await testMiddlewareSiwaOkMalformedPayment402();

  // ── CORS ──
  console.log(chalk.cyan('\n  CORS'));
  await testCorsWithoutX402();
  await testCorsWithX402();
  await testCorsOptionsPreflight();

  // ── Summary ──
  console.log('');
  console.log('\u2500'.repeat(40));
  const total = passed + failed;
  if (failed === 0) {
    console.log(chalk.green.bold(`  All ${total} x402 tests passed!`));
  } else {
    console.log(chalk.red.bold(`  ${failed}/${total} tests failed`));
  }
  console.log('');

  return failed === 0;
}
