/**
 * identity.ts
 *
 * Read/write helpers for the agent's SIWA_IDENTITY.md file.
 * Minimal 4-field identity: Address, Agent ID, Agent Registry, Chain ID.
 *
 * SIWA_IDENTITY.md uses the pattern: - **Key**: `value`
 *
 * Registration checks are done onchain via ownerOf() when a PublicClient
 * is provided, otherwise the local file is used as a cache.
 *
 * Dependencies: fs (Node built-in), viem (optional for onchain checks)
 */

import * as fs from 'fs';
import type { PublicClient, Address } from 'viem';

const DEFAULT_IDENTITY_PATH = './SIWA_IDENTITY.md';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentIdentity {
  address?: string;
  agentId?: number;
  agentRegistry?: string;
  chainId?: number;
}

// ---------------------------------------------------------------------------
// File Operations
// ---------------------------------------------------------------------------

/**
 * Ensure SIWA_IDENTITY.md exists. If not, copy from template or create minimal.
 */
export function ensureIdentityExists(
  identityPath: string = DEFAULT_IDENTITY_PATH,
  templatePath?: string
): void {
  if (fs.existsSync(identityPath)) return;

  if (templatePath && fs.existsSync(templatePath)) {
    fs.copyFileSync(templatePath, identityPath);
  } else {
    const minimal = `# Agent Identity
- **Address**: \`<NOT SET>\`
- **Agent ID**: \`<NOT SET>\`
- **Agent Registry**: \`<NOT SET>\`
- **Chain ID**: \`<NOT SET>\`
`;
    fs.writeFileSync(identityPath, minimal);
  }
}

/**
 * Read the agent identity from SIWA_IDENTITY.md.
 * Returns typed AgentIdentity with parsed values.
 */
export function readIdentity(identityPath: string = DEFAULT_IDENTITY_PATH): AgentIdentity {
  if (!fs.existsSync(identityPath)) return {};
  const content = fs.readFileSync(identityPath, 'utf-8');
  const fields: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const match = line.match(/^- \*\*(.+?)\*\*:\s*`(.+?)`/);
    if (match && match[2] !== '<NOT SET>') {
      fields[match[1]] = match[2];
    }
  }

  const identity: AgentIdentity = {};
  if (fields['Address']) identity.address = fields['Address'];
  if (fields['Agent ID']) identity.agentId = parseInt(fields['Agent ID']);
  if (fields['Agent Registry']) identity.agentRegistry = fields['Agent Registry'];
  if (fields['Chain ID']) identity.chainId = parseInt(fields['Chain ID']);
  return identity;
}

/**
 * Write a single field value in SIWA_IDENTITY.md.
 */
export function writeIdentityField(
  key: string,
  value: string,
  identityPath: string = DEFAULT_IDENTITY_PATH
): void {
  let content = fs.readFileSync(identityPath, 'utf-8');
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(- \\*\\*${escaped}\\*\\*:\\s*)\`.+?\``);
  if (pattern.test(content)) {
    content = content.replace(pattern, `$1\`${value}\``);
  } else {
    content += `\n- **${key}**: \`${value}\`\n`;
  }
  fs.writeFileSync(identityPath, content);
}

/**
 * Check if the agent has a wallet address recorded in SIWA_IDENTITY.md.
 */
export function hasWalletRecord(identityPath: string = DEFAULT_IDENTITY_PATH): boolean {
  const identity = readIdentity(identityPath);
  return !!identity.address;
}

/**
 * Check if the agent is registered.
 *
 * Without a client: returns true if SIWA_IDENTITY.md has an Agent ID and Agent Registry (local cache).
 * With a client: performs an onchain ownerOf(agentId) check on the registry contract.
 */
export async function isRegistered(options?: {
  identityPath?: string;
  client?: PublicClient;
}): Promise<boolean> {
  const identityPath = options?.identityPath ?? DEFAULT_IDENTITY_PATH;
  const identity = readIdentity(identityPath);

  if (!identity.agentId || !identity.agentRegistry) return false;

  const client = options?.client;
  if (!client) return true; // Local cache says registered

  // Onchain check: ownerOf(agentId) on the registry
  const registryParts = identity.agentRegistry.split(':');
  if (registryParts.length !== 3 || registryParts[0] !== 'eip155') return false;
  const registryAddress = registryParts[2] as Address;

  try {
    await client.readContract({
      address: registryAddress,
      abi: [{
        name: 'ownerOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        outputs: [{ name: '', type: 'address' }],
      }] as const,
      functionName: 'ownerOf',
      args: [BigInt(identity.agentId)],
    });
    return true;
  } catch {
    return false;
  }
}
