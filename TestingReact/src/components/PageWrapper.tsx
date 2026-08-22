"use client";

import React, { useSyncExternalStore } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import PageTransition from "@/components/PageTransition";
import { useI18n } from "@/i18n/LanguageProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { cn } from "@/lib/utils";
import {
  readSidebarOpen,
  readSidebarOpenOnServer,
  setSidebarOpen,
  subscribeToSidebar,
} from "@/services/sidebarPreference";
import { sidebarMarginClass } from "@/lib/sidebarMetrics";
import type { TranslationKey } from "@/i18n/translations";

interface PageWrapperProps {
  /**
   * Translation keys rather than finished strings: every page's heading is a
   * static label, so resolving it here keeps all 13 callers as plain markup
   * instead of each needing its own `useI18n()` just for the title.
   */
  titleKey: TranslationKey;
  subtitleKey?: TranslationKey;
  children: React.ReactNode;
}

export default function PageWrapper({ titleKey, subtitleKey, children }: PageWrapperProps) {
  /*
    Read from a module-scope store, not `useState`.

    This component is rendered by each of the 25 pages rather than by a shared
    layout, so React unmounts it on every navigation — and a `useState(true)`
    here went with it. Measured: collapse the rail on `/spareparts` (256px →
    80px), navigate to `/customers`, and it is 256px again.

    `services/sidebarPreference` outlives the remount and persists a deliberate
    desktop collapse. See that file for why a phone closing the drawer does not
    write anything, and why this does not flash on reload.
  */
  const sidebarOpen = useSyncExternalStore(
    subscribeToSidebar,
    readSidebarOpen,
    readSidebarOpenOnServer
  );
  const { lang, t } = useI18n();
  const { prefs } = useTheme();

  const marginClass = sidebarMarginClass(prefs.sidebarStyle || "classic", sidebarOpen);

  return (
    <div className="h-screen overflow-hidden bg-[var(--background)] text-ink font-sans flex">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Main Content Body. */}
      <div
        className={cn(
          "flex-1 flex flex-col h-screen overflow-hidden min-w-0 transition-[margin] duration-300 ease-out",
          marginClass
        )}
      >
        {/* Header Bar */}
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        {/* Page Main Content Area */}
        <main className="flex-1 flex flex-col p-2.5 sm:p-3.5 lg:p-3.5 xl:p-6 w-full mx-auto overflow-hidden min-h-0">
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
      </div>
    </div>
  );
}
