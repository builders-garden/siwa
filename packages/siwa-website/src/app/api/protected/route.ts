import { NextRequest } from "next/server";
import { validateToken } from "@/lib/session-store";
import { corsJson, corsOptions } from "@/lib/cors";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return corsJson({ error: "Unauthorized" }, { status: 401 });
  }

  const token = auth.slice(7);
  const payload = validateToken(token);
  if (!payload) {
    return corsJson({ error: "Unauthorized" }, { status: 401 });
  }

  return corsJson({
    message: `Hello Agent #${payload.agentId}!`,
    address: payload.address,
    agentId: payload.agentId,
    timestamp: new Date().toISOString(),
  });
}

export async function OPTIONS() {
  return corsOptions();
}
