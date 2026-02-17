import { NextRequest } from "next/server";
import { createPublicClient, http } from "viem";
import { createSIWANonce, createMemorySIWANonceStore, SIWAErrorCode } from "@buildersgarden/siwa";
import { corsJson, siwaOptions } from "@buildersgarden/siwa/next";

const SERVER_DOMAIN = process.env.SERVER_DOMAIN || "siwa.id";
const MAINNET_RPC_URL = "https://mainnet.base.org";
const MAINNET_CHAIN_ID = 8453;

const client = createPublicClient({ transport: http(MAINNET_RPC_URL) });

/** Singleton nonce store for mainnet — shared with the verify route via module import */
export const mainnetNonceStore = createMemorySIWANonceStore();

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { address, agentId, agentRegistry } = body;

  if (!address) {
    return corsJson({ error: "Missing address" }, { status: 400 });
  }

  const result = await createSIWANonce(
    { address, agentId, agentRegistry },
    client,
    { nonceStore: mainnetNonceStore },
  );

  if (result.status !== "nonce_issued") {
    return corsJson(result, { status: 403 });
  }

  return corsJson({
    nonce: result.nonce,
    issuedAt: result.issuedAt,
    expirationTime: result.expirationTime,
    domain: SERVER_DOMAIN,
    uri: `https://${SERVER_DOMAIN}/api/siwa/mainnet/verify`,
    chainId: MAINNET_CHAIN_ID,
  });
}

export const OPTIONS = () => siwaOptions();
