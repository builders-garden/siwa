import 'dotenv/config';
import express from 'express';
import { createPublicClient, http } from 'viem';
import { recordSession, getSessions, getSessionCount, createReceiptForAgent } from './session-store.js';
import { verifySIWA, buildSIWAResponse, createSIWANonce, SIWAErrorCode } from '@buildersgarden/siwa';
import { siwaMiddleware, siwaJsonParser, siwaCors } from '@buildersgarden/siwa/express';
import { renderDashboard } from './dashboard.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000');
const SERVER_DOMAIN = process.env.SERVER_DOMAIN || 'localhost:3000';
const SIWA_NONCE_SECRET = process.env.SIWA_NONCE_SECRET || process.env.SIWA_SECRET || 'test-secret-change-in-production';
const RECEIPT_SECRET = process.env.RECEIPT_SECRET || process.env.SIWA_SECRET || 'test-secret-change-in-production';
const ERC8128_VERIFY_ONCHAIN = process.env.ERC8128_VERIFY_ONCHAIN === 'true';

// Testnet: Base Sepolia (chain ID 84532)
const TESTNET_RPC = 'https://sepolia.base.org';
const TESTNET_CHAIN_ID = 84532;
const testnetClient = createPublicClient({ transport: http(TESTNET_RPC) });

// Mainnet: Base (chain ID 8453)
const MAINNET_RPC = 'https://mainnet.base.org';
const MAINNET_CHAIN_ID = 8453;
const mainnetClient = createPublicClient({ transport: http(MAINNET_RPC) });

// Middleware — SIWA SDK wrappers handle JSON parsing (with rawBody), CORS, and OPTIONS
app.use(siwaJsonParser());
app.use(siwaCors());

// ─── Routes ───────────────────────────────────────────────────────────

// Dashboard
app.get('/', (_req, res) => {
  const html = renderDashboard(getSessions(), 'live');
  res.type('html').send(html);
});

// Health
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    agents: new Set(getSessions().map((s) => s.address)).size,
    sessions: getSessionCount(),
  });
});

// ─── Testnet Routes (Base Sepolia) ────────────────────────────────────

// Request nonce (testnet)
app.post('/siwa/nonce', async (req, res) => {
  const { address, agentId, agentRegistry } = req.body;
  if (!address) {
    res.status(400).json({ status: 'rejected', code: SIWAErrorCode.VERIFICATION_FAILED, error: 'Missing address' });
    return;
  }

  const result = await createSIWANonce(
    { address, agentId, agentRegistry },
    testnetClient,
    { secret: SIWA_NONCE_SECRET },
  );

  if (result.status !== 'nonce_issued') {
    console.log(`❌ [testnet] Nonce rejected for ${address.slice(0, 6)}...${address.slice(-4)}: ${result.error}`);
    res.status(403).json(result);
    return;
  }

  const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;
  console.log(`📨 [testnet] Nonce issued to ${truncated}`);

  res.json({
    nonce: result.nonce,
    nonceToken: result.nonceToken,
    issuedAt: result.issuedAt,
    expirationTime: result.expirationTime,
    domain: SERVER_DOMAIN,
    uri: `http://${SERVER_DOMAIN}/siwa/verify`,
    chainId: TESTNET_CHAIN_ID,
  });
});

// Verify SIWA signature (testnet)
app.post('/siwa/verify', async (req, res) => {
  const { message, signature, nonceToken } = req.body;
  if (!message || !signature) {
    res.status(400).json({ status: 'rejected', code: SIWAErrorCode.VERIFICATION_FAILED, error: 'Missing message or signature' });
    return;
  }
  if (!nonceToken) {
    res.status(400).json({ status: 'rejected', code: SIWAErrorCode.INVALID_NONCE, error: 'Missing nonceToken' });
    return;
  }

  const result = await verifySIWA(
    message,
    signature,
    SERVER_DOMAIN,
    { nonceToken, secret: SIWA_NONCE_SECRET },
    testnetClient,
  );

  const response = buildSIWAResponse(result);

  if (!result.valid) {
    console.log(`❌ [testnet] SIWA verification failed: ${result.error}`);
    const statusCode = result.code === SIWAErrorCode.NOT_REGISTERED ? 403 : 401;
    res.status(statusCode).json(response);
    return;
  }

  const verificationResult = {
    address: result.address,
    agentId: result.agentId,
    agentRegistry: result.agentRegistry,
    chainId: result.chainId,
  };

  const receiptResult = createReceiptForAgent({ ...verificationResult, verified: result.verified });
  recordSession(verificationResult, result.verified, receiptResult.expiresAt);

  const truncated = `${result.address.slice(0, 6)}...${result.address.slice(-4)}`;
  console.log(`✅ [testnet] Agent #${result.agentId} (${truncated}) signed in [${result.verified}]`);

  res.json({
    ...response,
    receipt: receiptResult.receipt,
    receiptExpiresAt: receiptResult.expiresAt,
  });
});

// ─── Mainnet Routes (Base) ────────────────────────────────────────────

// Request nonce (mainnet)
app.post('/siwa/mainnet/nonce', async (req, res) => {
  const { address, agentId, agentRegistry } = req.body;
  if (!address) {
    res.status(400).json({ status: 'rejected', code: SIWAErrorCode.VERIFICATION_FAILED, error: 'Missing address' });
    return;
  }

  const result = await createSIWANonce(
    { address, agentId, agentRegistry },
    mainnetClient,
    { secret: SIWA_NONCE_SECRET },
  );

  if (result.status !== 'nonce_issued') {
    console.log(`❌ [mainnet] Nonce rejected for ${address.slice(0, 6)}...${address.slice(-4)}: ${result.error}`);
    res.status(403).json(result);
    return;
  }

  const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;
  console.log(`📨 [mainnet] Nonce issued to ${truncated}`);

  res.json({
    nonce: result.nonce,
    nonceToken: result.nonceToken,
    issuedAt: result.issuedAt,
    expirationTime: result.expirationTime,
    domain: SERVER_DOMAIN,
    uri: `http://${SERVER_DOMAIN}/siwa/mainnet/verify`,
    chainId: MAINNET_CHAIN_ID,
  });
});

// Verify SIWA signature (mainnet)
app.post('/siwa/mainnet/verify', async (req, res) => {
  const { message, signature, nonceToken } = req.body;
  if (!message || !signature) {
    res.status(400).json({ status: 'rejected', code: SIWAErrorCode.VERIFICATION_FAILED, error: 'Missing message or signature' });
    return;
  }
  if (!nonceToken) {
    res.status(400).json({ status: 'rejected', code: SIWAErrorCode.INVALID_NONCE, error: 'Missing nonceToken' });
    return;
  }

  const result = await verifySIWA(
    message,
    signature,
    SERVER_DOMAIN,
    { nonceToken, secret: SIWA_NONCE_SECRET },
    mainnetClient,
  );

  const response = buildSIWAResponse(result);

  if (!result.valid) {
    console.log(`❌ [mainnet] SIWA verification failed: ${result.error}`);
    const statusCode = result.code === SIWAErrorCode.NOT_REGISTERED ? 403 : 401;
    res.status(statusCode).json(response);
    return;
  }

  const verificationResult = {
    address: result.address,
    agentId: result.agentId,
    agentRegistry: result.agentRegistry,
    chainId: result.chainId,
  };

  const receiptResult = createReceiptForAgent({ ...verificationResult, verified: result.verified });
  recordSession(verificationResult, result.verified, receiptResult.expiresAt);

  const truncated = `${result.address.slice(0, 6)}...${result.address.slice(-4)}`;
  console.log(`✅ [mainnet] Agent #${result.agentId} (${truncated}) signed in [${result.verified}]`);

  res.json({
    ...response,
    receipt: receiptResult.receipt,
    receiptExpiresAt: receiptResult.expiresAt,
  });
});

// List sessions (for dashboard polling)
app.get('/siwa/sessions', (_req, res) => {
  const sessions = getSessions().map((s) => ({
    ...s,
    issuedAt: s.issuedAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
  }));
  res.json(sessions);
});

// Auth middleware — SIWA SDK wrapper for ERC-8128 + Receipt verification
const requireAuth = siwaMiddleware({
  receiptSecret: RECEIPT_SECRET,
  verifyOnchain: false,
});

// Protected endpoint
app.get('/api/protected', requireAuth, (req, res) => {
  const agent = req.agent!;
  res.json({
    message: `Hello Agent #${agent.agentId}!`,
    address: agent.address,
    agentId: agent.agentId,
    timestamp: new Date().toISOString(),
  });
});

// Agent action endpoint
app.post('/api/agent-action', requireAuth, (req, res) => {
  const agent = req.agent!;
  res.json({
    received: req.body,
    processedBy: 'siwa-test-server',
    agent: { address: agent.address, agentId: agent.agentId },
    timestamp: new Date().toISOString(),
  });
});

// ─── Start ────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🌐 SIWA Server running at http://localhost:${PORT}`);
  console.log(`📋 Dashboard: http://localhost:${PORT}`);
  console.log(`🔗 Testnet (Base Sepolia): /siwa/nonce, /siwa/verify`);
  console.log(`🔗 Mainnet (Base): /siwa/mainnet/nonce, /siwa/mainnet/verify`);
});
