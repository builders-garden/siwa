import 'dotenv/config';
import express from 'express';
import { createPublicClient, http } from 'viem';
import { createSession, validateToken, getSessions, getSessionCount } from './session-store.js';
import { verifySIWA, buildSIWAResponse, createSIWANonce, SIWAErrorCode } from '@buildersgarden/siwa';
import { renderDashboard } from './dashboard.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000');
const SERVER_DOMAIN = process.env.SERVER_DOMAIN || 'localhost:3000';
const RPC_URL = process.env.RPC_URL;
const SIWA_NONCE_SECRET = process.env.SIWA_NONCE_SECRET || process.env.JWT_SECRET || 'test-secret-change-in-production';

if (!RPC_URL) {
  console.error('RPC_URL is required. Set it in your environment or .env file.');
  process.exit(1);
}

const client = createPublicClient({ transport: http(RPC_URL) });

// Middleware
app.use(express.json());
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  next();
});
app.options('*', (_req, res) => res.sendStatus(204));

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

// Request nonce (validates registration before issuing)
app.post('/siwa/nonce', async (req, res) => {
  const { address, agentId, agentRegistry } = req.body;
  if (!address) {
    res.status(400).json({ status: 'rejected', code: SIWAErrorCode.VERIFICATION_FAILED, error: 'Missing address' });
    return;
  }

  const result = await createSIWANonce(
    { address, agentId, agentRegistry },
    client,
    { secret: SIWA_NONCE_SECRET },
  );

  if (result.status !== 'nonce_issued') {
    // Forward the SIWAResponse directly to the agent
    console.log(`\u{274C} Nonce rejected for ${address.slice(0, 6)}...${address.slice(-4)}: ${result.error}`);
    res.status(403).json(result);
    return;
  }

  const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;
  console.log(`\u{1F4E8} Nonce issued to ${truncated}`);

  res.json({
    nonce: result.nonce,
    nonceToken: result.nonceToken,
    issuedAt: result.issuedAt,
    expirationTime: result.expirationTime,
    domain: SERVER_DOMAIN,
    uri: `http://${SERVER_DOMAIN}/siwa/verify`,
    chainId: parseInt(agentRegistry?.split(':')[1] || '84532'),
  });
});

// Verify SIWA signature
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
    client,
  );

  const response = buildSIWAResponse(result);

  if (!result.valid) {
    console.log(`\u{274C} SIWA verification failed: ${result.error}`);
    const statusCode = result.code === SIWAErrorCode.NOT_REGISTERED ? 403 : 401;
    res.status(statusCode).json(response);
    return;
  }

  const session = createSession(
    {
      address: result.address,
      agentId: result.agentId,
      agentRegistry: result.agentRegistry,
      chainId: result.chainId,
    },
    result.verified
  );

  const truncated = `${result.address.slice(0, 6)}...${result.address.slice(-4)}`;
  console.log(`\u{2705} Agent #${result.agentId} (${truncated}) signed in [${result.verified}]`);

  res.json({
    ...response,
    token: session.token,
    expiresAt: session.expiresAt.toISOString(),
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

// Auth middleware
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = auth.slice(7);
  const payload = validateToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  (req as any).agent = payload;
  next();
}

// Protected endpoint
app.get('/api/protected', requireAuth, (req, res) => {
  const agent = (req as any).agent;
  res.json({
    message: `Hello Agent #${agent.agentId}!`,
    address: agent.address,
    agentId: agent.agentId,
    timestamp: new Date().toISOString(),
  });
});

// Agent action endpoint
app.post('/api/agent-action', requireAuth, (req, res) => {
  const agent = (req as any).agent;
  res.json({
    received: req.body,
    processedBy: 'siwa-test-server',
    agent: { address: agent.address, agentId: agent.agentId },
    timestamp: new Date().toISOString(),
  });
});

// ─── Start ────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\u{1F310} SIWA Server running at http://localhost:${PORT}`);
  console.log(`\u{1F4CB} Dashboard: http://localhost:${PORT}`);
  console.log(`\u{1F511} RPC: ${RPC_URL}`);
});
