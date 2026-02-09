import { createReceipt, verifyReceipt, DEFAULT_RECEIPT_TTL, type ReceiptPayload } from '@buildersgarden/siwa/receipt';

const RECEIPT_SECRET = process.env.RECEIPT_SECRET || process.env.SIWA_SECRET || 'test-secret-change-in-production';
const RECEIPT_TTL = parseInt(process.env.RECEIPT_TTL || String(DEFAULT_RECEIPT_TTL));

export interface AgentSession {
  address: string;
  agentId: number;
  agentRegistry: string;
  chainId: number;
  issuedAt: Date;
  expiresAt: Date;
  verified: 'offline' | 'onchain';
}

interface VerificationResult {
  address: string;
  agentId: number;
  agentRegistry: string;
  chainId: number;
}

const sessions: AgentSession[] = [];

export function createReceiptForAgent(result: VerificationResult & { verified: 'offline' | 'onchain' }) {
  return createReceipt(
    {
      address: result.address,
      agentId: result.agentId,
      agentRegistry: result.agentRegistry,
      chainId: result.chainId,
      verified: result.verified,
    },
    { secret: RECEIPT_SECRET, ttl: RECEIPT_TTL },
  );
}

export function validateReceiptToken(receipt: string): ReceiptPayload | null {
  return verifyReceipt(receipt, RECEIPT_SECRET);
}

export function recordSession(
  result: VerificationResult,
  mode: 'offline' | 'onchain',
  receiptExpiresAt: string,
): AgentSession {
  const issuedAt = new Date();
  const expiresAt = new Date(receiptExpiresAt);

  const session: AgentSession = {
    address: result.address,
    agentId: result.agentId,
    agentRegistry: result.agentRegistry,
    chainId: result.chainId,
    issuedAt,
    expiresAt,
    verified: mode,
  };

  sessions.push(session);
  return session;
}

export function getSessions(): AgentSession[] {
  return sessions;
}

export function getSessionCount(): number {
  return sessions.length;
}
