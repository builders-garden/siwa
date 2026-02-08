/**
 * keystore/errors.ts
 *
 * Custom error types for the keystore module.
 */

/**
 * Thrown when an operation is not supported by the current provider.
 * For example, calling importWallet() on a proxy provider.
 */
export class UnsupportedOperationError extends Error {
  constructor(operation: string, providerName: string) {
    super(
      `${operation}() is not supported by the "${providerName}" provider.`
    );
    this.name = "UnsupportedOperationError";
  }
}

/**
 * Thrown when a provider requires an external SDK that is not installed.
 */
export class MissingSdkError extends Error {
  constructor(providerName: string, packageName: string) {
    super(
      `The "${providerName}" provider requires the "${packageName}" package. ` +
        `Install it with: npm install ${packageName}`
    );
    this.name = "MissingSdkError";
  }
}
