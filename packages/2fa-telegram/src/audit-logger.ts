import fs from "fs";
import path from "path";
import { TFA_AUDIT_LOG_PATH } from "./config.js";
import type { AuditLogEntry } from "./types.js";

let logStream: fs.WriteStream | null = null;

export function initAuditLogger(): void {
  const logDir = path.dirname(TFA_AUDIT_LOG_PATH);

  // Ensure directory exists
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  logStream = fs.createWriteStream(TFA_AUDIT_LOG_PATH, { flags: "a" });

  logStream.on("error", (err) => {
    console.error("[AUDIT] Write error:", err.message);
  });

  console.log(`[AUDIT] Logging to ${TFA_AUDIT_LOG_PATH}`);
}

export function audit(entry: Omit<AuditLogEntry, "timestamp">): void {
  const fullEntry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  };

  const line = JSON.stringify(fullEntry) + "\n";

  // Write to file
  if (logStream) {
    logStream.write(line);
  }

  // Also log to console for visibility
  const emoji = getEventEmoji(fullEntry.event);
  console.log(
    `[AUDIT] ${emoji} ${fullEntry.event} ${fullEntry.requestId || ""} ${
      fullEntry.error ? `- ${fullEntry.error}` : ""
    }`.trim()
  );
}

function getEventEmoji(event: string): string {
  switch (event) {
    case "request_created":
      return "📝";
    case "user_approved":
      return "✅";
    case "user_rejected":
      return "❌";
    case "request_timeout":
      return "⏰";
    case "webhook_received":
      return "📥";
    case "telegram_error":
      return "⚠️";
    default:
      return "📋";
  }
}

export function closeAuditLogger(): void {
  if (logStream) {
    logStream.end();
    logStream = null;
  }
}
