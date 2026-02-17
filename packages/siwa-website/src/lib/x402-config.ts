import {
  createFacilitatorClient,
  createMemoryX402SessionStore,
  type X402Config,
  type PaymentRequirements,
  type FacilitatorClient,
} from "@buildersgarden/siwa";

// ---------------------------------------------------------------------------
// Payment requirements (shared across x402 endpoints)
// ---------------------------------------------------------------------------

/** 0.01 USDC on Base Sepolia */
export const USDC_BASE_SEPOLIA: PaymentRequirements = {
  scheme: "exact",
  network: "eip155:84532",
  amount: "10000", // 0.01 USDC (6 decimals)
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
  payTo: "0xffddB7C78D466f7d55C879c56EB8BF4c66400ab5",
  maxTimeoutSeconds: 60,
};

// ---------------------------------------------------------------------------
// Facilitator client (singleton)
// ---------------------------------------------------------------------------

export const facilitator: FacilitatorClient = createFacilitatorClient({
  url: "https://api.cdp.coinbase.com/platform/v2/x402",
});

// ---------------------------------------------------------------------------
// Session store (singleton, shared across endpoints that use pay-once)
// ---------------------------------------------------------------------------

export const sessionStore = createMemoryX402SessionStore();

/** Session TTL: 1 hour */
export const SESSION_TTL = 3_600_000;

// ---------------------------------------------------------------------------
// Pre-built x402 configs for sample endpoints
// ---------------------------------------------------------------------------

/** Per-request payment — no session, pay every time */
export function perRequestConfig(resourceUrl: string, description?: string): X402Config {
  return {
    facilitator,
    resource: { url: resourceUrl, description },
    accepts: [USDC_BASE_SEPOLIA],
  };
}

/** Pay-once session — first request requires payment, subsequent requests are free until TTL */
export function payOnceConfig(resourceUrl: string, description?: string): X402Config {
  return {
    facilitator,
    resource: { url: resourceUrl, description },
    accepts: [USDC_BASE_SEPOLIA],
    session: {
      store: sessionStore,
      ttl: SESSION_TTL,
    },
  };
}
