"use client";

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import PageTransition from "@/components/PageTransition";
import { useI18n } from "@/i18n/LanguageProvider";
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { t } = useI18n();

  return (
    <div className="h-screen overflow-hidden bg-[var(--background)] text-ink font-sans flex">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Main Content Body */}
      <div
        className={`flex-1 flex flex-col h-screen overflow-hidden min-w-0 transition-all duration-300 ${
          sidebarOpen ? "lg:ml-64" : "lg:ml-20"
        }`}
      >
        {/* Header Bar */}
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        {/* Page Main Content Area */}
        {/* `PageTransition` keys on the pathname, so the stage genuinely
            re-mounts on every navigation and the enter animation replays.
            Without it these `enter-up` classes fire once, on the first page
            you land on, and never again — React reuses this subtree between
            routes because all 13 pages render the same wrapper.

            The title leads and the content follows one beat behind. Two
            elements is the whole choreography: a shell that re-animates every
            item on every navigation stops feeling designed and starts feeling
            slow, because the cost is paid on each route change, not once. */}
        <main className="flex-1 flex flex-col p-3 sm:p-4 lg:p-6 w-full mx-auto overflow-hidden min-h-0">
          <PageTransition className="flex-1 flex flex-col min-h-0 overflow-hidden gap-2.5 sm:gap-3">
            <div className="enter-up flex items-center justify-between shrink-0">
              <div>
                <h1 className="text-lg md:text-xl font-bold text-ink">{t(titleKey)}</h1>
                {subtitleKey && (
                  <p className="text-xs text-ink-secondary mt-0.5">{t(subtitleKey)}</p>
                )}
              </div>
            </div>

            <div
              style={{ "--enter-i": 1 } as React.CSSProperties}
              className="enter-up flex-1 flex flex-col min-h-0 overflow-hidden"
            >
              {children}
            </div>
          </PageTransition>
        </main>
      </div>
    </div>
  );
}
