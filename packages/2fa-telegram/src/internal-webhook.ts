import type { Request, Response } from "express";
import { audit } from "./audit-logger.js";
import {
  resolvePendingApproval,
  getPendingApproval,
} from "./approval-store.js";
import {
  editMessage,
  answerCallbackQuery,
  sendMessage,
} from "./telegram.js";
import {
  formatApprovedMessage,
  formatRejectedMessage,
} from "./message-formatter.js";
import type { TelegramUpdate, TelegramCallbackQuery } from "./types.js";

// Parse callback data: "action:requestId"
function parseCallbackData(data: string): { action: string; requestId: string } | null {
  const parts = data.split(":");
  if (parts.length !== 2) return null;

  const [action, requestId] = parts;
  if (!["approve", "reject"].includes(action)) return null;
  if (!requestId) return null;

  return { action, requestId };
}

export async function handleInternalWebhook(
  req: Request,
  res: Response
): Promise<void> {
  const update = req.body as TelegramUpdate;

  // Log webhook received
  audit({
    event: "webhook_received",
    callbackId: update.callback_query?.id,
  });

  // We only handle callback queries (button presses)
  if (!update.callback_query) {
    res.json({ ok: true, message: "No callback query" });
    return;
  }

  const callback = update.callback_query;

  // Validate callback data
  if (!callback.data) {
    await answerCallbackQuery(callback.id, "Invalid callback");
    res.json({ ok: true });
    return;
  }

  const parsed = parseCallbackData(callback.data);
  if (!parsed) {
    await answerCallbackQuery(callback.id, "Invalid callback data");
    res.json({ ok: true });
    return;
  }

  const { action, requestId } = parsed;
  const approved = action === "approve";

  // Get pending approval to access metadata
  const pending = getPendingApproval(requestId);
  if (!pending) {
    await answerCallbackQuery(callback.id, "Request expired or already processed");
    res.json({ ok: true, message: "Request not found" });
    return;
  }

  // Resolve the approval
  const result = resolvePendingApproval(
    requestId,
    approved,
    callback.from.id
  );

  if (!result) {
    await answerCallbackQuery(callback.id, "Failed to process");
    res.json({ ok: false, error: "Failed to resolve approval" });
    return;
  }

  // Answer the callback to remove loading state
  await answerCallbackQuery(
    callback.id,
    approved ? "Approved!" : "Rejected"
  );

  // Update the Telegram message
  const message = callback.message;
  if (message) {
    const messageText = approved
      ? formatApprovedMessage(
          requestId,
          pending.operation,
          pending.wallet,
          result.responseTimeMs || 0
        )
      : formatRejectedMessage(
          requestId,
          pending.operation,
          pending.wallet,
          result.responseTimeMs || 0
        );

    await editMessage({
      chatId: message.chat.id,
      messageId: message.message_id,
      text: messageText,
      parseMode: "HTML",
    });
  }

  res.json({ ok: true, approved });
}
