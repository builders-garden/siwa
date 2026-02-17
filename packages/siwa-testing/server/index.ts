import 'dotenv/config';
import express from 'express';
import { recordSession, getSessions, getSessionCount, createReceiptForAgent } from './session-store.js';
import { verifySIWA, buildSIWAResponse, createSIWANonce, parseSIWAMessage, SIWAErrorCode, createClientResolver, parseChainId } from '@buildersgarden/siwa';
import { siwaMiddleware, siwaJsonParser, siwaCors } from '@buildersgarden/siwa/express';
import { renderDashboard } from './dashboard.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000');
const SERVER_DOMAIN = process.env.SERVER_DOMAIN || 'localhost:3000';
const SIWA_NONCE_SECRET = process.env.SIWA_NONCE_SECRET || process.env.SIWA_SECRET || 'test-secret-change-in-production';
const RECEIPT_SECRET = process.env.RECEIPT_SECRET || process.env.SIWA_SECRET || 'test-secret-change-in-production';
const ERC8128_VERIFY_ONCHAIN = process.env.ERC8128_VERIFY_ONCHAIN === 'true';

// Dynamic client resolver — supports all chains from addresses.ts + env overrides
const resolver = createClientResolver();

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

// ─── Unified SIWA Routes (all chains) ────────────────────────────────

// Request nonce (any supported chain)
app.post('/siwa/nonce', async (req, res) => {
  const { address, agentId, agentRegistry } = req.body;
  if (!address) {
    res.status(400).json({ status: 'rejected', code: SIWAErrorCode.VERIFICATION_FAILED, error: 'Missing address' });
    return;
  }

  const chainId = parseChainId(agentRegistry);
  if (!chainId) {
    res.status(400).json({ status: 'rejected', code: SIWAErrorCode.INVALID_REGISTRY_FORMAT, error: 'Invalid agentRegistry format' });
    return;
  }

  let client;
  try {
    client = resolver.getClient(chainId);
  } catch (err: any) {
    res.status(400).json({ status: 'rejected', error: err.message });
    return;
  }

  const result = await createSIWANonce(
    { address, agentId, agentRegistry },
    client,
    { secret: SIWA_NONCE_SECRET },
  );

  if (result.status !== 'nonce_issued') {
    console.log(`❌ [${chainId}] Nonce rejected for ${address.slice(0, 6)}...${address.slice(-4)}: ${result.error}`);
    res.status(403).json(result);
    return;
  }

  const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;
  console.log(`📨 [${chainId}] Nonce issued to ${truncated}`);

  res.json({
    nonce: result.nonce,
    nonceToken: result.nonceToken,
    issuedAt: result.issuedAt,
    expirationTime: result.expirationTime,
    domain: SERVER_DOMAIN,
    uri: `http://${SERVER_DOMAIN}/siwa/verify`,
    chainId,
  });
});

// Verify SIWA signature (any supported chain)
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

  const fields = parseSIWAMessage(message);
  const chainId = parseChainId(fields.agentRegistry);
  if (!chainId) {
    res.status(400).json({ status: 'rejected', code: SIWAErrorCode.INVALID_REGISTRY_FORMAT, error: 'Invalid agentRegistry in message' });
    return;
  }

  let client;
  try {
    client = resolver.getClient(chainId);
  } catch (err: any) {
    res.status(400).json({ status: 'rejected', error: err.message });
    return;
  }

  const result = await verifySIWA(
    message,
    signature,
    SERVER_DOMAIN,
    { nonceToken, secret: SIWA_NONCE_SECRET },
    client,
  );

  const response = buildSIWAResponse(result);

  if (!result.valid) {
    console.log(`❌ [${chainId}] SIWA verification failed: ${result.error}`);
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
  console.log(`✅ [${chainId}] Agent #${result.agentId} (${truncated}) signed in [${result.verified}]`);

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
  const chains = resolver.supportedChainIds().join(', ');
  console.log(`🌐 SIWA Server running at http://localhost:${PORT}`);
  console.log(`📋 Dashboard: http://localhost:${PORT}`);
  console.log(`🔗 Supported chains: ${chains}`);
  console.log(`🔗 Routes: /siwa/nonce, /siwa/verify`);
});
