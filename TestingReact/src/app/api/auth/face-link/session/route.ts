/**
 * @file api/auth/face-link/session/route.ts
 * @description Desktop side of phone face pairing: create a session, then hold
 * an SSE stream open waiting for the phone to finish.
 *
 * POST   -> { sessionId, secret }   (secret stays on this desktop)
 * GET    -> text/event-stream        (requires sessionId AND secret)
 * DELETE -> ends the session
 *
 * The QR the desktop draws carries only `sessionId`. `secret` is what proves
 * this browser is the one that started the pairing, and it is required to read
 * the stream — on the login path the stream delivers a real session token, so
 * without that check anyone who photographed the QR could collect it. See
 * `lib/faceLinkBridge.ts`.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createFaceLinkSession,
  deleteFaceLinkSession,
  emitFaceLink,
  getFaceLinkSession,
  ownsFaceLinkSession,
  subscribeFaceLink,
  unsubscribeFaceLink,
  type FaceLinkEvent,
} from "@/lib/faceLinkBridge";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Keeps proxies from closing an idle stream while someone walks to fetch their phone. */
const HEARTBEAT_MS = 20_000;

export async function POST(req: NextRequest) {
  let body: { mode?: string; userName?: string; userId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // An empty body is fine; mode defaults to login below.
  }

  const mode = body.mode === "enroll" ? "enroll" : "login";

  // Pairing a phone TO an account requires already being signed in as that
  // account - the same rule passkey and face enrolment follow. Signing in with
  // an already-paired phone obviously does not.
  const authHeader = req.headers.get("authorization");
  if (mode === "enroll" && !authHeader) {
    return NextResponse.json(
      { isSuccess: false, message: "Sign in before pairing a phone." },
      { status: 401 }
    );
  }

  const { id, secret } = createFaceLinkSession(
    mode,
    authHeader ?? undefined,
    body.userName,
    body.userId
  );

  return NextResponse.json(
    { isSuccess: true, sessionId: id, secret },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  const secret = searchParams.get("secret");

  if (!sessionId || !ownsFaceLinkSession(sessionId, secret)) {
    // One response for "no such session" and "wrong secret" on purpose: telling
    // them apart would confirm which session ids are live.
    return NextResponse.json({ isSuccess: false, message: "Session not found." }, { status: 404 });
  }

  const encoder = new TextEncoder();
  let listener: ((e: FaceLinkEvent & { timestamp: number }) => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Client already gone; cleanup runs via the abort handler.
        }
      };

      send({ type: "init", sessionId, timestamp: Date.now() });

      const session = getFaceLinkSession(sessionId);
      if (session?.phoneJoined) {
        send({ type: "phone-joined", sessionId, timestamp: Date.now() });
      }

      listener = (event) => {
        send(event);
        if (event.type === "done" || event.type === "error") {
          // The session is finished either way; closing here means the desktop
          // does not have to remember to tear the stream down itself. Clean up
          // the timer and the bridge subscription NOW rather than waiting on
          // the client's abort — a clean server-side close does not guarantee
          // the abort handler fires, and each missed one leaked a 20s
          // heartbeat interval plus a listener for the process lifetime.
          if (heartbeat) {
            clearInterval(heartbeat);
            heartbeat = null;
          }
          if (listener) {
            unsubscribeFaceLink(sessionId, listener);
            listener = null;
          }
          try {
            controller.close();
          } catch {
            // Already closed.
          }
        }
      };

      subscribeFaceLink(sessionId, listener);
      heartbeat = setInterval(() => send({ type: "ping", sessionId, timestamp: Date.now() }), HEARTBEAT_MS);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (listener) unsubscribeFaceLink(sessionId, listener);
    },
  });

  // Closing the tab has to release the listener, or an abandoned pairing keeps a
  // session and its callback alive until the TTL sweep.
  req.signal.addEventListener("abort", () => {
    if (heartbeat) clearInterval(heartbeat);
    if (listener) unsubscribeFaceLink(sessionId, listener);
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Nginx buffers event-streams into uselessness without this.
      "X-Accel-Buffering": "no",
    },
  });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  const secret = searchParams.get("secret");

  if (!sessionId || !ownsFaceLinkSession(sessionId, secret)) {
    return NextResponse.json({ isSuccess: false, message: "Session not found." }, { status: 404 });
  }

  emitFaceLink(sessionId, { type: "error", sessionId, message: "cancelled" });
  deleteFaceLinkSession(sessionId);

  return NextResponse.json({ isSuccess: true });
}
