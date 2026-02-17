/**
 * Pure unit tests for x402 payment protocol integration.
 *
 * Tests:
 *   1. x402 core — encode/decode, processX402Payment with mock facilitator
 *   2. Express middleware — SIWA gate (always required), x402 payment gate, CORS
 *   3. Next.js wrapper — x402 payment gate via withSiwa()
 *   4. Hono middleware — x402 payment gate via siwaMiddleware()
 *   5. Fastify preHandler — x402 payment gate via siwaAuth()
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
  createMemoryX402SessionStore,
  type PaymentPayload,
  type PaymentRequirements,
  type FacilitatorClient,
} from '@buildersgarden/siwa/x402';
import {
  siwaMiddleware,
  siwaCors,
} from '@buildersgarden/siwa/express';
import { withSiwa } from '@buildersgarden/siwa/next';
import { Hono } from 'hono';
import {
  siwaMiddleware as honoSiwaMiddleware,
  siwaCors as honoSiwaCors,
} from '@buildersgarden/siwa/hono';
import Fastify from 'fastify';
import {
  siwaAuth as fastifySiwaAuth,
} from '@buildersgarden/siwa/fastify';

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

// ─── Middleware: SIWX Sessions ───────────────────────────────────────

async function testSessionFirstRequestNoPayment402() {
  try {
    const sessionStore = createMemoryX402SessionStore();
    const facilitator = createMockFacilitator();
    const middleware = siwaMiddleware({
      receiptSecret: TEST_SECRET,
      x402: {
        facilitator,
        resource: { url: '/api/data', description: 'Premium' },
        accepts: MOCK_ACCEPTS,
        session: { store: sessionStore, ttl: 60_000 },
      },
    });

    // Valid SIWA but no payment, no session yet → 402
    const req = await createSignedMockReq();
    const res = createMockRes();
    let nextCalled = false;

    await (middleware as any)(req, res, () => { nextCalled = true; });

    res.statusCode === 402 && !nextCalled
      ? pass('SIWX: first request without payment → 402')
      : fail('SIWX first 402', `status=${res.statusCode}, next=${nextCalled}`);
  } catch (err: any) {
    fail('SIWX first 402', err.message);
  }
}

async function testSessionPaymentCreatesSession() {
  try {
    const sessionStore = createMemoryX402SessionStore();
    const facilitator = createMockFacilitator({ txHash: '0xsiwx' });
    const middleware = siwaMiddleware({
      receiptSecret: TEST_SECRET,
      x402: {
        facilitator,
        resource: { url: '/api/data', description: 'Premium' },
        accepts: MOCK_ACCEPTS,
        session: { store: sessionStore, ttl: 60_000 },
      },
    });

    // First request with payment → should succeed + create session
    const paymentHeader = encodeX402Header(MOCK_PAYLOAD);
    const req = await createSignedMockReq({ paymentHeader });
    const res = createMockRes();
    let nextCalled = false;

    await (middleware as any)(req, res, () => { nextCalled = true; });

    if (!nextCalled) {
      fail('SIWX: payment creates session', `status=${res.statusCode}, body=${JSON.stringify(res.body)}`);
      return;
    }

    // Verify session was stored
    const session = await sessionStore.get(account.address.toLowerCase(), '/api/data');
    session && session.txHash === '0xsiwx'
      ? pass('SIWX: payment succeeds + session created with txHash')
      : fail('SIWX session created', `session=${JSON.stringify(session)}`);
  } catch (err: any) {
    fail('SIWX session created', err.message);
  }
}

async function testSessionSecondRequestSkipsPayment() {
  try {
    const sessionStore = createMemoryX402SessionStore();
    const facilitator = createMockFacilitator({ txHash: '0xsiwx2' });
    const middleware = siwaMiddleware({
      receiptSecret: TEST_SECRET,
      x402: {
        facilitator,
        resource: { url: '/api/data', description: 'Premium' },
        accepts: MOCK_ACCEPTS,
        session: { store: sessionStore, ttl: 60_000 },
      },
    });

    // First request: pay
    const paymentHeader = encodeX402Header(MOCK_PAYLOAD);
    const req1 = await createSignedMockReq({ paymentHeader });
    const res1 = createMockRes();
    await (middleware as any)(req1, res1, () => {});

    // Second request: SIWA only (no payment header) → should pass via session
    const req2 = await createSignedMockReq();
    const res2 = createMockRes();
    let nextCalled = false;

    await (middleware as any)(req2, res2, () => { nextCalled = true; });

    nextCalled && !res2.headersSent
      ? pass('SIWX: second request (session active) → next() without payment')
      : fail('SIWX session skip', `status=${res2.statusCode}, next=${nextCalled}`);
  } catch (err: any) {
    fail('SIWX session skip', err.message);
  }
}

async function testSessionReqPaymentPresence() {
  try {
    const sessionStore = createMemoryX402SessionStore();
    const facilitator = createMockFacilitator({ txHash: '0xpay' });
    const middleware = siwaMiddleware({
      receiptSecret: TEST_SECRET,
      x402: {
        facilitator,
        resource: { url: '/api/data', description: 'Premium' },
        accepts: MOCK_ACCEPTS,
        session: { store: sessionStore, ttl: 60_000 },
      },
    });

    // First request with payment → req.payment should be set
    const paymentHeader = encodeX402Header(MOCK_PAYLOAD);
    const req1 = await createSignedMockReq({ paymentHeader });
    const res1 = createMockRes();
    await (middleware as any)(req1, res1, () => {});
    const firstHasPayment = !!req1.payment;

    // Second request via session → req.payment should NOT be set
    const req2 = await createSignedMockReq();
    const res2 = createMockRes();
    await (middleware as any)(req2, res2, () => {});
    const secondHasPayment = !!req2.payment;

    firstHasPayment && !secondHasPayment
      ? pass('SIWX: req.payment set on first request, absent on session request')
      : fail('SIWX req.payment', `first=${firstHasPayment}, second=${secondHasPayment}`);
  } catch (err: any) {
    fail('SIWX req.payment', err.message);
  }
}

async function testSessionExpiry() {
  try {
    const sessionStore = createMemoryX402SessionStore();
    const facilitator = createMockFacilitator({ txHash: '0xexp' });
    // TTL of 1ms — will expire almost instantly
    const middleware = siwaMiddleware({
      receiptSecret: TEST_SECRET,
      x402: {
        facilitator,
        resource: { url: '/api/data', description: 'Premium' },
        accepts: MOCK_ACCEPTS,
        session: { store: sessionStore, ttl: 1 },
      },
    });

    // First request: pay
    const paymentHeader = encodeX402Header(MOCK_PAYLOAD);
    const req1 = await createSignedMockReq({ paymentHeader });
    const res1 = createMockRes();
    await (middleware as any)(req1, res1, () => {});

    // Wait for TTL to expire
    await new Promise((r) => setTimeout(r, 10));

    // Second request: session expired → 402
    const req2 = await createSignedMockReq();
    const res2 = createMockRes();
    let nextCalled = false;

    await (middleware as any)(req2, res2, () => { nextCalled = true; });

    res2.statusCode === 402 && !nextCalled
      ? pass('SIWX: expired session → 402 (payment required again)')
      : fail('SIWX expiry', `status=${res2.statusCode}, next=${nextCalled}`);
  } catch (err: any) {
    fail('SIWX expiry', err.message);
  }
}

async function testSessionNoSharingBetweenAgents() {
  try {
    const sessionStore = createMemoryX402SessionStore();
    const facilitator = createMockFacilitator({ txHash: '0xagent1' });
    const middleware = siwaMiddleware({
      receiptSecret: TEST_SECRET,
      x402: {
        facilitator,
        resource: { url: '/api/data', description: 'Premium' },
        accepts: MOCK_ACCEPTS,
        session: { store: sessionStore, ttl: 60_000 },
      },
    });

    // Agent 1 pays
    const paymentHeader = encodeX402Header(MOCK_PAYLOAD);
    const req1 = await createSignedMockReq({ paymentHeader });
    const res1 = createMockRes();
    await (middleware as any)(req1, res1, () => {});

    // Agent 2 (different key) — create a different signer
    const { privateKeyToAccount: pk2a } = await import('viem/accounts');
    const { createLocalAccountSigner: cls2 } = await import('@buildersgarden/siwa/signer');
    const { signAuthenticatedRequest: sar2 } = await import('@buildersgarden/siwa/erc8128');
    const { createReceipt: cr2 } = await import('@buildersgarden/siwa/receipt');

    // Hardhat account #1
    const otherKey = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
    const otherAccount = pk2a(otherKey as `0x${string}`);
    const otherSigner = cls2(otherAccount);

    const { receipt: otherReceipt } = cr2(
      {
        address: otherAccount.address,
        agentId: 2,
        agentRegistry: TEST_REGISTRY,
        chainId: TEST_CHAIN_ID,
        verified: 'offline',
      },
      { secret: TEST_SECRET },
    );

    const otherRequest = new Request('http://localhost:3000/api/data', { method: 'GET' });
    const signedOther = await sar2(otherRequest, otherReceipt, otherSigner, TEST_CHAIN_ID);

    const otherHeaders: Record<string, string> = {};
    signedOther.headers.forEach((value, key) => { otherHeaders[key] = value; });
    otherHeaders['host'] = 'localhost:3000';

    const req2: any = {
      method: 'GET',
      protocol: 'http',
      originalUrl: '/api/data',
      headers: otherHeaders,
      get(name: string) {
        const lower = name.toLowerCase();
        for (const [k, v] of Object.entries(otherHeaders)) {
          if (k.toLowerCase() === lower) return v;
        }
        return undefined;
      },
    };
    const res2 = createMockRes();
    let nextCalled = false;

    await (middleware as any)(req2, res2, () => { nextCalled = true; });

    // Agent 2 should get 402 — no session sharing
    res2.statusCode === 402 && !nextCalled
      ? pass('SIWX: different agent address → no session sharing → 402')
      : fail('SIWX no sharing', `status=${res2.statusCode}, next=${nextCalled}`);
  } catch (err: any) {
    fail('SIWX no sharing', err.message);
  }
}

async function testSessionNoSharingBetweenRoutes() {
  try {
    const sessionStore = createMemoryX402SessionStore();
    const facilitator = createMockFacilitator({ txHash: '0xroute1' });

    // Route 1: /api/cheap — agent pays here
    const middleware1 = siwaMiddleware({
      receiptSecret: TEST_SECRET,
      x402: {
        facilitator,
        resource: { url: '/api/cheap', description: 'Cheap' },
        accepts: MOCK_ACCEPTS,
        session: { store: sessionStore, ttl: 60_000 },
      },
    });

    const paymentHeader = encodeX402Header(MOCK_PAYLOAD);
    const req1 = await createSignedMockReq({ paymentHeader, path: '/api/cheap' });
    const res1 = createMockRes();
    await (middleware1 as any)(req1, res1, () => {});

    // Route 2: /api/expensive — same store, same agent, different resource
    const middleware2 = siwaMiddleware({
      receiptSecret: TEST_SECRET,
      x402: {
        facilitator,
        resource: { url: '/api/expensive', description: 'Expensive' },
        accepts: MOCK_ACCEPTS,
        session: { store: sessionStore, ttl: 60_000 },
      },
    });

    const req2 = await createSignedMockReq({ path: '/api/expensive' });
    const res2 = createMockRes();
    let nextCalled = false;

    await (middleware2 as any)(req2, res2, () => { nextCalled = true; });

    // Should get 402 — session for /api/cheap doesn't grant /api/expensive
    res2.statusCode === 402 && !nextCalled
      ? pass('SIWX: session for /api/cheap does not grant /api/expensive → 402')
      : fail('SIWX route isolation', `status=${res2.statusCode}, next=${nextCalled}`);
  } catch (err: any) {
    fail('SIWX route isolation', err.message);
  }
}

// ─── Helper: create signed web-standard Request ─────────────────────

async function createSignedFetchRequest(options?: {
  paymentHeader?: string;
  method?: string;
  path?: string;
  body?: string;
}): Promise<Request> {
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
  const signed = await signAuthenticatedRequest(request, receipt, signer, TEST_CHAIN_ID);

  // If payment header requested, clone with extra header
  if (options?.paymentHeader) {
    const headers = new Headers(signed.headers);
    headers.set(X402_HEADERS.PAYMENT_SIGNATURE.toLowerCase(), options.paymentHeader);
    return new Request(signed.url, {
      method: signed.method,
      headers,
      body: signed.method !== 'GET' && signed.method !== 'HEAD' ? await signed.clone().text() : undefined,
    });
  }

  return signed;
}

// ─── Next.js x402 Tests ─────────────────────────────────────────────

async function testNextSiwaOkNoPayment402() {
  try {
    const facilitator = createMockFacilitator();
    const handler = withSiwa(
      (agent) => ({ ok: true, address: agent.address }),
      {
        receiptSecret: TEST_SECRET,
        x402: {
          facilitator,
          resource: { url: '/api/data', description: 'Premium' },
          accepts: MOCK_ACCEPTS,
        },
      },
    );

    const req = await createSignedFetchRequest();
    const res = await handler(req);

    if (res.status !== 402) {
      fail('Next.js: valid SIWA + no payment → 402', `status=${res.status}`);
      return;
    }

    const prHeader = res.headers.get(X402_HEADERS.PAYMENT_REQUIRED);
    prHeader
      ? pass('Next.js: valid SIWA + no payment → 402 + Payment-Required header')
      : fail('Next.js: 402 missing Payment-Required header');
  } catch (err: any) {
    fail('Next.js: no payment 402', err.message);
  }
}

async function testNextSiwaOkValidPaymentSuccess() {
  try {
    const facilitator = createMockFacilitator({ txHash: '0xnext' });
    let receivedPayment: any = undefined;

    const handler = withSiwa(
      (agent, _req, payment) => {
        receivedPayment = payment;
        return { ok: true, address: agent.address };
      },
      {
        receiptSecret: TEST_SECRET,
        x402: {
          facilitator,
          resource: { url: '/api/data', description: 'Premium' },
          accepts: MOCK_ACCEPTS,
        },
      },
    );

    const paymentHeader = encodeX402Header(MOCK_PAYLOAD);
    const req = await createSignedFetchRequest({ paymentHeader });
    const res = await handler(req);

    if (res.status !== 200) {
      fail('Next.js: valid SIWA + valid payment → 200', `status=${res.status}`);
      return;
    }

    const hasPaymentResponse = res.headers.get(X402_HEADERS.PAYMENT_RESPONSE);
    receivedPayment?.txHash === '0xnext' && hasPaymentResponse
      ? pass('Next.js: valid SIWA + valid payment → handler receives payment + Payment-Response header')
      : fail('Next.js: payment success', `payment=${JSON.stringify(receivedPayment)}`);
  } catch (err: any) {
    fail('Next.js: payment success', err.message);
  }
}

async function testNextSessionPayThenSkip() {
  try {
    const sessionStore = createMemoryX402SessionStore();
    const facilitator = createMockFacilitator({ txHash: '0xnextsess' });

    const handler = withSiwa(
      (agent) => ({ ok: true, address: agent.address }),
      {
        receiptSecret: TEST_SECRET,
        x402: {
          facilitator,
          resource: { url: '/api/data', description: 'Premium' },
          accepts: MOCK_ACCEPTS,
          session: { store: sessionStore, ttl: 60_000 },
        },
      },
    );

    // First: pay
    const paymentHeader = encodeX402Header(MOCK_PAYLOAD);
    const req1 = await createSignedFetchRequest({ paymentHeader });
    const res1 = await handler(req1);

    if (res1.status !== 200) {
      fail('Next.js: session pay-then-skip', `first status=${res1.status}`);
      return;
    }

    // Second: no payment, session should grant access
    const req2 = await createSignedFetchRequest();
    const res2 = await handler(req2);

    res2.status === 200
      ? pass('Next.js: session — second request passes without payment')
      : fail('Next.js: session skip', `second status=${res2.status}`);
  } catch (err: any) {
    fail('Next.js: session', err.message);
  }
}

// ─── Hono x402 Tests ────────────────────────────────────────────────

async function testHonoSiwaOkNoPayment402() {
  try {
    const facilitator = createMockFacilitator();
    const app = new Hono();
    app.use('*', honoSiwaCors({ x402: true }));
    app.get(
      '/api/data',
      honoSiwaMiddleware({
        receiptSecret: TEST_SECRET,
        x402: {
          facilitator,
          resource: { url: '/api/data', description: 'Premium' },
          accepts: MOCK_ACCEPTS,
        },
      }),
      (c) => c.json({ ok: true }),
    );

    const req = await createSignedFetchRequest();
    const res = await app.request(req);

    if (res.status !== 402) {
      fail('Hono: valid SIWA + no payment → 402', `status=${res.status}`);
      return;
    }

    const prHeader = res.headers.get(X402_HEADERS.PAYMENT_REQUIRED);
    prHeader
      ? pass('Hono: valid SIWA + no payment → 402 + Payment-Required header')
      : fail('Hono: 402 missing Payment-Required header');
  } catch (err: any) {
    fail('Hono: no payment 402', err.message);
  }
}

async function testHonoSiwaOkValidPaymentSuccess() {
  try {
    const facilitator = createMockFacilitator({ txHash: '0xhono' });
    let paymentFromCtx: any = undefined;

    const app = new Hono();
    app.get(
      '/api/data',
      honoSiwaMiddleware({
        receiptSecret: TEST_SECRET,
        x402: {
          facilitator,
          resource: { url: '/api/data', description: 'Premium' },
          accepts: MOCK_ACCEPTS,
        },
      }),
      (c) => {
        paymentFromCtx = (c as any).get('payment');
        return c.json({ ok: true });
      },
    );

    const paymentHeader = encodeX402Header(MOCK_PAYLOAD);
    const req = await createSignedFetchRequest({ paymentHeader });
    const res = await app.request(req);

    if (res.status !== 200) {
      fail('Hono: valid SIWA + valid payment → 200', `status=${res.status}`);
      return;
    }

    const hasPaymentResponse = res.headers.get(X402_HEADERS.PAYMENT_RESPONSE);
    paymentFromCtx?.txHash === '0xhono' && hasPaymentResponse
      ? pass('Hono: valid SIWA + valid payment → c.get("payment") has payment + Payment-Response header')
      : fail('Hono: payment success', `payment=${JSON.stringify(paymentFromCtx)}`);
  } catch (err: any) {
    fail('Hono: payment success', err.message);
  }
}

async function testHonoSessionPayThenSkip() {
  try {
    const sessionStore = createMemoryX402SessionStore();
    const facilitator = createMockFacilitator({ txHash: '0xhonosess' });

    const app = new Hono();
    app.get(
      '/api/data',
      honoSiwaMiddleware({
        receiptSecret: TEST_SECRET,
        x402: {
          facilitator,
          resource: { url: '/api/data', description: 'Premium' },
          accepts: MOCK_ACCEPTS,
          session: { store: sessionStore, ttl: 60_000 },
        },
      }),
      (c) => c.json({ ok: true }),
    );

    // First: pay
    const paymentHeader = encodeX402Header(MOCK_PAYLOAD);
    const req1 = await createSignedFetchRequest({ paymentHeader });
    const res1 = await app.request(req1);

    if (res1.status !== 200) {
      fail('Hono: session pay-then-skip', `first status=${res1.status}`);
      return;
    }

    // Second: no payment, session should grant access
    const req2 = await createSignedFetchRequest();
    const res2 = await app.request(req2);

    res2.status === 200
      ? pass('Hono: session — second request passes without payment')
      : fail('Hono: session skip', `second status=${res2.status}`);
  } catch (err: any) {
    fail('Hono: session', err.message);
  }
}

// ─── Fastify x402 Tests ─────────────────────────────────────────────

/** Extract headers from a signed fetch Request into a plain object for Fastify inject. */
function headersForInject(signed: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  signed.headers.forEach((v, k) => { headers[k] = v; });
  // Ensure host is set so Fastify reconstructs the correct URL for verification
  headers['host'] = 'localhost:3000';
  return headers;
}

async function testFastifySiwaOkNoPayment402() {
  try {
    const facilitator = createMockFacilitator();
    const app = Fastify();
    app.get(
      '/api/data',
      {
        preHandler: fastifySiwaAuth({
          receiptSecret: TEST_SECRET,
          x402: {
            facilitator,
            resource: { url: '/api/data', description: 'Premium' },
            accepts: MOCK_ACCEPTS,
          },
        }),
      },
      async (req) => ({ ok: true }),
    );

    const signed = await createSignedFetchRequest();
    const res = await app.inject({
      method: 'GET',
      url: '/api/data',
      headers: headersForInject(signed),
    });

    await app.close();

    if (res.statusCode !== 402) {
      fail('Fastify: valid SIWA + no payment → 402', `status=${res.statusCode}`);
      return;
    }

    const prHeader = res.headers[X402_HEADERS.PAYMENT_REQUIRED.toLowerCase()];
    prHeader
      ? pass('Fastify: valid SIWA + no payment → 402 + Payment-Required header')
      : fail('Fastify: 402 missing Payment-Required header');
  } catch (err: any) {
    fail('Fastify: no payment 402', err.message);
  }
}

async function testFastifySiwaOkValidPaymentSuccess() {
  try {
    const facilitator = createMockFacilitator({ txHash: '0xfastify' });
    let reqPayment: any = undefined;

    const app = Fastify();
    app.get(
      '/api/data',
      {
        preHandler: fastifySiwaAuth({
          receiptSecret: TEST_SECRET,
          x402: {
            facilitator,
            resource: { url: '/api/data', description: 'Premium' },
            accepts: MOCK_ACCEPTS,
          },
        }),
      },
      async (req) => {
        reqPayment = req.payment;
        return { ok: true };
      },
    );

    const paymentHeader = encodeX402Header(MOCK_PAYLOAD);
    const signed = await createSignedFetchRequest({ paymentHeader });

    const res = await app.inject({
      method: 'GET',
      url: '/api/data',
      headers: headersForInject(signed),
    });

    await app.close();

    if (res.statusCode !== 200) {
      fail('Fastify: valid SIWA + valid payment → 200', `status=${res.statusCode}, body=${res.body}`);
      return;
    }

    const responseHeader = res.headers[X402_HEADERS.PAYMENT_RESPONSE.toLowerCase()];
    reqPayment?.txHash === '0xfastify' && responseHeader
      ? pass('Fastify: valid SIWA + valid payment → req.payment set + Payment-Response header')
      : fail('Fastify: payment success', `payment=${JSON.stringify(reqPayment)}`);
  } catch (err: any) {
    fail('Fastify: payment success', err.message);
  }
}

async function testFastifySessionPayThenSkip() {
  try {
    const sessionStore = createMemoryX402SessionStore();
    const facilitator = createMockFacilitator({ txHash: '0xfastsess' });

    const app = Fastify();
    app.get(
      '/api/data',
      {
        preHandler: fastifySiwaAuth({
          receiptSecret: TEST_SECRET,
          x402: {
            facilitator,
            resource: { url: '/api/data', description: 'Premium' },
            accepts: MOCK_ACCEPTS,
            session: { store: sessionStore, ttl: 60_000 },
          },
        }),
      },
      async () => ({ ok: true }),
    );

    // First: pay
    const paymentHeader = encodeX402Header(MOCK_PAYLOAD);
    const signed1 = await createSignedFetchRequest({ paymentHeader });

    const res1 = await app.inject({ method: 'GET', url: '/api/data', headers: headersForInject(signed1) });

    if (res1.statusCode !== 200) {
      fail('Fastify: session pay-then-skip', `first status=${res1.statusCode}`);
      await app.close();
      return;
    }

    // Second: no payment, session should grant access
    const signed2 = await createSignedFetchRequest();

    const res2 = await app.inject({ method: 'GET', url: '/api/data', headers: headersForInject(signed2) });

    await app.close();

    res2.statusCode === 200
      ? pass('Fastify: session — second request passes without payment')
      : fail('Fastify: session skip', `second status=${res2.statusCode}`);
  } catch (err: any) {
    fail('Fastify: session', err.message);
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

  // ── SIWX Sessions ──
  console.log(chalk.cyan('\n  Middleware: SIWX Sessions'));
  await testSessionFirstRequestNoPayment402();
  await testSessionPaymentCreatesSession();
  await testSessionSecondRequestSkipsPayment();
  await testSessionReqPaymentPresence();
  await testSessionExpiry();
  await testSessionNoSharingBetweenAgents();
  await testSessionNoSharingBetweenRoutes();

  // ── Next.js x402 ──
  console.log(chalk.cyan('\n  Next.js: x402'));
  await testNextSiwaOkNoPayment402();
  await testNextSiwaOkValidPaymentSuccess();
  await testNextSessionPayThenSkip();

  // ── Hono x402 ──
  console.log(chalk.cyan('\n  Hono: x402'));
  await testHonoSiwaOkNoPayment402();
  await testHonoSiwaOkValidPaymentSuccess();
  await testHonoSessionPayThenSkip();

  // ── Fastify x402 ──
  console.log(chalk.cyan('\n  Fastify: x402'));
  await testFastifySiwaOkNoPayment402();
  await testFastifySiwaOkValidPaymentSuccess();
  await testFastifySessionPayThenSkip();

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
