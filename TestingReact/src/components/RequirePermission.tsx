"use client";

import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, Lock } from "lucide-react";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useI18n } from "@/i18n/LanguageProvider";

interface RequirePermissionProps {
  module?: string;
  action?: "Access" | "View" | "Create" | "Edit" | "Delete" | "Print" | "Export";
  requiredRoles?: readonly string[];
  children: React.ReactNode;
}

/**
 * Route guard component that checks whether the current user has permission
 * to access a given module. Displays an Access Denied view if unauthorized.
 */
export default function RequirePermission({
  module,
  action = "Access",
  requiredRoles,
  children,
}: RequirePermissionProps) {
  const { lang } = useI18n();
  const isKhmer = lang === "km";
  const { hasPermission } = useUserPermissions();

  const isAllowed = hasPermission(module, action, requiredRoles);

  // If permissions allow, render children.
  if (isAllowed) {
    return <>{children}</>;
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] px-6 py-16 text-center">
      <div className="relative mb-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-danger/20 bg-danger/10 text-danger shadow-soft-sm">
          <Lock className="h-10 w-10 text-danger" />
        </div>
        <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-warning text-white shadow-sm">
          <ShieldAlert className="h-4 w-4" />
        </div>
      </div>

      <h2 className="mb-2 text-xl font-bold text-ink">
        {isKhmer ? "គ្មានសិទ្ធិអនុញ្ញាតចូលប្រើប្រាស់" : "Access Denied"}
      </h2>
      <p className="mb-2 max-w-md text-sm text-ink-secondary leading-relaxed">
        {module
          ? isKhmer
            ? `គណនីរបស់អ្នកមិនត្រូវបានផ្តល់សិទ្ធិសម្រាប់ផ្នែក (${module}) នេះឡើយ។ សូមទាក់ទងអ្នកគ្រប់គ្រងប្រព័ន្ធ (Admin) ប្រសិនបើអ្នកត្រូវការចូលប្រើប្រាស់។`
            : `Your account does not have permission to access the (${module}) module. Please contact your system administrator if you require access.`
          : isKhmer
            ? "គណនីរបស់អ្នកមិនត្រូវបានផ្តល់សិទ្ធិដើម្បីចូលប្រើប្រាស់ទំព័រនេះឡើយ។ សូមទាក់ទងអ្នកគ្រប់គ្រងប្រព័ន្ធ (Admin)។"
            : "Your account does not have permission to access this page. Please contact your system administrator."}
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent to-accent-hover text-white text-sm font-semibold shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{isKhmer ? "ត្រឡប់ទៅផ្ទាំងដើម" : "Back to Dashboard"}</span>
        </Link>
      </div>
    </div>
  );
}
