import "dotenv/config";

// Server Configuration
export const TFA_GATEWAY_PORT = parseInt(
  process.env.TFA_GATEWAY_PORT || "3201",
  10
);

// Telegram Bot Token (for future signature verification if Telegram adds it)
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Internal 2FA Server URL
export const TFA_INTERNAL_URL = process.env.TFA_INTERNAL_URL;

// Validation
export function validateConfig(): void {
  const errors: string[] = [];

  if (!TFA_INTERNAL_URL) {
    errors.push("TFA_INTERNAL_URL is required");
  }

  if (errors.length > 0) {
    console.error("FATAL: Configuration errors:");
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
}
