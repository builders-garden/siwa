import {
  REGISTRY_ADDRESSES,
  REPUTATION_ADDRESSES,
  RPC_ENDPOINTS,
  CHAIN_NAMES,
  FAUCETS,
  BLOCK_EXPLORERS,
} from "@buildersgarden/siwa/addresses";
import { createKeyringProxySigner, type TransactionSigner } from "@buildersgarden/siwa/signer";
import * as path from "path";

const projectRoot = path.resolve(import.meta.dirname || __dirname, "..");
const skillRoot = path.resolve(projectRoot, "..", "siwa-skill");

// Re-export address constants from SDK for consumers of this module
export {
  REGISTRY_ADDRESSES,
  REPUTATION_ADDRESSES,
  RPC_ENDPOINTS,
  CHAIN_NAMES,
  FAUCETS,
  BLOCK_EXPLORERS,
};

export function txUrl(chainId: number, txHash: string): string {
  const base = BLOCK_EXPLORERS[chainId];
  return base ? `${base}/tx/${txHash}` : txHash;
}

export function addressUrl(chainId: number, address: string): string {
  const base = BLOCK_EXPLORERS[chainId];
  return base ? `${base}/address/${address}` : address;
}

export const config = {
  serverUrl: process.env.SERVER_URL || "http://localhost:3000",
  serverDomain: process.env.SERVER_DOMAIN || "localhost:3000",
  identityPath: process.env.IDENTITY_PATH || path.resolve(projectRoot, "SIWA_IDENTITY.md"),
  keyringProxyUrl: process.env.KEYRING_PROXY_URL || "",
  keyringProxySecret: process.env.KEYRING_PROXY_SECRET || "",
  templatePath: path.resolve(skillRoot, "assets", "SIWA_IDENTITY.template.md"),
  registrationFile:
    process.env.REGISTRATION_FILE ||
    path.resolve(skillRoot, "assets", "registration-template.json"),

  // Onchain settings
  rpcUrl: process.env.RPC_URL || "",
  chainId: parseInt(process.env.CHAIN_ID || "84532"),
  storageMode: (process.env.STORAGE_MODE || "base64") as "ipfs" | "base64",
  pinataJwt: process.env.PINATA_JWT || "",

  // Mock registration defaults (used when --live is not set)
  mockAgentId: parseInt(process.env.MOCK_AGENT_ID || "1"),
  mockAgentRegistry:
    process.env.MOCK_AGENT_REGISTRY ||
    "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e",
  mockChainId: parseInt(process.env.MOCK_CHAIN_ID || "84532"),
};

/**
 * @deprecated Use getSigner() instead.
 */
export function getKeystoreConfig() {
  return {
    proxyUrl: config.keyringProxyUrl || undefined,
    proxySecret: config.keyringProxySecret || undefined,
  };
}

/**
 * Get a signer configured from environment variables.
 * Uses the keyring proxy by default.
 */
export function getSigner(): TransactionSigner {
  return createKeyringProxySigner({
    proxyUrl: config.keyringProxyUrl || undefined,
    proxySecret: config.keyringProxySecret || undefined,
  });
}

export function isLiveMode(): boolean {
  return process.argv.includes("--live") || !!config.rpcUrl;
}
