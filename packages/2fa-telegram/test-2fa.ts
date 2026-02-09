/**
 * Test script for 2FA Telegram flow
 *
 * Prerequisites:
 *   1. 2fa-telegram running on port 3200
 *   2. 2fa-gateway running on port 3201
 *   3. keyring-proxy running on port 3100 with TFA_ENABLED=true
 *   4. Cloudflare tunnel or ngrok exposing port 3201
 *   5. Telegram webhook set to the public URL
 *
 * Usage:
 *   cd packages/2fa-telegram
 *   npx tsx test-2fa.ts
 */

import crypto from "crypto";

const KEYRING_PROXY_URL = "http://localhost:3100";
const KEYRING_PROXY_SECRET = "test-keyring-secret-12345";

// Compute HMAC headers for keyring-proxy authentication
function computeHmac(
  secret: string,
  method: string,
  path: string,
  body: string
): { "X-Keyring-Timestamp": string; "X-Keyring-Signature": string } {
  const timestamp = Date.now().toString();
  const payload = `${method.toUpperCase()}\n${path}\n${timestamp}\n${body}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return {
    "X-Keyring-Timestamp": timestamp,
    "X-Keyring-Signature": signature,
  };
}

async function callKeyringProxy(
  method: string,
  path: string,
  body?: object
): Promise<any> {
  const bodyStr = body ? JSON.stringify(body) : "";
  const hmacHeaders = computeHmac(KEYRING_PROXY_SECRET, method, path, bodyStr);

  const response = await fetch(`${KEYRING_PROXY_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...hmacHeaders,
    },
    body: bodyStr || undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`${response.status}: ${data.error || JSON.stringify(data)}`);
  }

  return data;
}

async function main() {
  console.log("=".repeat(60));
  console.log("2FA Telegram Integration Test");
  console.log("=".repeat(60));
  console.log();

  // Step 1: Check if wallet exists, create if not
  console.log("[1/3] Checking wallet...");
  try {
    const hasWallet = await callKeyringProxy("POST", "/has-wallet");

    if (!hasWallet.hasWallet) {
      console.log("      Creating new wallet...");
      const wallet = await callKeyringProxy("POST", "/create-wallet");
      console.log(`      Created wallet: ${wallet.address}`);
    } else {
      const address = await callKeyringProxy("POST", "/get-address");
      console.log(`      Wallet exists: ${address.address}`);
    }
  } catch (err) {
    console.error("      Error:", (err as Error).message);
    process.exit(1);
  }

  // Step 2: Test signing a message (this triggers 2FA)
  console.log();
  console.log("[2/3] Testing sign-message (check your Telegram!)...");
  console.log("      Waiting for approval...");
  console.log();

  const testMessage = `Test message from 2FA integration test\nTimestamp: ${new Date().toISOString()}`;

  try {
    const startTime = Date.now();
    const result = await callKeyringProxy("POST", "/sign-message", {
      message: testMessage,
    });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`      APPROVED in ${elapsed}s`);
    console.log(`      Signature: ${result.signature.slice(0, 30)}...`);
  } catch (err) {
    const error = err as Error;
    if (error.message.includes("2FA rejected")) {
      console.log(`      REJECTED: ${error.message}`);
    } else if (error.message.includes("2FA verification failed")) {
      console.log(`      FAILED: ${error.message}`);
      console.log();
      console.log("      Make sure:");
      console.log("        - 2fa-telegram is running on port 3200");
      console.log("        - 2fa-gateway is running on port 3201");
      console.log("        - Cloudflare tunnel is active");
      console.log("        - Webhook is set correctly");
    } else {
      console.log(`      ERROR: ${error.message}`);
    }
    process.exit(1);
  }

  // Step 3: Summary
  console.log();
  console.log("[3/3] Test complete!");
  console.log("=".repeat(60));
  console.log();
  console.log("2FA flow is working correctly.");
  console.log();
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
