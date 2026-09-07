/**
 * @file services/faceAuth.ts
 * @description Typed client for face verification - the second factor.
 *
 * Normalises the User Management API's PascalCase into the app's camelCase in
 * one place, the same way `services/webauthn.ts` does, and for the same reason:
 * `Program.cs` sets `PropertyNamingPolicy = null` API-wide and the face proxy
 * route forwards bodies verbatim rather than re-serialising them.
 */

import { readToken } from "@/services/authSession";
import type { LoginResponse } from "@/services/types";

/** Whether the signed-in user has a face enrolled. */
export interface FaceStatus {
  enrolled: boolean;
  twoFactorEnabled: boolean;
  sampleCount: number;
  requiredSamples: number;
  enrolledAt: string | null;
}

/**
 * What the password step returns.
 *
 * A discriminated union rather than one loose object: the two outcomes are
 * genuinely different - one IS a session, the other is explicitly not one - and
 * flattening them into optional fields is how a caller ends up treating a
 * face-required response as a successful sign-in.
 */
export type FaceLoginStart =
  | { kind: "session"; session: LoginResponse }
  | { kind: "faceRequired"; faceToken: string; attemptsLeft: number; expiresInSeconds: number }
  | { kind: "failed"; message: string };

/** A failed face check, with how many tries remain on this token. */
export class FaceVerifyError extends Error {
  readonly attemptsLeft: number | null;
  /** True when the token is gone: the user has to start from the password again. */
  readonly expired: boolean;

  constructor(message: string, attemptsLeft: number | null, expired: boolean) {
    super(message);
    this.name = "FaceVerifyError";
    this.attemptsLeft = attemptsLeft;
    this.expired = expired;
  }
}

const BASE = "/api/auth/face";

function pick<T>(source: Record<string, unknown>, camel: string, pascal: string): T | undefined {
  const value = source[camel] !== undefined ? source[camel] : source[pascal];
  return value as T | undefined;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = readToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** Pulls the shared session shape out of a response body. */
function toLoginResponse(data: Record<string, unknown>): LoginResponse {
  const rawUser = pick<Record<string, unknown>>(data, "user", "User");

  return {
    isSuccess: pick<boolean>(data, "isSuccess", "IsSuccess") === true,
    message: pick<string>(data, "message", "Message"),
    token: pick<string>(data, "token", "Token"),
    refreshToken: pick<string>(data, "refreshToken", "RefreshToken"),
    user: rawUser
      ? {
          id: pick<string>(rawUser, "id", "Id") || "",
          userName: pick<string>(rawUser, "userName", "UserName") || "",
          email: pick<string>(rawUser, "email", "Email") || "",
          firstName: pick<string>(rawUser, "firstName", "FirstName") || "",
          lastName: pick<string>(rawUser, "lastName", "LastName") || "",
          roles: pick<string[]>(rawUser, "roles", "Roles") || [],
        }
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Enrolment & 2FA Toggle
// ---------------------------------------------------------------------------

export async function getFaceStatus(): Promise<FaceStatus> {
  const res = await fetch(`${BASE}/status`, {
    method: "GET",
    headers: authHeaders(),
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Could not read face status.");

  const data = (await res.json()) as Record<string, unknown>;
  return {
    enrolled: pick<boolean>(data, "enrolled", "Enrolled") === true,
    twoFactorEnabled: pick<boolean>(data, "twoFactorEnabled", "TwoFactorEnabled") === true,
    sampleCount: pick<number>(data, "sampleCount", "SampleCount") ?? 0,
    requiredSamples: pick<number>(data, "requiredSamples", "RequiredSamples") ?? 3,
    enrolledAt: pick<string>(data, "enrolledAt", "EnrolledAt") ?? null,
  };
}

/** Toggles Two-Factor Face Verification on password login. */
export async function toggleFaceTwoFactor(enabled: boolean): Promise<boolean> {
  const res = await fetch(`${BASE}/toggle-2fa`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ enabled }),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(pick<string>(data, "message", "Message") || "Could not update Two-Factor setting.");
  }

  return pick<boolean>(data, "twoFactorEnabled", "TwoFactorEnabled") === true;
}

/** Replaces this user's stored samples. */
export async function enrollFace(samples: number[][]): Promise<number> {
  const res = await fetch(`${BASE}/enroll`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ samples }),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    throw new Error(pick<string>(data, "message", "Message") || "Could not save your face.");
  }

  return pick<number>(data, "sampleCount", "SampleCount") ?? samples.length;
}

/** Deletes every stored sample for this user. */
export async function removeFace(): Promise<void> {
  const res = await fetch(`${BASE}/enroll`, {
    method: "DELETE",
    headers: authHeaders(),
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Could not turn off face verification.");
}

// ---------------------------------------------------------------------------
// Paired phones
// ---------------------------------------------------------------------------

/** One phone paired for face sign-in. */
export interface FaceDevice {
  id: number;
  deviceName: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/**
 * Phones paired to the signed-in account.
 *
 * There is deliberately no client function for PAIRING one: that happens on the
 * phone, through `api/auth/face-link/submit`, using a bearer token the desktop
 * never hands over. See `lib/faceLinkBridge.ts`.
 */
export async function listFaceDevices(): Promise<FaceDevice[]> {
  const res = await fetch(`${BASE}/devices`, {
    method: "GET",
    headers: authHeaders(),
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Could not load paired phones.");

  const data = (await res.json()) as Record<string, unknown>;
  const list = pick<Record<string, unknown>[]>(data, "devices", "Devices") ?? [];

  return list.map((raw) => ({
    id: pick<number>(raw, "id", "Id") ?? 0,
    deviceName: pick<string>(raw, "deviceName", "DeviceName") || "Phone",
    createdAt: pick<string>(raw, "createdAt", "CreatedAt") || "",
    lastUsedAt: pick<string>(raw, "lastUsedAt", "LastUsedAt") ?? null,
  }));
}

/** Unpairs a phone. Its face samples are untouched - only this device is revoked. */
export async function revokeFaceDevice(id: number): Promise<void> {
  const res = await fetch(`${BASE}/devices/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Could not unpair the phone.");
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

/**
 * The password step. Returns a full session when the account has no face
 * enrolled, so callers can use this unconditionally in place of `loginUser`.
 */
export async function faceLoginStart(userName: string, password: string): Promise<FaceLoginStart> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/login-start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userName, password }),
      cache: "no-store",
    });
  } catch {
    return { kind: "failed", message: "Connection failed. Please check your internet or API service status." };
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    return { kind: "failed", message: pick<string>(data, "message", "Message") || "Invalid username or password" };
  }

  if (pick<boolean>(data, "requiresFace", "RequiresFace") === true) {
    return {
      kind: "faceRequired",
      faceToken: pick<string>(data, "faceToken", "FaceToken") || "",
      attemptsLeft: pick<number>(data, "attemptsLeft", "AttemptsLeft") ?? 5,
      expiresInSeconds: pick<number>(data, "expiresInSeconds", "ExpiresInSeconds") ?? 120,
    };
  }

  return { kind: "session", session: toLoginResponse(data) };
}

/** The face step. Throws {@link FaceVerifyError} on a mismatch. */
export async function faceLoginVerify(faceToken: string, descriptor: number[]): Promise<LoginResponse> {
  const res = await fetch(`${BASE}/login-verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ faceToken, descriptor }),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    const attemptsLeft = pick<number>(data, "attemptsLeft", "AttemptsLeft") ?? null;
    throw new FaceVerifyError(
      pick<string>(data, "message", "Message") || "Face not recognised.",
      attemptsLeft,
      // No attempts field means the token is gone, not that the face was wrong.
      attemptsLeft === null
    );
  }

  return toLoginResponse(data);
}
