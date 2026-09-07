/**
 * @file authSession.ts
 * @description One place that answers "is this browser still logged in?".
 *
 * The app stored a JWT at login and from then on treated *the presence of the
 * string* as proof of a session. Nothing ever looked at the token's `exp`
 * claim, so once it lapsed the UI stayed fully logged in: menus, tables and
 * save buttons all rendered, while every request behind them failed. With
 * bearer validation switched on at the API (`Jwt:Enabled`), that turns into a
 * screen where nothing works and no explanation is given.
 *
 * Reading `exp` client-side is a *user-experience* check, not a security
 * boundary — a JWT payload is base64, not encrypted, and anyone can edit their
 * own copy. Enforcement lives in the API, which verifies the signature. This
 * only decides when to stop pretending and send the user back to the login
 * page.
 */

const TOKEN_KEY = "jwt_token";
const USER_KEY = "user_info";

/**
 * Treat a token as expired this long *before* its real deadline.
 *
 * Without the margin, a token with four seconds left passes the check, the
 * page renders, and the first save fails anyway. Expiring slightly early puts
 * the user on the login page while they can still act on it.
 */
const EXPIRY_LEEWAY_MS = 30_000;

/** The JWT claims this app reads. Everything else in the payload is ignored. */
interface JwtPayload {
  /** Expiry, in **seconds** since the epoch (RFC 7519) — not milliseconds. */
  exp?: number;
  /**
   * Role claims. ASP.NET Identity emits the long schema URI; other issuers use
   * the short name. A single role arrives as a string, several as an array.
   */
  role?: string | string[];
  roles?: string | string[];
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"?: string | string[];
}

/** Role names as defined in the User Management API (verified against it). */
export const ROLES = {
  admin: "Admin",
  superAdmin: "SuperAdmin",
  manager: "Manager",
  engineer: "Engineer",
  sales: "Sales",
  stock: "Stock",
  user: "User",
} as const;

/** Roles allowed into the user/role administration screens. */
export const ADMIN_ROLES: readonly string[] = [ROLES.admin, ROLES.superAdmin];

/**
 * Fired in *this* tab when the session changes (logout, expiry). The browser's
 * own `storage` event only reaches other tabs, so both are needed to keep every
 * subscriber in step.
 */
export const SESSION_CHANGED_EVENT = "auth-session-changed";

/** Subscribes to session changes in this tab and any other. */
export function subscribeToSession(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    // Only fire for auth-session keys (token, user info) or full clear (key is null).
    // Non-session writes (like theme, cache, timers) must not trigger session re-sync.
    if (e.key === null || e.key === TOKEN_KEY || e.key === USER_KEY) {
      onChange();
    }
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(SESSION_CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SESSION_CHANGED_EVENT, onChange);
  };
}

/**
 * Decodes a JWT payload without verifying it.
 *
 * Uses base64**url** decoding: JWTs replace `+` and `/` with `-` and `_`, and
 * drop the `=` padding. Passing that straight to `atob` throws on any token
 * whose payload happens to contain those characters — an intermittent failure
 * that looks like a corrupt login rather than a decoding bug.
 */
function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

    return JSON.parse(atob(padded)) as JwtPayload;
  } catch {
    return null; // malformed token — the caller decides what that means
  }
}

/**
 * Whether `token` is past its expiry (or so close as to be unusable).
 *
 * A token with no readable `exp` is treated as **valid**. Some issuers omit it,
 * and refusing to log those users in would be a worse failure than letting the
 * API reject an expired one — the API is the authority either way.
 */
export function isTokenExpired(token: string | null | undefined): boolean {
  if (!token) return true;

  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return false;

  return Date.now() >= payload.exp * 1_000 - EXPIRY_LEEWAY_MS;
}

/** Milliseconds until `token` expires; null if it has none or is unreadable. */
export function millisecondsUntilExpiry(token: string | null | undefined): number | null {
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return null;

  return payload.exp * 1_000 - EXPIRY_LEEWAY_MS - Date.now();
}

/** The stored token, or null. Safe during SSR. */
export function readToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // storage disabled (private mode, blocked cookies)
  }
}

/**
 * A usable session: a token that exists *and* has not expired.
 * This is what the app should branch on, never `readToken() !== null`.
 */
export function hasValidSession(): boolean {
  const token = readToken();
  return Boolean(token) && !isTokenExpired(token);
}

/** Normalises one claim value (string, array, or absent) into a string array. */
function toRoleArray(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}

/**
 * Every role this browser's session claims, from both sources available.
 *
 * Two sources on purpose. `user_info.roles` is written at login from a lookup
 * against the User Management API — and that lookup reads only the first 100
 * users and silently falls back to `["User"]` when it fails or the account
 * isn't on that first page. Gating on it alone would demote a real
 * administrator to a normal user on any hiccup. The JWT's role claims come
 * from the identity server that issued the token and don't depend on that
 * lookup, so they're the more trustworthy half.
 *
 * Returns the union, de-duplicated. An empty array means "no role information
 * at all" — which is different from "this user has no roles", and callers
 * treat it as such.
 */
export function getUserRoles(): string[] {
  if (typeof window === "undefined") return [];

  const roles = new Set<string>();

  try {
    const payload = decodeJwtPayload(readToken() ?? "");
    if (payload) {
      for (const claim of [
        payload.role,
        payload.roles,
        payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"],
      ]) {
        for (const role of toRoleArray(claim)) roles.add(role);
      }
    }
  } catch {
    /* unreadable token — fall through to user_info */
  }

  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) {
      for (const role of toRoleArray((JSON.parse(raw) as { roles?: unknown }).roles)) {
        roles.add(role);
      }
    }
  } catch {
    /* malformed user_info is not worth failing a render over */
  }

  return [...roles];
}

/**
 * Whether the session holds any of `allowed` (case-insensitive).
 *
 * **This is a UX gate, not a security boundary.** Roles are read from the
 * browser's own storage, which the user controls; anyone can edit them. It
 * decides whether to *show* a screen. What actually protects the data is
 * authorization on the API — see `Jwt:Enabled` in the API's appsettings.
 *
 * When no role information is available at all, this returns true. Locking a
 * genuine administrator out because a lookup failed is the worse failure of
 * the two, and the API remains the real check either way.
 */
export function hasAnyRole(allowed: readonly string[]): boolean {
  const roles = getUserRoles();
  if (roles.length === 0) return false; // Strict security: fail closed, deny unauthorized access

  const normalised = new Set(roles.map((r) => r.toLowerCase()));
  return allowed.some((role) => normalised.has(role.toLowerCase()));
}

/**
 * In-memory caches that must be emptied along with the session.
 *
 * A registry rather than a direct import, for two reasons: `services/api.ts` is
 * 60 KB and importing it here would drag it into every bundle that only wanted
 * to read a token, and importing it *from* here would close an import cycle.
 * Each cache owner registers itself at module load; a module that never loaded
 * has no cache to clear, so an unregistered clearer is not a missed one.
 */
type SessionCacheClearer = () => void;
const sessionCacheClearers = new Set<SessionCacheClearer>();

/** Registers a cache to be emptied by `clearSession()`. Returns an unsubscribe. */
export function registerSessionCacheClearer(clear: SessionCacheClearer): () => void {
  sessionCacheClearers.add(clear);
  return () => sessionCacheClearers.delete(clear);
}

/**
 * Drops the stored session.
 *
 * Also clears the cached API responses: they were fetched as the previous user
 * and holding them across a logout would show one person's ticket queue to
 * whoever logs in next on the same machine — a shared-workstation risk in a
 * service workshop.
 *
 * ── The half of that which used to be missing ──────────────────────────────
 *
 * Only the `sessionStorage` copy was cleared. `services/api.ts` keeps a SECOND,
 * in-memory copy in a module-scope `Map`, and `getCached` reads memory FIRST —
 * so the sweep below never reached the copy that actually answers. Logout ends
 * in `router.push("/login")`, a client-side navigation that does not reload the
 * page, so module state survives it intact.
 *
 * The result was measurable: signing in as a second user on the same tab served
 * the FIRST user's ticket queues and dashboard stats out of memory in ~1ms.
 * That looked like "the second account is faster" and was really one account
 * reading another's data. Both halves are cleared now.
 */
export function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem("last_workspace_sync_time");
    sessionStorage.removeItem("workspace_pipeline_synced");
    sessionStorage.removeItem("robot_greeted");

    for (const clear of sessionCacheClearers) {
      try {
        clear();
      } catch {
        // One cache failing to clear must not leave the rest populated.
      }
    }

    // Terminate and delete mobile companion scanner session
    const scannerSessionId = localStorage.getItem("companion_scanner_session_id");
    if (scannerSessionId) {
      try {
        fetch("/api/scanner/emit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: scannerSessionId, type: "terminate" }),
          keepalive: true,
        }).catch(() => {});
      } catch {}
      localStorage.removeItem("companion_scanner_session_id");
    }

    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith("cache:") || key.startsWith("inf_list_")) {
        sessionStorage.removeItem(key);
      }
    }

    // Notify all tab stores and subscribers immediately (Frame 0)
    window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

export { TOKEN_KEY, USER_KEY };
