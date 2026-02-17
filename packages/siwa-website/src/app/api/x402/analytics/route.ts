import { withSiwa, siwaOptions } from "@buildersgarden/siwa/next";
import { payOnceConfig } from "@/lib/x402-config";

const x402 = payOnceConfig("/api/x402/analytics", "Agent analytics dashboard");

/**
 * GET /api/x402/analytics
 *
 * Sample x402 paid endpoint — pay-once session mode.
 * First request requires payment. Subsequent requests within the session TTL
 * (default 1 hour) skip payment automatically.
 *
 * Flow: SIWA auth → session check → x402 payment (if no session) → response
 */
export const GET = withSiwa(
  async (agent, _req, payment) => {
    return {
      agent: { address: agent.address, agentId: agent.agentId },
      sessionActive: !payment, // true when session was reused (no new payment)
      payment: payment
        ? { txHash: payment.txHash, amount: payment.amount, network: payment.network }
        : undefined,
      analytics: {
        totalRequests: Math.floor(Math.random() * 10000),
        uniqueAgents: Math.floor(Math.random() * 500),
        avgResponseTime: `${(Math.random() * 100 + 20).toFixed(1)}ms`,
        topEndpoints: [
          { path: "/api/protected", calls: 4821 },
          { path: "/api/agent-action", calls: 3102 },
          { path: "/api/x402/weather", calls: 1547 },
        ],
        period: "last_24h",
      },
      timestamp: new Date().toISOString(),
    };
  },
  { x402 },
);

/**
 * POST /api/x402/analytics
 *
 * Submit custom analytics events. Same pay-once session as GET —
 * a single payment unlocks both GET and POST on this route.
 */
export const POST = withSiwa(
  async (agent, req, payment) => {
    const body = await req.json();

    return {
      agent: { address: agent.address, agentId: agent.agentId },
      sessionActive: !payment,
      received: body,
      status: "event_recorded",
      timestamp: new Date().toISOString(),
    };
  },
  { x402 },
);

export const OPTIONS = () => siwaOptions({ x402: true });
