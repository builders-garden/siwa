import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-change-in-production';
const JWT_EXPIRY = '1h';

export interface AgentSession {
  token: string;
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

export function createSession(
  result: VerificationResult,
  mode: 'offline' | 'onchain'
): AgentSession {
  const payload = {
    address: result.address,
    agentId: result.agentId,
    agentRegistry: result.agentRegistry,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });

  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 60 * 60 * 1000); // 1h

  const session: AgentSession = {
    token,
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

export function validateToken(
  token: string
): { address: string; agentId: number; agentRegistry: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      address: string;
      agentId: number;
      agentRegistry: string;
    };
    return payload;
  } catch {
    return null;
  }
}

export function getSessions(): AgentSession[] {
  return sessions;
}

export function getSessionCount(): number {
  return sessions.length;
}
