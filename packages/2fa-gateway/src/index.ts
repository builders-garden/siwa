import express, { type Request, type Response } from "express";
import { validateConfig, TFA_GATEWAY_PORT, TFA_INTERNAL_URL } from "./config.js";

// Validate configuration
validateConfig();

const app = express();

// Parse JSON
app.use(express.json());

// Rate limiting state (simple in-memory)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const requests = rateLimitMap.get(ip) || [];

  // Remove old requests outside the window
  const recentRequests = requests.filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
  );

  if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  // Add current request
  recentRequests.push(now);
  rateLimitMap.set(ip, recentRequests);

  return false;
}

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Telegram webhook endpoint
app.post("/webhook", async (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";

  // Rate limiting
  if (isRateLimited(ip)) {
    console.log(`[GATEWAY] Rate limited: ${ip}`);
    res.status(429).json({ error: "Too many requests" });
    return;
  }

  // Basic validation - Telegram updates have update_id
  const body = req.body;
  if (!body || typeof body.update_id !== "number") {
    console.log(`[GATEWAY] Invalid Telegram update from ${ip}`);
    res.status(400).json({ error: "Invalid Telegram update" });
    return;
  }

  console.log(
    `[GATEWAY] Forwarding webhook update_id=${body.update_id} from ${ip}`
  );

  try {
    // Forward to internal 2FA server
    const response = await fetch(`${TFA_INTERNAL_URL}/internal-webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    const data = await response.json();

    // Return the response from the internal server
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[GATEWAY] Failed to forward webhook:", (err as Error).message);
    res.status(502).json({ error: "Failed to forward to internal server" });
  }
});

// 404 for all other routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// Start server
app.listen(TFA_GATEWAY_PORT, () => {
  console.log(`[GATEWAY] 2FA Gateway listening on port ${TFA_GATEWAY_PORT}`);
  console.log(`[GATEWAY] Forwarding webhooks to ${TFA_INTERNAL_URL}`);
  console.log(`[GATEWAY] Endpoints:`);
  console.log(`  POST /webhook - Telegram webhook (public)`);
  console.log(`  GET  /health  - Health check`);
});
