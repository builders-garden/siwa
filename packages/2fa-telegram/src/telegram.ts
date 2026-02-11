import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from "./config.js";
import { audit } from "./audit-logger.js";
import type { TelegramInlineKeyboard } from "./types.js";

const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

interface SendMessageOptions {
  text: string;
  parseMode?: "HTML" | "Markdown" | "MarkdownV2";
  replyMarkup?: TelegramInlineKeyboard;
  chatId?: string | number;
}

interface SendMessageResponse {
  ok: boolean;
  result?: {
    message_id: number;
    chat: { id: number };
  };
  description?: string;
}

interface EditMessageOptions {
  chatId: string | number;
  messageId: number;
  text: string;
  parseMode?: "HTML" | "Markdown" | "MarkdownV2";
}

export async function sendMessage(
  options: SendMessageOptions
): Promise<number | null> {
  try {
    const body: Record<string, unknown> = {
      chat_id: options.chatId ?? TELEGRAM_CHAT_ID,
      text: options.text,
    };

    if (options.parseMode) {
      body.parse_mode = options.parseMode;
    }

    if (options.replyMarkup) {
      body.reply_markup = options.replyMarkup;
    }

    const response = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    const data = (await response.json()) as SendMessageResponse;

    if (!data.ok) {
      audit({
        event: "telegram_error",
        error: data.description || "Unknown error",
        endpoint: "sendMessage",
      });
      return null;
    }

    return data.result?.message_id || null;
  } catch (err) {
    audit({
      event: "telegram_error",
      error: (err as Error).message,
      endpoint: "sendMessage",
    });
    return null;
  }
}

export async function editMessage(options: EditMessageOptions): Promise<boolean> {
  try {
    const body: Record<string, unknown> = {
      chat_id: options.chatId,
      message_id: options.messageId,
      text: options.text,
    };

    if (options.parseMode) {
      body.parse_mode = options.parseMode;
    }

    const response = await fetch(`${TELEGRAM_API_BASE}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    const data = (await response.json()) as { ok: boolean; description?: string };

    if (!data.ok) {
      audit({
        event: "telegram_error",
        error: data.description || "Unknown error",
        endpoint: "editMessageText",
      });
      return false;
    }

    return true;
  } catch (err) {
    audit({
      event: "telegram_error",
      error: (err as Error).message,
      endpoint: "editMessageText",
    });
    return false;
  }
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string
): Promise<boolean> {
  try {
    const body: Record<string, unknown> = {
      callback_query_id: callbackQueryId,
    };

    if (text) {
      body.text = text;
      body.show_alert = false;
    }

    const response = await fetch(`${TELEGRAM_API_BASE}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });

    const data = (await response.json()) as { ok: boolean };
    return data.ok;
  } catch {
    return false;
  }
}

export function createApprovalKeyboard(
  requestId: string
): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "✅ Approve", callback_data: `approve:${requestId}` },
        { text: "❌ Reject", callback_data: `reject:${requestId}` },
      ],
    ],
  };
}
