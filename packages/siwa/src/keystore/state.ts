/**
 * keystore/state.ts
 *
 * Module-level singleton for "configure once" pattern.
 *
 * Usage:
 *   await initKeystore({ backend: 'cdp' });
 *   // all subsequent calls — no config needed
 *   await signMessage('hello');
 *
 * Backward compat:
 *   signMessage('hello', config) still works as a per-call override.
 *   If initKeystore() was never called, auto-detects from env vars.
 */

import type { WalletProvider } from "./provider.js";
import type {
  KeystoreConfig,
  KeystoreProviderConfig,
  LegacyKeystoreConfig,
} from "./types.js";
import { detectBackend } from "./detect.js";
import { resolveProvider, normalizeConfig } from "./resolve.js";

// ---------------------------------------------------------------------------
// Module singleton
// ---------------------------------------------------------------------------

let _provider: WalletProvider | null = null;
let _initialized = false;

/**
 * Initialize the keystore with a specific backend config.
 * Call once at application startup. Subsequent API calls
 * will use this provider without needing a config argument.
 */
export async function initKeystore(
  config: KeystoreConfig
): Promise<WalletProvider> {
  const normalized = normalizeConfig(config);
  _provider = await resolveProvider(normalized);
  _initialized = true;
  return _provider;
}

/**
 * Get the active provider, creating one if necessary.
 *
 * Resolution order:
 *   1. Per-call config override (if provided)
 *   2. Module singleton (if initKeystore() was called)
 *   3. Auto-detect from env vars (legacy behavior)
 */
export async function getProvider(
  config?: KeystoreConfig
): Promise<WalletProvider> {
  // Per-call override — create a one-off provider
  if (config && Object.keys(config).length > 0) {
    const hasBackend = "backend" in config && config.backend;
    if (hasBackend) {
      const normalized = normalizeConfig(config);
      return resolveProvider(normalized);
    }

    // Legacy empty-ish config with just keystorePath/password but no backend:
    // merge with auto-detected backend
    const backend = await detectBackend();
    const merged = { ...config, backend } as KeystoreConfig;
    const normalized = normalizeConfig(merged);
    return resolveProvider(normalized);
  }

  // Singleton
  if (_initialized && _provider) {
    return _provider;
  }

  // Auto-detect (backward compat)
  const backend = await detectBackend();
  const autoConfig = { backend } as KeystoreProviderConfig;
  _provider = await resolveProvider(autoConfig);
  _initialized = true;
  return _provider;
}

/**
 * Reset the singleton. Useful for tests.
 */
export function resetKeystore(): void {
  _provider = null;
  _initialized = false;
}
