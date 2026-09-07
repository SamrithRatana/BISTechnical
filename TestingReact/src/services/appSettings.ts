/**
 * @file services/appSettings.ts
 * @description System-wide settings shared by every signed-in user —
 * currently just the sidebar logo. Backed by `UserManagementAPI`'s new
 * `AppSettingsController`, which is the one place this app persists a
 * setting server-side rather than per-browser in `localStorage` (everything
 * under Settings → Theme & Branding is deliberately per-device — see
 * `theme/themeConfig.ts` — because THAT is a personal preference; a logo
 * every user should see is not).
 *
 * Cached at module scope, same shape as `userService.ts`'s `fetchUserMap` —
 * `Sidebar` is rendered by every page and remounts on each navigation (see
 * `PageWrapper.tsx`), so without this every navigation would cost a fresh
 * fetch instead of one per session.
 */

export interface GlobalBranding {
  logoUrl: string | null;
  accentColor: string | null;
  logoScale: number;
  surfaceStyle: string;
}

let cachedBranding: GlobalBranding | null = null;
let brandingPromise: Promise<GlobalBranding | null> | null = null;
/**
 * Negative cache (same convention as `fetchUserMap`'s USER_MAP_EMPTY_TTL_MS):
 * Sidebar calls `fetchAppLogoUrl` on every mount and Sidebar remounts on every
 * navigation, so with the branding endpoint down every route change was a
 * fresh request, forever, with no backoff.
 */
let brandingFailedAt = 0;
const BRANDING_RETRY_MS = 60_000;

const LOCAL_STORAGE_BRANDING_KEY = "system_branding_cache";

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("jwt_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/** Fetches global company branding from server (Public endpoint, works before and after login) */
export async function fetchGlobalBranding(): Promise<GlobalBranding | null> {
  if (cachedBranding) return cachedBranding;

  // Hydrate from localStorage immediately if available for 0ms initial render
  if (typeof window !== "undefined" && !cachedBranding) {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_BRANDING_KEY);
      if (stored) {
        cachedBranding = JSON.parse(stored) as GlobalBranding;
      }
    } catch {}
  }

  if (brandingPromise) return brandingPromise;
  if (brandingFailedAt && Date.now() - brandingFailedAt < BRANDING_RETRY_MS) {
    return cachedBranding;
  }

  brandingPromise = (async () => {
    try {
      const res = await fetch("/api/proxy/AppSettings/branding?service=jwt", {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (!res.ok) return cachedBranding;
      const data = (await res.json()) as GlobalBranding;
      const result: GlobalBranding = {
        logoUrl: data.logoUrl ?? null,
        accentColor: data.accentColor ?? null,
        logoScale: typeof data.logoScale === "number" ? data.logoScale : 130,
        surfaceStyle: data.surfaceStyle || "cushion",
      };
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(LOCAL_STORAGE_BRANDING_KEY, JSON.stringify(result));
        } catch {}
      }
      return result;
    } catch {
      return cachedBranding;
    }
  })();

  const result = await brandingPromise;
  if (result) {
    cachedBranding = result;
    brandingFailedAt = 0;
  } else {
    brandingFailedAt = Date.now();
  }
  brandingPromise = null;
  return cachedBranding;
}

/** Updates global branding in SQL Server database (Admin/SuperAdmin only) */
export async function updateGlobalBranding(patch: Partial<GlobalBranding>): Promise<boolean> {
  try {
    const res = await fetch("/api/proxy/AppSettings/branding?service=jwt", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      if (cachedBranding) {
        cachedBranding = { ...cachedBranding, ...patch };
      }
      if (typeof window !== "undefined") {
        try {
          if (cachedBranding) {
            localStorage.setItem(LOCAL_STORAGE_BRANDING_KEY, JSON.stringify(cachedBranding));
          }
        } catch {}
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** The current app logo URL, or `null` if none is set / the fetch failed. */
export async function fetchAppLogoUrl(): Promise<string | null> {
  const b = await fetchGlobalBranding();
  return b?.logoUrl ?? null;
}

/** Admin-only server-side; a non-admin caller gets a 403 from the API. */
export async function updateAppLogoUrl(url: string): Promise<boolean> {
  return await updateGlobalBranding({ logoUrl: url });
}

/**
 * True when a bearer token exists. The `user-theme` endpoints are per-user and
 * reject anonymous calls, and `ThemeProvider`/`PerformanceProvider` mount on
 * every page including `/login` — calling them signed out guaranteed 401s and
 * matching console errors on each login-page visit. Storage read inside the
 * try: `localStorage` itself throws when storage is blocked.
 */
function hasAuthToken(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(localStorage.getItem("jwt_token"));
  } catch {
    return false;
  }
}

export async function fetchUserThemePreferences(): Promise<string | null> {
  if (!hasAuthToken()) return null;
  try {
    const res = await fetch("/api/proxy/AppSettings/user-theme?service=jwt", {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.themePreferencesJson ?? null;
  } catch {
    return null;
  }
}

/**
 * Persists the authenticated user's personal theme preferences to database
 */
export async function updateUserThemePreferences(themeJson: string): Promise<boolean> {
  // Same guard as the read path: accepting the Lite Mode prompt on /login
  // used to PUT to this per-user endpoint and collect the very 401 the
  // fetch-side guard removed.
  if (!hasAuthToken()) return false;
  try {
    const res = await fetch("/api/proxy/AppSettings/user-theme?service=jwt", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ themePreferencesJson: themeJson }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
