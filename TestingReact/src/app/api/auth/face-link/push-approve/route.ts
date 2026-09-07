import { NextRequest, NextResponse } from "next/server";
import { completeFaceLinkSession, emitFaceLink, getFaceLinkSession } from "@/lib/faceLinkBridge";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const approved = Boolean(body.approved);
    const payload = body.payload;

    if (!sessionId) {
      return NextResponse.json({ isSuccess: false, message: "Missing sessionId" }, { status: 400 });
    }

    const session = getFaceLinkSession(sessionId);
    if (!session) {
      console.warn(`[PushApprove] Session ${sessionId} not found or expired on push-approve request.`);
      return NextResponse.json({ isSuccess: false, message: "Session expired or not found" }, { status: 404 });
    }

    if (approved) {
      completeFaceLinkSession(sessionId);
      emitFaceLink(sessionId, {
        type: "done",
        sessionId,
        payload,
      });
      console.log(`[PushApprove] Successfully forwarded approval for session ${sessionId} to desktop stream!`);
      return NextResponse.json({ isSuccess: true, message: "Approval forwarded to desktop stream" });
    } else {
      // Forward the API's own reason when it sent one. A wrong match number
      // arrives as "Incorrect matching number selected." and saying only
      // "denied by the phone" instead left the person at the desktop unable to
      // tell a mistyped number from someone rejecting their sign-in.
      const reason =
        typeof body.message === "string" && body.message.trim()
          ? body.message.trim()
          : "Login request was denied by the phone.";
      emitFaceLink(sessionId, {
        type: "error",
        sessionId,
        message: reason,
      });
      console.log(`[PushApprove] Forwarded denial for session ${sessionId}`);
      return NextResponse.json({ isSuccess: true, message: "Denial forwarded to desktop stream" });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error handling push approval";
    console.error(`[PushApprove] Error handling push approval:`, err);
    return NextResponse.json({ isSuccess: false, message }, { status: 500 });
  }
}
