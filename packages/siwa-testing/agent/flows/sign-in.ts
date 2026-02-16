import chalk from 'chalk';
import { isRegistered, readIdentity } from '@buildersgarden/siwa-ts/identity';
import { signSIWAMessage } from '@buildersgarden/siwa-ts';
import { signAuthenticatedRequest } from '@buildersgarden/siwa-ts/erc8128';
import { config, getSigner } from '../config.js';
import type { NonceResponse, VerifyResponse } from '../../shared/types.js';

export interface SignInResult {
  receipt: string;
}

export async function signInFlow(): Promise<SignInResult | null> {
  const signer = getSigner();

  // Read SIWA_IDENTITY.md
  if (!(await isRegistered({ identityPath: config.identityPath }))) {
    console.log(chalk.yellow(`\u{26A0}\u{FE0F}  Agent not locally registered. Proceeding with sign-in — the server will check onchain registration.`));
  }

  const identity = readIdentity(config.identityPath);
  const address = identity.address;
  const agentId = identity.agentId!;
  const agentRegistry = identity.agentRegistry!;
  const chainId = identity.chainId!;

  // 1. Request nonce from server
  console.log(chalk.cyan(`\u{1F310} Requesting nonce from ${config.serverDomain}...`));

  const nonceRes = await fetch(`${config.serverUrl}/siwa/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, agentId, agentRegistry }),
  });

  if (!nonceRes.ok) {
    // The nonce endpoint may return a SIWAResponse (e.g. NOT_REGISTERED)
    const body: VerifyResponse | { error: string } = await nonceRes.json().catch(() => ({ error: `HTTP ${nonceRes.status}` }));
    if ('status' in body && body.status === 'not_registered') {
      console.log(chalk.red(`\u{274C} Nonce rejected: ${body.error}`));
      console.log('');
      console.log(chalk.yellow.bold('Agent is not registered on the ERC-8004 Identity Registry.'));
      if (body.action) {
        console.log(chalk.yellow(`Registry: ${body.action.registryAddress} (chain ${body.action.chainId})`));
        console.log('');
        console.log(chalk.cyan.bold('To register, follow these steps:'));
        for (const [i, step] of body.action.steps.entries()) {
          console.log(chalk.cyan(`  ${i + 1}. ${step}`));
        }
      }
      if (body.skill) {
        console.log('');
        console.log(chalk.dim(`SDK: ${body.skill.install}`));
        console.log(chalk.dim(`Skill: ${body.skill.url}`));
      }
    } else {
      const errMsg = 'error' in body ? body.error : 'Unknown error';
      console.log(chalk.red(`\u{274C} Failed to get nonce: ${errMsg}`));
    }
    return null;
  }

  const nonceData: NonceResponse = await nonceRes.json();
  console.log(chalk.dim(`\u{1F4E8} Nonce received: ${nonceData.nonce} (expires: ${nonceData.expirationTime})`));

  // 2. Build and sign SIWA message via signer
  // Address is resolved directly from the signer (trusted source of truth)
  const { message, signature } = await signSIWAMessage(
    {
      domain: config.serverDomain,
      statement: 'Authenticate as a registered ERC-8004 agent.',
      uri: `${config.serverUrl}/siwa/verify`,
      agentId,
      agentRegistry,
      chainId,
      nonce: nonceData.nonce,
      issuedAt: nonceData.issuedAt,
      expirationTime: nonceData.expirationTime,
    },
    signer
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
    body: JSON.stringify({ message, signature, nonceToken: nonceData.nonceToken }),
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
  const receiptTrunc = verifyData.receipt ? verifyData.receipt.slice(0, 32) + '...' : 'none';
  console.log(chalk.green.bold(`\u{2705} SIWA Sign-In Successful!`));
  console.log(chalk.dim(`   Receipt:  ${receiptTrunc}`));
  console.log(chalk.dim(`   Verified: ${verifyData.verified}`));
  if (verifyData.receiptExpiresAt) {
    console.log(chalk.dim(`   Expires:  ${verifyData.receiptExpiresAt}`));
  }

  // 4. Test authenticated API call via ERC-8128
  console.log(chalk.cyan(`\u{1F310} Testing authenticated API call (ERC-8128)...`));

  const testRequest = new Request(`${config.serverUrl}/api/protected`, {
    method: 'GET',
  });
  const signedTestRequest = await signAuthenticatedRequest(testRequest, verifyData.receipt!, signer, chainId);
  const apiRes = await fetch(signedTestRequest);

  if (apiRes.ok) {
    const apiData = await apiRes.json();
    console.log(chalk.green.bold(`\u{2705} Authenticated API call successful:`));
    console.log(chalk.dim(`   "${apiData.message}"`));
  } else {
    console.log(chalk.red(`\u{274C} API call failed: ${apiRes.status}`));
  }

  return { receipt: verifyData.receipt! };
}

export async function callApiFlow(): Promise<void> {
  const signer = getSigner();
  const identity = readIdentity(config.identityPath);
  const chainId = identity.chainId!;

  // For the call-api command, we re-do the sign-in to get a fresh receipt.
  console.log(chalk.yellow(`\u{2139}\u{FE0F}  call-api performs a fresh sign-in to obtain a receipt`));
  const result = await signInFlow();
  if (!result) return;

  console.log('');
  console.log(chalk.cyan(`\u{1F310} POST /api/agent-action (ERC-8128 signed request)`));

  const body = JSON.stringify({ action: 'test', data: { hello: 'world' } });
  const request = new Request(`${config.serverUrl}/api/agent-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  const signedRequest = await signAuthenticatedRequest(request, result.receipt, signer, chainId);
  const res = await fetch(signedRequest);

  if (res.ok) {
    const data = await res.json();
    console.log(chalk.green.bold(`\u{2705} Agent action response:`));
    console.log(chalk.dim(JSON.stringify(data, null, 2)));
  } else {
    console.log(chalk.red(`\u{274C} Agent action failed: ${res.status}`));
  }
}
