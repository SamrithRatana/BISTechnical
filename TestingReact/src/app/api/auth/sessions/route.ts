import { NextRequest, NextResponse } from "next/server";
import {
  recordLoginHeartbeat,
  getActiveLoginSessions,
  revokeLoginSession,
  revokeAllOtherLoginSessions,
} from "@/lib/loginSessionTracker";
import { broadcast } from "@/services/eventBus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userName = searchParams.get("userName") || undefined;
    const sessions = getActiveLoginSessions(userName);
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
    const userName = searchParams.get("userName") || undefined;

    if (revokeOthers && currentSessionId) {
      revokeAllOtherLoginSessions(currentSessionId, userName);
      // "others" + the spared session id, NOT the bare username: broadcasting
      // the username matched the clicking browser too and signed it out along
      // with the sessions it was trying to revoke.
      broadcast({
        type: "force_logout",
        status: "others",
        id: currentSessionId,
        user: userName || "",
        at: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, message: "Revoked other sessions" });
    }

    if (sessionId) {
      revokeLoginSession(sessionId);
      broadcast({
        type: "force_logout",
        id: sessionId,
        status: userName || "",
        at: new Date().toISOString(),
      });
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
