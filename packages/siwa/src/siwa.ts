/**
 * siwa.ts
 *
 * SIWA (Sign In With Agent) utility functions.
 * Provides message building, signing (agent-side), and verification (server-side).
 *
 * Dependencies:
 *   npm install viem
 */

import {
  createPublicClient,
  http,
  verifyMessage,
  hashMessage,
  getAddress as checksumAddress,
  type PublicClient,
  type Hex,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as crypto from 'crypto';
import { AgentProfile, getAgent, getReputation, ServiceType, TrustModel } from './registry.js';

// ─── Types ───────────────────────────────────────────────────────────

export enum SIWAErrorCode {
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  DOMAIN_MISMATCH = 'DOMAIN_MISMATCH',
  INVALID_NONCE = 'INVALID_NONCE',
  MESSAGE_EXPIRED = 'MESSAGE_EXPIRED',
  MESSAGE_NOT_YET_VALID = 'MESSAGE_NOT_YET_VALID',
  INVALID_REGISTRY_FORMAT = 'INVALID_REGISTRY_FORMAT',
  NOT_REGISTERED = 'NOT_REGISTERED',
  NOT_OWNER = 'NOT_OWNER',
  AGENT_NOT_ACTIVE = 'AGENT_NOT_ACTIVE',
  MISSING_SERVICE = 'MISSING_SERVICE',
  MISSING_TRUST_MODEL = 'MISSING_TRUST_MODEL',
  LOW_REPUTATION = 'LOW_REPUTATION',
  CUSTOM_CHECK_FAILED = 'CUSTOM_CHECK_FAILED',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
}

export interface SIWAMessageFields {
  domain: string;
  address: string;
  statement?: string;
  uri: string;
  version?: string;
  agentId: number;
  agentRegistry: string;   // e.g. "eip155:84532:0x8004AA63..."
  chainId: number;
  nonce: string;
  issuedAt: string;         // RFC 3339
  expirationTime?: string;  // RFC 3339
  notBefore?: string;       // RFC 3339
  requestId?: string;
}

export interface SIWAVerificationResult {
  valid: boolean;
  address: string;
  agentId: number;
  agentRegistry: string;
  chainId: number;
  code?: SIWAErrorCode;
  error?: string;
  agent?: AgentProfile;
}

export interface SIWAVerifyCriteria {
  minScore?: number;
  minFeedbackCount?: number;
  reputationRegistryAddress?: string;
  requiredServices?: (ServiceType | (string & {}))[];
  mustBeActive?: boolean;
  requiredTrust?: (TrustModel | (string & {}))[];
  custom?: (agent: AgentProfile) => boolean | Promise<boolean>;
}

// ─── Standard Response Format ────────────────────────────────────────

export interface SIWAResponse {
  status: 'authenticated' | 'not_registered' | 'rejected';
  address?: string;
  agentId?: number;
  agentRegistry?: string;
  chainId?: number;
  verified?: 'offline' | 'onchain';
  code?: SIWAErrorCode;
  error?: string;
  action?: SIWAAction;
  skill?: { name: string; install: string; url: string };
}

export interface SIWAAction {
  type: 'register';
  message: string;
  skill: { name: string; install: string; url: string };
  steps: string[];
  registryAddress?: string;
  chainId?: number;
}

/**
 * Convert a SIWAVerificationResult into a standard SIWAResponse
 * that platforms can forward directly to agents.
 */
export function buildSIWAResponse(result: SIWAVerificationResult): SIWAResponse {
  const base = {
    address: result.address || undefined,
    agentId: result.agentId || undefined,
    agentRegistry: result.agentRegistry || undefined,
    chainId: result.chainId || undefined,
  };

  const skillRef = {
    name: '@buildersgarden/siwa',
    install: 'npm install @buildersgarden/siwa',
    url: 'https://siwa.builders.garden/skill.md',
  };

  if (result.valid) {
    return { status: 'authenticated', ...base };
  }

  if (result.code === SIWAErrorCode.NOT_REGISTERED) {
    const registryParts = result.agentRegistry ? result.agentRegistry.split(':') : [];
    const registryAddress = registryParts.length === 3 ? registryParts[2] : undefined;
    const chainId = result.chainId || (registryParts.length >= 2 ? parseInt(registryParts[1]) : undefined);

    return {
      status: 'not_registered',
      ...base,
      code: result.code,
      error: 'Agent is not registered on the ERC-8004 Identity Registry.',
      skill: skillRef,
      action: {
        type: 'register',
        message: 'This address is not registered as an ERC-8004 agent. Install the SIWA SDK and register before signing in.',
        skill: skillRef,
        steps: [
          'Install the SDK: npm install @buildersgarden/siwa',
          "Create a wallet: import { createWallet } from '@buildersgarden/siwa/keystore'; const wallet = await createWallet();",
          'Fund the wallet with ETH on the target chain for gas fees',
          'Build ERC-8004 registration metadata (JSON with name, description, services, active: true)',
          'Register onchain: call register(agentURI) on the Identity Registry contract',
          'Retry SIWA sign-in',
        ],
        registryAddress,
        chainId,
      },
    };
  }

  return {
    status: 'rejected',
    ...base,
    code: result.code,
    error: result.error,
    skill: skillRef,
  };
}

// ─── Message Construction ────────────────────────────────────────────

/**
 * Build a SIWA plaintext message string from structured fields.
 */
export function buildSIWAMessage(fields: SIWAMessageFields): string {
  const lines: string[] = [];

  lines.push(`${fields.domain} wants you to sign in with your Agent account:`);
  lines.push(fields.address);
  lines.push('');

  if (fields.statement) {
    lines.push(fields.statement);
  }
  lines.push('');

  lines.push(`URI: ${fields.uri}`);
  lines.push(`Version: ${fields.version || '1'}`);
  lines.push(`Agent ID: ${fields.agentId}`);
  lines.push(`Agent Registry: ${fields.agentRegistry}`);
  lines.push(`Chain ID: ${fields.chainId}`);
  lines.push(`Nonce: ${fields.nonce}`);
  lines.push(`Issued At: ${fields.issuedAt}`);

  if (fields.expirationTime) lines.push(`Expiration Time: ${fields.expirationTime}`);
  if (fields.notBefore) lines.push(`Not Before: ${fields.notBefore}`);
  if (fields.requestId) lines.push(`Request ID: ${fields.requestId}`);

  return lines.join('\n');
}

/**
 * Parse a SIWA message string back into structured fields.
 */
export function parseSIWAMessage(message: string): SIWAMessageFields {
  const lines = message.split('\n');

  const domainMatch = lines[0]?.match(/^(.+) wants you to sign in with your Agent account:$/);
  if (!domainMatch) throw new Error('Invalid SIWA message: missing domain line');

  const domain = domainMatch[1];
  const address = lines[1];
  if (!address || !address.startsWith('0x') || address.length !== 42) {
    throw new Error('Invalid SIWA message: missing or malformed address');
  }

  // Find fields after the blank lines
  const fieldMap: Record<string, string> = {};
  let statement: string | undefined;
  let inStatement = false;
  const stmtLines: string[] = [];

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];

    if (i === 2 && line === '') { inStatement = true; continue; }

    if (inStatement) {
      if (line === '' || line.startsWith('URI: ')) {
        inStatement = false;
        statement = stmtLines.join('\n').trim() || undefined;
        if (line.startsWith('URI: ')) {
          const [key, ...rest] = line.split(': ');
          fieldMap[key] = rest.join(': ');
        }
        continue;
      }
      stmtLines.push(line);
      continue;
    }

    if (line.includes(': ')) {
      const [key, ...rest] = line.split(': ');
      fieldMap[key] = rest.join(': ');
    }
  }

  return {
    domain,
    address,
    statement,
    uri: fieldMap['URI'] || '',
    version: fieldMap['Version'] || '1',
    agentId: parseInt(fieldMap['Agent ID'] || '0'),
    agentRegistry: fieldMap['Agent Registry'] || '',
    chainId: parseInt(fieldMap['Chain ID'] || '0'),
    nonce: fieldMap['Nonce'] || '',
    issuedAt: fieldMap['Issued At'] || '',
    expirationTime: fieldMap['Expiration Time'],
    notBefore: fieldMap['Not Before'],
    requestId: fieldMap['Request ID'],
  };
}

// ─── Nonce Generation ────────────────────────────────────────────────

/**
 * Generate a cryptographically secure nonce (≥ 8 alphanumeric characters).
 */
export function generateNonce(length: number = 16): string {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

// ─── Server-Side Nonce Creation ─────────────────────────────────────

export interface SIWANonceParams {
  address: string;
  agentId: number;
  agentRegistry: string;   // e.g. "eip155:84532:0x8004AA63..."
}

export interface SIWANonceOptions {
  expirationTTL?: number;  // milliseconds, defaults to 300_000 (5 min)
}

export type SIWANonceResult =
  | { status: 'nonce_issued'; nonce: string; issuedAt: string; expirationTime: string }
  | SIWAResponse;

/**
 * Validate agent registration and create a SIWA nonce.
 *
 * Platforms call this in their nonce endpoint. When a `client` is provided,
 * the function checks onchain that the agent NFT exists and is owned by the
 * requesting address **before** issuing a nonce.  This lets the agent fail
 * fast with actionable registration instructions instead of going through
 * the full sign → verify cycle.
 *
 * The nonce and timestamps are returned to the platform, which is responsible
 * for storing them and validating them later during verification.
 *
 * @param params   Agent identity (address, agentId, agentRegistry)
 * @param client   viem PublicClient for onchain checks (skip registration check if null)
 * @param options  Optional config (expirationTTL)
 * @returns        `{ status: 'nonce_issued', nonce, ... }` on success, or a `SIWAResponse` on failure
 */
export async function createSIWANonce(
  params: SIWANonceParams,
  client?: PublicClient | null,
  options?: SIWANonceOptions,
): Promise<SIWANonceResult> {
  const { address, agentId, agentRegistry } = params;
  const ttl = options?.expirationTTL ?? 300_000; // 5 minutes

  // Validate agentRegistry format
  const registryParts = agentRegistry.split(':');
  if (registryParts.length !== 3 || registryParts[0] !== 'eip155') {
    return buildSIWAResponse({
      valid: false,
      address,
      agentId,
      agentRegistry,
      chainId: 0,
      code: SIWAErrorCode.INVALID_REGISTRY_FORMAT,
      error: 'Invalid agentRegistry format',
    });
  }

  const registryAddress = registryParts[2] as Address;
  const chainId = parseInt(registryParts[1]);

  // Onchain registration check (if client is available)
  if (client) {
    let owner: string;
    try {
      owner = await client.readContract({
        address: registryAddress,
        abi: [{ name: 'ownerOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] }] as const,
        functionName: 'ownerOf',
        args: [BigInt(agentId)],
      }) as string;
    } catch {
      return buildSIWAResponse({
        valid: false,
        address,
        agentId,
        agentRegistry,
        chainId,
        code: SIWAErrorCode.NOT_REGISTERED,
        error: 'Agent is not registered on the ERC-8004 Identity Registry',
      });
    }

    if (owner.toLowerCase() !== address.toLowerCase()) {
      return buildSIWAResponse({
        valid: false,
        address,
        agentId,
        agentRegistry,
        chainId,
        code: SIWAErrorCode.NOT_OWNER,
        error: 'Signer is not the owner of this agent NFT',
      });
    }
  }

  // Agent is registered (or offline mode) — issue the nonce
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttl);

  return {
    status: 'nonce_issued',
    nonce: generateNonce(),
    issuedAt: now.toISOString(),
    expirationTime: expiresAt.toISOString(),
  };
}

// ─── Agent-Side Signing ──────────────────────────────────────────────

/**
 * Fields accepted by signSIWAMessage.
 * `address` is optional — when omitted, the address is fetched directly
 * from the keystore (the trusted source of truth for the agent wallet).
 */
export type SIWASignFields = Omit<SIWAMessageFields, 'address'> & { address?: string };

/**
 * Sign a SIWA message using the secure keystore.
 *
 * The private key is loaded from the keystore, used to sign, and discarded.
 * It is NEVER returned or exposed to the caller.
 *
 * The agent address is always resolved from the keystore — the single source
 * of truth — so the caller doesn't need to supply (or risk hallucinating) it.
 * If `fields.address` is provided it must match the keystore address.
 *
 * @param fields — SIWA message fields (domain, agentId, etc.). `address` is optional.
 * @param keystoreConfig — Optional keystore configuration override
 * @returns { message, signature, address } — the plaintext message, EIP-191 signature, and resolved address
 */
export async function signSIWAMessage(
  fields: SIWASignFields,
  keystoreConfig?: import('./keystore').KeystoreConfig
): Promise<{ message: string; signature: string; address: string }> {
  // Import keystore dynamically to avoid circular deps
  const { signMessage, getAddress } = await import('./keystore');

  // Resolve the address from the keystore — the trusted source of truth
  const keystoreAddress = await getAddress(keystoreConfig);
  if (!keystoreAddress) {
    throw new Error('No wallet found in keystore. Run createWallet() first.');
  }

  // If the caller supplied an address, verify it matches (defensive check)
  if (fields.address && keystoreAddress.toLowerCase() !== fields.address.toLowerCase()) {
    throw new Error(`Address mismatch: keystore has ${keystoreAddress}, message claims ${fields.address}`);
  }

  const resolvedFields: SIWAMessageFields = {
    ...fields,
    address: keystoreAddress,
  };

  const message = buildSIWAMessage(resolvedFields);

  // Sign via keystore — private key is loaded, used, and discarded internally
  const result = await signMessage(message, keystoreConfig);

  return { message, signature: result.signature, address: keystoreAddress };
}



// ─── Server-Side Verification ────────────────────────────────────────

/**
 * Verify a SIWA message + signature.
 *
 * Checks:
 * 1. Message format validity
 * 2. Signature → address recovery
 * 3. Address matches message
 * 4. Domain matches expected domain
 * 5. Nonce matches (caller must validate against their nonce store)
 * 6. Time window (expirationTime / notBefore)
 * 7. Onchain: ownerOf(agentId) === recovered address
 *
 * @param message    Full SIWA message string
 * @param signature  EIP-191 signature hex string
 * @param expectedDomain  The server's domain (for domain binding)
 * @param nonceValid  Callback that returns true if the nonce is valid and unconsumed
 * @param client   viem PublicClient for onchain verification
 * @param criteria   Optional criteria to validate agent profile/reputation after ownership check
 */
export async function verifySIWA(
  message: string,
  signature: string,
  expectedDomain: string,
  nonceValid: (nonce: string) => boolean | Promise<boolean>,
  client: PublicClient,
  criteria?: SIWAVerifyCriteria
): Promise<SIWAVerificationResult> {
  try {
    // 1. Parse
    const fields = parseSIWAMessage(message);

    // 2. Recover signer
    const isValid = await verifyMessage({
      address: fields.address as Address,
      message,
      signature: signature as Hex,
    });

    if (!isValid) {
      return { valid: false, address: fields.address, agentId: fields.agentId, agentRegistry: fields.agentRegistry, chainId: fields.chainId, code: SIWAErrorCode.INVALID_SIGNATURE, error: 'Invalid signature' };
    }

    const recovered = fields.address;

    // 3. Address match is implicit in verifyMessage (it checks against the address)

    // 4. Domain binding
    if (fields.domain !== expectedDomain) {
      return { valid: false, address: recovered, agentId: fields.agentId, agentRegistry: fields.agentRegistry, chainId: fields.chainId, code: SIWAErrorCode.DOMAIN_MISMATCH, error: `Domain mismatch: expected ${expectedDomain}, got ${fields.domain}` };
    }

    // 5. Nonce
    const nonceOk = await nonceValid(fields.nonce);
    if (!nonceOk) {
      return { valid: false, address: recovered, agentId: fields.agentId, agentRegistry: fields.agentRegistry, chainId: fields.chainId, code: SIWAErrorCode.INVALID_NONCE, error: 'Invalid or consumed nonce' };
    }

    // 6. Time window
    const now = new Date();
    if (fields.expirationTime && now > new Date(fields.expirationTime)) {
      return { valid: false, address: recovered, agentId: fields.agentId, agentRegistry: fields.agentRegistry, chainId: fields.chainId, code: SIWAErrorCode.MESSAGE_EXPIRED, error: 'Message expired' };
    }
    if (fields.notBefore && now < new Date(fields.notBefore)) {
      return { valid: false, address: recovered, agentId: fields.agentId, agentRegistry: fields.agentRegistry, chainId: fields.chainId, code: SIWAErrorCode.MESSAGE_NOT_YET_VALID, error: 'Message not yet valid (notBefore)' };
    }

    // 7. Onchain ownership — extract registry address from agentRegistry string
    const registryParts = fields.agentRegistry.split(':');
    if (registryParts.length !== 3 || registryParts[0] !== 'eip155') {
      return { valid: false, address: recovered, agentId: fields.agentId, agentRegistry: fields.agentRegistry, chainId: fields.chainId, code: SIWAErrorCode.INVALID_REGISTRY_FORMAT, error: 'Invalid agentRegistry format' };
    }
    const registryAddress = registryParts[2] as Address;

    let owner: string;
    try {
      owner = await client.readContract({
        address: registryAddress,
        abi: [{ name: 'ownerOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] }] as const,
        functionName: 'ownerOf',
        args: [BigInt(fields.agentId)],
      }) as string;
    } catch {
      // ownerOf reverts when the token doesn't exist — agent is not registered
      return { valid: false, address: recovered, agentId: fields.agentId, agentRegistry: fields.agentRegistry, chainId: fields.chainId, code: SIWAErrorCode.NOT_REGISTERED, error: 'Agent is not registered on the ERC-8004 Identity Registry' };
    }

    if (owner.toLowerCase() !== recovered.toLowerCase()) {
      // 7b. ERC-1271 fallback for smart contract wallets / EIP-7702 delegated accounts.
      // If ecrecover doesn't match the NFT owner, the owner may be a contract
      // that validates signatures via isValidSignature (ERC-1271).
      const messageHash = hashMessage(message);
      try {
        const magicValue = await client.readContract({
          address: owner as Address,
          abi: [{ name: 'isValidSignature', type: 'function', stateMutability: 'view', inputs: [{ name: 'hash', type: 'bytes32' }, { name: 'signature', type: 'bytes' }], outputs: [{ name: '', type: 'bytes4' }] }] as const,
          functionName: 'isValidSignature',
          args: [messageHash, signature as Hex],
        });
        // ERC-1271 magic value: 0x1626ba7e
        if (magicValue !== '0x1626ba7e') {
          return { valid: false, address: recovered, agentId: fields.agentId, agentRegistry: fields.agentRegistry, chainId: fields.chainId, code: SIWAErrorCode.NOT_OWNER, error: 'Signer is not the owner of this agent NFT (ERC-1271 check also failed)' };
        }
        // ERC-1271 validated — the owner contract accepted the signature
      } catch {
        // Owner is not a contract or doesn't implement ERC-1271
        return { valid: false, address: recovered, agentId: fields.agentId, agentRegistry: fields.agentRegistry, chainId: fields.chainId, code: SIWAErrorCode.NOT_OWNER, error: 'Signer is not the owner of this agent NFT' };
      }
    }

    // 8. Criteria checks (optional)
    const baseResult: SIWAVerificationResult = {
      valid: true,
      address: recovered,
      agentId: fields.agentId,
      agentRegistry: fields.agentRegistry,
      chainId: fields.chainId,
    };

    if (!criteria) return baseResult;

    const agent = await getAgent(fields.agentId, {
      registryAddress: registryAddress,
      client,
      fetchMetadata: true,
    });
    baseResult.agent = agent;

    if (criteria.mustBeActive) {
      if (!agent.metadata?.active) {
        return { ...baseResult, valid: false, code: SIWAErrorCode.AGENT_NOT_ACTIVE, error: 'Agent is not active' };
      }
    }

    if (criteria.requiredServices && criteria.requiredServices.length > 0) {
      const serviceNames = (agent.metadata?.services ?? []).map(s => s.name);
      for (const required of criteria.requiredServices) {
        if (!serviceNames.includes(required)) {
          return { ...baseResult, valid: false, code: SIWAErrorCode.MISSING_SERVICE, error: `Agent missing required service: ${required}` };
        }
      }
    }

    if (criteria.requiredTrust && criteria.requiredTrust.length > 0) {
      const supported = agent.metadata?.supportedTrust ?? [];
      for (const required of criteria.requiredTrust) {
        if (!supported.includes(required)) {
          return { ...baseResult, valid: false, code: SIWAErrorCode.MISSING_TRUST_MODEL, error: `Agent missing required trust model: ${required}` };
        }
      }
    }

    if (criteria.minScore !== undefined || criteria.minFeedbackCount !== undefined) {
      if (!criteria.reputationRegistryAddress) {
        return { ...baseResult, valid: false, code: SIWAErrorCode.LOW_REPUTATION, error: 'reputationRegistryAddress is required for reputation criteria' };
      }
      const rep = await getReputation(fields.agentId, {
        reputationRegistryAddress: criteria.reputationRegistryAddress,
        client,
      });
      if (criteria.minFeedbackCount !== undefined && rep.count < criteria.minFeedbackCount) {
        return { ...baseResult, valid: false, code: SIWAErrorCode.LOW_REPUTATION, error: `Agent feedback count ${rep.count} below minimum ${criteria.minFeedbackCount}` };
      }
      if (criteria.minScore !== undefined && rep.score < criteria.minScore) {
        return { ...baseResult, valid: false, code: SIWAErrorCode.LOW_REPUTATION, error: `Agent reputation score ${rep.score} below minimum ${criteria.minScore}` };
      }
    }

    if (criteria.custom) {
      const passed = await criteria.custom(agent);
      if (!passed) {
        return { ...baseResult, valid: false, code: SIWAErrorCode.CUSTOM_CHECK_FAILED, error: 'Agent failed custom criteria check' };
      }
    }

    return baseResult;

  } catch (err: any) {
    return { valid: false, address: '', agentId: 0, agentRegistry: '', chainId: 0, code: SIWAErrorCode.VERIFICATION_FAILED, error: err.message || 'Verification failed' };
  }
}
