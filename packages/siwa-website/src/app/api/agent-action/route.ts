import { NextRequest } from "next/server";
import { verifyAuthenticatedRequest, nextjsToFetchRequest } from "@buildersgarden/siwa/erc8128";
import { corsJson, corsOptions } from "@/lib/cors";

const RECEIPT_SECRET =
  process.env.RECEIPT_SECRET || process.env.SIWA_SECRET || "siwa-demo-secret-change-in-production";

export async function POST(req: NextRequest) {
  // Clone before verification — verifyRequest consumes the body stream
  // for content-digest checks, so we need the clone for req.json() later.
  const result = await verifyAuthenticatedRequest(nextjsToFetchRequest(req.clone()), {
    receiptSecret: RECEIPT_SECRET,
  });

  if (!result.valid) {
    return corsJson({ error: result.error }, { status: 401 });
  }

  const body = await req.json();

  return corsJson({
    received: body,
    processedBy: "siwa-server",
    agent: { address: result.agent.address, agentId: result.agent.agentId },
    timestamp: new Date().toISOString(),
  });
}

export async function OPTIONS() {
  return corsOptions();
}
