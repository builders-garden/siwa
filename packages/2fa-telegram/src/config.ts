import "dotenv/config";

// Telegram Bot Configuration
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
export const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Server Configuration
export const TFA_PORT = parseInt(process.env.TFA_PORT || "3200", 10);
export const TFA_SECRET = process.env.TFA_SECRET;
export const TFA_APPROVAL_TIMEOUT_MS = parseInt(
  process.env.TFA_APPROVAL_TIMEOUT_MS || "60000",
  10
);

// Audit Logging
export const TFA_AUDIT_LOG_PATH =
  process.env.TFA_AUDIT_LOG_PATH || "./audit.jsonl";

// Validation
export function validateConfig(): void {
  const errors: string[] = [];

  if (!TELEGRAM_BOT_TOKEN) {
    errors.push("TELEGRAM_BOT_TOKEN is required");
  }

  if (!TELEGRAM_CHAT_ID) {
    errors.push("TELEGRAM_CHAT_ID is required");
  }

  if (!TFA_SECRET) {
    errors.push("TFA_SECRET is required");
  }

  if (errors.length > 0) {
    console.error("FATAL: Configuration errors:");
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
}
