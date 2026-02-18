import { NextRequest } from "next/server";
import { createSIWANonce, SIWAErrorCode } from "@buildersgarden/siwa";
import { corsJson, siwaOptions } from "@buildersgarden/siwa/next";
import { parseChainId, getClient, nonceStore } from "@/lib/siwa-resolver";

const SERVER_DOMAIN = process.env.SERVER_DOMAIN || "siwa.id";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { address, agentId, agentRegistry } = body;

  if (!address) {
    return corsJson({ error: "Missing address" }, { status: 400 });
  }

  const chainId = parseChainId(agentRegistry);
  if (!chainId) {
    return corsJson({ error: "Invalid agentRegistry format" }, { status: 400 });
  }

  let client;
  try {
    client = getClient(chainId);
  } catch (err: any) {
    return corsJson({ error: err.message }, { status: 400 });
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
    chainId,
  });
}

export const OPTIONS = () => siwaOptions();
