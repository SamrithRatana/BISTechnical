/**
 * @file services/permissionStore.ts
 * @description Central client-side permission store and reactive hook for
 * evaluating user permissions, module access, and role privileges.
 */

import { getUserRoles, ADMIN_ROLES, readToken, subscribeToSession, SESSION_CHANGED_EVENT } from "./authSession";

const PERMISSIONS_STORAGE_KEY = "user_permissions";
export const PERMISSIONS_CHANGED_EVENT = "user-permissions-changed";

export interface StoredPermissionItem {
  module: string;
  permission: string;
  displayName?: string;
  isAssigned: boolean;
}

export interface StoredUserPermissions {
  userId?: string;
  userName?: string;
  roles: string[];
  permissions: StoredPermissionItem[];
  timestamp: number;
}

// In-memory snapshot for useSyncExternalStore
let cachedPermissionsSnapshot: StoredUserPermissions | null = null;
let isFetchingPermissions = false;

/**
 * Reads cached permissions from localStorage safely (SSR safe).
 */
export function readCachedPermissions(): StoredUserPermissions | null {
  if (typeof window === "undefined") return null;
  if (cachedPermissionsSnapshot) return cachedPermissionsSnapshot;

  try {
    const raw = localStorage.getItem(PERMISSIONS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredUserPermissions;
    cachedPermissionsSnapshot = parsed;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Broadcasts permissions change in the current browser window.
 */
function notifyPermissionsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PERMISSIONS_CHANGED_EVENT));
  }
}

/**
 * Saves permissions to localStorage and notifies subscribers.
 */
export function saveCachedPermissions(data: StoredUserPermissions) {
  if (typeof window === "undefined") return;
  try {
    cachedPermissionsSnapshot = data;
    localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(data));
    notifyPermissionsChanged();
  } catch (err) {
    console.error("Failed to save permissions to localStorage:", err);
  }
}

/**
 * Clears cached permissions (e.g. on logout).
 */
export function clearCachedPermissions() {
  if (typeof window === "undefined") return;
  cachedPermissionsSnapshot = null;
  try {
    localStorage.removeItem(PERMISSIONS_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
  notifyPermissionsChanged();
}

/**
 * Fetches effective permissions for the currently logged-in user from UserManagementAPI.
 */
export async function fetchMyPermissions(forceRefresh = false): Promise<StoredUserPermissions | null> {
  if (typeof window === "undefined") return null;

  const token = readToken();
  if (!token) {
    clearCachedPermissions();
    return null;
  }

  // Return cached if not forced and still fresh (5 minutes)
  const cached = readCachedPermissions();
  if (!forceRefresh && cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    return cached;
  }

  if (isFetchingPermissions) {
    return cached;
  }

  isFetchingPermissions = true;

  try {
    const res = await fetch("/api/proxy/PermissionManagement/my-permissions?service=jwt", {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 401) {
        clearCachedPermissions();
      }
      return cached;
    }

    const json = await res.json();
    const data = json.Data || json;
    const rawPerms: Record<string, unknown>[] = (data.Permissions || data.permissions || []) as Record<string, unknown>[];

    const permissions: StoredPermissionItem[] = rawPerms.map((p) => ({
      module: String(p.Module || p.module || ""),
      permission: String(p.Permission || p.permission || ""),
      displayName: p.DisplayName ? String(p.DisplayName) : undefined,
      isAssigned: Boolean(p.IsAssigned ?? p.isAssigned ?? true),
    }));

    const result: StoredUserPermissions = {
      userId: data.UserId ? String(data.UserId) : undefined,
      userName: data.UserName ? String(data.UserName) : undefined,
      roles: (data.Roles || data.roles || getUserRoles()) as string[],
      permissions,
      timestamp: Date.now(),
    };

    saveCachedPermissions(result);
    return result;
  } catch (err) {
    console.warn("Failed to fetch my-permissions:", err);
    return cached;
  } finally {
    isFetchingPermissions = false;
  }
}

/**
 * Subscribes to permissions or session changes.
 */
export function subscribeToPermissions(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === PERMISSIONS_STORAGE_KEY) {
      cachedPermissionsSnapshot = null;
      onChange();
    }
  };

  const handleCustom = () => {
    onChange();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(PERMISSIONS_CHANGED_EVENT, handleCustom);
  window.addEventListener(SESSION_CHANGED_EVENT, handleCustom);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(PERMISSIONS_CHANGED_EVENT, handleCustom);
    window.removeEventListener(SESSION_CHANGED_EVENT, handleCustom);
  };
}

/**
 * Evaluates whether the current user has access to a specific module and action.
 *
 * Rules:
 * 1. If user is Admin or SuperAdmin -> ALWAYS GRANTED (true).
 * 2. If no moduleKey is required -> ALWAYS GRANTED (true).
 * 3. If requiredRoles are passed -> User must possess at least one of those roles.
 * 4. If moduleKey is passed:
 *    - Looks up user's assigned permissions for this module.
 *    - If action specified (e.g. "Create"), checks `Permissions.${moduleKey}.${action}`.
 *    - If action is "Access" or "View" (or not specified):
 *      Grants access if the user has `Access`, `View`, OR ANY assigned permission within that module!
 */
export function hasPermission(
  moduleKey?: string,
  action: "Access" | "View" | "Create" | "Edit" | "Delete" | "Print" | "Export" = "Access",
  requiredRoles?: readonly string[]
): boolean {
  if (typeof window === "undefined") return true;

  const roles = getUserRoles();
  const lowerRoles = roles.map((r) => r.toLowerCase());

  // 1. SuperAdmin and Admin have unrestricted access
  if (lowerRoles.includes("superadmin") || lowerRoles.includes("admin")) {
    return true;
  }

  // 2. If specific roles are required (e.g. ADMIN_ROLES)
  if (requiredRoles && requiredRoles.length > 0) {
    const hasRole = requiredRoles.some((r) => lowerRoles.includes(r.toLowerCase()));
    if (!hasRole) return false;
  }

  // 3. If no module requirement, grant access
  if (!moduleKey) {
    return true;
  }

  // 4. Check cached permissions
  const cached = readCachedPermissions();
  if (!cached || !cached.permissions || cached.permissions.length === 0) {
    // Trigger fetch in background if missing
    void fetchMyPermissions();
    return false;
  }

  const modulePerms = cached.permissions.filter(
    (p) => p.module.toLowerCase() === moduleKey.toLowerCase() && p.isAssigned
  );

  if (modulePerms.length === 0) {
    return false;
  }

  // If checking specific action other than general Access/View
  if (action && action !== "Access" && action !== "View") {
    const exactPerm = `permissions.${moduleKey}.${action}`.toLowerCase();
    return modulePerms.some((p) => p.permission.toLowerCase() === exactPerm);
  }

  // For general Access/View: Having Access, View, or ANY active permission in that module grants view access
  return modulePerms.length > 0;
}
