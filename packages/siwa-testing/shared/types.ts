// Shared types between agent and server

export interface NonceRequest {
  address: string;
  agentId: number;
  agentRegistry: string;
}

export interface NonceResponse {
  nonce: string;
  nonceToken?: string;
  issuedAt: string;
  expirationTime: string;
  domain: string;
  uri: string;
  chainId: number;
}

export interface VerifyRequest {
  message: string;
  signature: string;
  nonceToken?: string;
}

export type { SIWAErrorCode, SIWAAction } from '@buildersgarden/siwa-ts';

export interface VerifyResponse {
  status: 'authenticated' | 'not_registered' | 'rejected';
  address?: string;
  agentId?: number;
  agentRegistry?: string;
  chainId?: number;
  verified?: 'offline' | 'onchain';
  code?: import('@buildersgarden/siwa-ts').SIWAErrorCode;
  error?: string;
  action?: import('@buildersgarden/siwa-ts').SIWAAction;
  skill?: { name: string; install: string; url: string };
  // On authenticated
  receipt?: string;
  receiptExpiresAt?: string;
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
