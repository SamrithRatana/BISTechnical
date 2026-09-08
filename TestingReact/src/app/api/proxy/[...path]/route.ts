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
import {
  recordProcessActivity,
  captureSystemError,
  type ServiceId,
} from "@/services/systemObservability";

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

/**
 * Detects whether an error was caused by a client-side abort (navigating away, page refresh),
 * container restart socket drop, or undici ResponseAborted event.
 */
function isAbortOrClientDisconnect(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof Error) {
    if (
      error.name === "AbortError" ||
      error.name === "ResponseAborted"
    ) {
      return true;
    }
    const errStr = `${error.name} ${error.message} ${error.stack ?? ""}`.toLowerCase();
    if (
      errStr.includes("abort") ||
      errStr.includes("signal") ||
      errStr.includes("cancelled") ||
      errStr.includes("canceled") ||
      errStr.includes("econnreset")
    ) {
      return true;
    }
  }
  const code = (error as { code?: string })?.code;
  if (code === "UND_ERR_ABORTED" || code === "ECONNRESET" || code === "ERR_ABORTED") {
    return true;
  }
  return false;
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
  if (p.includes("inspecting") || p.includes("setinspecting")) return "Inspecting";
  if (p.includes("inspectitem"))                              return "Inspection";
  if (p.includes("repairitem") || p.includes("repairservice") || p.includes("setrepair") || p.includes("repairing")) return "Repairing";
  if (p.includes("finishedrepair") || p.includes("setfinished")) return "Finished";
  if (p.includes("awaitingcustomer") || p.includes("setawaitingcustomer")) return "Awaiting Customer Confirm";
  if (p.includes("customerrejected") || p.includes("setcustomerrejected")) return "Customer Rejected";
  if (p.includes("awaitingsparepart") || p.includes("setawaitingsparepart")) return "Awaiting Sparepart";
  if (p.includes("saleconfirmed") || p.includes("setsaleconfirmed")) return "Sale Confirmed";
  if (p.includes("sentspareparts") || p.includes("setsentspareparts")) return "Sent Spareparts";
  if (p.includes("unrepairable") || p.includes("setunrepairable")) return "Unrepairable";
  if (p.includes("thirdpartyrepair") || p.includes("setthirdpartyrepair")) return "Repair by Third-Party";
  if (p.includes("receiveitem"))                              return "Received";
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
  const p = pathString.toLowerCase();
  // Interconnected mutations that affect both tickets and spare parts
  if (
    p.includes("sentspareparts") ||
    p.includes("inspectitem") ||
    p.includes("awaitingsparepart") ||
    p.includes("spareparts/manual-stockout") ||
    p.includes("spareparts/items")
  ) {
    return "all";
  }

  if (inferStatusFromPath(pathString)) return "ticket";
  if (p.startsWith("spareparts")) return "sparepart";
  if (p.startsWith("items"))      return "item";
  if (p.startsWith("customer"))   return "customer";
  return "ticket";
}

function extractUserFromAuth(authHeader: string | null): string | undefined {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return undefined;
  try {
    const token = authHeader.substring(7);
    const parts = token.split(".");
    if (parts.length >= 2) {
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
      return (
        payload.unique_name ||
        payload.name ||
        payload.sub ||
        payload.username ||
        payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"] ||
        undefined
      );
    }
  } catch {}
  return undefined;
}

function mapServiceId(targetService: string): ServiceId {
  if (targetService === "jwt" || targetService === "user") return "our-user-api";
  if (targetService === "customer") return "our-user-api";
  return "our-technical-api";
}

function inferOperationDescriptions(
  method: string,
  pathString: string
): { km: string; en: string; type: "MUTATION" | "QUERY" | "AUTH" } {
  const p = pathString.toLowerCase();

  if (p.includes("auth/login") || p.includes("authenticate") || p.includes("token")) {
    return {
      km: "ផ្ទៀងផ្ទាត់គណនីចូលប្រព័ន្ធ (Login)",
      en: "User authentication / Login request",
      type: "AUTH",
    };
  }
  if (p.includes("receiveitem")) {
    return {
      km: "បង្កើតប័ណ្ណទទួលជួសជុលថ្មី (Receive Ticket)",
      en: "Created new repair intake ticket",
      type: "MUTATION",
    };
  }
  if (p.includes("inspectitem") || p.includes("setinspecting")) {
    return {
      km: "កត់ត្រាការត្រួតពិនិត្យបច្ចេកទេស (Technical Inspection)",
      en: "Recorded technical inspection details",
      type: "MUTATION",
    };
  }
  if (p.includes("setrepair") || p.includes("repairitem") || p.includes("repairservice")) {
    return {
      km: "ប្តូរស្ថានភាពទៅកំពុងជួសជុល (Repairing)",
      en: "Updated ticket status to Repairing",
      type: "MUTATION",
    };
  }
  if (p.includes("setfinished") || p.includes("finishedrepair")) {
    return {
      km: "បញ្ចប់ការជួសជុលជាស្ថាពរ (Finished Repair)",
      en: "Marked repair ticket as Finished",
      type: "MUTATION",
    };
  }
  if (p.includes("spareparts/manual-stockout")) {
    return {
      km: "កាត់ស្តុកគ្រឿងបន្លាស់ដោយផ្ទាល់ (Stockout)",
      en: "Manual spare parts stock deduction",
      type: "MUTATION",
    };
  }
  if (p.includes("sentspareparts")) {
    return {
      km: "បញ្ជូនគ្រឿងបន្លាស់ទៅកាន់ជាង (Sent Spareparts)",
      en: "Dispatched spare parts to technician",
      type: "MUTATION",
    };
  }
  if (p.includes("awaitingcustomer")) {
    return {
      km: "រង់ចាំការបញ្ជាក់ពីអតិថិជន (Awaiting Customer)",
      en: "Moved ticket to Awaiting Customer Confirmation",
      type: "MUTATION",
    };
  }
  if (p.includes("customerrejected")) {
    return {
      km: "អតិថិជនបដិសេធមិនជួសជុល (Customer Rejected)",
      en: "Customer rejected repair quotation",
      type: "MUTATION",
    };
  }
  if (p.includes("spareparts")) {
    if (method === "GET") {
      return {
        km: "ទាញយកទិន្នន័យគ្រឿងបន្លាស់ (Spareparts Catalogue)",
        en: "Queried spare parts catalogue",
        type: "QUERY",
      };
    }
    return {
      km: "កែប្រែទិន្នន័យគ្រឿងបន្លាស់ (Spareparts Mutation)",
      en: "Modified spare parts catalogue",
      type: "MUTATION",
    };
  }
  if (p.includes("technicalservices")) {
    if (method === "GET") {
      return {
        km: "ទាញយកបញ្ជីប័ណ្ណជួសជុល (Fetch Tickets)",
        en: "Fetched technical repair tickets",
        type: "QUERY",
      };
    }
    return {
      km: "កែប្រែទិន្នន័យប័ណ្ណជួសជុល (Update Ticket)",
      en: "Updated technical repair ticket",
      type: "MUTATION",
    };
  }
  if (p.includes("users")) {
    if (method === "GET") {
      return {
        km: "ទាញយកបញ្ជីអ្នកប្រើប្រាស់ (Fetch Users)",
        en: "Queried user accounts list",
        type: "QUERY",
      };
    }
    return {
      km: "កែប្រែគណនីអ្នកប្រើប្រាស់ (User Management)",
      en: "Modified user account credentials",
      type: "MUTATION",
    };
  }

  return {
    km: `${method} /api/${pathString}`,
    en: `${method} /api/${pathString}`,
    type: method === "GET" ? "QUERY" : "MUTATION",
  };
}

// ---------------------------------------------------------------------------
// GET — read-only, no broadcast needed
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const startTime = performance.now();
  let pathString = "";
  let targetService = "technical";
  let authHeader: string | null = null;

  try {
    const { path } = await params;
    pathString = path ? path.join("/") : "";
    const searchParams = new URLSearchParams(req.nextUrl.searchParams);

    targetService = searchParams.get("service") || "technical";
    searchParams.delete("service");

    let baseUrl = TECHNICAL_API_BASE;
    if (targetService === "customer") baseUrl = CUSTOMER_API_BASE;
    if (targetService === "jwt")      baseUrl = JWT_API_BASE;

    if (!searchParams.has("api-version")) {
      searchParams.set("api-version", API_VERSION);
    }

    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const targetUrl = `${baseUrl}/api/${pathString}${queryString}`;

    recordRequest();
    logProxy("GET", targetUrl);

    authHeader = req.headers.get("authorization");
    const reqHeaders: Record<string, string> = {
      Accept: "application/json",
      "Accept-Encoding": "br, gzip",
      "Bypass-Tunnel-Reminder": "true",
    };
    if (authHeader) reqHeaders["Authorization"] = authHeader;

    const res = await fetch(targetUrl, {
      headers: reqHeaders,
      cache: "no-store",
      signal: withTimeout(req.signal),
    });

    const durationMs = Math.round(performance.now() - startTime);
    const serviceId = mapServiceId(targetService);
    const user = extractUserFromAuth(authHeader);

    // Record activity for normal API queries (skip health checks)
    if (!pathString.startsWith("health")) {
      const { km, en, type } = inferOperationDescriptions("GET", pathString);
      recordProcessActivity({
        serviceId,
        type,
        descriptionKm: `${km} (${res.status})`,
        descriptionEn: `${en} (${res.status})`,
        durationMs,
        statusCode: res.status,
        user,
      });
    }

    if (!res.ok) {
      console.warn(`⚠️ Backend API ${targetUrl} returned status ${res.status}`);
      captureSystemError({
        serviceId,
        endpoint: `/api/${pathString}`,
        method: "GET",
        statusCode: res.status,
        message: `Upstream API returned HTTP ${res.status} for /api/${pathString}`,
        userContext: user ? { username: user } : undefined,
      });
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
    const durationMs = Math.round(performance.now() - startTime);
    const serviceId = mapServiceId(targetService);
    const user = extractUserFromAuth(authHeader);

    if (error instanceof Error && error.name === "TimeoutError") {
      console.error("❌ Proxy GET timed out after", UPSTREAM_TIMEOUT_MS, "ms");
      captureSystemError({
        serviceId,
        endpoint: `/api/${pathString}`,
        method: "GET",
        statusCode: 504,
        message: `Upstream API timed out after ${UPSTREAM_TIMEOUT_MS}ms`,
        userContext: user ? { username: user } : undefined,
      });
      return NextResponse.json({ error: "Backend API timed out" }, { status: 504 });
    }
    if (isAbortOrClientDisconnect(error)) {
      return NextResponse.json({ error: "Request aborted" }, { status: 499 });
    }
    console.error("❌ Proxy GET Error:", msg);
    captureSystemError({
      serviceId,
      endpoint: `/api/${pathString}`,
      method: "GET",
      statusCode: 500,
      message: `Proxy GET Error: ${msg || error?.constructor?.name || "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      userContext: user ? { username: user } : undefined,
    });
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
  let endWrite: (() => void) | undefined;
  const startTime = performance.now();
  let pathString = "";
  let targetService = "technical";
  let authHeader: string | null = null;
  let body = "";

  try {
    const { path } = await params;
    pathString = path ? path.join("/") : "";
    targetService = req.nextUrl.searchParams.get("service") || "technical";
    const targetUrl = getTargetUrl(req, pathString);

    endWrite = beginWrite(`POST /${pathString}`);
    logProxy("POST", targetUrl);

    authHeader = req.headers.get("authorization");
    body = await req.text();
    const reqHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Bypass-Tunnel-Reminder": "true",
    };
    if (authHeader) reqHeaders["Authorization"] = authHeader;

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: reqHeaders,
      body,
      cache: "no-store",
      signal: withTimeout(),
    });

    const durationMs = Math.round(performance.now() - startTime);
    const serviceId = mapServiceId(targetService);
    const user = extractUserFromAuth(authHeader);
    const { km, en, type } = inferOperationDescriptions("POST", pathString);

    recordProcessActivity({
      serviceId,
      type: res.ok ? type : "ERROR",
      descriptionKm: `${km} (${res.status})`,
      descriptionEn: `${en} (${res.status})`,
      durationMs,
      statusCode: res.status,
      user,
    });

    if (!res.ok) {
      captureSystemError({
        serviceId,
        endpoint: `/api/${pathString}`,
        method: "POST",
        statusCode: res.status,
        message: `Upstream POST error [HTTP ${res.status}] on /api/${pathString}`,
        payloadSnippet: typeof body === "string" ? body.substring(0, 300) : undefined,
        userContext: user ? { username: user } : undefined,
      });
    }

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

    return relay(res, data);
  } catch (error: unknown) {
    if (isAbortOrClientDisconnect(error)) {
      return NextResponse.json({ error: "Request aborted" }, { status: 499 });
    }
    const msg = error instanceof Error ? error.message : "Unknown error";
    const durationMs = Math.round(performance.now() - startTime);
    const serviceId = mapServiceId(targetService);
    const user = extractUserFromAuth(authHeader);

    console.error("❌ Proxy POST Error:", msg);
    captureSystemError({
      serviceId,
      endpoint: `/api/${pathString}`,
      method: "POST",
      statusCode: 500,
      message: `Proxy POST Error: ${msg || error?.constructor?.name || "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      payloadSnippet: typeof body === "string" ? body.substring(0, 300) : undefined,
      userContext: user ? { username: user } : undefined,
    });
    return NextResponse.json({ error: "Failed to connect to backend API service" }, { status: 500 });
  } finally {
    endWrite?.();
  }
}

/**
 * Relays an upstream mutation response to the browser.
 */
function relay(res: Response, data: unknown): NextResponse {
  if (res.status === 204 || res.status === 205) {
    return new NextResponse(null, { status: res.status });
  }
  return NextResponse.json(data, { status: res.status });
}

// ---------------------------------------------------------------------------
// PUT — mutates data, then broadcasts
// ---------------------------------------------------------------------------

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  let endWrite: (() => void) | undefined;
  const startTime = performance.now();
  let pathString = "";
  let targetService = "technical";
  let authHeader: string | null = null;
  let body = "";

  try {
    const { path } = await params;
    pathString = path ? path.join("/") : "";
    targetService = req.nextUrl.searchParams.get("service") || "technical";
    const targetUrl = getTargetUrl(req, pathString);

    endWrite = beginWrite(`PUT /${pathString}`);
    logProxy("PUT", targetUrl);

    authHeader = req.headers.get("authorization");
    body = await req.text();
    const reqHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Bypass-Tunnel-Reminder": "true",
    };
    if (authHeader) reqHeaders["Authorization"] = authHeader;

    const res = await fetch(targetUrl, {
      method: "PUT",
      headers: reqHeaders,
      body,
      cache: "no-store",
      signal: withTimeout(),
    });

    const durationMs = Math.round(performance.now() - startTime);
    const serviceId = mapServiceId(targetService);
    const user = extractUserFromAuth(authHeader);
    const { km, en, type } = inferOperationDescriptions("PUT", pathString);

    recordProcessActivity({
      serviceId,
      type: res.ok ? type : "ERROR",
      descriptionKm: `${km} (${res.status})`,
      descriptionEn: `${en} (${res.status})`,
      durationMs,
      statusCode: res.status,
      user,
    });

    if (!res.ok) {
      captureSystemError({
        serviceId,
        endpoint: `/api/${pathString}`,
        method: "PUT",
        statusCode: res.status,
        message: `Upstream PUT error [HTTP ${res.status}] on /api/${pathString}`,
        payloadSnippet: typeof body === "string" ? body.substring(0, 300) : undefined,
        userContext: user ? { username: user } : undefined,
      });
    }

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

    return relay(res, data);
  } catch (error: unknown) {
    if (isAbortOrClientDisconnect(error)) {
      return NextResponse.json({ error: "Request aborted" }, { status: 499 });
    }
    const msg = error instanceof Error ? error.message : "Unknown error";
    const durationMs = Math.round(performance.now() - startTime);
    const serviceId = mapServiceId(targetService);
    const user = extractUserFromAuth(authHeader);

    console.error("❌ Proxy PUT Error:", msg);
    captureSystemError({
      serviceId,
      endpoint: `/api/${pathString}`,
      method: "PUT",
      statusCode: 500,
      message: `Proxy PUT Error: ${msg || error?.constructor?.name || "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      payloadSnippet: typeof body === "string" ? body.substring(0, 300) : undefined,
      userContext: user ? { username: user } : undefined,
    });
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
  const startTime = performance.now();
  let pathString = "";
  let targetService = "technical";
  let authHeader: string | null = null;

  try {
    const { path } = await params;
    pathString = path ? path.join("/") : "";
    targetService = req.nextUrl.searchParams.get("service") || "technical";
    const targetUrl = getTargetUrl(req, pathString);

    endWrite = beginWrite(`DELETE /${pathString}`);
    logProxy("DELETE", targetUrl);

    authHeader = req.headers.get("authorization");
    const reqHeaders: Record<string, string> = {
      Accept: "application/json",
      "Bypass-Tunnel-Reminder": "true",
    };
    if (authHeader) reqHeaders["Authorization"] = authHeader;

    const res = await fetch(targetUrl, {
      method: "DELETE",
      headers: reqHeaders,
      cache: "no-store",
      signal: withTimeout(),
    });

    const durationMs = Math.round(performance.now() - startTime);
    const serviceId = mapServiceId(targetService);
    const user = extractUserFromAuth(authHeader);

    recordProcessActivity({
      serviceId,
      type: res.ok ? "MUTATION" : "ERROR",
      descriptionKm: `លុបទិន្នន័យ ${pathString} (${res.status})`,
      descriptionEn: `Deleted ${pathString} (${res.status})`,
      durationMs,
      statusCode: res.status,
      user,
    });

    if (!res.ok) {
      captureSystemError({
        serviceId,
        endpoint: `/api/${pathString}`,
        method: "DELETE",
        statusCode: res.status,
        message: `Upstream DELETE error [HTTP ${res.status}] on /api/${pathString}`,
        userContext: user ? { username: user } : undefined,
      });
    }

    const data = await res.json().catch(() => ({}));

    // ✅ Broadcast ticket_deleted to all SSE clients on success
    if (res.ok) {
      broadcast({
        type: "ticket_deleted",
        resource: inferResourceFromPath(pathString),
        at: new Date().toISOString(),
      });
    }

    return relay(res, data);
  } catch (error: unknown) {
    if (isAbortOrClientDisconnect(error)) {
      return NextResponse.json({ error: "Request aborted" }, { status: 499 });
    }
    const msg = error instanceof Error ? error.message : "Unknown error";
    const durationMs = Math.round(performance.now() - startTime);
    const serviceId = mapServiceId(targetService);
    const user = extractUserFromAuth(authHeader);

    console.error("❌ Proxy DELETE Error:", msg);
    captureSystemError({
      serviceId,
      endpoint: `/api/${pathString}`,
      method: "DELETE",
      statusCode: 500,
      message: `Proxy DELETE Error: ${msg || error?.constructor?.name || "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      userContext: user ? { username: user } : undefined,
    });
    return NextResponse.json({ error: "Failed to connect to backend API service" }, { status: 500 });
  } finally {
    endWrite?.();
  }
}
