import { TFA_APPROVAL_TIMEOUT_MS, TELEGRAM_CHAT_ID } from "./config.js";
import { audit } from "./audit-logger.js";
import { editMessage } from "./telegram.js";
import { formatExpiredMessage } from "./message-formatter.js";
import type { PendingApproval, ApprovalResult, ApprovalRequest } from "./types.js";

// In-memory store for pending approvals
const pendingApprovals = new Map<string, PendingApproval>();

export interface CreateApprovalOptions {
  request: ApprovalRequest;
  telegramMessageId: number;
  decodedData?: string;
}

export function createPendingApproval(
  options: CreateApprovalOptions
): Promise<ApprovalResult> {
  const { request, telegramMessageId, decodedData } = options;

  return new Promise((resolve) => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TFA_APPROVAL_TIMEOUT_MS);

    // Set up timeout for auto-rejection
    const timeoutId = setTimeout(() => {
      handleTimeout(request.requestId);
    }, TFA_APPROVAL_TIMEOUT_MS);

    const pending: PendingApproval = {
      requestId: request.requestId,
      operation: request.operation,
      wallet: request.wallet,
      payload: request.payload,
      decodedData,
      createdAt: now,
      expiresAt,
      telegramMessageId,
      chatId: TELEGRAM_CHAT_ID!,
      resolve,
      timeoutId,
    };

    pendingApprovals.set(request.requestId, pending);

    console.log(
      `[STORE] Created pending approval ${request.requestId}, expires at ${expiresAt.toISOString()}`
    );
  });
}

async function handleTimeout(requestId: string): Promise<void> {
  const pending = pendingApprovals.get(requestId);
  if (!pending) return;

  // Clean up
  pendingApprovals.delete(requestId);

  // Log timeout
  audit({
    event: "request_timeout",
    requestId: pending.requestId,
    operation: pending.operation,
    wallet: pending.wallet,
  });

  // Update Telegram message
  const timeoutSeconds = Math.floor(TFA_APPROVAL_TIMEOUT_MS / 1000);
  await editMessage({
    chatId: pending.chatId,
    messageId: pending.telegramMessageId,
    text: formatExpiredMessage(
      pending.requestId,
      pending.operation,
      pending.wallet,
      timeoutSeconds
    ),
    parseMode: "HTML",
  });

  // Resolve with rejection
  pending.resolve({
    approved: false,
    reason: `Timeout (${timeoutSeconds}s)`,
  });
}

export function resolvePendingApproval(
  requestId: string,
  approved: boolean,
  telegramUserId?: number
): ApprovalResult | null {
  const pending = pendingApprovals.get(requestId);
  if (!pending) {
    console.log(`[STORE] No pending approval found for ${requestId}`);
    return null;
  }

  // Clear timeout
  clearTimeout(pending.timeoutId);

  // Remove from store
  pendingApprovals.delete(requestId);

  // Calculate response time
  const responseTimeMs = Date.now() - pending.createdAt.getTime();

  // Log the action
  audit({
    event: approved ? "user_approved" : "user_rejected",
    requestId: pending.requestId,
    responseTimeMs,
    telegramUserId,
  });

  const result: ApprovalResult = {
    approved,
    reason: approved ? undefined : "User rejected the request",
    responseTimeMs,
  };

  // Resolve the promise
  pending.resolve(result);

  return result;
}

export function getPendingApproval(requestId: string): PendingApproval | undefined {
  return pendingApprovals.get(requestId);
}

export function getPendingCount(): number {
  return pendingApprovals.size;
}

export function cleanupAllPending(): void {
  for (const [requestId, pending] of pendingApprovals) {
    clearTimeout(pending.timeoutId);
    pending.resolve({
      approved: false,
      reason: "Server shutdown",
    });
  }
  pendingApprovals.clear();
}
