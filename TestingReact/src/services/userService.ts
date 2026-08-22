/**
 * @file userService.ts
 * @description Fetches user details from JWT User Management API (user.camprotec.com.kh)
 * and resolves User GUIDs (createBy, inspectBy, repairBy, verifiedBy, etc.) to full names.
 */

import { RepairServiceItem, calculateDaysTaken } from "./types";

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
    try {
      const map = new Map<string, UserDto>();
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const res = await fetch(`/api/proxy/UserManagement?service=jwt&page=${page}&pageSize=100`, {
          headers: buildUserApiHeaders(),
        });
        if (!res.ok) break;

        const data = await res.json();
        const rawUsers: any[] = data.Data || data.items || (Array.isArray(data) ? data : []);
        if (!rawUsers || rawUsers.length === 0) break;

        rawUsers.forEach((raw) => {
          const userId = String(raw.id || raw.Id || "").trim();
          if (userId) {
            const dto: UserDto = {
              id: userId,
              userName: raw.userName || raw.UserName || "",
              email: raw.email || raw.Email || "",
              firstName: raw.firstName || raw.FirstName || "",
              lastName: raw.lastName || raw.LastName || "",
              phoneNumber: raw.phoneNumber || raw.PhoneNumber || "",
              profilePictureUrl: raw.profilePictureUrl || raw.ProfilePictureUrl || null,
              roles: raw.roles || raw.Roles || [],
            };
            map.set(userId.toLowerCase(), dto);
            if (dto.userName) {
              map.set(dto.userName.toLowerCase(), dto);
            }
          }
        });

        hasMore = Boolean(data.Pagination?.HasNext);
        page++;
        if (page > 10) break;
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

/** Formats a UserDto into a display full name */
export function formatUserName(user?: UserDto): string {
  if (!user) return "";
  const fn = (user.firstName || "").trim();
  const ln = (user.lastName || "").trim();
  const fullName = `${fn} ${ln}`.trim();
  return fullName || user.userName || "";
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
