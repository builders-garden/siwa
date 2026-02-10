/**
 * 2FA Client for Keyring Proxy
 *
 * Handles communication with the 2FA Telegram server for approval requests.
 */

import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const TFA_ENABLED = process.env.TFA_ENABLED === "true";
export const TFA_SERVER_URL = process.env.TFA_SERVER_URL;
export const TFA_SECRET = process.env.TFA_SECRET;
export const TFA_OPERATIONS = (
  process.env.TFA_OPERATIONS || "sign-message,sign-transaction,sign-authorization"
)
  .split(",")
  .map((op) => op.trim());

// Timeout slightly longer than the 2FA server's approval timeout
const TFA_REQUEST_TIMEOUT_MS = 70000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Operation = "sign-message" | "sign-transaction" | "sign-authorization";

export interface TFARequest {
  requestId: string;
  operation: Operation;
  wallet: string;
  payload: unknown;
  chainId?: number;
}

export interface TFAResponse {
  approved: boolean;
  reason?: string;
  responseTimeMs?: number;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateTFAConfig(): void {
  if (!TFA_ENABLED) {
    return; // 2FA disabled, no validation needed
  }

  const errors: string[] = [];

  if (!TFA_SERVER_URL) {
    errors.push("TFA_SERVER_URL is required when TFA_ENABLED=true");
  }

  if (!TFA_SECRET) {
    errors.push("TFA_SECRET is required when TFA_ENABLED=true");
  }

  if (errors.length > 0) {
    console.error("FATAL: 2FA Configuration errors:");
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log(`[2FA] Enabled for operations: ${TFA_OPERATIONS.join(", ")}`);
}

// ---------------------------------------------------------------------------
// 2FA Client
// ---------------------------------------------------------------------------

/**
 * Check if 2FA is required for a given operation
 */
export function isTFARequired(operation: Operation): boolean {
  if (!TFA_ENABLED) {
    return false;
  }
  return TFA_OPERATIONS.includes(operation);
}

/**
 * Request 2FA approval from the Telegram server.
 * This will block until the user approves/rejects or timeout occurs.
 *
 * @throws Error if 2FA server is unreachable or returns an error
 */
export async function requestTFAApproval(
  operation: Operation,
  wallet: string,
  payload: unknown,
  chainId?: number
): Promise<TFAResponse> {
  const requestId = randomUUID().slice(0, 8); // Short ID for display

  const tfaRequest: TFARequest = {
    requestId,
    operation,
    wallet,
    payload,
    chainId,
  };

  console.log(`[2FA] Requesting approval for ${operation} (${requestId})`);

  try {
    const response = await fetch(`${TFA_SERVER_URL}/request-approval`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-TFA-Secret": TFA_SECRET!,
      },
      body: JSON.stringify(tfaRequest),
      signal: AbortSignal.timeout(TFA_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `2FA server error: ${response.status} - ${(errorData as any).error || "Unknown error"}`
      );
    }

    const result = (await response.json()) as TFAResponse;

    console.log(
      `[2FA] Result for ${requestId}: ${result.approved ? "APPROVED" : "REJECTED"} ${
        result.reason ? `(${result.reason})` : ""
      }`
    );

    return result;
  } catch (err) {
    const error = err as Error;

    // Handle different error types
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new Error("2FA verification failed: Request timeout");
    }

    if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED")) {
      throw new Error("2FA verification failed: Server unreachable");
    }

    throw new Error(`2FA verification failed: ${error.message}`);
  }
}

/**
 * Check 2FA approval and throw appropriate error if not approved.
 *
 * @returns void if approved
 * @throws Error with appropriate HTTP status code hint if not approved
 */
export async function requireTFAApproval(
  operation: Operation,
  wallet: string,
  payload: unknown,
  chainId?: number
): Promise<void> {
  if (!isTFARequired(operation)) {
    return; // No 2FA required
  }

  const result = await requestTFAApproval(operation, wallet, payload, chainId);

  if (!result.approved) {
    const reason = result.reason || "User rejected the request";
    const error = new Error(`2FA rejected: ${reason}`) as Error & { statusCode?: number };

    // Add status code hint for the caller
    if (reason.includes("Timeout")) {
      error.statusCode = 408; // Request Timeout
    } else {
      error.statusCode = 403; // Forbidden
    }

    throw error;
  }
}
