/**
 * @file services/profileSync.ts
 * @description Re-reads the signed-in user's profile from the server and
 * refreshes `localStorage["user_info"]`, so an edit made on ANOTHER device
 * (the CAM ID mobile app's "Edit Info", a photo upload elsewhere) shows up
 * here without signing out and back in.
 *
 * Why this exists: `user_info` was written once at login and then trusted
 * forever. Mobile edits DO reach the server (`device/update-profile`), but the
 * portal never re-read, so the two sides drifted apart until the next login —
 * which read as "sync is broken" even though the server had the truth.
 *
 * Source endpoint: `GET api/auth/profile` (per-user, `[Authorize]`) — returns
 * PhoneNumber, ProfilePictureUrl (absolute), CoverUrl, names and roles in one
 * call. Session-cached with a TTL, same shape as `healthSnapshot`, because
 * `Header` remounts on every navigation and must not fetch each time.
 */

import { registerSessionCacheClearer } from "./authSession";

const PROFILE_TTL_MS = 60_000;
/** Fired on window after `user_info` is refreshed, for mounted listeners. */
export const USER_INFO_UPDATED_EVENT = "user_info_updated";

let lastSyncAt = 0;
let inflight: Promise<boolean> | null = null;

// Sign-in is a soft navigation, so module state survives a logout/login cycle
// in the same tab. A stale sync stamp from the previous account would delay
// the next account's first profile refresh by up to the TTL.
registerSessionCacheClearer(() => {
  lastSyncAt = 0;
  inflight = null;
});

interface ServerProfile {
  id?: string;
  userName?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  profilePictureUrl?: string;
  coverUrl?: string;
  roles?: string[];
}

function readToken(): string | null {
  try {
    return localStorage.getItem("jwt_token");
  } catch {
    return null;
  }
}

/** PascalCase-tolerant field read — the API serializes PascalCase. */
function pick<T>(obj: Record<string, unknown>, camel: string, pascal: string): T | undefined {
  return (obj[camel] ?? obj[pascal]) as T | undefined;
}

/**
 * Refreshes `user_info` from the server if the last sync is stale.
 * Returns true when a refresh actually happened. Failures are silent by
 * design: the cached copy keeps serving, same as before this service existed.
 */
export function syncUserProfile(options?: { force?: boolean }): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const token = readToken();
  if (!token) return Promise.resolve(false);
  if (!options?.force && Date.now() - lastSyncAt < PROFILE_TTL_MS) {
    return Promise.resolve(false);
  }
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch("/api/proxy/Auth/profile?service=jwt", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) return false;
      const body = (await res.json()) as Record<string, unknown>;
      const data = (pick<Record<string, unknown>>(body, "data", "Data") ?? body) as Record<string, unknown>;

      const fresh: ServerProfile = {
        id: pick<string>(data, "id", "Id"),
        userName: pick<string>(data, "userName", "UserName"),
        email: pick<string>(data, "email", "Email"),
        firstName: pick<string>(data, "firstName", "FirstName"),
        lastName: pick<string>(data, "lastName", "LastName"),
        phoneNumber: pick<string>(data, "phoneNumber", "PhoneNumber"),
        profilePictureUrl: pick<string>(data, "profilePictureUrl", "ProfilePictureUrl"),
        coverUrl: pick<string>(data, "coverUrl", "CoverUrl"),
        roles: pick<string[]>(data, "roles", "Roles"),
      };
      if (!fresh.userName) return false; // Unrecognizable payload — keep the cache.

      const existing = JSON.parse(localStorage.getItem("user_info") || "{}") as Record<string, unknown>;
      // Merge over the stored copy: fields this endpoint doesn't know about
      // (and the login page's brand-logo avatar substitution) survive unless
      // the server has a real value for them.
      const merged = {
        ...existing,
        id: fresh.id || existing.id,
        userName: fresh.userName,
        email: fresh.email ?? existing.email,
        firstName: fresh.firstName ?? existing.firstName,
        lastName: fresh.lastName ?? existing.lastName,
        phoneNumber: fresh.phoneNumber || existing.phoneNumber,
        profilePictureUrl: fresh.profilePictureUrl || existing.profilePictureUrl,
        coverUrl: fresh.coverUrl || existing.coverUrl,
        roles: fresh.roles?.length ? fresh.roles : existing.roles,
      };
      localStorage.setItem("user_info", JSON.stringify(merged));
      lastSyncAt = Date.now();
      window.dispatchEvent(new Event(USER_INFO_UPDATED_EVENT));
      return true;
    } catch {
      return false; // Offline / API down — the cached copy keeps serving.
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
