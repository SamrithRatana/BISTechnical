import { NextResponse } from "next/server";
import { getAllActiveSessions } from "@/lib/scannerBridge";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const activeSessions = getAllActiveSessions();
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
