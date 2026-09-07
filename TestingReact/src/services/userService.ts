/**
 * @file userService.ts
 * @description Fetches user details from JWT User Management API (user.camprotec.com.kh)
 * and resolves User GUIDs (createBy, inspectBy, repairBy, verifiedBy, etc.) to full names.
 */

import { RepairServiceItem, calculateDaysTaken } from "./types";
import { registerSessionCacheClearer } from "./authSession";

export interface UserDto {
  id: string;
  userName: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  profilePictureUrl?: string;
  roles?: string[];
}

let cachedUserMap: Map<string, UserDto> | null = null;
let userMapPromise: Promise<Map<string, UserDto>> | null = null;

/**
 * When the last lookup came back empty, and how long that is remembered.
 *
 * `fetchUserMap` only treats a NON-EMPTY map as cached — deliberately, because
 * an empty one carries no names and every `resolveUserNameSync` against it
 * returns "". But a lookup that fails (the loop `break`s on `!res.ok`) or
 * genuinely returns no rows also stores an empty map, so the guard never
 * tripped and every single caller re-issued the request.
 *
 * Measured on a production build: four calls on one dashboard load and roughly
 * one more per navigation, all failing, forever. Exactly the wrong behaviour —
 * the app hammered the user API hardest at the moment it was already unwell.
 *
 * A short negative cache fixes that without making a real outage sticky: an
 * empty result is remembered for a minute, then one caller is allowed to try
 * again. A successful lookup still caches for the rest of the session and
 * clears this.
 */
let userMapEmptyAt = 0;
const USER_MAP_EMPTY_TTL_MS = 60_000;

/** Returned on the negative-cache path so a miss allocates nothing. */
const EMPTY_USER_MAP: Map<string, UserDto> = new Map();

/**
 * Headers for the User Management API, including the bearer token.
 *
 * This call used to send `Accept` only. That worked because
 * `UserManagementController` had no `[Authorize]` attribute at all — the whole
 * controller, including create/delete user and role assignment, served
 * anonymous callers. Now that the controller requires a signed-in caller, the
 * token has to go with the request: the proxy route only forwards an
 * `Authorization` header when the browser actually sent one.
 *
 * Same storage key and shape as `getAuthHeaders()` in `services/api.ts`.
 */
function buildUserApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("jwt_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Drops the cached user map, so the next `fetchUserMap()` call refetches.
 *
 * `fetchUserMap` has no TTL — once populated it serves the same map for the
 * rest of the tab's session. That's fine for names/roles, which rarely
 * change mid-session, but it means a just-uploaded profile photo would
 * otherwise be silently overwritten by the stale cached URL on every
 * subsequent page's `Header` mount. Call this right after any write that
 * changes a field this map carries.
 */
/**
 * The resolved-users map is per-session too: it is fetched with the signed-in
 * user's token and decides which names appear on tickets. Registered here so
 * `clearSession()` drops it with everything else — before this it survived a
 * sign-out, because logout never reloads the page.
 */
registerSessionCacheClearer(() => invalidateUserMapCache());

export function invalidateUserMapCache(): void {
  cachedUserMap = null;
  userMapPromise = null;
  // Also clears the negative cache: an explicit invalidation is a caller
  // saying the data changed, which is a reason to retry immediately.
  userMapEmptyAt = 0;
}

/**
 * Fetches all users from GET /api/proxy/UserManagement?service=jwt
 * and returns a Map keyed by lowercase User ID.
 */
export async function fetchUserMap(): Promise<Map<string, UserDto>> {
  if (cachedUserMap && cachedUserMap.size > 0) {
    return cachedUserMap;
  }
  if (userMapPromise) {
    return userMapPromise;
  }
  if (userMapEmptyAt && Date.now() - userMapEmptyAt < USER_MAP_EMPTY_TTL_MS) {
    return cachedUserMap || EMPTY_USER_MAP;
  }

  userMapPromise = (async () => {
    /**
     * Page size and hard page cap. The cap is a runaway guard, not a product
     * decision: a broken `HasNext` that never turns false used to mean an
     * unbounded loop.
     */
    const PAGE_SIZE = 100;
    const MAX_PAGES = 10;

    interface PaginationInfo {
      TotalPages?: number;
      TotalCount?: number;
      HasNext?: boolean;
    }

    /** One page -> DTOs. Extracted so the first page and the parallel rest share it. */
    const readPage = async (page: number): Promise<{ users: UserDto[]; pagination: PaginationInfo | undefined } | null> => {
      const res = await fetch(`/api/proxy/UserManagement?service=jwt&page=${page}&pageSize=${PAGE_SIZE}`, {
        headers: buildUserApiHeaders(),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as Record<string, unknown>;
      const rawUsers: Record<string, unknown>[] = (data.Data || data.items || (Array.isArray(data) ? data : [])) as Record<string, unknown>[];
      if (!rawUsers || rawUsers.length === 0) return { users: [], pagination: data.Pagination as PaginationInfo | undefined };
      const users = rawUsers
        .map((raw): UserDto | null => {
          const userId = String(raw.id || raw.Id || "").trim();
          if (!userId) return null;
          return {
            id: userId,
            userName: String(raw.userName || raw.UserName || ""),
            email: String(raw.email || raw.Email || ""),
            firstName: String(raw.firstName || raw.FirstName || ""),
            lastName: String(raw.lastName || raw.LastName || ""),
            phoneNumber: String(raw.phoneNumber || raw.PhoneNumber || ""),
            profilePictureUrl: (raw.profilePictureUrl || raw.ProfilePictureUrl || undefined) as string | undefined,
            roles: ((raw.roles || raw.Roles || []) as string[]),
          };
        })
        .filter((u): u is UserDto => u !== null);
      return { users, pagination: data.Pagination as PaginationInfo | undefined };
    };

    try {
      const map = new Map<string, UserDto>();
      const add = (dto: UserDto) => {
        map.set(dto.id.toLowerCase(), dto);
        if (dto.userName) map.set(dto.userName.toLowerCase(), dto);
      };

      const first = await readPage(1);
      if (!first) {
        cachedUserMap = map;
        userMapPromise = null;
        userMapEmptyAt = Date.now();
        return map;
      }
      first.users.forEach(add);

      /**
       * Pages 2..N in PARALLEL, not one after another.
       *
       * This loop used to be `while (hasMore) { await fetch(...) }`, which is a
       * serial chain: every page waited for the one before it. Each page is a
       * browser -> Next proxy -> UserManagementAPI -> SQL Server round trip, and
       * that database is remote, so a page costs ~300ms of mostly latency.
       *
       * It is also the reason signing in as an administrator felt slow while an
       * ordinary account felt instant, on identical code: the account's own
       * permissions decide how many users come back, so an admin who can see
       * every user paid 5-10 sequential round trips (1.5-3s) where a limited
       * account paid one. Nothing about the admin was heavier — it was just
       * further down the same serial chain.
       *
       * Fetching the remainder concurrently makes the cost ~2 round trips
       * regardless of headcount. `allSettled`, so one failed page degrades to a
       * partial map rather than losing every user.
       */
      const pag = first.pagination;
      const totalPages: number | null =
        typeof pag?.TotalPages === "number"
          ? pag.TotalPages
          : typeof pag?.TotalCount === "number"
            ? Math.ceil(pag.TotalCount / PAGE_SIZE)
            : null;

      if (totalPages !== null) {
        const last = Math.min(totalPages, MAX_PAGES);
        if (last > 1) {
          const rest = await Promise.allSettled(
            Array.from({ length: last - 1 }, (_, i) => readPage(i + 2))
          );
          rest.forEach((r) => {
            if (r.status === "fulfilled" && r.value) r.value.users.forEach(add);
          });
        }
      } else if (pag?.HasNext) {
        // The API did not report a total, so fall back to the original serial
        // walk. Correctness first: without a total there is no safe page count
        // to fan out over.
        let page = 2;
        let hasMore = true;
        while (hasMore && page <= MAX_PAGES) {
          const next = await readPage(page);
          if (!next || next.users.length === 0) break;
          next.users.forEach(add);
          hasMore = Boolean(next.pagination?.HasNext);
          page++;
        }
      }

      cachedUserMap = map;
      userMapPromise = null;
      userMapEmptyAt = map.size > 0 ? 0 : Date.now();
      return map;
    } catch (err) {
      console.warn("⚠️ Failed to fetch UserManagement API users:", err);
      userMapPromise = null;
      userMapEmptyAt = Date.now();
      return cachedUserMap || EMPTY_USER_MAP;
    }
  })();

  return userMapPromise;
}

/**
 * Fetches unique list of users from User Management (deduplicated by User ID).
 */
export async function fetchUsersList(): Promise<UserDto[]> {
  const map = await fetchUserMap();
  const seen = new Set<string>();
  const list: UserDto[] = [];
  for (const u of map.values()) {
    const key = (u.id || "").toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      list.push(u);
    }
  }
  return list;
}

/** Formats a UserDto into a display full name */
export function formatUserName(user?: UserDto | { firstName?: string; lastName?: string; userName?: string; FirstName?: string; LastName?: string; UserName?: string }): string {
  if (!user) return "";
  const fn = String(user.firstName || (user as any).FirstName || "").trim();
  const ln = String(user.lastName || (user as any).LastName || "").trim();
  const fullName = `${fn} ${ln}`.trim();
  return fullName || user.userName || (user as any).UserName || "";
}

/**
 * Returns the currently logged-in user's full name ("FirstName LastName", e.g. "Vun Navin").
 * Always prioritizes FirstName + LastName over userName ("NavinCAM").
 */
export function getCurrentUserFullName(): string {
  if (typeof window === "undefined") return "Staff";
  try {
    const raw = localStorage.getItem("user_info");
    if (raw) {
      const u = JSON.parse(raw);
      const fn = String(u.firstName || u.FirstName || "").trim();
      const ln = String(u.lastName || u.LastName || "").trim();
      const full = `${fn} ${ln}`.trim();
      if (full) return full;
      if (u.name && String(u.name).trim()) return String(u.name).trim();
      if (u.userName && String(u.userName).trim()) return String(u.userName).trim();
    }
  } catch {}
  return "Staff";
}

/** Resolves a single User GUID to full name using cachedUserMap synchronously if available */
export function resolveUserNameSync(userId?: string): string {
  if (!userId || userId === "00000000-0000-0000-0000-000000000000") return "";
  if (!cachedUserMap) return "";
  const user = cachedUserMap.get(userId.toLowerCase());
  return user ? formatUserName(user) : "";
}

/** Resolves a single User GUID to phone number */
export function resolveUserPhoneSync(userId?: string): string {
  if (!userId || userId === "00000000-0000-0000-0000-000000000000") return "";
  if (!cachedUserMap) return "";
  const user = cachedUserMap.get(userId.toLowerCase());
  return user?.phoneNumber || "";
}

/**
 * Enriches a RepairServiceItem with resolved user names for all GUID fields
 */
export function enrichTicketUsers(item: RepairServiceItem, userMap: Map<string, UserDto>): RepairServiceItem {
  if (!item) return item;

  const get = (guid?: string) => {
    if (!guid || guid === "00000000-0000-0000-0000-000000000000") return "";
    const u = userMap.get(guid.toLowerCase());
    return u ? formatUserName(u) : "";
  };

  const getPhone = (guid?: string) => {
    if (!guid || guid === "00000000-0000-0000-0000-000000000000") return "";
    const u = userMap.get(guid.toLowerCase());
    return u?.phoneNumber || "";
  };

  const createdByName = item.createdByName || get(item.createBy || item.userId);
  const createdByPhone = item.createdByPhone || getPhone(item.createBy || item.userId);
  const inspectByName = item.inspectByName || get(item.inspectBy || item.inspectingBy);
  const setAwaitingCustomerConfirmByName = item.setAwaitingCustomerConfirmByName || get(item.setAwaitingCustomerConfirmBy);
  const setAwaitingSparepartByName = item.setAwaitingSparepartByName || get(item.setAwaitingSparepartBy);
  const setSaleConfirmedByName = item.setSaleConfirmedByName || get(item.setSaleConfirmedBy);
  const setSentSparepartsByName = item.setSentSparepartsByName || get(item.setSentSparepartsBy);
  const repairByName = item.repairByName || item.repairByUserName || get(item.repairBy);
  const repairByPhone = item.repairByPhone || getPhone(item.repairBy);
  const thirdPartyRepairByName = item.thirdPartyRepairByName || get(item.thirdPartyRepairBy);
  const verifiedByName = item.verifiedByName || get(item.verifiedBy);
  const setCustomerRejectedByName = item.setCustomerRejectedByName || get(item.setCustomerRejectedBy);
  const setUnrepairableByName = item.setUnrepairableByName || get(item.setUnrepairableBy);

  const daysTaken = item.daysTaken ?? calculateDaysTaken(item) ?? undefined;

  return {
    ...item,
    daysTaken,
    createdByName,
    createdByPhone,
    inspectByName,
    setAwaitingCustomerConfirmByName,
    setAwaitingSparepartByName,
    setSaleConfirmedByName,
    setSentSparepartsByName,
    repairByName,
    repairByPhone,
    thirdPartyRepairByName,
    verifiedByName,
    setCustomerRejectedByName,
    setUnrepairableByName,
  };
}

/**
 * Resolves the logged-in user's GUID from localStorage / JWT token claims.
 */
export function getCurrentUserGuid(): string | null {
  if (typeof window === "undefined") return null;

  try {
    // 1. Try saved user_info object
    const rawUserInfo = localStorage.getItem("user_info");
    if (rawUserInfo) {
      const parsed = JSON.parse(rawUserInfo);
      if (parsed.id) return parsed.id;
    }

    // 2. Try JWT token payload claims
    const token = localStorage.getItem("jwt_token");
    if (token) {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        const id =
          payload.nameid ||
          payload.sub ||
          payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] ||
          payload["id"] ||
          payload["user_id"] ||
          payload["user_guid"];
        if (id) return id;
      }
    }
  } catch (e) {
    console.warn("Could not resolve current user GUID:", e);
  }

  return null;
}

/**
 * Updates the user's profile information via the UserManagement API.
 */
export async function updateUserProfile(
  userId: string,
  data: {
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    email?: string;
    userName?: string;
  }
): Promise<{ success: boolean; message?: string; errors?: string[] }> {
  try {
    const headers = buildUserApiHeaders();
    headers["Content-Type"] = "application/json";

    const res = await fetch(`/api/proxy/UserManagement/${encodeURIComponent(userId)}?service=jwt`, {
      method: "PUT",
      headers,
      body: JSON.stringify(data),
    });

    const json = await res.json();
    if (!res.ok) {
      return {
        success: false,
        message: json.message || "Failed to update profile",
        errors: json.errors || [],
      };
    }

    // Invalidate caches
    invalidateUserMapCache();

    return {
      success: true,
      message: json.message || "Profile updated successfully!",
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Network error updating profile",
    };
  }
}

/**
 * Changes the authenticated user's password via the Auth API.
 */
export async function changeUserPassword(data: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ success: boolean; message?: string; errors?: string[] }> {
  try {
    const headers = buildUserApiHeaders();
    headers["Content-Type"] = "application/json";

    const res = await fetch(`/api/proxy/auth/change-password?service=jwt`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      return {
        success: false,
        message: json.message || json.Message || "Failed to change password",
        errors: json.errors || json.Errors || [],
      };
    }

    return {
      success: true,
      message: json.message || json.Message || "Password changed successfully!",
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Network error changing password",
    };
  }
}
