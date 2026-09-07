import { NextRequest, NextResponse } from "next/server";
import {
  revokeLoginSession,
  revokeAllLoginSessionsForUser,
} from "@/lib/loginSessionTracker";
import { broadcast } from "@/services/eventBus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { revokeAll, sessionId, userName } = body;

    console.log(`[RemoteRevoke] Received remote session termination request:`, {
      revokeAll,
      sessionId,
      userName,
    });

    if (revokeAll) {
      revokeAllLoginSessionsForUser(userName);
      broadcast({
        type: "force_logout",
        status: userName || "all",
        at: new Date().toISOString(),
      });
      return NextResponse.json({
        isSuccess: true,
        message: `All sessions revoked for ${userName || "all users"}.`,
      });
    }

    if (sessionId) {
      revokeLoginSession(sessionId);
      broadcast({
        type: "force_logout",
        id: sessionId,
        status: userName || "",
        at: new Date().toISOString(),
      });
      return NextResponse.json({
        isSuccess: true,
        message: `Session ${sessionId} revoked.`,
      });
    }

    if (userName) {
      revokeAllLoginSessionsForUser(userName);
      broadcast({
        type: "force_logout",
        status: userName,
        at: new Date().toISOString(),
      });
      return NextResponse.json({
        isSuccess: true,
        message: `Sessions for user ${userName} revoked.`,
      });
    }

    return NextResponse.json(
      { isSuccess: false, message: "Missing sessionId, userName or revokeAll." },
      { status: 400 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error revoking session remotely";
    console.error(`[RemoteRevoke] Error processing remote revocation:`, err);
    return NextResponse.json({ isSuccess: false, message }, { status: 500 });
  }
}
