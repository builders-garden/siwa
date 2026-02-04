// Shared types between agent and server

export interface NonceRequest {
  address: string;
  agentId: number;
  agentRegistry: string;
}

export interface NonceResponse {
  nonce: string;
  issuedAt: string;
  expirationTime: string;
  domain: string;
  uri: string;
  chainId: number;
}

export interface VerifyRequest {
  message: string;
  signature: string;
}

export interface VerifyResponse {
  success: boolean;
  token?: string;
  address?: string;
  agentId?: number;
  agentRegistry?: string;
  verified?: 'offline' | 'onchain';
  expiresAt?: string;
  error?: string;
}

export interface ProtectedResponse {
  message: string;
  address: string;
  agentId: number;
  timestamp: string;
}

export interface AgentActionResponse {
  received: Record<string, unknown>;
  processedBy: string;
  agent: { address: string; agentId: number };
  timestamp: string;
}

export interface HealthResponse {
  status: string;
  agents: number;
  sessions: number;
}
