"use client";

import React from "react";
import { usePathname } from "next/navigation";
import PageTransition from "@/components/PageTransition";
import { useI18n } from "@/i18n/LanguageProvider";
import type { TranslationKey } from "@/i18n/translations";
import { findNavItem } from "@/config/navigation";
import RequirePermission from "@/components/RequirePermission";

interface PageWrapperProps {
  /**
   * Translation keys rather than finished strings: every page's heading is a
   * static label, so resolving it here keeps all callers as plain markup
   * instead of each needing its own `useI18n()` just for the title.
   */
  titleKey: TranslationKey;
  subtitleKey?: TranslationKey;
  requiredModule?: string;
  requiredRoles?: readonly string[];
  skipPermissionCheck?: boolean;
  children: React.ReactNode;
}

export default function PageWrapper({
  titleKey,
  subtitleKey,
  requiredModule,
  requiredRoles,
  skipPermissionCheck = false,
  children,
}: PageWrapperProps) {
  const { lang, t } = useI18n();
  const pathname = usePathname();

  const matchedNav = !skipPermissionCheck ? findNavItem(pathname) : undefined;
  const targetModule = requiredModule ?? matchedNav?.requiredModule;
  const targetRoles = requiredRoles ?? matchedNav?.requiredRoles;

  const content = (
    <main className="flex-1 flex flex-col p-2.5 sm:p-3 lg:p-3.5 xl:p-4 2xl:p-6 w-full mx-auto overflow-hidden min-h-0">
      <PageTransition className="flex-1 flex flex-col min-h-0 overflow-hidden gap-2.5 sm:gap-3">
        <div className="flex items-center justify-between shrink-0">
          <div key={`heading-text-${lang}`} className="transition-all duration-300">
            <h1 className="text-lg md:text-xl font-bold text-ink">{t(titleKey)}</h1>
            {subtitleKey && (
              <p className="text-xs text-ink-secondary mt-0.5">{t(subtitleKey)}</p>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {children}
        </div>
      </PageTransition>
    </main>
  );

  if (!skipPermissionCheck && (targetModule || targetRoles)) {
    return (
      <RequirePermission module={targetModule} requiredRoles={targetRoles}>
        {content}
      </RequirePermission>
    );
  }

  return content;
}

