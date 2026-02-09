import express, { type Request, type Response, type NextFunction } from "express";
import { validateConfig, TFA_PORT } from "./config.js";
import { initAuditLogger, closeAuditLogger, audit } from "./audit-logger.js";
import { handleApprovalRequest } from "./approval-handler.js";
import { handleInternalWebhook } from "./internal-webhook.js";
import { cleanupAllPending, getPendingCount } from "./approval-store.js";

// Validate configuration before starting
validateConfig();

// Initialize audit logger
initAuditLogger();

// Create Express app
const app = express();

// Parse JSON with raw body capture (for debugging if needed)
app.use(express.json());

// Health check endpoint (no auth required)
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    pendingApprovals: getPendingCount(),
    timestamp: new Date().toISOString(),
  });
});

// Request approval endpoint (internal, from keyring-proxy)
app.post("/request-approval", handleApprovalRequest);

// Internal webhook endpoint (from gateway)
app.post("/internal-webhook", handleInternalWebhook);

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[ERROR]", err);
  audit({
    event: "telegram_error",
    error: err.message,
  });
  res.status(500).json({ error: "Internal server error" });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// Graceful shutdown
function shutdown(): void {
  console.log("\n[SERVER] Shutting down...");

  // Reject all pending approvals
  cleanupAllPending();

  // Close audit logger
  closeAuditLogger();

  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Start server
app.listen(TFA_PORT, () => {
  console.log(`[SERVER] 2FA Telegram server listening on port ${TFA_PORT}`);
  console.log(`[SERVER] Endpoints:`);
  console.log(`  POST /request-approval - Request user approval (internal)`);
  console.log(`  POST /internal-webhook - Telegram webhook handler (from gateway)`);
  console.log(`  GET  /health           - Health check`);
});
