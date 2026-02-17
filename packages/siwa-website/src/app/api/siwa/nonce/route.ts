import { NextRequest } from "next/server";
import { createPublicClient, http } from "viem";
import { createSIWANonce, createMemorySIWANonceStore, SIWAErrorCode } from "@buildersgarden/siwa";
import { corsJson, siwaOptions } from "@buildersgarden/siwa/next";

const SERVER_DOMAIN = process.env.SERVER_DOMAIN || "siwa.id";
const RPC_URL = process.env.RPC_URL || "https://sepolia.base.org";

const client = createPublicClient({ transport: http(RPC_URL) });

/** Singleton nonce store — shared with the verify route via module import */
export const nonceStore = createMemorySIWANonceStore();

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { address, agentId, agentRegistry } = body;

  if (!address) {
    return corsJson({ error: "Missing address" }, { status: 400 });
  }

  const result = await createSIWANonce(
    { address, agentId, agentRegistry },
    client,
    { nonceStore },
  );

  if (result.status !== "nonce_issued") {
    return corsJson(result, { status: 403 });
  }

  return corsJson({
    nonce: result.nonce,
    issuedAt: result.issuedAt,
    expirationTime: result.expirationTime,
    domain: SERVER_DOMAIN,
    uri: `https://${SERVER_DOMAIN}/api/siwa/verify`,
    chainId: parseInt(agentRegistry?.split(":")[1] || "84532"),
  });
}

export const OPTIONS = () => siwaOptions();
