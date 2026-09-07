"use client";

/**
 * @file components/permissions/PermissionMatrix.tsx
 * @description Modern, interactive Permission Matrix for managing permissions
 * by System Roles and Modules with search, batch selection, and live dirty tracking.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  fetchRolesList,
  fetchRolePermissions,
  saveRolePermissions,
  MODULE_METADATA,
  type SystemRoleItem,
  type RolePermissionsData,
  type PermissionItem,
} from "@/services/permissionService";
import { fetchMyPermissions } from "@/services/permissionStore";
import { useI18n } from "@/i18n/LanguageProvider";
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Lock,
  Eye,
  PlusCircle,
  Edit,
  Trash2,
  Printer,
  Download,
  Check,
  RotateCcw,
  Sparkles,
  Package,
  Wrench,
  Users,
  BarChart3,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface PermissionMatrixProps {
  initialRoleId?: string;
  onRoleChange?: (roleId: string) => void;
  showRoleSelector?: boolean;
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  Access: Lock,
  View: Eye,
  Create: PlusCircle,
  Edit: Edit,
  Delete: Trash2,
  Print: Printer,
  Export: Download,
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  inventory: Package,
  technical: Wrench,
  sales: Users,
  reports: BarChart3,
};

export default function PermissionMatrix({
  initialRoleId,
  onRoleChange,
  showRoleSelector = true,
}: PermissionMatrixProps) {
  const { lang } = useI18n();
  const isKhmer = lang === "km";

  // State
  const [roles, setRoles] = useState<SystemRoleItem[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>(initialRoleId || "");
  const [rolePermissions, setRolePermissions] = useState<RolePermissionsData | null>(null);
  const [assignedSet, setAssignedSet] = useState<Set<string>>(new Set());
  const [originalSet, setOriginalSet] = useState<Set<string>>(new Set());
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "assigned" | "unassigned">("all");

  // Load Roles
  const loadRoles = useCallback(async () => {
    setLoadingRoles(true);
    try {
      const data = await fetchRolesList();
      setRoles(data);
      if (!selectedRoleId && data.length > 0) {
        // Default to Admin or SuperAdmin or first role
        const defaultRole = data.find((r) => r.name === "Admin" || r.name === "SuperAdmin") || data[0];
        setSelectedRoleId(defaultRole.id);
        onRoleChange?.(defaultRole.id);
      }
    } catch (err) {
      console.error("Failed to load roles:", err);
      toast.error(isKhmer ? "មិនអាចទាញយកបញ្ជី Roles បានទេ" : "Failed to load roles list");
    } finally {
      setLoadingRoles(false);
    }
  }, [selectedRoleId, onRoleChange, isKhmer]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  // Load Permissions for selected role
  const loadPermissionsForRole = useCallback(
    async (roleId: string) => {
      if (!roleId) return;
      setLoadingPerms(true);
      try {
        const data = await fetchRolePermissions(roleId);
        setRolePermissions(data);
        const assigned = new Set<string>();
        data.permissions.forEach((p) => {
          if (p.isAssigned) assigned.add(p.permission);
        });
        setAssignedSet(new Set(assigned));
        setOriginalSet(new Set(assigned));
      } catch (err) {
        console.error("Failed to load role permissions:", err);
        toast.error(isKhmer ? "មិនអាចទាញយកសិទ្ធិអនុញ្ញាតសម្រាប់ Role នេះទេ" : "Failed to load role permissions");
      } finally {
        setLoadingPerms(false);
      }
    },
    [isKhmer]
  );

  useEffect(() => {
    if (selectedRoleId) {
      void loadPermissionsForRole(selectedRoleId);
    }
  }, [selectedRoleId, loadPermissionsForRole]);

  // Handle Role Selection change
  const handleSelectRole = (roleId: string) => {
    if (roleId === selectedRoleId) return;
    if (isDirty) {
      const confirmLeave = window.confirm(
        isKhmer
          ? "អ្នកមានការកែប្រែសិទ្ធិដែលមិនទាន់បានរក្សាទុក។ តើអ្នកចង់ចាកចេញដោយមិនរក្សាទុកឬ?"
          : "You have unsaved permission changes. Do you want to discard them?"
      );
      if (!confirmLeave) return;
    }
    setSelectedRoleId(roleId);
    onRoleChange?.(roleId);
  };

  // Toggle single permission
  const handleTogglePermission = (permissionKey: string) => {
    setAssignedSet((prev) => {
      const next = new Set(prev);
      if (next.has(permissionKey)) {
        next.delete(permissionKey);
      } else {
        next.add(permissionKey);
      }
      return next;
    });
  };

  // Toggle all permissions for a specific module
  const handleToggleModule = (modulePermissions: PermissionItem[], shouldAssign: boolean) => {
    setAssignedSet((prev) => {
      const next = new Set(prev);
      modulePermissions.forEach((p) => {
        if (shouldAssign) {
          next.add(p.permission);
        } else {
          next.delete(p.permission);
        }
      });
      return next;
    });
  };

  // Grant All
  const handleGrantAll = () => {
    if (!rolePermissions) return;
    const all = new Set<string>();
    rolePermissions.permissions.forEach((p) => all.add(p.permission));
    setAssignedSet(all);
    toast.success(isKhmer ? "បានជ្រើសរើសសិទ្ធិទាំងអស់" : "Selected all permissions");
  };

  // Revoke All
  const handleRevokeAll = () => {
    setAssignedSet(new Set());
    toast(isKhmer ? "បានលុបការជ្រើសរើសទាំងអស់" : "Revoked all selections");
  };

  // Discard changes
  const handleDiscard = () => {
    setAssignedSet(new Set(originalSet));
    toast(isKhmer ? "បានត្រឡប់ទៅស្ថានភាពដើមវិញ" : "Changes discarded");
  };

  // Save changes
  const handleSave = async () => {
    if (!selectedRoleId || !rolePermissions) return;
    setSaving(true);
    try {
      const permissionsToSave = Array.from(assignedSet);
      await saveRolePermissions(selectedRoleId, permissionsToSave);
      setOriginalSet(new Set(assignedSet));
      void fetchMyPermissions();
      toast.success(
        isKhmer
          ? `🎉 បានរក្សាទុកសិទ្ធិអនុញ្ញាតសម្រាប់ Role "${rolePermissions.roleName}" ជោគជ័យ!`
          : `🎉 Permissions updated successfully for role "${rolePermissions.roleName}"!`,
        { duration: 4000 }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      toast.error(isKhmer ? `បរាជ័យក្នុងការរក្សាទុក៖ ${msg}` : `Save failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  // Changes diff
  const isDirty = useMemo(() => {
    if (assignedSet.size !== originalSet.size) return true;
    for (const p of assignedSet) {
      if (!originalSet.has(p)) return true;
    }
    return false;
  }, [assignedSet, originalSet]);

  const addedCount = useMemo(() => {
    let c = 0;
    for (const p of assignedSet) {
      if (!originalSet.has(p)) c++;
    }
    return c;
  }, [assignedSet, originalSet]);

  const removedCount = useMemo(() => {
    let c = 0;
    for (const p of originalSet) {
      if (!assignedSet.has(p)) c++;
    }
    return c;
  }, [assignedSet, originalSet]);

  // Group permissions by Module
  const groupedModules = useMemo(() => {
    if (!rolePermissions) return [];

    const map = new Map<string, PermissionItem[]>();
    rolePermissions.permissions.forEach((p) => {
      const list = map.get(p.module) || [];
      list.push(p);
      map.set(p.module, list);
    });

    const q = searchQuery.toLowerCase().trim();

    return Array.from(map.entries())
      .map(([moduleKey, perms]) => {
        const meta = MODULE_METADATA[moduleKey] || {
          key: moduleKey,
          nameEn: moduleKey,
          nameKm: moduleKey,
          category: "technical",
          categoryEn: "General",
          categoryKm: "ទូទៅ",
          descriptionEn: "",
          descriptionKm: "",
        };

        // Filter permissions inside module
        const filteredPerms = perms.filter((p) => {
          // Status filter
          const isAssigned = assignedSet.has(p.permission);
          if (statusFilter === "assigned" && !isAssigned) return false;
          if (statusFilter === "unassigned" && isAssigned) return false;

          // Search query filter
          if (!q) return true;
          return (
            p.displayName.toLowerCase().includes(q) ||
            p.permission.toLowerCase().includes(q) ||
            meta.nameEn.toLowerCase().includes(q) ||
            meta.nameKm.toLowerCase().includes(q)
          );
        });

        return {
          moduleKey,
          meta,
          allPermissions: perms,
          permissions: filteredPerms,
        };
      })
      .filter((g) => {
        // Category filter
        if (selectedCategory !== "all" && g.meta.category !== selectedCategory) return false;
        // Keep module if it matches search or has filtered perms
        if (q && g.permissions.length === 0) {
          const matchMeta =
            g.meta.nameEn.toLowerCase().includes(q) ||
            g.meta.nameKm.toLowerCase().includes(q) ||
            g.moduleKey.toLowerCase().includes(q);
          return matchMeta;
        }
        return g.permissions.length > 0;
      });
  }, [rolePermissions, searchQuery, selectedCategory, statusFilter, assignedSet]);

  const activeRole = roles.find((r) => r.id === selectedRoleId);

  return (
    <div className="space-y-6">
      {/* ── 1. ROLE SELECTOR STRIP ── */}
      {showRoleSelector && (
        <div className="bg-surface p-4 lg:p-5 rounded-2xl border border-subtle shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-ink flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-accent" />
                <span>{isKhmer ? "ជ្រើសរើសតួនាទី (Select Role)" : "Select System Role"}</span>
              </h2>
              <p className="text-xs text-ink-secondary mt-0.5">
                {isKhmer
                  ? "កំណត់សិទ្ធិអនុញ្ញាតចូលប្រើប្រាស់ សម្រាប់តួនាទីនីមួយៗក្នុងប្រព័ន្ធ"
                  : "Assign module access and operational privileges for each role"}
              </p>
            </div>

            <button
              onClick={() => void loadPermissionsForRole(selectedRoleId)}
              disabled={loadingPerms}
              className="self-start sm:self-auto p-2 rounded-xl border border-subtle text-ink-secondary hover:bg-cushion transition-colors cursor-pointer"
              title={isKhmer ? "ទាញយកទិន្នន័យឡើងវិញ" : "Refresh"}
            >
              <RefreshCw className={cn("w-4 h-4", loadingPerms && "animate-spin")} />
            </button>
          </div>

          {/* Role Pill Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {loadingRoles ? (
              <div className="flex items-center gap-2 text-xs text-ink-muted py-2">
                <Loader2 className="w-4 h-4 animate-spin text-accent" />
                <span>{isKhmer ? "កំពុងទាញយក Roles..." : "Loading roles..."}</span>
              </div>
            ) : (
              roles.map((r) => {
                const isActive = r.id === selectedRoleId;
                return (
                  <button
                    key={r.id}
                    onClick={() => handleSelectRole(r.id)}
                    className={cn(
                      "px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 shrink-0 transition-all cursor-pointer border select-none",
                      isActive
                        ? "bg-accent text-white border-accent shadow-md ring-2 ring-accent/30"
                        : "bg-surface hover:bg-cushion text-ink-secondary hover:text-ink border-subtle"
                    )}
                  >
                    <ShieldCheck className={cn("w-3.5 h-3.5", isActive ? "text-white" : "text-accent")} />
                    <span>{r.name}</span>
                    {r.userCount !== undefined && (
                      <span
                        className={cn(
                          "px-1.5 py-0.5 text-[10px] rounded-full font-mono",
                          isActive ? "bg-white/20 text-white" : "bg-sunken text-ink-muted"
                        )}
                      >
                        {r.userCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── 2. ACTIVE ROLE STATS & BATCH ACTIONS BAR ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-cushion/60 p-4 rounded-2xl border border-subtle">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-accent-soft text-accent border border-accent/20">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-ink">
                {activeRole ? activeRole.name : "..."}
              </span>
              <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-accent-soft text-accent border border-accent/20 tabular-nums">
                {assignedSet.size} / {rolePermissions?.permissions.length || 0} {isKhmer ? "សិទ្ធិ" : "Permissions"}
              </span>
            </div>
            <p className="text-xs text-ink-secondary mt-0.5">
              {isKhmer
                ? `បានកំណត់ ${assignedSet.size} ក្នុងចំណោម ${rolePermissions?.permissions.length || 0} សិទ្ធិសរុប`
                : `${assignedSet.size} of ${rolePermissions?.permissions.length || 0} total permissions granted`}
            </p>
          </div>
        </div>

        {/* Quick Batch Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleGrantAll}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-surface hover:bg-cushion text-ink border border-subtle shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5 text-success" />
            <span>{isKhmer ? "ផ្តល់សិទ្ធិទាំងអស់" : "Grant All"}</span>
          </button>
          <button
            type="button"
            onClick={handleRevokeAll}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-surface hover:bg-cushion text-ink-secondary hover:text-danger border border-subtle shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isKhmer ? "ដកសិទ្ធិទាំងអស់" : "Revoke All"}</span>
          </button>
        </div>
      </div>

      {/* ── 3. SEARCH & CATEGORY FILTER TABS ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: "all", labelEn: "All Modules", labelKm: "គ្រប់ម៉ូឌុលទាំងអស់" },
            { id: "inventory", labelEn: "Inventory & Spare Parts", labelKm: "ស្តុក & គ្រឿងបន្លាស់" },
            { id: "technical", labelEn: "Technical Operations", labelKm: "ប្រតិបត្តិការបច្ចេកទេស" },
            { id: "sales", labelEn: "Customer & Sales", labelKm: "អតិថិជន & ការលក់" },
            { id: "reports", labelEn: "Reports & Analytics", labelKm: "របាយការណ៍ & ស្ថិតិ" },
          ].map((cat) => {
            const isCatActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-colors cursor-pointer select-none",
                  isCatActive
                    ? "bg-ink text-surface shadow-xs font-bold"
                    : "bg-cushion text-ink-secondary hover:text-ink hover:bg-cushion-hover"
                )}
              >
                {isKhmer ? cat.labelKm : cat.labelEn}
              </button>
            );
          })}
        </div>

        {/* Search Input & Status Dropdown */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isKhmer ? "ស្វែងរកសិទ្ធិ ឬម៉ូឌុល..." : "Filter permissions..."}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface border border-subtle rounded-xl text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "assigned" | "unassigned")}
            aria-label={isKhmer ? "ច្រោះតាមស្ថានភាព" : "Filter by status"}
            className="px-2.5 py-1.5 text-xs bg-surface border border-subtle rounded-xl text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
          >
            <option value="all">{isKhmer ? "សិទ្ធិទាំងអស់" : "All Status"}</option>
            <option value="assigned">{isKhmer ? "បានផ្តល់សិទ្ធិ (Assigned)" : "Assigned Only"}</option>
            <option value="unassigned">{isKhmer ? "មិនទាន់ផ្តល់សិទ្ធិ" : "Unassigned Only"}</option>
          </select>
        </div>
      </div>

      {/* ── 4. MODULES & PERMISSIONS MATRIX GRID ── */}
      {loadingPerms ? (
        <div className="flex flex-col items-center justify-center py-24 bg-surface rounded-2xl border border-subtle">
          <Loader2 className="w-8 h-8 animate-spin text-accent mb-3" />
          <p className="text-sm font-medium text-ink-secondary">
            {isKhmer ? "កំពុងទាញយកសិទ្ធិអនុញ្ញាតពី UserManagement API..." : "Loading permissions from API..."}
          </p>
        </div>
      ) : groupedModules.length === 0 ? (
        <div className="text-center py-16 bg-surface rounded-2xl border border-subtle">
          <ShieldCheck className="w-10 h-10 text-ink-muted mx-auto mb-2 opacity-50" />
          <p className="text-sm font-semibold text-ink">
            {isKhmer ? "រកមិនឃើញសិទ្ធិដែលត្រូវនឹងការស្វែងរកឡើយ" : "No permissions match your search filter."}
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("all");
              setStatusFilter("all");
            }}
            className="mt-3 text-xs text-accent hover:underline font-semibold cursor-pointer"
          >
            {isKhmer ? "សម្អាតការស្វែងរក" : "Reset all filters"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-16">
          {groupedModules.map((group) => {
            const CategoryIcon = CATEGORY_ICONS[group.meta.category] || Wrench;
            const modulePerms = group.allPermissions;
            const assignedInModule = modulePerms.filter((p) => assignedSet.has(p.permission)).length;
            const isAllModuleAssigned = assignedInModule === modulePerms.length && modulePerms.length > 0;
            const isPartiallyAssigned = assignedInModule > 0 && !isAllModuleAssigned;

            return (
              <div
                key={group.moduleKey}
                className={cn(
                  "bg-surface rounded-2xl border transition-all p-4 space-y-3.5 shadow-2xs hover:shadow-sm",
                  assignedInModule > 0 ? "border-accent/30" : "border-subtle"
                )}
              >
                {/* Module Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={cn(
                        "p-2 rounded-xl border shrink-0",
                        assignedInModule > 0
                          ? "bg-accent-soft text-accent border-accent/30"
                          : "bg-cushion text-ink-secondary border-subtle"
                      )}
                    >
                      <CategoryIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-ink truncate">
                        {isKhmer ? group.meta.nameKm : group.meta.nameEn}
                      </h3>
                      <p className="text-[11px] text-ink-muted truncate">
                        {isKhmer ? group.meta.descriptionKm : group.meta.descriptionEn}
                      </p>
                    </div>
                  </div>

                  {/* Module Toggle All Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleModule(modulePerms, !isAllModuleAssigned)}
                    className={cn(
                      "px-2 py-1 text-[10.5px] font-bold rounded-lg border transition-all shrink-0 cursor-pointer select-none",
                      isAllModuleAssigned
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        : isPartiallyAssigned
                        ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                        : "bg-cushion hover:bg-cushion-hover text-ink-secondary border-subtle"
                    )}
                    title={isAllModuleAssigned ? "Deselect all in module" : "Select all in module"}
                  >
                    {assignedInModule}/{modulePerms.length}
                  </button>
                </div>

                {/* Module Permissions Checkbox Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                  {group.permissions.map((p) => {
                    const isChecked = assignedSet.has(p.permission);
                    const ActionIcon = ACTION_ICONS[p.displayName] || Lock;
                    const isAccess = p.displayName === "Access";

                    return (
                      <button
                        key={p.permission}
                        type="button"
                        onClick={() => handleTogglePermission(p.permission)}
                        className={cn(
                          "px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all cursor-pointer select-none text-left",
                          isChecked
                            ? isAccess
                              ? "bg-accent text-white border-accent shadow-xs"
                              : "bg-accent-soft text-accent border-accent/40 font-bold"
                            : "bg-cushion hover:bg-cushion-hover text-ink-secondary hover:text-ink border-subtle/80"
                        )}
                        title={p.permission}
                      >
                        <div className="flex items-center gap-1.5 truncate mr-1">
                          <ActionIcon
                            className={cn(
                              "w-3 h-3 shrink-0",
                              isChecked
                                ? isAccess
                                  ? "text-white"
                                  : "text-accent"
                                : "text-ink-muted"
                            )}
                          />
                          <span className="truncate">{p.displayName}</span>
                        </div>

                        <div
                          className={cn(
                            "w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border transition-all",
                            isChecked
                              ? isAccess
                                ? "bg-white text-accent border-white"
                                : "bg-accent text-white border-accent"
                              : "border-subtle bg-surface"
                          )}
                        >
                          {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 5. STICKY / FLOATING SAVE CHANGES BAR ── */}
      {isDirty && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-8 z-50 bg-slate-900/95 text-white p-3.5 sm:px-6 rounded-2xl border border-white/20 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-4 animate-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <div>
              <span className="text-xs font-bold text-slate-200">
                {isKhmer ? "ការកែប្រែមិនទាន់បានរក្សាទុក" : "Unsaved Permission Changes"}
              </span>
              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                {addedCount > 0 && <span className="text-emerald-400">+{addedCount} granted</span>}
                {removedCount > 0 && <span className="text-rose-400">-{removedCount} revoked</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={saving}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer"
            >
              {isKhmer ? "បោះបង់" : "Discard"}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-accent to-accent-hover hover:opacity-95 text-white shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{isKhmer ? "កំពុងរក្សាទុក..." : "Saving..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isKhmer ? "រក្សាទុកសិទ្ធិ" : "Save Permissions"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
