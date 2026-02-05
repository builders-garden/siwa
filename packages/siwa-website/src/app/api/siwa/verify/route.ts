import { NextRequest } from "next/server";
import { validateNonce } from "@/lib/nonce-store";
import { createSession } from "@/lib/session-store";
import { verifySIWARequest } from "@/lib/siwa-verifier";
import { corsJson, corsOptions } from "@/lib/cors";

const SERVER_DOMAIN = process.env.SERVER_DOMAIN || "siwa.builders.garden";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { message, signature } = body;

  if (!message || !signature) {
    return corsJson(
      { success: false, error: "Missing message or signature" },
      { status: 400 }
    );
  }

  const result = await verifySIWARequest(
    message,
    signature,
    SERVER_DOMAIN,
    validateNonce
  );

  if (!result.valid) {
    return corsJson(
      { success: false, error: result.error },
      { status: 401 }
    );
  }

  const session = createSession(
    {
      address: result.address,
      agentId: result.agentId,
      agentRegistry: result.agentRegistry,
      chainId: result.chainId,
    },
    result.verified
  );

  return corsJson({
    success: true,
    token: session.token,
    address: result.address,
    agentId: result.agentId,
    agentRegistry: result.agentRegistry,
    verified: result.verified,
    expiresAt: session.expiresAt.toISOString(),
  });
}

export async function OPTIONS() {
  return corsOptions();
}
