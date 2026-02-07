/**
 * policy-store.ts
 *
 * JSON file-based storage for policies and wallet-policy bindings.
 * Policies are stored in an encrypted JSON file alongside the keystore.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { Policy, PolicyStoreData, WalletPolicyBinding } from './types.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_STORE_PATH = './data/policies.json';

function getStorePath(): string {
  return process.env.POLICY_STORE_PATH || DEFAULT_STORE_PATH;
}

// ---------------------------------------------------------------------------
// ID Generation
// ---------------------------------------------------------------------------

export function generatePolicyId(): string {
  return `pol_${crypto.randomBytes(12).toString('hex')}`;
}

// ---------------------------------------------------------------------------
// Store Initialization
// ---------------------------------------------------------------------------

function ensureStoreExists(): void {
  const storePath = getStorePath();
  const dir = path.dirname(storePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(storePath)) {
    const initial: PolicyStoreData = {
      policies: {},
      bindings: {},
    };
    fs.writeFileSync(storePath, JSON.stringify(initial, null, 2), { mode: 0o600 });
  }
}

function loadStore(): PolicyStoreData {
  ensureStoreExists();
  const storePath = getStorePath();
  const content = fs.readFileSync(storePath, 'utf-8');
  return JSON.parse(content) as PolicyStoreData;
}

function saveStore(data: PolicyStoreData): void {
  ensureStoreExists();
  const storePath = getStorePath();
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2), { mode: 0o600 });
}

// ---------------------------------------------------------------------------
// Policy CRUD
// ---------------------------------------------------------------------------

/**
 * Get all policies.
 */
export async function getAllPolicies(): Promise<Policy[]> {
  const store = loadStore();
  return Object.values(store.policies);
}

/**
 * Get a policy by ID.
 */
export async function getPolicy(id: string): Promise<Policy | null> {
  const store = loadStore();
  return store.policies[id] || null;
}

/**
 * Create or update a policy.
 */
export async function savePolicy(policy: Policy): Promise<void> {
  const store = loadStore();
  policy.updated_at = new Date().toISOString();
  store.policies[policy.id] = policy;
  saveStore(store);
}

/**
 * Delete a policy by ID.
 * Also removes all bindings to this policy.
 */
export async function deletePolicy(id: string): Promise<boolean> {
  const store = loadStore();

  if (!store.policies[id]) {
    return false;
  }

  delete store.policies[id];

  // Remove bindings
  for (const address of Object.keys(store.bindings)) {
    store.bindings[address] = store.bindings[address].filter(pid => pid !== id);
    if (store.bindings[address].length === 0) {
      delete store.bindings[address];
    }
  }

  saveStore(store);
  return true;
}

// ---------------------------------------------------------------------------
// Wallet-Policy Bindings
// ---------------------------------------------------------------------------

/**
 * Get all policies attached to a wallet.
 */
export async function getWalletPolicies(walletAddress: string): Promise<Policy[]> {
  const store = loadStore();
  const normalizedAddress = walletAddress.toLowerCase();
  const policyIds = store.bindings[normalizedAddress] || [];

  const policies: Policy[] = [];
  for (const id of policyIds) {
    const policy = store.policies[id];
    if (policy) {
      policies.push(policy);
    }
  }

  return policies;
}

/**
 * Get all policy IDs attached to a wallet.
 */
export async function getWalletPolicyIds(walletAddress: string): Promise<string[]> {
  const store = loadStore();
  const normalizedAddress = walletAddress.toLowerCase();
  return store.bindings[normalizedAddress] || [];
}

/**
 * Attach a policy to a wallet.
 */
export async function attachPolicy(walletAddress: string, policyId: string): Promise<void> {
  const store = loadStore();
  const normalizedAddress = walletAddress.toLowerCase();

  // Verify policy exists
  if (!store.policies[policyId]) {
    throw new Error(`Policy ${policyId} not found`);
  }

  // Initialize bindings array if needed
  if (!store.bindings[normalizedAddress]) {
    store.bindings[normalizedAddress] = [];
  }

  // Don't add duplicates
  if (!store.bindings[normalizedAddress].includes(policyId)) {
    store.bindings[normalizedAddress].push(policyId);
    saveStore(store);
  }
}

/**
 * Detach a policy from a wallet.
 */
export async function detachPolicy(walletAddress: string, policyId: string): Promise<boolean> {
  const store = loadStore();
  const normalizedAddress = walletAddress.toLowerCase();

  if (!store.bindings[normalizedAddress]) {
    return false;
  }

  const idx = store.bindings[normalizedAddress].indexOf(policyId);
  if (idx === -1) {
    return false;
  }

  store.bindings[normalizedAddress].splice(idx, 1);

  // Clean up empty bindings
  if (store.bindings[normalizedAddress].length === 0) {
    delete store.bindings[normalizedAddress];
  }

  saveStore(store);
  return true;
}

/**
 * Get all wallet-policy bindings.
 */
export async function getAllBindings(): Promise<WalletPolicyBinding[]> {
  const store = loadStore();
  const bindings: WalletPolicyBinding[] = [];

  for (const [address, policyIds] of Object.entries(store.bindings)) {
    for (const policyId of policyIds) {
      bindings.push({
        wallet_address: address,
        policy_id: policyId,
        attached_at: store.policies[policyId]?.created_at || new Date().toISOString(),
      });
    }
  }

  return bindings;
}

/**
 * Check if a wallet has any policies attached.
 */
export async function walletHasPolicies(walletAddress: string): Promise<boolean> {
  const store = loadStore();
  const normalizedAddress = walletAddress.toLowerCase();
  const bindings = store.bindings[normalizedAddress];
  return Array.isArray(bindings) && bindings.length > 0;
}
