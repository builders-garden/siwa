import { NextRequest } from "next/server";
import { verifySIWA, buildSIWAResponse, parseSIWAMessage, SIWAErrorCode } from "@buildersgarden/siwa";
import { createReceiptForAgent, recordSession } from "@/lib/session-store";
import { corsJson, siwaOptions } from "@buildersgarden/siwa/next";
import { parseChainId, getClient, nonceStore } from "@/lib/siwa-resolver";

const SERVER_DOMAIN = process.env.SERVER_DOMAIN || "siwa.id";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { message, signature } = body;

  if (!message || !signature) {
    return corsJson(
      { status: "rejected", code: SIWAErrorCode.VERIFICATION_FAILED, error: "Missing message or signature" },
      { status: 400 },
    );
  }

  const fields = parseSIWAMessage(message);
  const chainId = parseChainId(fields.agentRegistry);
  if (!chainId) {
    return corsJson(
      { status: "rejected", code: SIWAErrorCode.INVALID_REGISTRY_FORMAT, error: "Invalid agentRegistry in message" },
      { status: 400 },
    );
  }

  let client;
  try {
    client = getClient(chainId);
  } catch (err: any) {
    return corsJson({ status: "rejected", error: err.message }, { status: 400 });
  }

  const result = await verifySIWA(
    message,
    signature,
    SERVER_DOMAIN,
    { nonceStore },
    client,
  );

  const response = buildSIWAResponse(result);

  if (!result.valid) {
    const statusCode = result.code === SIWAErrorCode.NOT_REGISTERED ? 403 : 401;
    return corsJson(response, { status: statusCode });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signerType = (result as any).signerType as 'eoa' | 'sca' | undefined;
  const verificationResult = {
    address: result.address,
    agentId: result.agentId,
    agentRegistry: result.agentRegistry,
    chainId: result.chainId,
    ...(signerType ? { signerType } : {}),
  };

  const receiptResult = createReceiptForAgent({ ...verificationResult, verified: result.verified });
  recordSession(verificationResult, result.verified, receiptResult.expiresAt);

  return corsJson({
    ...response,
    receipt: receiptResult.receipt,
    receiptExpiresAt: receiptResult.expiresAt,
  });
}

export const OPTIONS = () => siwaOptions();
