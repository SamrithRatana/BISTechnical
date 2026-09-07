/**
 * @file api/auth/face/[...path]/route.ts
 * @description Proxy for the User Management API's face-verification endpoints.
 *
 * Separate from `api/proxy/[...path]` for the same two reasons the passkey proxy
 * is: that route broadcasts a realtime event after every successful POST (a
 * sign-in is two of them, and neither touches a ticket), and this one forwards
 * bodies through untouched.
 *
 * The bodies here are large-ish - three 128-float arrays on enrolment - and are
 * never logged. A face descriptor is biometric-derived personal data; it should
 * not end up in a request log because a proxy found it convenient to print.
 */

import { NextRequest, NextResponse } from "next/server";
import { recordRequest } from "@/services/activityTracker";

const JWT_API_BASE = process.env.NEXT_PUBLIC_JWT_API_URL || "https://user.camprotec.com.kh";

const UPSTREAM_TIMEOUT_MS = 20_000;

const ALLOWED_STATIC_PATHS = new Set([
  "status",
  "enroll",
  "toggle-2fa",
  "login-start",
  "login-verify",
  "devices",
  "device/enroll",
  "device/login",
]);

function isPathAllowed(path: string, segments: string[]): boolean {
  if (ALLOWED_STATIC_PATHS.has(path)) return true;
  // Allow devices/{id} (e.g. devices/1)
  if (segments.length === 2 && segments[0] === "devices" && /^\d+$/.test(segments[1])) {
    return true;
  }
  return false;
}

async function forward(
  req: NextRequest,
  segments: string[],
  method: "GET" | "POST" | "DELETE"
): Promise<NextResponse> {
  recordRequest();

  const path = segments.join("/");
  if (!isPathAllowed(path, segments)) {
    return NextResponse.json({ isSuccess: false, message: "Unknown endpoint." }, { status: 404 });
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  const authHeader = req.headers.get("authorization");
  if (authHeader) headers["Authorization"] = authHeader;

  let body: string | undefined;
  if (method === "POST") {
    body = await req.text();
    headers["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(`${JWT_API_BASE}/api/auth/face/${path}`, {
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

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return forward(req, path, "POST");
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return forward(req, path, "GET");
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return forward(req, path, "DELETE");
}
