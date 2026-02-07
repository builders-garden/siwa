/**
 * test-proxy-policies-advanced.ts
 *
 * Advanced tests for the keyring proxy policy system.
 * Tests:
 * - Separate admin secret (KEYRING_POLICY_ADMIN_SECRET)
 * - Calldata policies with ABI decoding
 * - Message content/length/is_hex policies
 * - Authorization (7702) policies
 */

import chalk from "chalk";
import { encodeFunctionData } from "viem";
import { computeHmac } from "@buildersgarden/siwa/proxy-auth";
import { getKeystoreConfig } from "../config.js";

let passed = 0;
let failed = 0;

function pass(label: string) {
  passed++;
  console.log(chalk.green(`  \u{2705} ${label}`));
}

function fail(label: string, detail?: string) {
  failed++;
  console.log(chalk.red(`  \u{274C} ${label}`));
  if (detail) console.log(chalk.dim(`     ${detail}`));
}

function skip(label: string, reason?: string) {
  console.log(chalk.yellow(`  \u{23ED} ${label} (skipped)`));
  if (reason) console.log(chalk.dim(`     ${reason}`));
}

async function proxyRequest(
  proxyUrl: string,
  secret: string,
  method: string,
  path: string,
  body: Record<string, unknown> = {}
): Promise<{ status: number; data: any }> {
  const bodyStr =
    method === "GET" || method === "DELETE" ? "" : JSON.stringify(body);
  const hmacHeaders = computeHmac(secret, method, path, bodyStr);

  const res = await fetch(`${proxyUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...hmacHeaders,
    },
    body: method !== "GET" && method !== "DELETE" ? bodyStr : undefined,
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// ERC20 ABI for testing calldata decoding
const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export async function testAdvancedPoliciesFlow(): Promise<boolean> {
  console.log(chalk.bold("Advanced Policy Tests"));
  console.log("\u{2500}".repeat(40));

  const kc = getKeystoreConfig();
  const proxyUrl = kc.proxyUrl || process.env.KEYRING_PROXY_URL;
  const secret = kc.proxySecret || process.env.KEYRING_PROXY_SECRET;
  const adminSecret = process.env.KEYRING_POLICY_ADMIN_SECRET;

  if (!proxyUrl || !secret) {
    fail(
      "Config check",
      "KEYRING_PROXY_URL and KEYRING_PROXY_SECRET must be set"
    );
    return false;
  }

  // Check if admin secret is configured
  let adminSecretConfigured = false;
  try {
    const res = await fetch(`${proxyUrl}/health`);
    const data = (await res.json()) as any;
    adminSecretConfigured = data.admin_secret_configured === true;
  } catch (err: any) {
    fail("Health check", err.message);
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 1: Admin Secret Tests
  // ═══════════════════════════════════════════════════════════════════════
  console.log(chalk.bold.cyan("\n── Admin Secret Tests ──"));

  if (adminSecretConfigured) {
    // Test: Regular secret should be rejected for policy creation
    try {
      const policy = {
        name: "Test Policy",
        rules: [
          {
            name: "Test",
            method: "sign_message",
            action: "ALLOW",
            conditions: [],
          },
        ],
      };
      const { status, data } = await proxyRequest(
        proxyUrl,
        secret,
        "POST",
        "/policies",
        policy
      );
      if (
        status === 403 &&
        data.error?.includes("Admin authentication required")
      ) {
        pass("Regular secret rejected for policy creation (admin required)");
      } else {
        fail(
          "Regular secret should be rejected",
          `Status: ${status}, Response: ${JSON.stringify(data)}`
        );
      }
    } catch (err: any) {
      fail("Admin secret test", err.message);
    }

    // Test: Admin secret should work for policy creation
    if (adminSecret) {
      try {
        const policy = {
          name: "Admin Created Policy",
          rules: [
            {
              name: "Allow all messages",
              method: "sign_message",
              action: "ALLOW",
              conditions: [],
            },
          ],
        };
        const { status, data } = await proxyRequest(
          proxyUrl,
          adminSecret,
          "POST",
          "/policies",
          policy
        );
        if (status === 201 && data.id) {
          pass(`Admin secret accepted for policy creation \u{2192} ${data.id}`);
          // Clean up
          await proxyRequest(
            proxyUrl,
            adminSecret,
            "DELETE",
            `/policies/${data.id}`,
            {}
          );
        } else {
          fail("Admin secret policy creation", JSON.stringify(data));
        }
      } catch (err: any) {
        fail("Admin secret policy creation", err.message);
      }
    } else {
      skip(
        "Admin secret policy creation",
        "KEYRING_POLICY_ADMIN_SECRET not provided"
      );
    }

    // Test: Regular secret can still read policies
    try {
      const { status, data } = await proxyRequest(
        proxyUrl,
        secret,
        "GET",
        "/policies",
        {}
      );
      if (status === 200 && Array.isArray(data.policies)) {
        pass("Regular secret can read policies (read-only allowed)");
      } else {
        fail("Regular secret read policies", JSON.stringify(data));
      }
    } catch (err: any) {
      fail("Regular secret read policies", err.message);
    }
  } else {
    skip(
      "Admin secret tests",
      "KEYRING_POLICY_ADMIN_SECRET not configured on server"
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 2: Create Wallet for Testing
  // ═══════════════════════════════════════════════════════════════════════
  let walletAddress: string | null = null;
  try {
    const { status, data } = await proxyRequest(
      proxyUrl,
      secret,
      "POST",
      "/create-wallet",
      {
        skipDefaultPolicy: true, // Start with no policies for clean tests
      }
    );
    if (status === 200 && data.address) {
      walletAddress = data.address;
      console.log(chalk.dim(`\n  Created test wallet: ${walletAddress}`));
    } else {
      fail("Create wallet", JSON.stringify(data));
      return false;
    }
  } catch (err: any) {
    fail("Create wallet", err.message);
    return false;
  }

  // Use the appropriate secret for policy operations
  const policySecret =
    adminSecretConfigured && adminSecret ? adminSecret : secret;

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 3: Message Policy Tests
  // ═══════════════════════════════════════════════════════════════════════
  console.log(chalk.bold.cyan("\n── Message Policy Tests ──"));

  // Test: Message content matching (SIWA only)
  let siwaOnlyPolicyId: string | null = null;
  try {
    const policy = {
      name: "SIWA Messages Only",
      rules: [
        {
          name: "Allow SIWA messages",
          method: "sign_message",
          action: "ALLOW",
          conditions: [
            {
              field_source: "message",
              field: "content",
              operator: "matches",
              value: "wants you to sign in with your Agent account",
            },
          ],
        },
      ],
    };
    const { status, data } = await proxyRequest(
      proxyUrl,
      policySecret,
      "POST",
      "/policies",
      policy
    );
    if (status === 201 && data.id) {
      siwaOnlyPolicyId = data.id;
      await proxyRequest(
        proxyUrl,
        policySecret,
        "POST",
        `/wallets/${walletAddress}/policies/${data.id}`,
        {}
      );
      pass(`Create SIWA-only message policy \u{2192} ${data.id}`);
    } else {
      fail("Create SIWA-only policy", JSON.stringify(data));
    }
  } catch (err: any) {
    fail("Create SIWA-only policy", err.message);
  }

  // Test: Non-SIWA message should be denied
  if (siwaOnlyPolicyId) {
    try {
      const message = "This is a random message";
      const { status, data } = await proxyRequest(
        proxyUrl,
        secret,
        "POST",
        "/sign-message",
        { message }
      );
      if (status === 403) {
        pass("Non-SIWA message denied by content policy");
      } else {
        fail("Non-SIWA message should be denied", `Status: ${status}`);
      }
    } catch (err: any) {
      fail("Non-SIWA message test", err.message);
    }

    // Test: SIWA message should be allowed
    try {
      const message =
        "example.com wants you to sign in with your Agent account:\n0x1234...";
      const { status, data } = await proxyRequest(
        proxyUrl,
        secret,
        "POST",
        "/sign-message",
        { message }
      );
      if (status === 200 && data.signature) {
        pass("SIWA message allowed by content policy");
      } else {
        fail(
          "SIWA message should be allowed",
          `Status: ${status}, Response: ${JSON.stringify(data)}`
        );
      }
    } catch (err: any) {
      fail("SIWA message test", err.message);
    }

    // Clean up
    await proxyRequest(
      proxyUrl,
      policySecret,
      "DELETE",
      `/wallets/${walletAddress}/policies/${siwaOnlyPolicyId}`,
      {}
    );
  }

  // Test: Message length policy
  let lengthPolicyId: string | null = null;
  try {
    const policy = {
      name: "Max Message Length",
      rules: [
        {
          name: "Allow short messages",
          method: "sign_message",
          action: "ALLOW",
          conditions: [
            {
              field_source: "message",
              field: "length",
              operator: "lte",
              value: 100,
            },
          ],
        },
      ],
    };
    const { status, data } = await proxyRequest(
      proxyUrl,
      policySecret,
      "POST",
      "/policies",
      policy
    );
    if (status === 201 && data.id) {
      lengthPolicyId = data.id;
      await proxyRequest(
        proxyUrl,
        policySecret,
        "POST",
        `/wallets/${walletAddress}/policies/${data.id}`,
        {}
      );
      pass(`Create message length policy \u{2192} ${data.id}`);
    } else {
      fail("Create length policy", JSON.stringify(data));
    }
  } catch (err: any) {
    fail("Create length policy", err.message);
  }

  if (lengthPolicyId) {
    // Test: Short message allowed
    try {
      const message = "Short message";
      const { status } = await proxyRequest(
        proxyUrl,
        secret,
        "POST",
        "/sign-message",
        { message }
      );
      if (status === 200) {
        pass("Short message (13 chars) allowed by length policy");
      } else {
        fail("Short message should be allowed", `Status: ${status}`);
      }
    } catch (err: any) {
      fail("Short message test", err.message);
    }

    // Test: Long message denied
    try {
      const message = "A".repeat(150);
      const { status } = await proxyRequest(
        proxyUrl,
        secret,
        "POST",
        "/sign-message",
        { message }
      );
      if (status === 403) {
        pass("Long message (150 chars) denied by length policy");
      } else {
        fail("Long message should be denied", `Status: ${status}`);
      }
    } catch (err: any) {
      fail("Long message test", err.message);
    }

    // Clean up
    await proxyRequest(
      proxyUrl,
      policySecret,
      "DELETE",
      `/wallets/${walletAddress}/policies/${lengthPolicyId}`,
      {}
    );
  }

  // Test: Hex message policy
  let hexPolicyId: string | null = null;
  try {
    const policy = {
      name: "Block Hex Messages",
      rules: [
        {
          name: "Deny hex messages",
          method: "sign_message",
          action: "DENY",
          conditions: [
            {
              field_source: "message",
              field: "is_hex",
              operator: "eq",
              value: "true",
            },
          ],
        },
        {
          name: "Allow non-hex messages",
          method: "sign_message",
          action: "ALLOW",
          conditions: [],
        },
      ],
    };
    const { status, data } = await proxyRequest(
      proxyUrl,
      policySecret,
      "POST",
      "/policies",
      policy
    );
    if (status === 201 && data.id) {
      hexPolicyId = data.id;
      await proxyRequest(
        proxyUrl,
        policySecret,
        "POST",
        `/wallets/${walletAddress}/policies/${data.id}`,
        {}
      );
      pass(`Create hex message policy \u{2192} ${data.id}`);
    } else {
      fail("Create hex policy", JSON.stringify(data));
    }
  } catch (err: any) {
    fail("Create hex policy", err.message);
  }

  if (hexPolicyId) {
    // Test: Hex message denied
    try {
      const message = "0xdeadbeef1234567890";
      const { status } = await proxyRequest(
        proxyUrl,
        secret,
        "POST",
        "/sign-message",
        { message }
      );
      if (status === 403) {
        pass("Hex message denied by is_hex policy");
      } else {
        fail("Hex message should be denied", `Status: ${status}`);
      }
    } catch (err: any) {
      fail("Hex message test", err.message);
    }

    // Test: Normal message allowed
    try {
      const message = "Hello world";
      const { status } = await proxyRequest(
        proxyUrl,
        secret,
        "POST",
        "/sign-message",
        { message }
      );
      if (status === 200) {
        pass("Non-hex message allowed");
      } else {
        fail("Non-hex message should be allowed", `Status: ${status}`);
      }
    } catch (err: any) {
      fail("Non-hex message test", err.message);
    }

    // Clean up
    await proxyRequest(
      proxyUrl,
      policySecret,
      "DELETE",
      `/wallets/${walletAddress}/policies/${hexPolicyId}`,
      {}
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 4: Calldata Policy Tests
  // ═══════════════════════════════════════════════════════════════════════
  console.log(chalk.bold.cyan("\n── Calldata Policy Tests ──"));

  // Test: Function name restriction
  let calldataPolicyId: string | null = null;
  try {
    const policy = {
      name: "Only Transfer Function",
      rules: [
        {
          name: "Allow transfer",
          method: "sign_transaction",
          action: "ALLOW",
          conditions: [
            {
              field_source: "ethereum_calldata",
              field: "function_name",
              operator: "eq",
              value: "transfer",
              abi: ERC20_ABI,
            },
          ],
        },
        {
          name: "Deny approve",
          method: "sign_transaction",
          action: "DENY",
          conditions: [
            {
              field_source: "ethereum_calldata",
              field: "function_name",
              operator: "eq",
              value: "approve",
              abi: ERC20_ABI,
            },
          ],
        },
      ],
    };
    const { status, data } = await proxyRequest(
      proxyUrl,
      policySecret,
      "POST",
      "/policies",
      policy
    );
    if (status === 201 && data.id) {
      calldataPolicyId = data.id;
      await proxyRequest(
        proxyUrl,
        policySecret,
        "POST",
        `/wallets/${walletAddress}/policies/${data.id}`,
        {}
      );
      pass(`Create calldata function policy \u{2192} ${data.id}`);
    } else {
      fail("Create calldata policy", JSON.stringify(data));
    }
  } catch (err: any) {
    fail("Create calldata policy", err.message);
  }

  if (calldataPolicyId) {
    // Test: transfer() function allowed
    try {
      const transferData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [
          "0x1234567890123456789012345678901234567890",
          BigInt("1000000000000000000"),
        ],
      });
      const tx = {
        to: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
        value: "0",
        data: transferData,
        chainId: 84532,
        type: 2,
        maxFeePerGas: "1000000000",
        maxPriorityFeePerGas: "1000000000",
      };
      const { status } = await proxyRequest(
        proxyUrl,
        secret,
        "POST",
        "/sign-transaction",
        { tx, abi: ERC20_ABI }
      );
      if (status === 200) {
        pass("ERC20 transfer() allowed by calldata policy");
      } else {
        fail("transfer() should be allowed", `Status: ${status}`);
      }
    } catch (err: any) {
      fail("transfer() test", err.message);
    }

    // Test: approve() function denied
    try {
      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [
          "0x1234567890123456789012345678901234567890",
          BigInt("1000000000000000000"),
        ],
      });
      const tx = {
        to: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        value: "0",
        data: approveData,
        chainId: 84532,
        type: 2,
        maxFeePerGas: "1000000000",
        maxPriorityFeePerGas: "1000000000",
      };
      const { status } = await proxyRequest(
        proxyUrl,
        secret,
        "POST",
        "/sign-transaction",
        { tx, abi: ERC20_ABI }
      );
      if (status === 403) {
        pass("ERC20 approve() denied by calldata policy");
      } else {
        fail("approve() should be denied", `Status: ${status}`);
      }
    } catch (err: any) {
      fail("approve() test", err.message);
    }

    // Clean up
    await proxyRequest(
      proxyUrl,
      policySecret,
      "DELETE",
      `/wallets/${walletAddress}/policies/${calldataPolicyId}`,
      {}
    );
  }

  // Test: Transfer recipient restriction
  let recipientPolicyId: string | null = null;
  try {
    const allowedRecipient = "0x1111111111111111111111111111111111111111";
    const policy = {
      name: "Restrict Transfer Recipients",
      rules: [
        {
          name: "Allow transfer to specific address",
          method: "sign_transaction",
          action: "ALLOW",
          conditions: [
            {
              field_source: "ethereum_calldata",
              field: "function_name",
              operator: "eq",
              value: "transfer",
              abi: ERC20_ABI,
            },
            {
              field_source: "ethereum_calldata",
              field: "transfer.to",
              operator: "eq",
              value: allowedRecipient,
              abi: ERC20_ABI,
            },
          ],
        },
      ],
    };
    const { status, data } = await proxyRequest(
      proxyUrl,
      policySecret,
      "POST",
      "/policies",
      policy
    );
    if (status === 201 && data.id) {
      recipientPolicyId = data.id;
      await proxyRequest(
        proxyUrl,
        policySecret,
        "POST",
        `/wallets/${walletAddress}/policies/${data.id}`,
        {}
      );
      pass(`Create recipient restriction policy \u{2192} ${data.id}`);
    } else {
      fail("Create recipient policy", JSON.stringify(data));
    }
  } catch (err: any) {
    fail("Create recipient policy", err.message);
  }

  if (recipientPolicyId) {
    // Test: Transfer to allowed recipient works
    try {
      const transferData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "transfer",
        args: ["0x1111111111111111111111111111111111111111", BigInt("1000")],
      });
      const tx = {
        to: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        value: "0",
        data: transferData,
        chainId: 84532,
        type: 2,
        maxFeePerGas: "1000000000",
        maxPriorityFeePerGas: "1000000000",
      };
      const { status } = await proxyRequest(
        proxyUrl,
        secret,
        "POST",
        "/sign-transaction",
        { tx, abi: ERC20_ABI }
      );
      if (status === 200) {
        pass("Transfer to allowed recipient works");
      } else {
        fail("Transfer to allowed recipient should work", `Status: ${status}`);
      }
    } catch (err: any) {
      fail("Allowed recipient test", err.message);
    }

    // Test: Transfer to other recipient denied
    try {
      const transferData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "transfer",
        args: ["0x2222222222222222222222222222222222222222", BigInt("1000")],
      });
      const tx = {
        to: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        value: "0",
        data: transferData,
        chainId: 84532,
        type: 2,
        maxFeePerGas: "1000000000",
        maxPriorityFeePerGas: "1000000000",
      };
      const { status } = await proxyRequest(
        proxyUrl,
        secret,
        "POST",
        "/sign-transaction",
        { tx, abi: ERC20_ABI }
      );
      if (status === 403) {
        pass("Transfer to other recipient denied");
      } else {
        fail(
          "Transfer to other recipient should be denied",
          `Status: ${status}`
        );
      }
    } catch (err: any) {
      fail("Other recipient test", err.message);
    }

    // Clean up
    await proxyRequest(
      proxyUrl,
      policySecret,
      "DELETE",
      `/wallets/${walletAddress}/policies/${recipientPolicyId}`,
      {}
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 5: Authorization (7702) Policy Tests
  // ═══════════════════════════════════════════════════════════════════════
  console.log(chalk.bold.cyan("\n── Authorization (7702) Policy Tests ──"));

  // Test: Delegate contract allowlist
  let authPolicyId: string | null = null;
  const allowedDelegate = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  try {
    const policy = {
      name: "7702 Delegate Allowlist",
      rules: [
        {
          name: "Allow specific delegate",
          method: "sign_authorization",
          action: "ALLOW",
          conditions: [
            {
              field_source: "ethereum_authorization",
              field: "contract",
              operator: "in",
              value: [
                allowedDelegate,
                "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
              ],
            },
          ],
        },
      ],
    };
    const { status, data } = await proxyRequest(
      proxyUrl,
      policySecret,
      "POST",
      "/policies",
      policy
    );
    if (status === 201 && data.id) {
      authPolicyId = data.id;
      await proxyRequest(
        proxyUrl,
        policySecret,
        "POST",
        `/wallets/${walletAddress}/policies/${data.id}`,
        {}
      );
      pass(`Create 7702 delegate policy \u{2192} ${data.id}`);
    } else {
      fail("Create 7702 policy", JSON.stringify(data));
    }
  } catch (err: any) {
    fail("Create 7702 policy", err.message);
  }

  if (authPolicyId) {
    // Test: Allowed delegate works
    try {
      const auth = {
        address: allowedDelegate,
        chainId: 84532,
      };
      const { status, data } = await proxyRequest(
        proxyUrl,
        secret,
        "POST",
        "/sign-authorization",
        { auth }
      );
      if (status === 200 && data.address) {
        pass("Authorization to allowed delegate works");
      } else {
        fail(
          "Allowed delegate authorization",
          `Status: ${status}, Response: ${JSON.stringify(data)}`
        );
      }
    } catch (err: any) {
      fail("Allowed delegate test", err.message);
    }

    // Test: Unauthorized delegate denied
    try {
      const auth = {
        address: "0xcccccccccccccccccccccccccccccccccccccccc",
        chainId: 84532,
      };
      const { status } = await proxyRequest(
        proxyUrl,
        secret,
        "POST",
        "/sign-authorization",
        { auth }
      );
      if (status === 403) {
        pass("Authorization to unauthorized delegate denied");
      } else {
        fail("Unauthorized delegate should be denied", `Status: ${status}`);
      }
    } catch (err: any) {
      fail("Unauthorized delegate test", err.message);
    }

    // Clean up
    await proxyRequest(
      proxyUrl,
      policySecret,
      "DELETE",
      `/wallets/${walletAddress}/policies/${authPolicyId}`,
      {}
    );
  }

  // Test: Authorization chain restriction
  let authChainPolicyId: string | null = null;
  try {
    const policy = {
      name: "7702 Chain Restriction",
      rules: [
        {
          name: "Allow Base Sepolia only",
          method: "sign_authorization",
          action: "ALLOW",
          conditions: [
            {
              field_source: "ethereum_authorization",
              field: "chain_id",
              operator: "eq",
              value: 84532,
            },
          ],
        },
      ],
    };
    const { status, data } = await proxyRequest(
      proxyUrl,
      policySecret,
      "POST",
      "/policies",
      policy
    );
    if (status === 201 && data.id) {
      authChainPolicyId = data.id;
      await proxyRequest(
        proxyUrl,
        policySecret,
        "POST",
        `/wallets/${walletAddress}/policies/${data.id}`,
        {}
      );
      pass(`Create 7702 chain restriction policy \u{2192} ${data.id}`);
    } else {
      fail("Create 7702 chain policy", JSON.stringify(data));
    }
  } catch (err: any) {
    fail("Create 7702 chain policy", err.message);
  }

  if (authChainPolicyId) {
    // Test: Correct chain works
    try {
      const auth = {
        address: "0xdddddddddddddddddddddddddddddddddddddddd",
        chainId: 84532,
      };
      const { status, data } = await proxyRequest(
        proxyUrl,
        secret,
        "POST",
        "/sign-authorization",
        { auth }
      );
      if (status === 200 && data.address) {
        pass("Authorization on allowed chain works");
      } else {
        fail(
          "Allowed chain authorization",
          `Status: ${status}, Response: ${JSON.stringify(data)}`
        );
      }
    } catch (err: any) {
      fail("Allowed chain test", err.message);
    }

    // Test: Wrong chain denied
    try {
      const auth = {
        address: "0xdddddddddddddddddddddddddddddddddddddddd",
        chainId: 1, // Mainnet
      };
      const { status } = await proxyRequest(
        proxyUrl,
        secret,
        "POST",
        "/sign-authorization",
        { auth }
      );
      if (status === 403) {
        pass("Authorization on wrong chain denied");
      } else {
        fail("Wrong chain should be denied", `Status: ${status}`);
      }
    } catch (err: any) {
      fail("Wrong chain test", err.message);
    }

    // Clean up
    await proxyRequest(
      proxyUrl,
      policySecret,
      "DELETE",
      `/wallets/${walletAddress}/policies/${authChainPolicyId}`,
      {}
    );
  }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log("");
  console.log(chalk.bold(`Results: ${passed} passed, ${failed} failed`));

  if (failed === 0) {
    console.log(chalk.green.bold("\u{2705} All advanced policy tests passed"));
  } else {
    console.log(chalk.red.bold(`\u{274C} ${failed} test(s) failed`));
  }

  return failed === 0;
}
