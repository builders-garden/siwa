import { NextResponse } from "next/server";

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-SIWA-Receipt, Signature, Signature-Input, Content-Digest",
  };
}

export function corsJson(data: unknown, init?: { status?: number }) {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: corsHeaders(),
  });
}

export function corsOptions() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
