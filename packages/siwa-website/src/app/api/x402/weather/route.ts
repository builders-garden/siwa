import { withSiwa, siwaOptions } from "@buildersgarden/siwa/next";
import { perRequestConfig } from "@/lib/x402-config";

/**
 * GET /api/x402/weather
 *
 * Sample x402 paid endpoint — per-request payment.
 * Every request requires a valid payment (no session caching).
 *
 * Flow: SIWA auth (401 if invalid) → x402 payment (402 if missing) → response
 */
export const GET = withSiwa(
  async (agent, _req, payment) => {
    // Mock weather data — in production this would be a real API call
    return {
      agent: { address: agent.address, agentId: agent.agentId },
      payment: payment
        ? { txHash: payment.txHash, amount: payment.amount, network: payment.network }
        : undefined,
      weather: {
        location: "Base Sepolia Testnet City",
        temperature: 21,
        unit: "celsius",
        conditions: "Sunny with a chance of blocks",
        humidity: 55,
        wind: { speed: 12, direction: "NE", unit: "km/h" },
        forecast: [
          { day: "Tomorrow", high: 23, low: 15, conditions: "Partly cloudy" },
          { day: "Day after", high: 19, low: 12, conditions: "Light rain" },
        ],
      },
      timestamp: new Date().toISOString(),
    };
  },
  {
    x402: perRequestConfig("/api/x402/weather", "Premium weather data"),
  },
);

export const OPTIONS = () => siwaOptions({ x402: true });
