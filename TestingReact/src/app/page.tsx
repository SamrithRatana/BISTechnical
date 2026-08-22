"use client";

import React, { useState, useSyncExternalStore } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import {
  readSidebarOpen,
  readSidebarOpenOnServer,
  setSidebarOpen,
  subscribeToSidebar,
} from "@/services/sidebarPreference";
import { sidebarMarginClass } from "@/lib/sidebarMetrics";
import StatCards from "@/components/StatCards";
import DashboardChart from "@/components/DashboardChart";
import ServiceTable from "@/components/ServiceTable";
import PageTransition from "@/components/PageTransition";
import { Badge } from "@/components/av";
import { useI18n } from "@/i18n/LanguageProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { cn } from "@/lib/utils";

/**
 * The dashboard's entrance is purely declarative: the stat cards stagger
 * themselves at indices 0-3, the chart panel continues at 4 and the table at 5,
 * so the page assembles top-down as one movement rather than as separate
 * events. The entrance system in globals.css uses `animation-fill-mode:
 * backwards`, which never holds the final frame — so the elements return to
 * `transform: none` on their own and never become the containing block for a
 * `position: fixed` dialog inside them.
 */
export default function Home() {
  /*
    The same module store `PageWrapper` reads, not a local `useState`.

    The dashboard renders the shell itself instead of going through
    `PageWrapper`, so it was the one route where a collapsed rail came back
    expanded — and toggling it here persisted nothing, so leaving the dashboard
    snapped the rail straight back to whatever the rest of the app had stored.
    See `services/sidebarPreference` for why this lives outside React.
  */
  const sidebarOpen = useSyncExternalStore(
    subscribeToSidebar,
    readSidebarOpen,
    readSidebarOpenOnServer
  );
  const [selectedFilter, setSelectedFilter] = useState("Today");
  const { t } = useI18n();
  const { prefs } = useTheme();

  const marginClass = sidebarMarginClass(prefs.sidebarStyle || "classic", sidebarOpen);

  return (
    <div className="min-h-screen bg-app text-ink font-sans flex">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 transition-[margin] duration-300 ease-out",
          marginClass
        )}
      >
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <PageTransition>
          <main className="flex-1 p-3.5 sm:p-4 lg:p-4 xl:p-6 max-w-7xl w-full mx-auto space-y-3 lg:space-y-4 xl:space-y-6">
            {/* Page header */}
            <div
              style={{ "--enter-i": 0 } as React.CSSProperties}
              className="enter-up flex flex-wrap items-start justify-between gap-3 lg:gap-3 xl:gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl lg:text-xl xl:text-2xl font-bold tracking-tight text-ink">
                    {t("nav.homeDashboard")}
                  </h1>
                  <Badge tone="success" dot pulse>
                    {t("dash.streamOn")}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs lg:text-xs xl:text-sm text-ink-secondary">
                  {t("dash.ticketVolumeHint")}
                </p>
              </div>
            </div>

            {/* KPI grid — staggers itself, indices 0-3 */}
            <StatCards
              selectedFilter={selectedFilter}
              setSelectedFilter={setSelectedFilter}
            />

            <div style={{ "--enter-i": 4 } as React.CSSProperties} className="enter-up">
              <DashboardChart />
            </div>

            <div style={{ "--enter-i": 5 } as React.CSSProperties} className="enter-up">
              <ServiceTable activeFilter={selectedFilter} />
            </div>
          </main>
        </PageTransition>
      </div>
    </div>
  );
}
