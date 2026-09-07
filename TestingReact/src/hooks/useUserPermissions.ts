"use client";

import { useSyncExternalStore, useEffect, useCallback } from "react";
import {
  readCachedPermissions,
  subscribeToPermissions,
  fetchMyPermissions,
  hasPermission,
  type StoredUserPermissions,
} from "@/services/permissionStore";

function getSnapshot(): StoredUserPermissions | null {
  return readCachedPermissions();
}

function getServerSnapshot(): StoredUserPermissions | null {
  return null;
}

/**
 * Reactive hook for tracking user permissions.
 * Automatically fetches fresh permissions from UserManagementAPI when mounted or session changes.
 */
export function useUserPermissions() {
  const permissionsData = useSyncExternalStore(
    subscribeToPermissions,
    getSnapshot,
    getServerSnapshot
  );

  useEffect(() => {
    // Ensure permissions are fetched on mount
    void fetchMyPermissions();
  }, []);

  const hasPerm = useCallback(
    (
      moduleKey?: string,
      action: "Access" | "View" | "Create" | "Edit" | "Delete" | "Print" | "Export" = "Access",
      requiredRoles?: readonly string[]
    ) => hasPermission(moduleKey, action, requiredRoles),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [permissionsData]
  );

  return {
    permissionsData,
    permissions: permissionsData?.permissions || [],
    roles: permissionsData?.roles || [],
    hasPermission: hasPerm,
    refreshPermissions: () => fetchMyPermissions(true),
  };
}
