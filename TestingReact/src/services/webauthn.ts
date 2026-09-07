/**
 * @file services/webauthn.ts
 * @description Typed client for passkey sign-in and device management.
 *
 * Sits between the React components and two things they should not each have to
 * know about: the three-step shape of a WebAuthn ceremony (ask for options, run
 * the browser prompt, post the result back), and the fact that the User
 * Management API answers in PascalCase.
 *
 * That casing is not a quirk to tidy up - `Program.cs` sets
 * `PropertyNamingPolicy = null` for the whole API on purpose, and the passkey
 * proxy route forwards bodies through verbatim rather than re-serialising them,
 * so the PascalCase arrives here intact. Normalising happens once, here, so the
 * rest of the app keeps seeing the same camelCase `LoginResponse` the password
 * path produces.
 */

import { createPasskey, getPasskeyAssertion, PasskeyError, describeThisDevice } from "@/lib/webauthn";
import { readToken } from "@/services/authSession";
import type { LoginResponse } from "@/services/types";

/** One enrolled device, as shown in Settings. */
export interface PasskeySummary {
  id: number;
  deviceName: string;
  /** True when a passkey provider syncs this credential to the user's other devices. */
  isBackedUp: boolean;
  transports: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

const BASE = "/api/auth/webauthn";

/** Reads a value that may have arrived in either casing. */
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

async function postJson(path: string, body: unknown, withAuth: boolean): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: withAuth ? authHeaders() : { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    const message = pick<string>(data, "message", "Message") || "Request failed.";
    throw new PasskeyError("failed", message);
  }

  return data;
}

/**
 * Starts a ceremony and hands back the options object the browser needs, plus
 * the id that ties the follow-up request to the challenge the server is holding.
 */
async function beginCeremony(
  path: string,
  body: unknown,
  withAuth: boolean
): Promise<{ ceremonyId: string; options: Record<string, unknown> }> {
  const data = await postJson(path, body, withAuth);

  const ceremonyId = pick<string>(data, "ceremonyId", "CeremonyId");
  const options = pick<Record<string, unknown>>(data, "options", "Options");

  if (!ceremonyId || !options) {
    throw new PasskeyError("failed", "The server did not return a usable challenge.");
  }

  return { ceremonyId, options };
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

/**
 * Signs in with a passkey.
 *
 * `userName` is optional and usually should be omitted: with no username the
 * browser offers whichever passkeys the device holds and the account is resolved
 * from the credential itself, which is the whole point of the feature. Passing
 * one narrows the prompt to that account, which is worth doing only on a shared
 * machine holding several people's passkeys.
 *
 * Returns the same `LoginResponse` shape as `loginUser`, so a caller can run the
 * identical post-sign-in pipeline either way.
 */
export async function loginWithPasskey(userName?: string): Promise<LoginResponse> {
  const trimmed = userName?.trim();
  const { ceremonyId, options } = await beginCeremony(
    "login-options",
    trimmed ? { userName: trimmed } : {},
    false
  );

  const credential = await getPasskeyAssertion(options);
  const data = await postJson("login", { ceremonyId, credential }, false);

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
// Device management
// ---------------------------------------------------------------------------

function normalizeCredential(raw: Record<string, unknown>): PasskeySummary {
  return {
    id: pick<number>(raw, "id", "Id") ?? 0,
    deviceName: pick<string>(raw, "deviceName", "DeviceName") || "Passkey",
    isBackedUp: pick<boolean>(raw, "isBackedUp", "IsBackedUp") === true,
    transports: pick<string>(raw, "transports", "Transports") ?? null,
    createdAt: pick<string>(raw, "createdAt", "CreatedAt") || "",
    lastUsedAt: pick<string>(raw, "lastUsedAt", "LastUsedAt") ?? null,
  };
}

/** The signed-in user's enrolled devices, newest first. */
export async function listPasskeys(): Promise<PasskeySummary[]> {
  const res = await fetch(`${BASE}/credentials`, {
    method: "GET",
    headers: authHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new PasskeyError("failed", "Could not load passkeys.");
  }

  const data = (await res.json()) as Record<string, unknown>;
  const list = pick<Record<string, unknown>[]>(data, "credentials", "Credentials") ?? [];
  return list.map(normalizeCredential);
}

/**
 * Enrols the current device (or a phone scanned from it) against the signed-in
 * account.
 *
 * Requires an existing session - the bearer token is what authorises attaching a
 * new device, which is why this cannot be offered on the login screen to someone
 * who is not signed in yet.
 */
export async function addPasskey(deviceName?: string): Promise<PasskeySummary> {
  const { ceremonyId, options } = await beginCeremony("register-options", {}, true);

  const credential = await createPasskey(options);

  const data = await postJson(
    "register",
    {
      ceremonyId,
      deviceName: deviceName?.trim() || describeThisDevice(),
      credential,
    },
    true
  );

  const raw = pick<Record<string, unknown>>(data, "credential", "Credential");
  if (!raw) {
    throw new PasskeyError("failed", "The passkey was not saved.");
  }

  return normalizeCredential(raw);
}

/** Removes one of the signed-in user's passkeys. */
export async function removePasskey(id: number): Promise<void> {
  const res = await fetch(`${BASE}/credentials/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new PasskeyError("failed", "Could not remove the passkey.");
  }
}
