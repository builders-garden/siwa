import chalk from 'chalk';
import { isRegistered, readMemory, appendToMemorySection } from '@buildersgarden/siwa/memory';
import { signSIWAMessage } from '@buildersgarden/siwa/siwa';
import { config, getKeystoreConfig } from '../config.js';
import type { NonceResponse, VerifyResponse } from '../../shared/types.js';

export async function signInFlow(): Promise<string | null> {
  const kc = getKeystoreConfig();

  // Read MEMORY.md
  if (!isRegistered(config.memoryPath)) {
    console.log(chalk.yellow(`\u{26A0}\u{FE0F}  Agent not locally registered. Proceeding with sign-in — the server will check onchain registration.`));
  }

  const mem = readMemory(config.memoryPath);
  const address = mem['Address'];
  const agentId = parseInt(mem['Agent ID']);
  const agentRegistry = mem['Agent Registry'];
  const chainId = parseInt(mem['Chain ID']);

  // 1. Request nonce from server
  console.log(chalk.cyan(`\u{1F310} Requesting nonce from ${config.serverDomain}...`));

  const nonceRes = await fetch(`${config.serverUrl}/siwa/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, agentId, agentRegistry }),
  });

  if (!nonceRes.ok) {
    const err = await nonceRes.text();
    console.log(chalk.red(`\u{274C} Failed to get nonce: ${err}`));
    return null;
  }

  const nonceData: NonceResponse = await nonceRes.json();
  console.log(chalk.dim(`\u{1F4E8} Nonce received: ${nonceData.nonce} (expires: ${nonceData.expirationTime})`));

  // 2. Build and sign SIWA message via keystore
  const { message, signature } = await signSIWAMessage(
    {
      domain: config.serverDomain,
      address,
      statement: 'Authenticate as a registered ERC-8004 agent.',
      uri: `${config.serverUrl}/siwa/verify`,
      agentId,
      agentRegistry,
      chainId,
      nonce: nonceData.nonce,
      issuedAt: nonceData.issuedAt,
      expirationTime: nonceData.expirationTime,
    },
    kc
  );

  console.log(chalk.green(`\u{1F511} SIWA message signed (key loaded from keystore, used, discarded)`));

  // Print the SIWA message in a bordered box
  const border = '\u{2500}'.repeat(60);
  console.log(chalk.dim(`\u{250C}${border}\u{2510}`));
  for (const line of message.split('\n')) {
    const padded = line.padEnd(60);
    console.log(chalk.dim(`\u{2502}`) + ` ${padded}` + chalk.dim(`\u{2502}`));
  }
  console.log(chalk.dim(`\u{2514}${border}\u{2518}`));

  // 3. Submit signature to server
  console.log(chalk.cyan(`\u{1F310} Submitting signature to ${config.serverDomain}...`));

  const verifyRes = await fetch(`${config.serverUrl}/siwa/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, signature }),
  });

  const verifyData: VerifyResponse = await verifyRes.json();

  if (verifyData.status === 'not_registered') {
    console.log(chalk.red(`\u{274C} SIWA Sign-In Failed: ${verifyData.error}`));
    console.log('');
    console.log(chalk.yellow.bold('Agent is not registered on the ERC-8004 Identity Registry.'));
    if (verifyData.action) {
      console.log(chalk.yellow(`Registry: ${verifyData.action.registryAddress} (chain ${verifyData.action.chainId})`));
      console.log('');
      console.log(chalk.cyan.bold('To register, follow these steps:'));
      for (const [i, step] of verifyData.action.steps.entries()) {
        console.log(chalk.cyan(`  ${i + 1}. ${step}`));
      }
    }
    if (verifyData.skill) {
      console.log('');
      console.log(chalk.dim(`SDK: ${verifyData.skill.install}`));
      console.log(chalk.dim(`Skill: ${verifyData.skill.url}`));
    }
    return null;
  }

  if (verifyData.status !== 'authenticated') {
    console.log(chalk.red(`\u{274C} SIWA Sign-In Rejected [${verifyData.code}]: ${verifyData.error}`));
    if (verifyData.skill) {
      console.log(chalk.dim(`Skill: ${verifyData.skill.url}`));
    }
    return null;
  }

  // Success
  const tokenTrunc = verifyData.token!.slice(0, 32) + '...';
  console.log(chalk.green.bold(`\u{2705} SIWA Sign-In Successful!`));
  console.log(chalk.dim(`   Token:    ${tokenTrunc}`));
  console.log(chalk.dim(`   Verified: ${verifyData.verified}`));
  console.log(chalk.dim(`   Expires:  ${verifyData.expiresAt}`));

  // Write session to MEMORY.md
  const sessionLine = `- **Session**: \`${verifyData.token!.slice(0, 20)}...\` @ ${config.serverDomain} (${verifyData.verified}, expires ${verifyData.expiresAt})`;
  appendToMemorySection('Sessions', sessionLine, config.memoryPath);
  console.log(chalk.green(`\u{1F4DD} Session saved to MEMORY.md`));

  // 4. Test authenticated API call
  console.log(chalk.cyan(`\u{1F310} Testing authenticated API call...`));

  const apiRes = await fetch(`${config.serverUrl}/api/protected`, {
    headers: { Authorization: `Bearer ${verifyData.token}` },
  });

  if (apiRes.ok) {
    const apiData = await apiRes.json();
    console.log(chalk.green.bold(`\u{2705} Authenticated API call successful:`));
    console.log(chalk.dim(`   "${apiData.message}"`));
  } else {
    console.log(chalk.red(`\u{274C} API call failed: ${apiRes.status}`));
  }

  return verifyData.token!;
}

export async function callApiFlow(): Promise<void> {
  const mem = readMemory(config.memoryPath);

  // Try to find a session token in MEMORY.md
  // The session line format: - **Session**: `token...` @ domain (mode, expires ...)
  // We need the full token, but MEMORY.md only stores truncated.
  // For the call-api command, we re-do the sign-in to get a fresh token.

  console.log(chalk.yellow(`\u{2139}\u{FE0F}  call-api performs a fresh sign-in to obtain a token`));
  const token = await signInFlow();
  if (!token) return;

  console.log('');
  console.log(chalk.cyan(`\u{1F310} POST /api/agent-action`));
  const res = await fetch(`${config.serverUrl}/api/agent-action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action: 'test', data: { hello: 'world' } }),
  });

  if (res.ok) {
    const data = await res.json();
    console.log(chalk.green.bold(`\u{2705} Agent action response:`));
    console.log(chalk.dim(JSON.stringify(data, null, 2)));
  } else {
    console.log(chalk.red(`\u{274C} Agent action failed: ${res.status}`));
  }
}
