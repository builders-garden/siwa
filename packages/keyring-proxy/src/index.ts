/**
 * Keyring Proxy Server
 *
 * Standalone Express server that acts as the security boundary for agent signing.
 * The agent process delegates all signing to this server over HMAC-authenticated HTTP,
 * so private keys never enter the agent's process.
 *
 * Usage:
 *   KEYRING_PROXY_SECRET=<secret> KEYSTORE_BACKEND=encrypted-file \
 *     KEYSTORE_PASSWORD=<password> tsx proxy/index.ts
 *
 * Environment:
 *   KEYRING_PROXY_SECRET  — Required. Shared HMAC secret.
 *   KEYRING_PROXY_PORT    — Listen port (default: 3100)
 *   KEYSTORE_BACKEND      — Backend for the proxy's own keystore (must NOT be "proxy")
 *   KEYSTORE_PASSWORD     — Password for encrypted-file backend
 *   KEYSTORE_PATH         — Path to keystore file
 */

import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { verifyHmac } from '@buildersgarden/siwa/proxy-auth';
import {
  createWallet, hasWallet, getAddress, signMessage,
  signTransaction, signAuthorization,
  type KeystoreConfig, type KeystoreBackend,
} from '@buildersgarden/siwa/keystore';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SECRET = process.env.KEYRING_PROXY_SECRET;
if (!SECRET) {
  console.error('FATAL: KEYRING_PROXY_SECRET is required');
  process.exit(1);
}

const PORT = parseInt(process.env.PORT || process.env.KEYRING_PROXY_PORT || '3100', 10);

const innerBackend = (process.env.KEYSTORE_BACKEND || 'encrypted-file') as KeystoreBackend;
if (innerBackend === 'proxy') {
  console.error('FATAL: Proxy server cannot use KEYSTORE_BACKEND=proxy (would create a loop)');
  process.exit(1);
}

function getInnerConfig(): KeystoreConfig {
  return {
    backend: innerBackend,
    keystorePath: process.env.KEYSTORE_PATH,
    password: process.env.KEYSTORE_PASSWORD,
  };
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

interface AuditEntry {
  timestamp: string;
  method: string;
  path: string;
  sourceIp: string;
  success: boolean;
  error?: string;
}

export const auditLog: AuditEntry[] = [];

function audit(req: Request, success: boolean, error?: string) {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    sourceIp: req.ip || req.socket.remoteAddress || 'unknown',
    success,
    error,
  };
  auditLog.push(entry);
  const status = success ? 'OK' : 'FAIL';
  const errStr = error ? ` — ${error}` : '';
  console.log(`[AUDIT] ${entry.timestamp} ${status} ${req.method} ${req.path} from ${entry.sourceIp}${errStr}`);
}

// ---------------------------------------------------------------------------
// Express setup
// ---------------------------------------------------------------------------

const app = express();

// Raw body capture for HMAC verification
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString();
  },
}));

// ---------------------------------------------------------------------------
// HMAC auth middleware (skip for /health)
// ---------------------------------------------------------------------------

function hmacAuth(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/health') return next();

  const timestamp = req.headers['x-keyring-timestamp'] as string;
  const signature = req.headers['x-keyring-signature'] as string;

  if (!timestamp || !signature) {
    audit(req, false, 'Missing HMAC headers');
    res.status(401).json({
      error: 'Missing HMAC headers',
      expected: {
        'X-Keyring-Timestamp': '<milliseconds since epoch>',
        'X-Keyring-Signature': '<HMAC-SHA256 hex of METHOD\\nPATH\\nTIMESTAMP\\nBODY>',
      },
      hint: "Use the SDK: import { computeHmac } from '@buildersgarden/siwa/proxy-auth'",
    });
    return;
  }

  const rawBody = (req as any).rawBody || '';
  const result = verifyHmac(SECRET!, req.method, req.path, rawBody, timestamp, signature);

  if (!result.valid) {
    audit(req, false, result.error);
    res.status(401).json({
      error: result.error,
      payload_format: 'METHOD\\nPATH\\nTIMESTAMP\\nBODY',
      hint: "Use the SDK: import { computeHmac } from '@buildersgarden/siwa/proxy-auth'",
    });
    return;
  }

  next();
}

app.use(hmacAuth);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', backend: innerBackend });
});

app.post('/create-wallet', async (req: Request, res: Response) => {
  try {
    const info = await createWallet(getInnerConfig());
    audit(req, true);
    res.json({ address: info.address, backend: info.backend });
  } catch (err: any) {
    audit(req, false, err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/has-wallet', async (req: Request, res: Response) => {
  try {
    const exists = await hasWallet(getInnerConfig());
    audit(req, true);
    res.json({ hasWallet: exists });
  } catch (err: any) {
    audit(req, false, err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/get-address', async (req: Request, res: Response) => {
  try {
    const address = await getAddress(getInnerConfig());
    audit(req, true);
    res.json({ address });
  } catch (err: any) {
    audit(req, false, err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/sign-message', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    if (typeof message !== 'string') {
      audit(req, false, 'Missing message field');
      res.status(400).json({ error: 'Missing "message" field' });
      return;
    }
    const result = await signMessage(message, getInnerConfig());
    audit(req, true);
    res.json(result);
  } catch (err: any) {
    audit(req, false, err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/sign-transaction', async (req: Request, res: Response) => {
  try {
    const { tx } = req.body;
    if (!tx || typeof tx !== 'object') {
      audit(req, false, 'Missing tx field');
      res.status(400).json({ error: 'Missing "tx" field' });
      return;
    }
    const result = await signTransaction(tx, getInnerConfig());
    audit(req, true);
    res.json(result);
  } catch (err: any) {
    audit(req, false, err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/sign-authorization', async (req: Request, res: Response) => {
  try {
    const { auth } = req.body;
    if (!auth || typeof auth !== 'object') {
      audit(req, false, 'Missing auth field');
      res.status(400).json({ error: 'Missing "auth" field' });
      return;
    }
    const result = await signAuthorization(auth, getInnerConfig());
    audit(req, true);
    res.json(result);
  } catch (err: any) {
    audit(req, false, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`Keyring proxy server listening on port ${PORT}`);
  console.log(`Backend: ${innerBackend}`);
  console.log(`HMAC auth: enabled`);
});
