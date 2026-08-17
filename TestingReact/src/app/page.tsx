"use client";

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import StatCards from "@/components/StatCards";
import DashboardChart from "@/components/DashboardChart";
import ServiceTable from "@/components/ServiceTable";
import PageTransition from "@/components/PageTransition";
import { Badge } from "@/components/av";
import { useI18n } from "@/i18n/LanguageProvider";

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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState("Today");
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-app text-ink font-sans flex">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      <div
        className={`flex-1 flex flex-col min-w-0 transition-[margin] duration-300 ease-out ${
          sidebarOpen ? "lg:ml-64" : "lg:ml-20"
        }`}
      >
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          <PageTransition className="space-y-6">
          {/* Page header */}
          <div
            style={{ "--enter-i": 0 } as React.CSSProperties}
            className="enter-up flex flex-wrap items-start justify-between gap-4"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-ink">
                  {t("nav.homeDashboard")}
                </h1>
                <Badge tone="success" dot pulse>
                  {t("dash.streamOn")}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-ink-secondary">
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
          </PageTransition>
        </main>
      </div>
    </div>
  );
}
