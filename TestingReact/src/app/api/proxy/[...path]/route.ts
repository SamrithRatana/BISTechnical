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

const TECHNICAL_API_BASE =
  process.env.NEXT_PUBLIC_TECHNICAL_API_URL || "https://technicalservicesapi.camprotec.com.kh";
const CUSTOMER_API_BASE =
  process.env.NEXT_PUBLIC_CUSTOMER_API_URL || "https://customerapi.camprotec.com.kh";
const JWT_API_BASE =
  process.env.NEXT_PUBLIC_JWT_API_URL || "https://user.camprotec.com.kh";
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || "1.0";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

    console.log(`📡 [Proxy GET] → ${targetUrl}`);

    const authHeader = req.headers.get("authorization");
    const reqHeaders: Record<string, string> = { Accept: "application/json" };
    if (authHeader) reqHeaders["Authorization"] = authHeader;

    const res = await fetch(targetUrl, {
      headers: reqHeaders,
      cache: "no-store",
      signal: req.signal,
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
  try {
    const { path } = await params;
    const pathString = path ? path.join("/") : "";
    const targetUrl = getTargetUrl(req, pathString);

    console.log(`📡 [Proxy POST] → ${targetUrl}`);

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
  }
}

// ---------------------------------------------------------------------------
// PUT — mutates data, then broadcasts
// ---------------------------------------------------------------------------

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const pathString = path ? path.join("/") : "";
    const targetUrl = getTargetUrl(req, pathString);

    console.log(`📡 [Proxy PUT] → ${targetUrl}`);

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
  }
}

// ---------------------------------------------------------------------------
// DELETE — mutates data, then broadcasts
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const pathString = path ? path.join("/") : "";
    const targetUrl = getTargetUrl(req, pathString);

    console.log(`📡 [Proxy DELETE] → ${targetUrl}`);

    const authHeader = req.headers.get("authorization");
    const reqHeaders: Record<string, string> = { Accept: "application/json" };
    if (authHeader) reqHeaders["Authorization"] = authHeader;

    const res = await fetch(targetUrl, {
      method: "DELETE",
      headers: reqHeaders,
      cache: "no-store",
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
  }
}
