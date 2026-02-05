/**
 * siwa.ts
 *
 * SIWA (Sign In With Agent) utility functions.
 * Provides message building, signing (agent-side), and verification (server-side).
 *
 * Dependencies:
 *   npm install ethers
 */

import { ethers } from 'ethers';
import * as crypto from 'crypto';

// ─── Types ───────────────────────────────────────────────────────────

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
  error?: string;
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

// ─── Agent-Side Signing ──────────────────────────────────────────────

/**
 * Sign a SIWA message using the secure keystore.
 *
 * The private key is loaded from the keystore, used to sign, and discarded.
 * It is NEVER returned or exposed to the caller.
 *
 * @param fields — SIWA message fields (domain, agentId, etc.)
 * @param keystoreConfig — Optional keystore configuration override
 * @returns { message, signature } — only the plaintext message and EIP-191 signature
 */
export async function signSIWAMessage(
  fields: SIWAMessageFields,
  keystoreConfig?: import('./keystore').KeystoreConfig
): Promise<{ message: string; signature: string }> {
  // Import keystore dynamically to avoid circular deps
  const { signMessage, getAddress } = await import('./keystore');

  // Verify the keystore address matches the claimed address
  const keystoreAddress = await getAddress(keystoreConfig);
  if (!keystoreAddress) {
    throw new Error('No wallet found in keystore. Run createWallet() first.');
  }
  if (keystoreAddress.toLowerCase() !== fields.address.toLowerCase()) {
    throw new Error(`Address mismatch: keystore has ${keystoreAddress}, message claims ${fields.address}`);
  }

  const message = buildSIWAMessage(fields);

  // Sign via keystore — private key is loaded, used, and discarded internally
  const result = await signMessage(message, keystoreConfig);

  return { message, signature: result.signature };
}

/**
 * Sign a SIWA message using a raw private key.
 * ⚠️ DEPRECATED: Use signSIWAMessage() with keystore instead.
 * Kept only for server-side testing or environments without keystore.
 */
export async function signSIWAMessageUnsafe(
  privateKey: string,
  fields: SIWAMessageFields
): Promise<{ message: string; signature: string }> {
  const wallet = new ethers.Wallet(privateKey);

  if (wallet.address.toLowerCase() !== fields.address.toLowerCase()) {
    throw new Error(`Address mismatch: wallet is ${wallet.address}, message says ${fields.address}`);
  }

  const message = buildSIWAMessage(fields);
  const signature = await wallet.signMessage(message);

  return { message, signature };
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
 * @param provider   ethers Provider for onchain verification
 */
export async function verifySIWA(
  message: string,
  signature: string,
  expectedDomain: string,
  nonceValid: (nonce: string) => boolean | Promise<boolean>,
  provider: ethers.Provider
): Promise<SIWAVerificationResult> {
  try {
    // 1. Parse
    const fields = parseSIWAMessage(message);

    // 2. Recover signer
    const recovered = ethers.verifyMessage(message, signature);

    // 3. Address match
    if (recovered.toLowerCase() !== fields.address.toLowerCase()) {
      return { valid: false, address: recovered, agentId: fields.agentId, agentRegistry: fields.agentRegistry, chainId: fields.chainId, error: 'Recovered address does not match message address' };
    }

    // 4. Domain binding
    if (fields.domain !== expectedDomain) {
      return { valid: false, address: recovered, agentId: fields.agentId, agentRegistry: fields.agentRegistry, chainId: fields.chainId, error: `Domain mismatch: expected ${expectedDomain}, got ${fields.domain}` };
    }

    // 5. Nonce
    const nonceOk = await nonceValid(fields.nonce);
    if (!nonceOk) {
      return { valid: false, address: recovered, agentId: fields.agentId, agentRegistry: fields.agentRegistry, chainId: fields.chainId, error: 'Invalid or consumed nonce' };
    }

    // 6. Time window
    const now = new Date();
    if (fields.expirationTime && now > new Date(fields.expirationTime)) {
      return { valid: false, address: recovered, agentId: fields.agentId, agentRegistry: fields.agentRegistry, chainId: fields.chainId, error: 'Message expired' };
    }
    if (fields.notBefore && now < new Date(fields.notBefore)) {
      return { valid: false, address: recovered, agentId: fields.agentId, agentRegistry: fields.agentRegistry, chainId: fields.chainId, error: 'Message not yet valid (notBefore)' };
    }

    // 7. Onchain ownership — extract registry address from agentRegistry string
    const registryParts = fields.agentRegistry.split(':');
    if (registryParts.length !== 3 || registryParts[0] !== 'eip155') {
      return { valid: false, address: recovered, agentId: fields.agentId, agentRegistry: fields.agentRegistry, chainId: fields.chainId, error: 'Invalid agentRegistry format' };
    }
    const registryAddress = registryParts[2];

    const registry = new ethers.Contract(
      registryAddress,
      ['function ownerOf(uint256) view returns (address)'],
      provider
    );
    const owner = await registry.ownerOf(fields.agentId);

    if (owner.toLowerCase() !== recovered.toLowerCase()) {
      // 7b. ERC-1271 fallback for smart contract wallets / EIP-7702 delegated accounts.
      // If ecrecover doesn't match the NFT owner, the owner may be a contract
      // that validates signatures via isValidSignature (ERC-1271).
      const messageHash = ethers.hashMessage(message);
      try {
        const ownerContract = new ethers.Contract(
          owner,
          ['function isValidSignature(bytes32, bytes) view returns (bytes4)'],
          provider
        );
        const magicValue = await ownerContract.isValidSignature(messageHash, signature);
        // ERC-1271 magic value: 0x1626ba7e
        if (magicValue !== '0x1626ba7e') {
          return { valid: false, address: recovered, agentId: fields.agentId, agentRegistry: fields.agentRegistry, chainId: fields.chainId, error: 'Signer is not the owner of this agent NFT (ERC-1271 check also failed)' };
        }
        // ERC-1271 validated — the owner contract accepted the signature
      } catch {
        // Owner is not a contract or doesn't implement ERC-1271
        return { valid: false, address: recovered, agentId: fields.agentId, agentRegistry: fields.agentRegistry, chainId: fields.chainId, error: 'Signer is not the owner of this agent NFT' };
      }
    }

    return { valid: true, address: recovered, agentId: fields.agentId, agentRegistry: fields.agentRegistry, chainId: fields.chainId };

  } catch (err: any) {
    return { valid: false, address: '', agentId: 0, agentRegistry: '', chainId: 0, error: err.message || 'Verification failed' };
  }
}
