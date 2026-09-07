"use client";

/**
 * @file app/permissions/page.tsx
 * @description Dedicated Permission Management page for configuring role-based
 * access control and permissions consuming UserManagementAPI.
 */

import React, { Suspense } from "react";
import PageTransition from "@/components/PageTransition";
import RequireRole from "@/components/RequireRole";
import { ADMIN_ROLES } from "@/services/authSession";
import { useI18n } from "@/i18n/LanguageProvider";
import PermissionMatrix from "@/components/permissions/PermissionMatrix";
import Link from "next/link";
import { ShieldCheck, Users, ArrowLeft, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

function PermissionsContent() {
  const { lang } = useI18n();
  const isKhmer = lang === "km";
  const searchParams = useSearchParams();
  const initialRoleId = searchParams.get("roleId") || undefined;

  return (
    <PageTransition className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <main className="w-full max-w-7xl mx-auto p-4 lg:p-6 space-y-6 pb-24">
        <RequireRole allowed={ADMIN_ROLES}>
          {/* Header Title Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-subtle shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-tr from-accent to-accent-hover rounded-xl text-white shadow-md">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-ink">
                  {isKhmer ? "ការគ្រប់គ្រងសិទ្ធិអនុញ្ញាតតាម Roles" : "Role Permissions Management"}
                </h1>
                <p className="text-sm text-ink-secondary">
                  {isKhmer
                    ? "កំណត់សិទ្ធិលម្អិតសម្រាប់តួនាទីនីមួយៗ (ចូលមើល បង្កើត កែប្រែ លុប បោះពុម្ព និងទាញយកទិន្នន័យ)"
                    : "Configure granular operational permissions (Access, View, Create, Edit, Delete, Print, Export) per system role"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/users"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-subtle text-ink-secondary hover:text-ink hover:bg-cushion transition-colors text-sm font-semibold"
              >
                <Users className="w-4 h-4" />
                <span>{isKhmer ? "គណនីអ្នកប្រើប្រាស់ (Users)" : "Manage Users"}</span>
              </Link>
            </div>
          </div>

          {/* Interactive Permission Matrix */}
          <PermissionMatrix initialRoleId={initialRoleId} />
        </RequireRole>
      </main>
    </PageTransition>
  );
}

export default function PermissionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      }
    >
      <PermissionsContent />
    </Suspense>
  );
}
