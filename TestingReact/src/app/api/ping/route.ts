import { NextResponse } from "next/server";

/**
 * @file api/ping/route.ts
 * @description Ultra-lightweight endpoint for measuring pure Browser → Web App network latency.
 *
 * Answers in < 1ms without touching databases or external microservices,
 * isolating pure frontend server connection latency.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    { ok: true, timestamp: Date.now() },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
