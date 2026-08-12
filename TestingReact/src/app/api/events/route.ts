/**
 * @file api/events/route.ts
 * @description Server-Sent Events (SSE) endpoint.
 *
 * Any authenticated browser tab that opens:
 *   GET /api/events
 *
 * will receive a persistent text/event-stream connection.
 * Whenever a ticket is created/updated/deleted by ANY user, the proxy route
 * calls eventBus.broadcast() which pushes a "data: {...}\n\n" frame to every
 * active SSE connection.
 *
 * Memory safety (server-side):
 * - Uses ReadableStream with `cancel()` callback — fires when client disconnects
 *   (tab close, navigate away, network drop). This calls unsubscribe() which
 *   removes the subscriber from the Set, preventing memory accumulation.
 * - No manual cleanup timer needed — the browser and Node HTTP layer handle it.
 *
 * Connection lifecycle:
 *   Client opens /api/events
 *     → subscribe() adds fn to Set
 *     → heartbeat keeps the connection alive (proxies close idle streams)
 *     → client disconnects → cancel() fires → unsubscribe() removes fn
 */

import { type NextRequest } from "next/server";
import { subscribe, type TicketEvent } from "@/services/eventBus";

export const dynamic = "force-dynamic"; // never cache this route
export const runtime = "nodejs";        // ReadableStream needs Node runtime

/** How often to send a keep-alive comment (prevents proxy/CDN timeouts) */
const HEARTBEAT_INTERVAL_MS = 25_000;

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let controller: ReadableStreamDefaultController | null = null;

  /**
   * Enqueue an SSE-formatted frame.
   * SSE format:
   *   data: <json>\n\n
   * A comment line (": heartbeat\n\n") keeps the connection alive.
   */
  function enqueue(payload: string) {
    try {
      controller?.enqueue(encoder.encode(payload));
    } catch {
      // Controller already closed — ignore
    }
  }

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;

      // Send initial connection confirmation
      enqueue("data: {\"type\":\"connected\"}\n\n");

      // Keep-alive heartbeat — proxies and load balancers drop idle HTTP/1.1
      // connections after ~30 s. We ping every 25 s to keep them open.
      heartbeatTimer = setInterval(() => {
        enqueue(": heartbeat\n\n");
      }, HEARTBEAT_INTERVAL_MS);

      // Subscribe to ticket events from the eventBus
      unsubscribe = subscribe((event: TicketEvent) => {
        enqueue(`data: ${JSON.stringify(event)}\n\n`);
      });
    },

    cancel() {
      // ✅ Fires when the client disconnects (tab close, navigate away, etc.)
      // This is the critical cleanup path — removes subscriber from the Set
      // so it doesn't accumulate in memory across many client connects/disconnects
      if (heartbeatTimer !== null) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (unsubscribe !== null) {
        unsubscribe();
        unsubscribe = null;
      }
      controller = null;
    },
  });

  // Also handle the request abort signal (used by some reverse proxies)
  req.signal.addEventListener("abort", () => {
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (unsubscribe !== null) {
      unsubscribe();
      unsubscribe = null;
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection:      "keep-alive",
      // Allow cross-origin SSE when needed (LAN access)
      "Access-Control-Allow-Origin": "*",
    },
  });
}
