import { NextRequest } from "next/server";
import { createNonce } from "@/lib/nonce-store";
import { corsJson, corsOptions } from "@/lib/cors";

const SERVER_DOMAIN = process.env.SERVER_DOMAIN || "siwa.builders.garden";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { address, agentRegistry } = body;

  if (!address) {
    return corsJson({ error: "Missing address" }, { status: 400 });
  }

  const { nonce, issuedAt, expirationTime } = createNonce(address);

  return corsJson({
    nonce,
    issuedAt,
    expirationTime,
    domain: SERVER_DOMAIN,
    uri: `https://${SERVER_DOMAIN}/api/siwa/verify`,
    chainId: parseInt(agentRegistry?.split(":")[1] || "84532"),
  });
}

export async function OPTIONS() {
  return corsOptions();
}
