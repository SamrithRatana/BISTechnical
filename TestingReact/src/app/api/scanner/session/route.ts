import { NextRequest } from "next/server";
import {
  subscribeToSession,
  getActiveSession,
  registerPcSession,
  unsubscribeFromSession,
  type ScannerEvent,
} from "@/lib/scannerBridge";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  const isPc = searchParams.get("role") === "pc";

  if (!sessionId) {
    return new Response(JSON.stringify({ error: "Missing sessionId parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // If this is a phone trying to connect, ensure the PC session actually exists!
  if (!isPc) {
    const active = getActiveSession(sessionId);
    if (!active) {
      return new Response(
        JSON.stringify({
          error: "SESSION_EXPIRED",
          message: "This scan session has expired or was terminated. Please scan a new QR code on your PC.",
        }),
        {
          status: 410,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  } else {
    // Register or keep alive PC session
    const ownerUserName = searchParams.get("userName") || undefined;
    const ownerUserId = searchParams.get("userId") || undefined;
    registerPcSession(sessionId, ownerUserName, ownerUserId);
  }

  const encoder = new TextEncoder();
  let listenerCallback: ((event: ScannerEvent) => void) | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // 1. Initial hello payload
      const initialPayload: ScannerEvent = {
        type: "init",
        sessionId,
        timestamp: Date.now(),
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialPayload)}\n\n`));

      const session = getActiveSession(sessionId);
      if (session?.phoneConnected) {
        const phoneJoinedPayload: ScannerEvent = {
          type: "phone-joined",
          sessionId,
          timestamp: Date.now(),
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(phoneJoinedPayload)}\n\n`));
      }

      // 2. Subscribe to real-time events
      listenerCallback = (event) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Stream controller likely closed
        }
      };

      const subscribed = subscribeToSession(sessionId, listenerCallback, isPc);
      if (!subscribed) {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "terminate",
                sessionId,
                timestamp: Date.now(),
              })}\n\n`
            )
          );
          controller.close();
        } catch {}
      }

      // 3. Heartbeat ping every 15s to keep proxy & browser connection alive
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          if (heartbeatTimer) clearInterval(heartbeatTimer);
        }
      }, 15000);
    },
    cancel() {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (listenerCallback) unsubscribeFromSession(sessionId, listenerCallback);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
