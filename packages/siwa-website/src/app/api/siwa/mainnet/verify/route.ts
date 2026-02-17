import { NextRequest } from "next/server";
import { createPublicClient, http } from "viem";
import { verifySIWA, buildSIWAResponse, SIWAErrorCode } from "@buildersgarden/siwa";
import { createReceiptForAgent, recordSession } from "@/lib/session-store";
import { corsJson, siwaOptions } from "@buildersgarden/siwa/next";
import { mainnetNonceStore } from "../nonce/route";

const SERVER_DOMAIN = process.env.SERVER_DOMAIN || "siwa.id";
const MAINNET_RPC_URL = "https://mainnet.base.org";

const client = createPublicClient({ transport: http(MAINNET_RPC_URL) });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { message, signature } = body;

  if (!message || !signature) {
    return corsJson(
      { status: "rejected", code: SIWAErrorCode.VERIFICATION_FAILED, error: "Missing message or signature" },
      { status: 400 },
    );
  }

  const result = await verifySIWA(
    message,
    signature,
    SERVER_DOMAIN,
    { nonceStore: mainnetNonceStore },
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
