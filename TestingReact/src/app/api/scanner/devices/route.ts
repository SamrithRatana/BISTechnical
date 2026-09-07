import { NextRequest, NextResponse } from "next/server";
import { getAllActiveSessions } from "@/lib/scannerBridge";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId") || undefined;
    const activeSessions = getAllActiveSessions(sessionId);
    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      devices: activeSessions,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch scanner devices" },
      { status: 500 }
    );
  }
}
