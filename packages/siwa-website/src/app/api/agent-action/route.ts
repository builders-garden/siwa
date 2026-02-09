import { NextRequest } from "next/server";
import { verifyAuthenticatedRequest } from "@buildersgarden/siwa";
import { corsJson, corsOptions } from "@/lib/cors";

const RECEIPT_SECRET =
  process.env.RECEIPT_SECRET || process.env.SIWA_SECRET || "siwa-demo-secret-change-in-production";

export async function POST(req: NextRequest) {
  const result = await verifyAuthenticatedRequest(req, {
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
