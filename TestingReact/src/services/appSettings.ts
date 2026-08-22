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
  if (brandingPromise) return brandingPromise;

  brandingPromise = (async () => {
    try {
      const res = await fetch("/api/proxy/AppSettings/branding?service=jwt", {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (!res.ok) return null;
      const data = (await res.json()) as GlobalBranding;
      return {
        logoUrl: data.logoUrl ?? null,
        accentColor: data.accentColor ?? null,
        logoScale: typeof data.logoScale === "number" ? data.logoScale : 130,
        surfaceStyle: data.surfaceStyle || "cushion",
      };
    } catch {
      return null;
    }
  })();

  const result = await brandingPromise;
  if (result) cachedBranding = result;
  brandingPromise = null;
  return result;
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
