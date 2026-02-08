/**
 * keystore/resolve.ts
 *
 * Factory that creates a WalletProvider from a KeystoreConfig.
 * Uses dynamic imports for new providers so their SDK deps are optional.
 */

import type { WalletProvider } from "./provider.js";
import type {
  KeystoreConfig,
  KeystoreBackend,
  KeystoreProviderConfig,
  LegacyKeystoreConfig,
  EncryptedFileConfig,
  ProxyConfig,
} from "./types.js";

/**
 * Normalize a legacy flat config or discriminated config into a
 * KeystoreProviderConfig that providers can consume.
 */
function normalizeConfig(
  config: KeystoreConfig
): KeystoreProviderConfig {
  // If it already has a backend discriminator, use it as-is
  if ("backend" in config && config.backend) {
    // For legacy flat configs, map into the proper discriminated shape
    const legacy = config as LegacyKeystoreConfig;
    switch (legacy.backend) {
      case "encrypted-file":
        return {
          backend: "encrypted-file",
          keystorePath: legacy.keystorePath,
          password: legacy.password,
        } as EncryptedFileConfig;
      case "proxy":
        return {
          backend: "proxy",
          proxyUrl: legacy.proxyUrl,
          proxySecret: legacy.proxySecret,
        } as ProxyConfig;
      case "env":
        return { backend: "env" };
      default:
        // Already a new-style config (circle, cdp, etc.)
        return config as KeystoreProviderConfig;
    }
  }

  // No backend specified — should not reach here (detectBackend should run first)
  return { backend: "encrypted-file" } as EncryptedFileConfig;
}

/**
 * Create a WalletProvider instance for the given config.
 */
export async function resolveProvider(
  config: KeystoreProviderConfig
): Promise<WalletProvider> {
  switch (config.backend) {
    case "encrypted-file": {
      const { EncryptedFileProvider } = await import(
        "./providers/encrypted-file.js"
      );
      return new EncryptedFileProvider(config);
    }

    case "env": {
      const { EnvProvider } = await import("./providers/env.js");
      return new EnvProvider();
    }

    case "proxy": {
      const { ProxyProvider } = await import("./providers/proxy.js");
      return new ProxyProvider(config);
    }

    case "circle": {
      const { CircleProvider } = await import("./providers/circle.js");
      return new CircleProvider(config);
    }

    case "cdp": {
      const { CdpProvider } = await import("./providers/cdp.js");
      return new CdpProvider(config);
    }

    case "base-account": {
      const { BaseAccountProvider } = await import(
        "./providers/base-account.js"
      );
      return new BaseAccountProvider(config);
    }

    case "privy": {
      const { PrivyProvider } = await import("./providers/privy.js");
      return new PrivyProvider(config);
    }

    default: {
      const _exhaustive: never = config;
      throw new Error(
        `Unknown keystore backend: ${(config as any).backend}`
      );
    }
  }
}

export { normalizeConfig };
