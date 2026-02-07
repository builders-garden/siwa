/**
 * Keyring Proxy Server
 *
 * Standalone Express server that acts as the security boundary for agent signing.
 * The agent process delegates all signing to this server over HMAC-authenticated HTTP,
 * so private keys never enter the agent's process.
 *
 * Features:
 *   - HMAC-SHA256 authentication for all requests
 *   - Policy-based transaction/message/authorization validation (Privy-inspired)
 *   - Audit logging for all operations
 *   - Optional separate admin secret for policy management
 *
 * Usage:
 *   KEYRING_PROXY_SECRET=<secret> KEYSTORE_BACKEND=encrypted-file \
 *     KEYSTORE_PASSWORD=<password> tsx src/index.ts
 *
 * Environment:
 *   KEYRING_PROXY_SECRET        — Required. Shared HMAC secret for signing operations.
 *   KEYRING_POLICY_ADMIN_SECRET — Optional. Separate secret for policy management.
 *   KEYRING_PROXY_PORT          — Listen port (default: 3100)
 *   KEYSTORE_BACKEND            — Backend for the proxy's own keystore (must NOT be "proxy")
 *   KEYSTORE_PASSWORD           — Password for encrypted-file backend
 *   KEYSTORE_PATH               — Path to keystore file
 *   POLICY_STORE_PATH           — Path to policies JSON file (default: ./data/policies.json)
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

// Policy system imports
import type { Policy, Rule, EvaluationContext, RuleMethod } from './types.js';
import {
  getAllPolicies, getPolicy, savePolicy, deletePolicy,
  getWalletPolicies, attachPolicy, detachPolicy, generatePolicyId,
} from './policy-store.js';
import { evaluatePolicies } from './policy-engine.js';
import {
  buildTransactionContext, buildMessageContext, buildAuthorizationContext,
  buildSystemContext, decodeCalldata,
} from './field-extractors.js';
import { createDefaultPolicy } from './default-policy.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SECRET = process.env.KEYRING_PROXY_SECRET;
if (!SECRET) {
  console.error('FATAL: KEYRING_PROXY_SECRET is required');
  process.exit(1);
}

const ADMIN_SECRET = process.env.KEYRING_POLICY_ADMIN_SECRET;
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
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively converts BigInt values to strings for JSON serialization.
 * ethers v6 returns BigInt values which can't be serialized by JSON.stringify.
 */
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInt(value);
    }
    return result;
  }
  return obj;
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
  policyViolation?: boolean;
}

export const auditLog: AuditEntry[] = [];

function audit(req: Request, success: boolean, error?: string, policyViolation?: boolean) {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    sourceIp: req.ip || req.socket.remoteAddress || 'unknown',
    success,
    error,
    policyViolation,
  };
  auditLog.push(entry);
  const status = success ? 'OK' : (policyViolation ? 'POLICY_DENIED' : 'FAIL');
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
// HMAC auth middleware
// ---------------------------------------------------------------------------

/**
 * Main HMAC authentication middleware.
 * Accepts either the regular secret OR the admin secret (if configured).
 * Stores which secret was used in req.authType for later checks.
 */
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

  // Try regular secret first
  const regularResult = verifyHmac(SECRET!, req.method, req.path, rawBody, timestamp, signature);
  if (regularResult.valid) {
    (req as any).authType = 'regular';
    return next();
  }

  // If admin secret is configured, try it
  if (ADMIN_SECRET) {
    const adminResult = verifyHmac(ADMIN_SECRET, req.method, req.path, rawBody, timestamp, signature);
    if (adminResult.valid) {
      (req as any).authType = 'admin';
      return next();
    }
  }

  // Both failed
  audit(req, false, regularResult.error);
  res.status(401).json({
    error: regularResult.error,
    payload_format: 'METHOD\\nPATH\\nTIMESTAMP\\nBODY',
    hint: "Use the SDK: import { computeHmac } from '@buildersgarden/siwa/proxy-auth'",
  });
}

/**
 * Check if the request was authenticated with admin credentials.
 * Returns true if admin secret is not configured (backwards compatible).
 */
function requireAdminAuth(req: Request, res: Response): boolean {
  // If admin secret is not configured, allow all authenticated requests
  if (!ADMIN_SECRET) return true;

  // If admin secret is configured, require admin auth
  if ((req as any).authType === 'admin') return true;

  audit(req, false, 'Admin authentication required');
  res.status(403).json({
    error: 'Admin authentication required for policy management',
    hint: 'Use KEYRING_POLICY_ADMIN_SECRET for HMAC',
  });
  return false;
}

app.use(hmacAuth);

// ---------------------------------------------------------------------------
// Policy evaluation helper
// ---------------------------------------------------------------------------

async function evaluateRequest(
  method: RuleMethod,
  context: EvaluationContext,
  walletAddress: string
): Promise<{ allowed: boolean; reason: string; denied_by?: string; policy_id?: string }> {
  const policies = await getWalletPolicies(walletAddress);
  return evaluatePolicies(policies, method, context);
}

// ---------------------------------------------------------------------------
// Health endpoint
// ---------------------------------------------------------------------------

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    backend: innerBackend,
    policies_enabled: true,
    admin_secret_configured: !!ADMIN_SECRET,
  });
});

// ---------------------------------------------------------------------------
// Wallet endpoints
// ---------------------------------------------------------------------------

app.post('/create-wallet', async (req: Request, res: Response) => {
  try {
    const { defaultPolicy, skipDefaultPolicy } = req.body || {};

    const info = await createWallet(getInnerConfig());

    // Attach default policy unless explicitly skipped
    if (!skipDefaultPolicy) {
      let policy: Policy;

      if (defaultPolicy) {
        // Use provided policy
        policy = {
          ...defaultPolicy,
          id: defaultPolicy.id || generatePolicyId(),
          version: defaultPolicy.version || '1.0',
          chain_type: defaultPolicy.chain_type || 'ethereum',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      } else {
        // Create default policy
        policy = createDefaultPolicy();
      }

      await savePolicy(policy);
      await attachPolicy(info.address, policy.id);

      audit(req, true);
      res.json({
        address: info.address,
        backend: info.backend,
        policy_id: policy.id,
      });
    } else {
      audit(req, true);
      res.json({
        address: info.address,
        backend: info.backend,
      });
    }
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

// ---------------------------------------------------------------------------
// Signing endpoints (with policy evaluation)
// ---------------------------------------------------------------------------

app.post('/sign-message', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    if (typeof message !== 'string') {
      audit(req, false, 'Missing message field');
      res.status(400).json({ error: 'Missing "message" field' });
      return;
    }

    // Get wallet address for policy lookup
    const walletAddress = await getAddress(getInnerConfig());
    if (!walletAddress) {
      audit(req, false, 'No wallet found');
      res.status(400).json({ error: 'No wallet found' });
      return;
    }

    // Build evaluation context
    const context: EvaluationContext = {
      message: buildMessageContext(message),
      system: buildSystemContext(),
    };

    // Evaluate policies
    const evaluation = await evaluateRequest('sign_message', context, walletAddress);

    if (!evaluation.allowed) {
      audit(req, false, evaluation.reason, true);
      res.status(403).json({
        error: 'Policy violation',
        reason: evaluation.reason,
        denied_by: evaluation.denied_by,
        policy_id: evaluation.policy_id,
      });
      return;
    }

    // Policy passed - sign the message
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
    const { tx, abi } = req.body;
    if (!tx || typeof tx !== 'object') {
      audit(req, false, 'Missing tx field');
      res.status(400).json({ error: 'Missing "tx" field' });
      return;
    }

    // Get wallet address for policy lookup
    const walletAddress = await getAddress(getInnerConfig());
    if (!walletAddress) {
      audit(req, false, 'No wallet found');
      res.status(400).json({ error: 'No wallet found' });
      return;
    }

    // Build evaluation context
    const txContext = buildTransactionContext(tx);
    const calldataContext = abi ? decodeCalldata(tx.data, abi) : undefined;

    const context: EvaluationContext = {
      ethereum_transaction: txContext,
      ethereum_calldata: calldataContext,
      system: buildSystemContext(),
    };

    // Evaluate policies
    const evaluation = await evaluateRequest('sign_transaction', context, walletAddress);

    if (!evaluation.allowed) {
      audit(req, false, evaluation.reason, true);
      res.status(403).json({
        error: 'Policy violation',
        reason: evaluation.reason,
        denied_by: evaluation.denied_by,
        policy_id: evaluation.policy_id,
      });
      return;
    }

    // Policy passed - sign the transaction
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

    // Get wallet address for policy lookup
    const walletAddress = await getAddress(getInnerConfig());
    if (!walletAddress) {
      audit(req, false, 'No wallet found');
      res.status(400).json({ error: 'No wallet found' });
      return;
    }

    // Build evaluation context
    const context: EvaluationContext = {
      ethereum_authorization: buildAuthorizationContext(auth),
      system: buildSystemContext(),
    };

    // Evaluate policies
    const evaluation = await evaluateRequest('sign_authorization', context, walletAddress);

    if (!evaluation.allowed) {
      audit(req, false, evaluation.reason, true);
      res.status(403).json({
        error: 'Policy violation',
        reason: evaluation.reason,
        denied_by: evaluation.denied_by,
        policy_id: evaluation.policy_id,
      });
      return;
    }

    // Policy passed - sign the authorization
    const result = await signAuthorization(auth, getInnerConfig());
    audit(req, true);
    // ethers v6 returns BigInt values which need conversion for JSON
    res.json(serializeBigInt(result));
  } catch (err: any) {
    audit(req, false, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Policy CRUD endpoints
// ---------------------------------------------------------------------------

// List all policies (regular auth)
app.get('/policies', async (req: Request, res: Response) => {
  try {
    const policies = await getAllPolicies();
    audit(req, true);
    res.json({ policies });
  } catch (err: any) {
    audit(req, false, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get a policy by ID (regular auth)
app.get('/policies/:id', async (req: Request, res: Response) => {
  try {
    const policy = await getPolicy(req.params.id);
    if (!policy) {
      audit(req, false, 'Policy not found');
      res.status(404).json({ error: 'Policy not found' });
      return;
    }
    audit(req, true);
    res.json({ policy });
  } catch (err: any) {
    audit(req, false, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Create a policy (admin auth if configured)
app.post('/policies', async (req: Request, res: Response) => {
  if (!requireAdminAuth(req, res)) return;

  try {
    const { name, rules, version, chain_type } = req.body;

    if (!name || typeof name !== 'string') {
      audit(req, false, 'Missing name field');
      res.status(400).json({ error: 'Missing "name" field' });
      return;
    }

    if (!rules || !Array.isArray(rules)) {
      audit(req, false, 'Missing rules field');
      res.status(400).json({ error: 'Missing "rules" field (must be array)' });
      return;
    }

    const policy: Policy = {
      id: generatePolicyId(),
      version: version || '1.0',
      name,
      chain_type: chain_type || 'ethereum',
      rules: rules as Rule[],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await savePolicy(policy);
    audit(req, true);
    res.status(201).json({ id: policy.id, policy });
  } catch (err: any) {
    audit(req, false, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update a policy (admin auth if configured)
app.put('/policies/:id', async (req: Request, res: Response) => {
  if (!requireAdminAuth(req, res)) return;

  try {
    const existing = await getPolicy(req.params.id);
    if (!existing) {
      audit(req, false, 'Policy not found');
      res.status(404).json({ error: 'Policy not found' });
      return;
    }

    const { name, rules, version, chain_type } = req.body;

    const updated: Policy = {
      ...existing,
      name: name || existing.name,
      rules: rules || existing.rules,
      version: version || existing.version,
      chain_type: chain_type || existing.chain_type,
      updated_at: new Date().toISOString(),
    };

    await savePolicy(updated);
    audit(req, true);
    res.json({ policy: updated });
  } catch (err: any) {
    audit(req, false, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Delete a policy (admin auth if configured)
app.delete('/policies/:id', async (req: Request, res: Response) => {
  if (!requireAdminAuth(req, res)) return;

  try {
    const deleted = await deletePolicy(req.params.id);
    if (!deleted) {
      audit(req, false, 'Policy not found');
      res.status(404).json({ error: 'Policy not found' });
      return;
    }
    audit(req, true);
    res.json({ deleted: true });
  } catch (err: any) {
    audit(req, false, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Wallet-Policy binding endpoints
// ---------------------------------------------------------------------------

// List policies for a wallet (regular auth)
app.get('/wallets/:address/policies', async (req: Request, res: Response) => {
  try {
    const policies = await getWalletPolicies(req.params.address);
    audit(req, true);
    res.json({ policies });
  } catch (err: any) {
    audit(req, false, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Attach a policy to a wallet (admin auth if configured)
app.post('/wallets/:address/policies/:policyId', async (req: Request, res: Response) => {
  if (!requireAdminAuth(req, res)) return;

  try {
    await attachPolicy(req.params.address, req.params.policyId);
    audit(req, true);
    res.json({ attached: true });
  } catch (err: any) {
    audit(req, false, err.message);
    res.status(400).json({ error: err.message });
  }
});

// Detach a policy from a wallet (admin auth if configured)
app.delete('/wallets/:address/policies/:policyId', async (req: Request, res: Response) => {
  if (!requireAdminAuth(req, res)) return;

  try {
    const detached = await detachPolicy(req.params.address, req.params.policyId);
    if (!detached) {
      audit(req, false, 'Policy binding not found');
      res.status(404).json({ error: 'Policy binding not found' });
      return;
    }
    audit(req, true);
    res.json({ detached: true });
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
  console.log(`Policy system: enabled`);
  console.log(`Admin secret: ${ADMIN_SECRET ? 'configured (separate from signing secret)' : 'not configured (using signing secret)'}`);
});
