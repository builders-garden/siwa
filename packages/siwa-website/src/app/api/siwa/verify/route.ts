import { NextRequest } from "next/server";
import { createPublicClient, http } from "viem";
import { verifySIWA, buildSIWAResponse, SIWAErrorCode } from "@buildersgarden/siwa";
import { createReceiptForAgent, recordSession } from "@/lib/session-store";

import { corsJson, corsOptions } from "@/lib/cors";

const SERVER_DOMAIN = process.env.SERVER_DOMAIN || "siwa.builders.garden";
const RPC_URL = process.env.RPC_URL || "https://sepolia.base.org";
const SIWA_NONCE_SECRET =
  process.env.SIWA_NONCE_SECRET ||
  process.env.SIWA_SECRET ||
  "siwa-demo-secret-change-in-production";

const client = createPublicClient({ transport: http(RPC_URL) });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { message, signature, nonceToken } = body;

  if (!message || !signature) {
    return corsJson(
      { status: "rejected", code: SIWAErrorCode.VERIFICATION_FAILED, error: "Missing message or signature" },
      { status: 400 },
    );
  }
  if (!nonceToken) {
    return corsJson(
      { status: "rejected", code: SIWAErrorCode.INVALID_NONCE, error: "Missing nonceToken" },
      { status: 400 },
    );
  }

  const result = await verifySIWA(
    message,
    signature,
    SERVER_DOMAIN,
    { nonceToken, secret: SIWA_NONCE_SECRET },
    client,
  );

  const response = buildSIWAResponse(result);

  if (!result.valid) {
    const statusCode = result.code === SIWAErrorCode.NOT_REGISTERED ? 403 : 401;
    return corsJson(response, { status: statusCode });
  }

  const verificationResult = {
    address: result.address,
    agentId: result.agentId,
    agentRegistry: result.agentRegistry,
    chainId: result.chainId,
  };

  const receiptResult = createReceiptForAgent({ ...verificationResult, verified: result.verified });
  recordSession(verificationResult, result.verified, receiptResult.expiresAt);

  return corsJson({
    ...response,
    receipt: receiptResult.receipt,
    receiptExpiresAt: receiptResult.expiresAt,
  });
}

export async function OPTIONS() {
  return corsOptions();
}
