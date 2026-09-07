/**
 * @file api/auth/face-link/submit/route.ts
 * @description Phone side of face pairing. The phone announces itself, then
 * sends what it captured; this route talks to the User Management API and pushes
 * the outcome back to the waiting desktop over the session's event stream.
 *
 * Actions, by `type`:
 *   join   -> tells the desktop a phone picked up the QR
 *   enroll -> pairs this phone and stores the face; the DEVICE TOKEN goes back
 *             to the phone in the response and is never sent to the desktop
 *   login  -> verifies the face against the account this phone is paired to; the
 *             SESSION goes to the DESKTOP over the stream and never to the phone
 *
 * That split is the point of the whole design. The phone keeps a long-lived
 * credential that names its account; the desktop receives the short-lived
 * session it asked for. Neither ever holds the other's secret.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  completeFaceLinkSession,
  emitFaceLink,
  getFaceLinkSession,
  markPhoneJoined,
} from "@/lib/faceLinkBridge";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const JWT_API_BASE = process.env.NEXT_PUBLIC_JWT_API_URL || "https://user.camprotec.com.kh";
const UPSTREAM_TIMEOUT_MS = 20_000;

async function callApi(path: string, body: unknown, bearer?: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const res = await fetch(`${JWT_API_BASE}/api/auth/face/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(bearer ? { Authorization: bearer } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

function pick<T>(source: Record<string, unknown>, camel: string, pascal: string): T | undefined {
  const value = source[camel] !== undefined ? source[camel] : source[pascal];
  return value as T | undefined;
}

function message(data: Record<string, unknown>, fallback: string): string {
  return pick<string>(data, "message", "Message") || fallback;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ isSuccess: false, message: "Malformed request." }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const type = typeof body.type === "string" ? body.type : "";
  const phoneUserName = typeof body.userName === "string" ? body.userName : (typeof body.pairedUserName === "string" ? body.pairedUserName : "");
  const phoneUserId = typeof body.userId === "string" ? body.userId : (typeof body.pairedUserId === "string" ? body.pairedUserId : "");

  const session = getFaceLinkSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { isSuccess: false, message: "This pairing expired. Please show a new QR code." },
      { status: 401 }
    );
  }

  // ── STRICT ACCOUNT MISMATCH GUARD ──
  // If the Web PC session has an owner/target user and the phone is already paired with an account:
  if (session.userName && phoneUserName && session.userName.trim().toLowerCase() !== phoneUserName.trim().toLowerCase()) {
    console.warn(`[FaceLinkSubmit] Rejected account mismatch: Phone=${phoneUserName}, PC=${session.userName}`);
    // Tell the desktop too (non-terminal) — otherwise it keeps saying
    // "waiting" while the phone shows the mismatch alert.
    emitFaceLink(sessionId, {
      type: "phone-error",
      sessionId,
      message: `The scanned phone is paired to '${phoneUserName}', not '${session.userName}'.`,
    });
    return NextResponse.json(
      {
        isSuccess: false,
        mismatch: true,
        phoneUser: phoneUserName,
        pcUser: session.userName,
        message: `Account mismatch: Phone is paired to '${phoneUserName}', but Web PC session belongs to '${session.userName}'.`,
      },
      { status: 403 }
    );
  }

  if (type === "join") {
    // A spent session is refused at join time. Letting the phone join meant it
    // walked the whole biometric flow only to hit "already used" at the end —
    // and on a login QR the desktop that owned this session is already gone.
    if (session.completed) {
      return NextResponse.json(
        { isSuccess: false, message: "This QR code was already used. Please show a new one." },
        { status: 409 }
      );
    }
    markPhoneJoined(sessionId);
    return NextResponse.json({
      isSuccess: true,
      mode: session.mode,
      userName: session.userName,
      userId: session.userId,
    });
  }

  // ---- enrolment: pair this phone and store the face ------------------------
  if (type === "enroll") {
    if (session.mode !== "enroll") {
      return NextResponse.json({ isSuccess: false, message: "Wrong pairing mode." }, { status: 400 });
    }

    // Spend the session BEFORE the upstream call. Two phones racing on one QR
    // would otherwise both enrol, and the second would silently replace the
    // first person's face samples on the desktop user's account.
    if (!completeFaceLinkSession(sessionId)) {
      return NextResponse.json({ isSuccess: false, message: "This pairing was already used." }, { status: 409 });
    }

    const { ok, data } = await callApi(
      "device/enroll",
      { samples: body.samples, deviceName: body.deviceName },
      session.bearer
    );

    if (!ok) {
      const text = message(data, "Could not pair this phone.");
      emitFaceLink(sessionId, { type: "error", sessionId, message: text });
      return NextResponse.json({ isSuccess: false, message: text }, { status: 400 });
    }

    // The desktop is told it worked, and nothing else - the device token is the
    // phone's to keep.
    emitFaceLink(sessionId, {
      type: "done",
      sessionId,
      payload: { deviceName: pick<string>(data, "deviceName", "DeviceName") ?? null },
    });

    return NextResponse.json({
      isSuccess: true,
      deviceToken: pick<string>(data, "deviceToken", "DeviceToken"),
      deviceName: pick<string>(data, "deviceName", "DeviceName"),
      userId: pick<string>(data, "userId", "UserId"),
      userName: pick<string>(data, "userName", "UserName"),
      fullName: pick<string>(data, "fullName", "FullName"),
      email: pick<string>(data, "email", "Email"),
      // Identity fields the phone renders on its profile cards. This bridge
      // used to drop them, which left a freshly paired phone showing
      // placeholder avatar/phone that never matched the web portal.
      phoneNumber: pick<string>(data, "phoneNumber", "PhoneNumber"),
      profilePictureUrl: pick<string>(data, "profilePictureUrl", "ProfilePictureUrl"),
      coverUrl: pick<string>(data, "coverUrl", "CoverUrl"),
      roles: pick<string[]>(data, "roles", "Roles") || [],
    });
  }

  // ---- login: verify the face against this phone's account ------------------
  if (type === "login") {
    if (session.mode !== "login") {
      return NextResponse.json({ isSuccess: false, message: "Wrong pairing mode." }, { status: 400 });
    }

    const { ok, data } = await callApi("device/login", {
      deviceToken: body.deviceToken,
      descriptor: body.descriptor,
    });

    if (!ok) {
      // NOT spent on failure: a mis-framed capture should let the person simply
      // try again rather than walk back to the desktop for a fresh QR. The
      // desktop IS told (non-terminal event) — without this it kept showing
      // "waiting" with no hint that the phone was rejected, which read as a
      // frozen page when the pairing was revoked or the account locked.
      const text = message(data, "Face not recognised.");
      emitFaceLink(sessionId, { type: "phone-error", sessionId, message: text });
      return NextResponse.json({ isSuccess: false, message: text }, { status: 401 });
    }

    if (!completeFaceLinkSession(sessionId)) {
      return NextResponse.json({ isSuccess: false, message: "This pairing was already used." }, { status: 409 });
    }

    // The session goes to the desktop, over the stream only that desktop can
    // read. The phone gets an acknowledgement and no token.
    // Normalised here rather than on the desktop: this is the one place that
    // sees the API's PascalCase, and the stream should carry the same camelCase
    // shape every other login path produces.
    const rawUser = pick<Record<string, unknown>>(data, "user", "User");

    emitFaceLink(sessionId, {
      type: "done",
      sessionId,
      payload: {
        token: pick<string>(data, "token", "Token"),
        refreshToken: pick<string>(data, "refreshToken", "RefreshToken"),
        user: rawUser
          ? {
              id: pick<string>(rawUser, "id", "Id") || "",
              userName: pick<string>(rawUser, "userName", "UserName") || "",
              email: pick<string>(rawUser, "email", "Email") || "",
              firstName: pick<string>(rawUser, "firstName", "FirstName") || "",
              lastName: pick<string>(rawUser, "lastName", "LastName") || "",
              phoneNumber: pick<string>(rawUser, "phoneNumber", "PhoneNumber") || "",
              profilePictureUrl: pick<string>(rawUser, "profilePictureUrl", "ProfilePictureUrl") || "",
              coverUrl: pick<string>(rawUser, "coverUrl", "CoverUrl") || "",
              roles: pick<string[]>(rawUser, "roles", "Roles") || [],
            }
          : undefined,
      },
    });

    return NextResponse.json({ isSuccess: true });
  }

  return NextResponse.json({ isSuccess: false, message: "Unknown action." }, { status: 400 });
}
