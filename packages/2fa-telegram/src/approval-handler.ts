import type { Request, Response } from "express";
import { TFA_SECRET } from "./config.js";
import { audit } from "./audit-logger.js";
import { sendMessage, createApprovalKeyboard } from "./telegram.js";
import { formatApprovalMessage } from "./message-formatter.js";
import { createPendingApproval } from "./approval-store.js";
import type { ApprovalRequest, TransactionPayload } from "./types.js";

// Verify internal secret header
function verifyInternalAuth(req: Request): boolean {
  const secret = req.headers["x-tfa-secret"] as string;
  return secret === TFA_SECRET;
}

// Validate request body
function validateApprovalRequest(body: unknown): ApprovalRequest | null {
  if (!body || typeof body !== "object") return null;

  const req = body as Record<string, unknown>;

  if (typeof req.requestId !== "string" || !req.requestId) return null;
  if (typeof req.operation !== "string") return null;
  if (!["sign-message", "sign-transaction", "sign-authorization"].includes(req.operation)) {
    return null;
  }
  if (typeof req.wallet !== "string" || !req.wallet) return null;
  if (!req.payload || typeof req.payload !== "object") return null;

  return {
    requestId: req.requestId,
    operation: req.operation as ApprovalRequest["operation"],
    wallet: req.wallet,
    payload: req.payload as ApprovalRequest["payload"],
    chainId: typeof req.chainId === "number" ? req.chainId : undefined,
  };
}

export async function handleApprovalRequest(
  req: Request,
  res: Response
): Promise<void> {
  // Verify authentication
  if (!verifyInternalAuth(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Validate request
  const approvalRequest = validateApprovalRequest(req.body);
  if (!approvalRequest) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  try {
    // Format the Telegram message
    const messageText = await formatApprovalMessage(approvalRequest);

    // Send to Telegram
    const messageId = await sendMessage({
      text: messageText,
      parseMode: "HTML",
      replyMarkup: createApprovalKeyboard(approvalRequest.requestId),
    });

    if (!messageId) {
      res.status(502).json({ error: "Failed to send Telegram message" });
      return;
    }

    // Log the request creation
    const txPayload = approvalRequest.payload as TransactionPayload;
    audit({
      event: "request_created",
      requestId: approvalRequest.requestId,
      operation: approvalRequest.operation,
      wallet: approvalRequest.wallet,
      to: txPayload?.to,
      value: txPayload?.value,
      chainId: approvalRequest.chainId,
      telegramMessageId: messageId,
    });

    // Create pending approval and wait for response
    // This blocks until user responds or timeout
    const result = await createPendingApproval({
      request: approvalRequest,
      telegramMessageId: messageId,
    });

    // Return the result
    res.json(result);
  } catch (err) {
    console.error("[APPROVAL] Error processing request:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
