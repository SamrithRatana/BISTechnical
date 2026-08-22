import { NextRequest, NextResponse } from "next/server";
import {
  recordLoginHeartbeat,
  getActiveLoginSessions,
  revokeLoginSession,
  revokeAllOtherLoginSessions,
} from "@/lib/loginSessionTracker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const sessions = getActiveLoginSessions();
    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      count: sessions.length,
      sessions,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to retrieve login sessions" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, userName, role, email } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const ua = req.headers.get("user-agent") || "";
    const forwardedFor = req.headers.get("x-forwarded-for") || "";
    const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1";

    const session = recordLoginHeartbeat(sessionId, userName, role, email, ua, ip);

    return NextResponse.json({
      success: true,
      session,
      isRevoked: session.isRevoked === true,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to record session heartbeat" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const revokeOthers = searchParams.get("revokeOthers") === "true";
    const currentSessionId = searchParams.get("currentSessionId");

    if (revokeOthers && currentSessionId) {
      revokeAllOtherLoginSessions(currentSessionId);
      return NextResponse.json({ success: true, message: "Revoked other sessions" });
    }

    if (sessionId) {
      revokeLoginSession(sessionId);
      return NextResponse.json({ success: true, message: `Session ${sessionId} revoked` });
    }

    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to revoke session" },
      { status: 500 }
    );
  }
}
