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
  getAddress as checksumAddress,
  type PublicClient,
  type Hex,
  type Address,
} from 'viem';
import * as crypto from 'crypto';
import { AgentProfile, getAgent, getReputation, ServiceType, TrustModel } from './registry.js';
import type { Signer, SignerType } from './signer/index.js';
import type { SIWANonceStore } from './nonce-store.js';
import {
  createCaptchaChallenge,
  unpackCaptchaResponse,
  verifyCaptchaSolution,
  type CaptchaChallenge,
  type CaptchaPolicy,
  type CaptchaOptions,
} from './captcha.js';

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
  CAPTCHA_REQUIRED = 'CAPTCHA_REQUIRED',
  CAPTCHA_FAILED = 'CAPTCHA_FAILED',
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
  verified: 'offline' | 'onchain';
  signerType?: SignerType;
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
  allowedSignerTypes?: SignerType[];
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
  signerType?: SignerType;
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
    verified: result.verified,
    ...(result.signerType ? { signerType: result.signerType } : {}),
  };

  const skillRef = {
    name: '@buildersgarden/siwa',
    install: 'npm install @buildersgarden/siwa',
    url: 'https://siwa.id/skill.md',
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

// ─── HMAC Nonce Token Helpers ───────────────────────────────────────

/** Sign a payload into a compact `base64url(json).base64url(hmac)` token. */
function signNonceToken(payload: object, secret: string): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

/** Verify and decode a nonce token. Returns the payload or null on failure. */
function verifyNonceToken(token: string, secret: string): Record<string, unknown> | null {
  const dotIdx = token.indexOf('.');
  if (dotIdx === -1) return null;
  const data = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return JSON.parse(Buffer.from(data, 'base64url').toString());
}

// ─── Server-Side Nonce Creation ─────────────────────────────────────

export interface SIWANonceParams {
  address: string;
  agentId: number;
  agentRegistry: string;   // e.g. "eip155:84532:0x8004AA63..."
  challengeResponse?: string;
}

export interface SIWANonceOptions {
  expirationTTL?: number;  // milliseconds, defaults to 300_000 (5 min)
  secret?: string;         // HMAC secret for stateless nonce tokens (pass your SIWA_SECRET or any server secret)
  nonceStore?: SIWANonceStore; // pluggable nonce store for replay protection
  captchaPolicy?: CaptchaPolicy;
  captchaOptions?: CaptchaOptions;
}

export type SIWANonceResult =
  | { status: 'nonce_issued'; nonce: string; nonceToken?: string; issuedAt: string; expirationTime: string }
  | { status: 'captcha_required'; challenge: CaptchaChallenge; challengeToken: string }
  | SIWAResponse;

/**
 * Validate agent registration and create a SIWA nonce.
 *
 * Platforms call this in their nonce endpoint. The function checks onchain
 * that the agent NFT exists and is owned by the requesting address **before**
 * issuing a nonce. This lets the agent fail fast with actionable registration
 * instructions instead of going through the full sign → verify cycle.
 *
 * The nonce and timestamps are returned to the platform, which is responsible
 * for storing them and validating them later during verification.
 *
 * @param params   Agent identity (address, agentId, agentRegistry)
 * @param client   viem PublicClient for onchain registration check
 * @param options  Optional config (expirationTTL)
 * @returns        `{ status: 'nonce_issued', nonce, ... }` on success, or a `SIWAResponse` on failure
 */
export async function createSIWANonce(
  params: SIWANonceParams,
  client: PublicClient,
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
      verified: 'onchain',
      code: SIWAErrorCode.INVALID_REGISTRY_FORMAT,
      error: 'Invalid agentRegistry format',
    });
  }

  const registryAddress = registryParts[2] as Address;
  const chainId = parseInt(registryParts[1]);

  // Onchain registration check
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
      verified: 'onchain',
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
      verified: 'onchain',
      code: SIWAErrorCode.NOT_OWNER,
      error: 'Signer is not the owner of this agent NFT',
    });
  }

  // Captcha evaluation (after ownership check, before nonce issuance)
  if (options?.captchaPolicy) {
    const captchaSecret = options.captchaOptions?.secret ?? options.secret;
    if (!captchaSecret) {
      throw new Error('captchaPolicy requires a secret — set captchaOptions.secret or options.secret');
    }

    const difficulty = await options.captchaPolicy({ address, agentId, agentRegistry });
    if (difficulty) {
      // Check if the agent submitted a challenge response
      if (params.challengeResponse) {
        const unpacked = unpackCaptchaResponse(params.challengeResponse);
        if (!unpacked) {
          return buildSIWAResponse({
            valid: false,
            address,
            agentId,
            agentRegistry,
            chainId,
            verified: 'onchain',
            code: SIWAErrorCode.CAPTCHA_FAILED,
            error: 'Invalid captcha response format',
          });
        }

        const verification = await verifyCaptchaSolution(
          unpacked.challengeToken, unpacked.solution, captchaSecret, options.captchaOptions?.verify,
        );
        if (!verification || !verification.overallPass) {
          return buildSIWAResponse({
            valid: false,
            address,
            agentId,
            agentRegistry,
            chainId,
            verified: 'onchain',
            code: SIWAErrorCode.CAPTCHA_FAILED,
            error: `Captcha verification failed: ${verification?.verdict ?? 'invalid token'}`,
          });
        }
        // Captcha passed — fall through to issue nonce
      } else {
        // No response yet — issue a challenge
        const captchaOpts: CaptchaOptions = {
          secret: captchaSecret,
          topics: options.captchaOptions?.topics,
          formats: options.captchaOptions?.formats,
        };
        const { challenge, challengeToken } = createCaptchaChallenge(difficulty, captchaOpts);
        return { status: 'captcha_required', challenge, challengeToken };
      }
    }
  }

  // Agent is registered — issue the nonce
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttl);
  const nonce = generateNonce();

  // Track nonce in the store (for replay protection)
  if (options?.nonceStore) {
    await options.nonceStore.issue(nonce, ttl);
  }

  const result: SIWANonceResult & { status: 'nonce_issued' } = {
    status: 'nonce_issued',
    nonce,
    issuedAt: now.toISOString(),
    expirationTime: expiresAt.toISOString(),
  };

  if (options?.secret) {
    result.nonceToken = signNonceToken(
      { nonce, address, agentId, iat: now.getTime(), exp: expiresAt.getTime() },
      options.secret,
    );
  }

  return result;
}

// ─── Agent-Side Signing ──────────────────────────────────────────────

/**
 * Fields accepted by signSIWAMessage.
 * `address` is optional — when omitted, the address is fetched directly
 * from the signer (the trusted source of truth for the agent wallet).
 */
export type SIWASignFields = Omit<SIWAMessageFields, 'address'> & { address?: string };

/**
 * Sign a SIWA message using the provided signer.
 *
 * The signer abstracts the wallet implementation, allowing you to use:
 *   - createKeyringProxySigner(config)   — Keyring proxy server
 *   - createLocalAccountSigner(account)  — viem LocalAccount (private key)
 *   - createWalletClientSigner(client)   — viem WalletClient (Privy, MetaMask, etc.)
 *
 * The agent address is always resolved from the signer — the single source
 * of truth — so the caller doesn't need to supply (or risk hallucinating) it.
 * If `fields.address` is provided it must match the signer's address.
 *
 * @param fields — SIWA message fields (domain, agentId, etc.). `address` is optional.
 * @param signer — A Signer implementation (see createKeyringProxySigner, createLocalAccountSigner, createWalletClientSigner)
 * @returns { message, signature, address } — the plaintext message, EIP-191 signature, and resolved address
 *
 * @example
 * ```typescript
 * import { signSIWAMessage, createLocalAccountSigner } from '@buildersgarden/siwa';
 * import { privateKeyToAccount } from 'viem/accounts';
 *
 * const account = privateKeyToAccount('0x...');
 * const signer = createLocalAccountSigner(account);
 *
 * const { message, signature, address } = await signSIWAMessage({
 *   domain: 'example.com',
 *   uri: 'https://example.com/login',
 *   agentId: 123,
 *   agentRegistry: 'eip155:84532:0x...',
 *   chainId: 84532,
 *   nonce: 'abc123',
 *   issuedAt: new Date().toISOString(),
 * }, signer);
 * ```
 */
export async function signSIWAMessage(
  fields: SIWASignFields,
  signer: Signer
): Promise<{ message: string; signature: string; address: string }> {
  // Resolve the address from the signer — the trusted source of truth
  const signerAddress = await signer.getAddress();

  // If the caller supplied an address, verify it matches (defensive check)
  if (fields.address && signerAddress.toLowerCase() !== fields.address.toLowerCase()) {
    throw new Error(`Address mismatch: signer has ${signerAddress}, message claims ${fields.address}`);
  }

  const resolvedFields: SIWAMessageFields = {
    ...fields,
    address: signerAddress,
  };

  const message = buildSIWAMessage(resolvedFields);

  // Sign via signer
  const signature = await signer.signMessage(message);

  return { message, signature, address: signerAddress };
}



// ─── Server-Side Verification ────────────────────────────────────────

/**
 * Nonce validation: either a callback (stateful) or a stateless token + secret.
 *
 * Stateful (callback):
 *   Platform stores nonces server-side and provides a validation function.
 *
 * Stateless (nonceToken + secret):
 *   The SDK verifies the HMAC token issued by createSIWANonce({ secret }).
 *   No server-side storage needed — ideal for serverless platforms.
 */
export type NonceValidator =
  | ((nonce: string) => boolean | Promise<boolean>)
  | { nonceToken: string; secret: string }
  | { nonceStore: SIWANonceStore };

/**
 * Verify a SIWA message + signature.
 *
 * Checks:
 * 1. Message format validity
 * 2. Signature → address recovery
 * 3. Address matches message
 * 4. Domain matches expected domain
 * 5. Nonce matches (caller must validate against their nonce store or stateless token)
 * 6. Time window (expirationTime / notBefore)
 * 7. Onchain: ownerOf(agentId) === recovered address
 *
 * @param message    Full SIWA message string
 * @param signature  EIP-191 signature hex string
 * @param expectedDomain  The server's domain (for domain binding)
 * @param nonceValid  Callback or { nonceToken, secret } for stateless validation
 * @param client   viem PublicClient for onchain verification
 * @param criteria   Optional criteria to validate agent profile/reputation after ownership check
 */
export async function verifySIWA(
  message: string,
  signature: string,
  expectedDomain: string,
  nonceValid: NonceValidator,
  client: PublicClient,
  criteria?: SIWAVerifyCriteria
): Promise<SIWAVerificationResult> {
  const fail = (fields: { address: string; agentId: number; agentRegistry: string; chainId: number }, code: SIWAErrorCode, error: string): SIWAVerificationResult =>
    ({ valid: false, address: fields.address, agentId: fields.agentId, agentRegistry: fields.agentRegistry, chainId: fields.chainId, verified: 'onchain', code, error });

  try {
    // 1. Parse
    const fields = parseSIWAMessage(message);

    // 2. Verify signature (supports both EOA and ERC-1271 smart wallets)
    // Using client.verifyMessage handles:
    //   - EOA signatures (ECDSA recovery)
    //   - ERC-1271 smart contract wallets (Safe, Argent, etc.)
    //   - ERC-6492 pre-deployed smart wallets
    const isValid = await client.verifyMessage({
      address: fields.address as Address,
      message,
      signature: signature as Hex,
    });

    if (!isValid) {
      return fail(fields, SIWAErrorCode.INVALID_SIGNATURE, 'Invalid signature');
    }

    const recovered = fields.address;

    // 2b. Detect signer type (EOA vs smart contract account)
    const signerCode = await client.getCode({ address: fields.address as Address });
    const signerType: SignerType = (signerCode && signerCode !== '0x') ? 'sca' : 'eoa';

    // 3. Address match is implicit in verifyMessage (it checks against the address)

    // 4. Domain binding
    if (fields.domain !== expectedDomain) {
      return fail(fields, SIWAErrorCode.DOMAIN_MISMATCH, `Domain mismatch: expected ${expectedDomain}, got ${fields.domain}`);
    }

    // 5. Nonce
    let nonceOk: boolean;
    if (typeof nonceValid === 'function') {
      nonceOk = await nonceValid(fields.nonce);
    } else if ('nonceStore' in nonceValid) {
      // Store-based validation: atomic consume (check + delete)
      nonceOk = await nonceValid.nonceStore.consume(fields.nonce);
    } else {
      // Stateless validation via HMAC token
      const payload = verifyNonceToken(nonceValid.nonceToken, nonceValid.secret);
      if (!payload) {
        return fail(fields, SIWAErrorCode.INVALID_NONCE, 'Invalid nonce token signature');
      }
      const expired = typeof payload.exp === 'number' && payload.exp < Date.now();
      const nonceMismatch = payload.nonce !== fields.nonce;
      const addressMismatch = typeof payload.address === 'string' &&
        payload.address.toLowerCase() !== fields.address.toLowerCase();
      nonceOk = !expired && !nonceMismatch && !addressMismatch;
    }
    if (!nonceOk) {
      return fail(fields, SIWAErrorCode.INVALID_NONCE, 'Invalid or consumed nonce');
    }

    // 6. Time window
    const now = new Date();
    if (fields.expirationTime && now > new Date(fields.expirationTime)) {
      return fail(fields, SIWAErrorCode.MESSAGE_EXPIRED, 'Message expired');
    }
    if (fields.notBefore && now < new Date(fields.notBefore)) {
      return fail(fields, SIWAErrorCode.MESSAGE_NOT_YET_VALID, 'Message not yet valid (notBefore)');
    }

    // 7. Onchain ownership
    const registryParts = fields.agentRegistry.split(':');
    if (registryParts.length !== 3 || registryParts[0] !== 'eip155') {
      return fail(fields, SIWAErrorCode.INVALID_REGISTRY_FORMAT, 'Invalid agentRegistry format');
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
      return fail(fields, SIWAErrorCode.NOT_REGISTERED, 'Agent is not registered on the ERC-8004 Identity Registry');
    }

    if (owner.toLowerCase() !== recovered.toLowerCase()) {
      return fail(fields, SIWAErrorCode.NOT_OWNER, 'Signer is not the owner of this agent NFT');
    }

    // 8. Base result
    const baseResult: SIWAVerificationResult = {
      valid: true,
      address: recovered,
      agentId: fields.agentId,
      agentRegistry: fields.agentRegistry,
      chainId: fields.chainId,
      verified: 'onchain',
      signerType,
    };

    if (!criteria) return baseResult;

    // Signer type policy (checked before fetching metadata for early exit)
    if (criteria.allowedSignerTypes?.length && !criteria.allowedSignerTypes.includes(signerType)) {
      return { ...baseResult, valid: false, code: SIWAErrorCode.CUSTOM_CHECK_FAILED, error: `Signer type '${signerType}' is not in allowed types [${criteria.allowedSignerTypes.join(', ')}]` };
    }

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
    return { valid: false, address: '', agentId: 0, agentRegistry: '', chainId: 0, verified: 'offline', code: SIWAErrorCode.VERIFICATION_FAILED, error: err.message || 'Verification failed' };
  }
}
