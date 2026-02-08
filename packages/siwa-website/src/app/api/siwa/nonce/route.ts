import { NextRequest } from "next/server";
import { createPublicClient, http } from "viem";
import { createSIWANonce, SIWAErrorCode } from "@buildersgarden/siwa";
import { corsJson, corsOptions } from "@/lib/cors";

const SERVER_DOMAIN = process.env.SERVER_DOMAIN || "siwa.builders.garden";
const RPC_URL = process.env.RPC_URL || "https://sepolia.base.org";
const SIWA_NONCE_SECRET =
  process.env.SIWA_NONCE_SECRET ||
  process.env.JWT_SECRET ||
  "siwa-demo-secret-change-in-production";

const client = createPublicClient({ transport: http(RPC_URL) });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { address, agentId, agentRegistry } = body;

  if (!address) {
    return corsJson({ error: "Missing address" }, { status: 400 });
  }

  const result = await createSIWANonce(
    { address, agentId, agentRegistry },
    client,
    { secret: SIWA_NONCE_SECRET },
  );

  if (result.status !== "nonce_issued") {
    return corsJson(result, { status: 403 });
  }

  return corsJson({
    nonce: result.nonce,
    nonceToken: result.nonceToken,
    issuedAt: result.issuedAt,
    expirationTime: result.expirationTime,
    domain: SERVER_DOMAIN,
    uri: `https://${SERVER_DOMAIN}/api/siwa/verify`,
    chainId: parseInt(agentRegistry?.split(":")[1] || "84532"),
  });
}

export async function OPTIONS() {
  return corsOptions();
}
