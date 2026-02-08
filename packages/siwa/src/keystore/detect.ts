/**
 * keystore/detect.ts
 *
 * Auto-detect the keystore backend from environment variables.
 */

import * as fs from "fs";
import type { KeystoreBackend } from "./types.js";

const DEFAULT_KEYSTORE_PATH = "./agent-keystore.json";

/**
 * Detect the best available backend from environment variables.
 *
 * Priority order:
 *   1. KEYSTORE_BACKEND env var (explicit override)
 *   2. Proxy (KEYRING_PROXY_URL set)
 *   3. CDP (CDP_API_KEY_ID set)
 *   4. Circle (CIRCLE_API_KEY set)
 *   5. Privy (PRIVY_APP_ID set)
 *   6. Encrypted file (keystore file exists on disk)
 *   7. Env (AGENT_PRIVATE_KEY set)
 *   8. Encrypted file (default — will be created on first use)
 */
export async function detectBackend(): Promise<KeystoreBackend> {
  // 0. Explicit env var override
  if (process.env.KEYSTORE_BACKEND) {
    return process.env.KEYSTORE_BACKEND as KeystoreBackend;
  }

  // 1. Proxy
  if (process.env.KEYRING_PROXY_URL) return "proxy";

  // 2. CDP
  if (process.env.CDP_API_KEY_ID) return "cdp";

  // 3. Circle
  if (process.env.CIRCLE_API_KEY) return "circle";

  // 4. Privy
  if (process.env.PRIVY_APP_ID) return "privy";

  // 5. Existing encrypted keystore file
  if (fs.existsSync(process.env.KEYSTORE_PATH || DEFAULT_KEYSTORE_PATH)) {
    return "encrypted-file";
  }

  // 6. Env var fallback
  if (process.env.AGENT_PRIVATE_KEY) return "env";

  // 7. Default to encrypted-file (will be created on first use)
  return "encrypted-file";
}
