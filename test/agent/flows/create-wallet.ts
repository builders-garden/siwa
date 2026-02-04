import chalk from 'chalk';
import { createWallet, hasWallet, getAddress } from '../../../scripts/keystore.js';
import { ensureMemoryExists, writeMemoryField } from '../../../scripts/memory.js';
import { config, getKeystoreConfig } from '../config.js';

export async function createWalletFlow(): Promise<void> {
  const kc = getKeystoreConfig();

  // Ensure MEMORY.md exists
  ensureMemoryExists(config.memoryPath, config.templatePath);

  // Check if wallet already exists
  if (await hasWallet(kc)) {
    const address = await getAddress(kc);
    console.log(chalk.yellow(`\u{1F511} Wallet already exists`));
    console.log(chalk.dim(`   Address:  ${address}`));
    console.log(chalk.dim(`   Backend:  ${config.keystoreBackend}`));
    console.log(chalk.dim(`   Keystore: ${config.keystorePath}`));
    return;
  }

  // Create wallet
  const info = await createWallet(kc);

  // Write to MEMORY.md
  writeMemoryField('Address', info.address, config.memoryPath);
  writeMemoryField('Keystore Backend', info.backend, config.memoryPath);
  writeMemoryField('Keystore Path', info.keystorePath || config.keystorePath, config.memoryPath);
  writeMemoryField('Created At', new Date().toISOString(), config.memoryPath);

  console.log(chalk.green(`\u{1F511} Wallet created`));
  console.log(chalk.dim(`   Address:  ${info.address}`));
  console.log(chalk.dim(`   Backend:  ${info.backend}`));
  console.log(chalk.dim(`   Keystore: ${info.keystorePath || config.keystorePath}`));
  console.log(chalk.green(`\u{1F4DD} MEMORY.md updated (public data only \u{2014} no private key stored here)`));
}
