/**
 * signer/index.ts
 *
 * Wallet-agnostic signing abstraction for SIWA.
 *
 * This module provides a `Signer` interface that abstracts signing operations,
 * allowing developers to use any wallet provider without changing the SDK.
 *
 * Available signer implementations:
 *   - createKeyringProxySigner(config)         — Keyring proxy server (HMAC-authenticated)
 *   - createLocalAccountSigner(account)        — viem LocalAccount (privateKeyToAccount)
 *   - createWalletClientSigner(client)         — viem WalletClient (Privy, MetaMask, etc.)
 *   - createCircleSiwaSigner(config)           — Circle developer-controlled wallet
 *   - createCircleSiwaSignerFromClient(config) — Circle with existing client
 *   - createPrivySiwaSigner(config)            — Privy server wallet
 *   - createBankrSiwaSigner(config)            — Bankr Agent API wallet
 *
 * Usage:
 *   import { signSIWAMessage, createLocalAccountSigner } from '@buildersgarden/siwa';
 *   import { privateKeyToAccount } from 'viem/accounts';
 *
 *   const account = privateKeyToAccount('0x...');
 *   const signer = createLocalAccountSigner(account);
 *   const { message, signature } = await signSIWAMessage(fields, signer);
 */

// Types
export type {
  Signer,
  SignerType,
  TransactionSigner,
  TransactionRequest,
  KeyringProxyConfig,
} from './types.js';

// Signer implementations
export { createKeyringProxySigner } from './keyring-proxy.js';
export { createLocalAccountSigner } from './local-account.js';
export { createWalletClientSigner } from './wallet-client.js';
export {
  createCircleSiwaSigner,
  createCircleSiwaSignerFromClient,
  type CircleSiwaSignerConfig,
  type CircleSiwaSignerClientConfig,
} from './circle.js';
export {
  createPrivySiwaSigner,
  type PrivySiwaSignerConfig,
} from './privy.js';
export {
  createBankrSiwaSigner,
  type BankrSiwaSignerConfig,
} from './bankr.js';
