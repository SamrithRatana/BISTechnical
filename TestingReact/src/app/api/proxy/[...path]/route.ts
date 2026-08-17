/**
 * @file api/proxy/[...path]/route.ts
 * @description Universal proxy route that forwards all API calls to the
 * appropriate backend service (TechnicalService.API, CustomerAPI, JWT API).
 *
 * After successful POST / PUT / DELETE mutations, it calls broadcast()
 * from the eventBus so all active SSE clients receive the event immediately.
 *
 * Memory safety (server-side):
 * - No state stored in this module — pure request/response
 * - eventBus.broadcast() is fire-and-forget, non-blocking
 * - All fetch calls use AbortSignal from req.signal
 */

import { NextRequest, NextResponse } from "next/server";
import { broadcast, type RealtimeResource } from "@/services/eventBus";
import { beginWrite, recordRequest } from "@/services/activityTracker";

const TECHNICAL_API_BASE =
  process.env.NEXT_PUBLIC_TECHNICAL_API_URL || "https://technicalservicesapi.camprotec.com.kh";
const CUSTOMER_API_BASE =
  process.env.NEXT_PUBLIC_CUSTOMER_API_URL || "https://customerapi.camprotec.com.kh";
const JWT_API_BASE =
  process.env.NEXT_PUBLIC_JWT_API_URL || "https://user.camprotec.com.kh";
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || "1.0";

/**
 * How long to wait on the upstream API before giving up.
 *
 * Without a deadline a backend that accepts the connection and then stalls
 * holds this route handler — and the Node socket behind it — open indefinitely.
 * Under load that is how a slow database turns into an unresponsive frontend,
 * because every queue page keeps polling. 30s is well past the slowest real
 * query (the spare-part usage report) and well short of "never".
 */
const UPSTREAM_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Per-request logging, development only.
 *
 * Every table render, every scroll batch and every 400ms-debounced keystroke
 * goes through here, so in production this wrote a line per request to the
 * server log for no diagnostic gain — and each line carried the full upstream
 * URL including any search terms the user typed.
 */
function logProxy(method: string, targetUrl: string): void {
  if (process.env.NODE_ENV !== "production") {
    console.log(`📡 [Proxy ${method}] → ${targetUrl}`);
  }
}

/**
 * Combines the client's abort signal with a timeout, so the upstream call ends
 * when *either* the user navigates away or the deadline passes.
 */
function withTimeout(clientSignal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
  return clientSignal
    ? AbortSignal.any([clientSignal, timeoutSignal])
    : timeoutSignal;
}

function getTargetUrl(req: NextRequest, pathString: string): string {
  const searchParams = new URLSearchParams(req.nextUrl.searchParams);
  const targetService = searchParams.get("service") || "technical";
  searchParams.delete("service");

  let baseUrl = TECHNICAL_API_BASE;
  if (targetService === "customer") baseUrl = CUSTOMER_API_BASE;
  if (targetService === "jwt")      baseUrl = JWT_API_BASE;

  if (!searchParams.has("api-version")) {
    searchParams.set("api-version", API_VERSION);
  }

  const queryString = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return `${baseUrl}/api/${pathString}${queryString}`;
}

/**
 * Infer a status from the URL path for the SSE event broadcast.
 * e.g. "/inspectitem" → "Inspecting", "/finishedrepair" → "Finished"
 */
function inferStatusFromPath(pathString: string): string | undefined {
  const p = pathString.toLowerCase();
  if (p.includes("inspecting"))           return "Inspecting";
  if (p.includes("inspectitem"))          return "Inspection";
  if (p.includes("repairitem") || p.includes("repairservice")) return "Repairing";
  if (p.includes("finishedrepair"))       return "Finished";
  if (p.includes("awaitingcustomer"))     return "Awaiting Customer Confirm";
  if (p.includes("customerrejected"))     return "Customer Rejected";
  if (p.includes("awaitingsparepart"))    return "Awaiting Sparepart";
  if (p.includes("saleconfirmed"))        return "Sale Confirmed";
  if (p.includes("sentspareparts"))       return "Sent Spareparts";
  if (p.includes("unrepairable"))         return "Unrepairable";
  if (p.includes("thirdpartyrepair"))     return "Repair by Third-Party";
  if (p.includes("receiveitem"))          return "Received";
  return undefined;
}

/**
 * Infer which record type a mutation touched, so subscribers only refresh for
 * events they actually care about.
 *
 * Order matters: several ticket-workflow endpoints contain "sparepart"
 * ("awaitingsparepart", "sentspareparts", and the inspect-item spare-part
 * sub-resource), and those act on a *ticket*, not the parts catalogue. So a
 * successful status match wins before any path-prefix check runs.
 */
function inferResourceFromPath(pathString: string): RealtimeResource {
  if (inferStatusFromPath(pathString)) return "ticket";

  const p = pathString.toLowerCase();
  if (p.startsWith("spareparts")) return "sparepart";
  if (p.startsWith("items"))      return "item";
  if (p.startsWith("customer"))   return "customer";
  return "ticket";
}

// ---------------------------------------------------------------------------
// GET — read-only, no broadcast needed
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const pathString = path ? path.join("/") : "";
    const searchParams = new URLSearchParams(req.nextUrl.searchParams);

    const targetService = searchParams.get("service") || "technical";
    searchParams.delete("service");

    let baseUrl = TECHNICAL_API_BASE;
    if (targetService === "customer") baseUrl = CUSTOMER_API_BASE;
    if (targetService === "jwt")      baseUrl = JWT_API_BASE;

    if (!searchParams.has("api-version")) {
      searchParams.set("api-version", API_VERSION);
    }

    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const targetUrl = `${baseUrl}/api/${pathString}${queryString}`;

    // A read does not block a deploy — nobody loses work to a restart while
    // reading — but it is evidence someone is here, which the SSE session
    // count alone would miss on pages that mount no realtime table.
    recordRequest();

    logProxy("GET", targetUrl);

    const authHeader = req.headers.get("authorization");
    const reqHeaders: Record<string, string> = {
      Accept: "application/json",
      // The upstream API now compresses JSON responses; undici decodes this
      // transparently, so the only visible effect is less data on the wire
      // between the two services.
      "Accept-Encoding": "br, gzip",
    };
    if (authHeader) reqHeaders["Authorization"] = authHeader;

    const res = await fetch(targetUrl, {
      headers: reqHeaders,
      cache: "no-store",
      signal: withTimeout(req.signal),
    });

    if (!res.ok) {
      console.warn(`⚠️ Backend API ${targetUrl} returned status ${res.status}`);
      return NextResponse.json(
        { error: `Backend API returned status ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const response = NextResponse.json(data);
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    return response;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";

    // A timeout also aborts, so check it first — otherwise a backend that
    // stalled for 30s would be reported as "client went away" and never show
    // up as a problem worth looking at.
    if (error instanceof Error && error.name === "TimeoutError") {
      console.error("❌ Proxy GET timed out after", UPSTREAM_TIMEOUT_MS, "ms");
      return NextResponse.json({ error: "Backend API timed out" }, { status: 504 });
    }
    // Ignore abort errors (client disconnected)
    if (msg.includes("abort") || msg.includes("signal")) {
      return NextResponse.json({ error: "Request aborted" }, { status: 499 });
    }
    console.error("❌ Proxy GET Error:", msg);
    return NextResponse.json({ error: "Failed to connect to backend API service" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — mutates data, then broadcasts
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // Declared outside the try so the finally block can always settle it — an
  // abandoned counter would pin the system at "busy" and make the deploy-safety
  // indicator permanently wrong.
  let endWrite: (() => void) | undefined;

  try {
    const { path } = await params;
    const pathString = path ? path.join("/") : "";
    const targetUrl = getTargetUrl(req, pathString);

    endWrite = beginWrite(`POST /${pathString}`);

    logProxy("POST", targetUrl);

    const authHeader = req.headers.get("authorization");
    const body = await req.text();
    const reqHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (authHeader) reqHeaders["Authorization"] = authHeader;

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: reqHeaders,
      body,
      cache: "no-store",
      // Deliberately not chained to req.signal: a mutation that has already
      // reached the backend should be allowed to finish even if the user
      // closed the tab, so the write and the SSE broadcast stay consistent.
      signal: withTimeout(),
    });

    const data = await res.json().catch(() => ({}));

    // ✅ Broadcast to all SSE clients on success
    if (res.ok) {
      const resource = inferResourceFromPath(pathString);
      const status = inferStatusFromPath(pathString);
      const isReceiveCreate = pathString.toLowerCase().includes("receiveitem");
      broadcast({
        type: resource === "ticket" && !isReceiveCreate ? "status_changed" : "ticket_created",
        resource,
        status,
        at: new Date().toISOString(),
      });
    }

    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Proxy POST Error:", msg);
    return NextResponse.json({ error: "Failed to connect to backend API service" }, { status: 500 });
  } finally {
    endWrite?.();
  }
}

// ---------------------------------------------------------------------------
// PUT — mutates data, then broadcasts
// ---------------------------------------------------------------------------

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  let endWrite: (() => void) | undefined;

  try {
    const { path } = await params;
    const pathString = path ? path.join("/") : "";
    const targetUrl = getTargetUrl(req, pathString);

    endWrite = beginWrite(`PUT /${pathString}`);

    logProxy("PUT", targetUrl);

    const authHeader = req.headers.get("authorization");
    const body = await req.text();
    const reqHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (authHeader) reqHeaders["Authorization"] = authHeader;

    const res = await fetch(targetUrl, {
      method: "PUT",
      headers: reqHeaders,
      body,
      cache: "no-store",
      signal: withTimeout(),
    });

    const data = await res.json().catch(() => ({}));

    // ✅ Broadcast ticket_updated to all SSE clients on success
    if (res.ok) {
      broadcast({
        type: "ticket_updated",
        resource: inferResourceFromPath(pathString),
        status: inferStatusFromPath(pathString),
        at: new Date().toISOString(),
      });
    }

    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Proxy PUT Error:", msg);
    return NextResponse.json({ error: "Failed to connect to backend API service" }, { status: 500 });
  } finally {
    endWrite?.();
  }
}

// ---------------------------------------------------------------------------
// DELETE — mutates data, then broadcasts
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  let endWrite: (() => void) | undefined;

  try {
    const { path } = await params;
    const pathString = path ? path.join("/") : "";
    const targetUrl = getTargetUrl(req, pathString);

    endWrite = beginWrite(`DELETE /${pathString}`);

    logProxy("DELETE", targetUrl);

    const authHeader = req.headers.get("authorization");
    const reqHeaders: Record<string, string> = { Accept: "application/json" };
    if (authHeader) reqHeaders["Authorization"] = authHeader;

    const res = await fetch(targetUrl, {
      method: "DELETE",
      headers: reqHeaders,
      cache: "no-store",
      signal: withTimeout(),
    });

    const data = await res.json().catch(() => ({}));

    // ✅ Broadcast ticket_deleted to all SSE clients on success
    if (res.ok) {
      broadcast({
        type: "ticket_deleted",
        resource: inferResourceFromPath(pathString),
        at: new Date().toISOString(),
      });
    }

    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Proxy DELETE Error:", msg);
    return NextResponse.json({ error: "Failed to connect to backend API service" }, { status: 500 });
  } finally {
    endWrite?.();
  }
}
