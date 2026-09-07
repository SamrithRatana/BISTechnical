"use client";

/**
 * @file components/permissions/UserPermissionsModal.tsx
 * @description Modal dialog showing effective permissions for a specific user
 * aggregated across all their assigned system roles.
 */

import React, { useEffect, useState, useMemo } from "react";
import { ModalWrapper } from "@/components/av/ModalWrapper";
import {
  fetchUserPermissions,
  MODULE_METADATA,
  type UserPermissionsData,
  type PermissionItem,
} from "@/services/permissionService";
import { useI18n } from "@/i18n/LanguageProvider";
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  Loader2,
  User,
  Mail,
  Lock,
  Layers,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UserPermissionsModalProps {
  user: {
    id: string;
    userName: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    roles?: string[];
  } | null;
  open: boolean;
  onClose: () => void;
  onEditRoles?: () => void;
}

export default function UserPermissionsModal({
  user,
  open,
  onClose,
  onEditRoles,
}: UserPermissionsModalProps) {
  const { lang } = useI18n();
  const isKhmer = lang === "km";

  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<UserPermissionsData | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open || !user?.id) return;
    let alive = true;
    setLoading(true);

    fetchUserPermissions(user.id)
      .then((data) => {
        if (alive) setUserData(data);
      })
      .catch((err) => {
        console.error("Failed to load user permissions:", err);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [open, user?.id]);

  const fullName = useMemo(() => {
    if (!user) return "";
    return `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.userName;
  }, [user]);

  // Group by module
  const groupedModules = useMemo(() => {
    if (!userData) return [];
    const map = new Map<string, PermissionItem[]>();
    userData.permissions.forEach((p) => {
      const list = map.get(p.module) || [];
      list.push(p);
      map.set(p.module, list);
    });

    const q = search.toLowerCase().trim();

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

        const filtered = perms.filter((p) => {
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
          permissions: filtered,
        };
      })
      .filter((g) => g.permissions.length > 0);
  }, [userData, search]);

  if (!user) return null;

  return (
    <ModalWrapper
      open={open}
      onClose={onClose}
      maxWidth="max-w-2xl"
      zIndex={50}
    >
      <div className="bg-surface rounded-2xl border border-subtle p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-subtle pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-accent-soft text-accent rounded-xl border border-accent/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-ink">
                {isKhmer ? "សិទ្ធិអនុញ្ញាតរបស់អ្នកប្រើប្រាស់" : "User Effective Permissions"}
              </h3>
              <p className="text-xs text-ink-muted">
                {isKhmer ? "សិទ្ធិទាំងអស់ដែលទទួលបានពី Roles" : "All granted permissions aggregated from assigned roles"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-muted hover:text-ink text-sm p-1.5 rounded-lg hover:bg-cushion transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* User Card */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-cushion/60 border border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-accent to-accent-hover flex items-center justify-center text-white font-bold text-base shadow-sm">
              {fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-sm text-ink">{fullName}</div>
              <div className="text-xs text-ink-muted flex items-center gap-2">
                <span>@{user.userName}</span>
                {user.email && (
                  <>
                    <span>•</span>
                    <span>{user.email}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {onEditRoles && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEditRoles();
              }}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-surface hover:bg-cushion text-accent border border-accent/30 transition-colors cursor-pointer"
            >
              {isKhmer ? "កែប្រែ Roles" : "Edit Roles"}
            </button>
          )}
        </div>

        {/* Assigned Roles Banner */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-ink-secondary flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-accent" />
            <span>{isKhmer ? "តួនាទីទទួលបាន (Roles):" : "Inherited Roles:"}</span>
          </span>
          {user.roles && user.roles.length > 0 ? (
            user.roles.map((r) => (
              <span
                key={r}
                className="px-2.5 py-0.5 text-xs font-semibold bg-accent-soft text-accent border border-accent/20 rounded-lg"
              >
                {r}
              </span>
            ))
          ) : (
            <span className="text-xs text-ink-muted italic">
              {isKhmer ? "គ្មាន Role" : "No Role Assigned"}
            </span>
          )}
        </div>

        {/* Info hint */}
        <div className="p-2.5 rounded-xl bg-sunken/60 border border-subtle text-xs text-ink-secondary flex items-start gap-2">
          <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <span>
            {isKhmer
              ? "សិទ្ធិអនុញ្ញាតទាំងនេះ ត្រូវបានទទួលដោយស្វ័យប្រវត្តិពីតួនាទី (Roles) ខាងលើ។ ដើម្បីបន្ថែម ឬកាត់បន្ថយសិទ្ធិ សូមកែប្រែក្នុងផ្ទាំង Role Permissions។"
              : "These permissions are inherited dynamically from the roles listed above. To adjust permissions, configure the role matrix."}
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isKhmer ? "ស្វែងរកសិទ្ធិ..." : "Filter granted permissions..."}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface border border-subtle rounded-xl text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Permissions Grid */}
        <div className="max-h-[380px] overflow-y-auto space-y-3 pr-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-xs text-ink-muted">
              <Loader2 className="w-6 h-6 animate-spin text-accent mb-2" />
              <span>{isKhmer ? "កំពុងទាញយកសិទ្ធិ..." : "Loading permissions..."}</span>
            </div>
          ) : groupedModules.length === 0 ? (
            <div className="py-10 text-center text-xs text-ink-muted">
              {isKhmer ? "អ្នកប្រើប្រាស់នេះមិនទាន់មានសិទ្ធិណាមួយឡើយ" : "No permissions granted to this user."}
            </div>
          ) : (
            groupedModules.map((g) => (
              <div key={g.moduleKey} className="p-3 rounded-xl border border-subtle bg-surface space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink">
                    {isKhmer ? g.meta.nameKm : g.meta.nameEn}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cushion text-ink-secondary">
                    {g.permissions.length} {isKhmer ? "សិទ្ធិ" : "actions"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {g.permissions.map((p) => (
                    <span
                      key={p.permission}
                      className="px-2 py-1 text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      <span>{p.displayName}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-subtle flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-cushion hover:bg-cushion-hover text-ink transition-colors cursor-pointer"
          >
            {isKhmer ? "បិទ" : "Close"}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}
