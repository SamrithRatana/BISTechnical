/**
 * @file api/auth/webauthn/[...path]/route.ts
 * @description Proxy for the User Management API's WebAuthn (passkey) endpoints.
 *
 * Deliberately separate from `api/proxy/[...path]` rather than folded into it,
 * for two reasons:
 *
 *  - That route `broadcast()`s a realtime event after every successful POST /
 *    PUT / DELETE. A passkey ceremony is three POSTs, none of which change any
 *    ticket, so routing it through there would fire three spurious
 *    `ticket_updated` events per sign-in — the same class of bug already
 *    documented for profile-photo uploads, except three times per login.
 *  - WebAuthn payloads are spec-shaped camelCase JSON. This route forwards the
 *    body through as an opaque string and never re-serialises it, so nothing in
 *    the hop can rename a field. The .NET side takes the same care; see the
 *    class remarks on `WebAuthnController`.
 *
 * The browser talks only to this route; the .NET API is reached server-to-server,
 * which is why the API's CORS policy does not need a localhost entry.
 */

import { NextRequest, NextResponse } from "next/server";
import { recordRequest } from "@/services/activityTracker";

const JWT_API_BASE = process.env.NEXT_PUBLIC_JWT_API_URL || "https://user.camprotec.com.kh";

/**
 * WebAuthn ceremonies are short. This is well past a slow round trip and well
 * short of holding a handler open on a stalled backend.
 */
const UPSTREAM_TIMEOUT_MS = 20_000;

/**
 * Only these path segments are forwarded.
 *
 * A catch-all segment is user-controlled input, so without this an attacker
 * could walk out of the webauthn namespace — `/api/auth/webauthn/../../Auth/
 * register-admin` — and reach any endpoint on the User API through a route that
 * looks like it only does passkeys. An allow-list is checked against the joined
 * path, so no traversal sequence can pass.
 */
const ALLOWED_PATHS = new Set([
  "register-options",
  "register",
  "login-options",
  "login",
  "credentials",
]);

function resolveTarget(segments: string[]): string | null {
  const path = segments.join("/");

  if (ALLOWED_PATHS.has(path)) {
    return `${JWT_API_BASE}/api/auth/webauthn/${path}`;
  }

  // The one parameterised path: credentials/{numeric id}.
  if (segments.length === 2 && segments[0] === "credentials" && /^\d+$/.test(segments[1])) {
    return `${JWT_API_BASE}/api/auth/webauthn/credentials/${segments[1]}`;
  }

  return null;
}

async function forward(
  req: NextRequest,
  segments: string[],
  method: "GET" | "POST" | "DELETE"
): Promise<NextResponse> {
  recordRequest();

  const target = resolveTarget(segments);
  if (!target) {
    return NextResponse.json({ isSuccess: false, message: "Unknown endpoint." }, { status: 404 });
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  const authHeader = req.headers.get("authorization");
  if (authHeader) headers["Authorization"] = authHeader;

  let body: string | undefined;
  if (method === "POST") {
    // Read as text, forward as text. Parsing and re-stringifying here would put
    // this route's JSON opinions between the browser and the verifier.
    body = await req.text();
    headers["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(target, {
      method,
      headers,
      body,
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await upstream.text();

    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return NextResponse.json(
      {
        isSuccess: false,
        message: aborted
          ? "The sign-in service did not respond in time."
          : "Could not reach the sign-in service.",
      },
      { status: 504 }
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return forward(req, path, "POST");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return forward(req, path, "GET");
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return forward(req, path, "DELETE");
}
