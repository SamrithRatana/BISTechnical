"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PageTransition from "@/components/PageTransition";
import {
  DashboardProvider,
  DashboardHeader,
  DashboardGrid,
  AddWidgetModal,
} from "@/components/dashboard";
import {
  fetchDashboardStats,
  fetchSparepartTransactions,
  type ServiceSearchExtras,
} from "@/services/api";
import { loadTickets } from "@/hooks/useTicketSeries";
import { fetchAppLogoUrl, fetchGlobalBranding } from "@/services/appSettings";
import { useBrandLogo, publishBrandLogo } from "@/services/brandLogoStore";
import BrandLogo from "@/components/BrandLogo";
import { registerSessionCacheClearer } from "@/services/authSession";
import { useI18n } from "@/i18n/LanguageProvider";
import {
  ShieldCheck,
  TrendingUp,
  ClipboardList,
  Boxes,
  Check,
  Activity,
  Wrench,
} from "lucide-react";

const PREWARM_SESSION_KEY = "workspace_dashboard_prewarmed_v1";

function checkIsPrewarmed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(PREWARM_SESSION_KEY) === "true";
  } catch {
    return false;
  }
}

registerSessionCacheClearer(() => {
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(PREWARM_SESSION_KEY);
    } catch {}
  }
});

const STAGES = [
  {
    id: 1,
    titleEn: "System Identity & Branding",
    titleKm: "និមិត្តសញ្ញា និងអត្តសញ្ញាណប្រព័ន្ធ",
    icon: ShieldCheck,
  },
  {
    id: 2,
    titleEn: "Real-Time KPI Statistics",
    titleKm: "ស្ថិតិ និងទិន្នន័យសរុប (Live KPI)",
    icon: TrendingUp,
  },
  {
    id: 3,
    titleEn: "Active Tickets & Urgent Queue",
    titleKm: "សំបុត្រជួសជុល & Urgent Queue",
    icon: ClipboardList,
  },
  {
    id: 4,
    titleEn: "Spareparts Stock Telemetry",
    titleKm: "ចរន្តស្តុកគ្រឿងបន្លាស់ Real-Time",
    icon: Boxes,
  },
];

/**
 * Responsive, flexible, and customizable dashboard inspired by
 * QuickBooks Online (QBO) and Tailwind Catalyst.
 */
export default function Home() {
  const { lang } = useI18n();
  const isKhmer = lang === "km";
  const brandLogo = useBrandLogo();
  const [selectedFilter, setSelectedFilter] = useState("Today");
  const [filterExtras, setFilterExtras] = useState<ServiceSearchExtras | undefined>(undefined);

  // If already pre-warmed in this browser session, enter immediately (0ms).
  // Otherwise, display the preloader while fetching fresh internal data.
  const [isInitialReady, setIsInitialReady] = useState(() => checkIsPrewarmed());
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    if (isInitialReady) return;

    let cancelled = false;

    async function runPipeline() {
      try {
        // Step 1: Branding & Logo
        if (cancelled) return;
        setCurrentStep(1);
        setProgress(25);
        try {
          const logoUrl = await fetchAppLogoUrl();
          if (logoUrl) {
            publishBrandLogo(logoUrl);
            await new Promise<void>((resolve) => {
              const img = new Image();
              img.onload = () => resolve();
              img.onerror = () => resolve();
              img.src = logoUrl;
            });
          }
          await fetchGlobalBranding();
        } catch (e) {
          console.warn("Branding prewarm warning:", e);
        }
        if (cancelled) return;
        setCompletedSteps((prev) => [...prev, 1]);

        // Step 2: Live KPI stats directly from backend API
        setCurrentStep(2);
        setProgress(50);
        try {
          await fetchDashboardStats(true);
        } catch (e) {
          console.warn("Stats prewarm warning:", e);
        }
        if (cancelled) return;
        setCompletedSteps((prev) => [...prev, 2]);

        // Step 3: Load recent tickets for sparklines and urgent queue
        setCurrentStep(3);
        setProgress(75);
        try {
          await loadTickets(true);
        } catch (e) {
          console.warn("Tickets prewarm warning:", e);
        }
        if (cancelled) return;
        setCompletedSteps((prev) => [...prev, 3]);

        // Step 4: Load stock movements
        setCurrentStep(4);
        setProgress(95);
        try {
          await fetchSparepartTransactions(1, 25, "All", "", true);
        } catch (e) {
          console.warn("Spareparts prewarm warning:", e);
        }
        if (cancelled) return;
        setCompletedSteps((prev) => [...prev, 4]);

        // Step 5: Finalize and Launch
        setProgress(100);
        await new Promise((r) => setTimeout(r, 320));

        if (cancelled) return;
        try {
          sessionStorage.setItem(PREWARM_SESSION_KEY, "true");
        } catch {}
        setIsInitialReady(true);
      } catch (err) {
        console.warn("Prewarm pipeline error:", err);
        if (!cancelled) {
          setIsInitialReady(true);
        }
      }
    }

    void runPipeline();

    // 15-second safety fallback (only if backend is totally unreachable)
    const safetyTimer = setTimeout(() => {
      if (!cancelled) {
        setIsInitialReady(true);
      }
    }, 15000);

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
    };
  }, [isInitialReady]);

  return (
    <>
      {/* ── Enterprise Full-Screen Preloader Gatekeeper ── */}
      <AnimatePresence>
        {!isInitialReady && (
          <motion.div
            key="preloader-overlay"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.35, ease: "easeInOut" } }}
            className="fixed inset-0 z-[9999] bg-[#070A10] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden select-none font-sans"
          >
            {/* Ambient Background Glow */}
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/15 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-10 right-10 w-80 h-80 bg-cyan-500/15 rounded-full blur-[120px] pointer-events-none" />

            <div className="relative z-10 w-full max-w-md space-y-6">
              {/* Brand Logo & Portal Title */}
              <div className="text-center space-y-3">
                <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-3xl bg-slate-900/90 border border-slate-700/80 p-3 shadow-2xl flex items-center justify-center ring-4 ring-emerald-500/10">
                  {brandLogo ? (
                    <BrandLogo
                      src={brandLogo}
                      alt="Logo"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Wrench className="w-8 h-8 text-emerald-400 animate-pulse" />
                  )}
                </div>

                <div className="space-y-1">
                  <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    {isKhmer
                      ? "ប្រព័ន្ធគ្រប់គ្រងការជួសជុល និងសេវាកម្ម"
                      : "Service & Maintenance Portal"}
                  </h1>
                  <p className="text-xs text-slate-400">
                    {isKhmer
                      ? "កំពុងដំណើរការទាញយកទិន្នន័យប្រព័ន្ធ និង Pre-warm Workspace..."
                      : "Synchronizing live telemetry & pre-warming workspace..."}
                  </p>
                </div>
              </div>

              {/* Step checklist */}
              <div className="space-y-2">
                {STAGES.map((s) => {
                  const isDone = completedSteps.includes(s.id);
                  const isCurrent = currentStep === s.id && !isDone;
                  const Icon = s.icon;

                  return (
                    <div
                      key={s.id}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition-all duration-200 ${
                        isDone
                          ? "bg-emerald-950/20 border-emerald-500/40 text-slate-200 shadow-sm"
                          : isCurrent
                          ? "bg-cyan-950/30 border-cyan-500/60 text-cyan-200 shadow-md shadow-cyan-500/10"
                          : "bg-slate-900/30 border-slate-800/60 text-slate-500 opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs transition-colors ${
                            isDone
                              ? "bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/30"
                              : isCurrent
                              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                              : "bg-slate-800/60 text-slate-600"
                          }`}
                        >
                          {isDone ? (
                            <Check className="w-4 h-4 stroke-[3]" />
                          ) : (
                            <Icon className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <span className="text-xs font-semibold truncate">
                          {isKhmer ? s.titleKm : s.titleEn}
                        </span>
                      </div>

                      <div className="shrink-0 ml-2">
                        {isDone ? (
                          <span className="text-[11px] font-semibold text-emerald-400">
                            {isKhmer ? "រួចរាល់" : "Ready"}
                          </span>
                        ) : isCurrent ? (
                          <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-700 block" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span className="flex items-center gap-1.5 text-cyan-400">
                    <Activity className="w-3.5 h-3.5 animate-pulse" />
                    <span>{isKhmer ? "វឌ្ឍនភាពដំណើរការ" : "Workspace Progress"}</span>
                  </span>
                  <span className="font-bold text-slate-200">{progress}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                  <div
                    className="h-full bg-linear-to-r from-emerald-500 via-teal-400 to-cyan-500 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Dashboard Workspace ── */}
      {isInitialReady && (
        <DashboardProvider>
          <PageTransition className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            <main className="flex-1 p-3.5 sm:p-4 lg:p-4 xl:p-6 max-w-7xl w-full mx-auto space-y-4 lg:space-y-5">
              {/* Header with View Presets & Action Toolbar */}
              <div
                style={{ "--enter-i": 0 } as React.CSSProperties}
                className="enter-up"
              >
                <DashboardHeader />
              </div>

              {/* Dynamic, flexible grid */}
              <div
                style={{ "--enter-i": 1 } as React.CSSProperties}
                className="enter-up"
              >
                <DashboardGrid
                  selectedFilter={selectedFilter}
                  setSelectedFilter={setSelectedFilter}
                  filterExtras={filterExtras}
                  setFilterExtras={setFilterExtras}
                />
              </div>

              {/* Add / Toggle Widgets Modal */}
              <AddWidgetModal />
            </main>
          </PageTransition>
        </DashboardProvider>
      )}
    </>
  );
}
