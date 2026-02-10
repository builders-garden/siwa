import chalk from 'chalk';
import { createWallet, hasWallet, getAddress } from '@buildersgarden/siwa/keystore';
import { ensureIdentityExists, writeIdentityField } from '@buildersgarden/siwa/identity';
import { config, getKeystoreConfig } from '../config.js';

export async function createWalletFlow(): Promise<void> {
  const kc = getKeystoreConfig();

  // Ensure SIWA_IDENTITY.md exists
  ensureIdentityExists(config.identityPath, config.templatePath);

  // Check if wallet already exists
  if (await hasWallet(kc)) {
    const address = await getAddress(kc);
    // Ensure SIWA_IDENTITY.md has the address (may have been reset while wallet persists in proxy)
    if (address) {
      writeIdentityField('Address', address, config.identityPath);
    }
    console.log(chalk.yellow(`\u{1F511} Wallet already exists`));
    console.log(chalk.dim(`   Address:  ${address}`));
    return;
  }

  // Create wallet
  const info = await createWallet(kc);

  // Write to SIWA_IDENTITY.md
  writeIdentityField('Address', info.address, config.identityPath);

  console.log(chalk.green(`\u{1F511} Wallet created`));
  console.log(chalk.dim(`   Address:  ${info.address}`));
  console.log(chalk.green(`\u{1F4DD} SIWA_IDENTITY.md updated (public data only \u{2014} no private key stored here)`));
}
