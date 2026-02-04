import 'dotenv/config';
import express from 'express';
import { ethers } from 'ethers';
import { createNonce, validateNonce, getNonceCount } from './nonce-store.js';
import { createSession, validateToken, getSessions, getSessionCount } from './session-store.js';
import { verifySIWARequest } from './siwa-verifier.js';
import { renderDashboard } from './dashboard.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000');
const SERVER_DOMAIN = process.env.SERVER_DOMAIN || 'localhost:3000';
const RPC_URL = process.env.RPC_URL;

// Determine verification mode
const isLiveMode = !!(RPC_URL && (process.env.VERIFICATION_MODE === 'live' || process.argv.includes('--live')));
let provider: ethers.Provider | null = null;
if (isLiveMode && RPC_URL) {
  provider = new ethers.JsonRpcProvider(RPC_URL);
}

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
  const mode = isLiveMode ? 'live' : 'offline';
  const html = renderDashboard(getSessions(), getNonceCount(), mode);
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

// Request nonce
app.post('/siwa/nonce', (req, res) => {
  const { address, agentId, agentRegistry } = req.body;
  if (!address) {
    res.status(400).json({ error: 'Missing address' });
    return;
  }

  const { nonce, issuedAt, expirationTime } = createNonce(address);
  const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;
  console.log(`\u{1F4E8} Nonce requested by ${truncated}`);

  res.json({
    nonce,
    issuedAt,
    expirationTime,
    domain: SERVER_DOMAIN,
    uri: `http://${SERVER_DOMAIN}/siwa/verify`,
    chainId: parseInt(agentRegistry?.split(':')[1] || '84532'),
  });
});

// Verify SIWA signature
app.post('/siwa/verify', async (req, res) => {
  const { message, signature } = req.body;
  if (!message || !signature) {
    res.status(400).json({ success: false, error: 'Missing message or signature' });
    return;
  }

  const result = await verifySIWARequest(
    message,
    signature,
    SERVER_DOMAIN,
    validateNonce,
    isLiveMode ? provider : null
  );

  if (!result.valid) {
    console.log(`\u{274C} SIWA verification failed: ${result.error}`);
    res.status(401).json({ success: false, error: result.error });
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
    success: true,
    token: session.token,
    address: result.address,
    agentId: result.agentId,
    agentRegistry: result.agentRegistry,
    verified: result.verified,
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
  if (isLiveMode) {
    console.log(`\u{1F511} Mode: live (onchain verification via ${RPC_URL})`);
  } else {
    console.log(`\u{1F511} Mode: offline (no onchain verification)`);
  }
});
