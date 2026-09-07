"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Award, ChevronRight, User, TrendingUp, Clock, CheckCircle2, ArrowDown } from "lucide-react";
import { fetchEngineerKpiReport, type EngineerKpiRow } from "@/services/reports";
import { useDashboard } from "../useDashboardStore";
import { useI18n } from "@/i18n/LanguageProvider";

export default function EngineerKpiWidget() {
  const [engineers, setEngineers] = useState<EngineerKpiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { isPrivacyMode } = useDashboard();
  const { lang } = useI18n();

  const PAGE_SIZE = 25;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    let alive = true;
    async function loadKpi() {
      try {
        const from = new Date();
        from.setDate(1); // Start of month
        const to = new Date();

        const rows = await fetchEngineerKpiReport({
          fromDate: from,
          toDate: to,
        });

        if (alive) {
          setEngineers(rows);
        }
      } catch (err) {
        console.warn("Failed to load engineer KPI:", err);
      } finally {
        if (alive) setLoading(false);
      }
    }

    void loadKpi();
    return () => {
      alive = false;
    };
  }, []);

  const displayedEngineers = useMemo(() => {
    return engineers.slice(0, visibleCount);
  }, [engineers, visibleCount]);

  const hasMore = visibleCount < engineers.length;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 40) {
      if (hasMore) {
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, engineers.length));
      }
    }
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, engineers.length));
  };

  return (
    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 p-4 shadow-xs flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                {lang === "km" ? "សមិទ្ធផល & KPI ជាងជួសជុល" : "Technician KPI Scorecard"}
              </h3>
              {engineers.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
                  {hasMore ? `${displayedEngineers.length}/${engineers.length}` : engineers.length}
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {lang === "km"
                ? "ចំណាត់ថ្នាក់ ល្បឿនជួសជុល (MTTR) និងអត្រាជោគជ័យប្រចាំខែ"
                : "Top engineers ranked by completion speed & success rate"}
            </p>
          </div>
        </div>

        <Link
          href="/engineer-kpi-report"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 font-medium"
        >
          <span>{lang === "km" ? "របាយការណ៍ KPI" : "Full Scorecard"}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Engineer List */}
      <div
        onScroll={handleScroll}
        className="flex-1 space-y-2 overflow-y-auto max-h-[340px] pr-1 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-600"
      >
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 animate-pulse"
              />
            ))}
          </div>
        ) : engineers.length === 0 ? (
          <div className="py-8 text-center flex flex-col items-center justify-center gap-1.5 text-zinc-400 dark:text-zinc-500">
            <User className="w-8 h-8 text-zinc-400/70" />
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              {lang === "km"
                ? "មិនទាន់មានទិន្នន័យ KPI ខែនេះនៅឡើយ"
                : "No KPI data available for current month"}
            </span>
          </div>
        ) : (
          <>
            {displayedEngineers.map((eng) => {
              const isTop = eng.rank === 1;
              const isSecond = eng.rank === 2;

              return (
                <div
                  key={eng.engineerName}
                  className="p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-800/30 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/60 transition-colors flex items-center justify-between gap-3"
                >
                  {/* Left: Rank & Name */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isTop
                          ? "bg-amber-400 text-amber-950 shadow-xs"
                          : isSecond
                          ? "bg-zinc-300 dark:bg-zinc-600 text-zinc-800 dark:text-zinc-100"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      {eng.rank}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                          {isPrivacyMode ? "Tech #" + eng.rank : eng.engineerName}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                          {eng.grade}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                        <span>
                          {lang === "km" ? "រួចរាល់:" : "Done:"}{" "}
                          <strong className="text-emerald-600 dark:text-emerald-400">
                            {eng.finishedJobs}/{eng.assignedJobs}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          {lang === "km" ? "ជោគជ័យ:" : "Rate:"}{" "}
                          <strong className="text-zinc-800 dark:text-zinc-200">
                            {eng.successRate}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: MTTR & WIP */}
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 justify-end text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      <Clock className="w-3 h-3 text-zinc-400" />
                      <span>{eng.avgDays} {lang === "km" ? "ថ្ងៃ/គ្រឿង" : "d avg"}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {lang === "km" ? "កំពុងកាន់:" : "Active WIP:"} {eng.activeWip}
                    </span>
                  </div>
                </div>
              );
            })}

            {hasMore && (
              <div className="pt-2 pb-1">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  className="w-full py-1.5 px-2 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all shadow-2xs group cursor-pointer"
                >
                  <ArrowDown className="w-3 h-3 group-hover:translate-y-0.5 transition-transform" />
                  <span>
                    {lang === "km"
                      ? `រមូរចុះ ឬចុចផ្ទុក ២៥ ទៀត (${displayedEngineers.length}/${engineers.length})`
                      : `Scroll down or load next 25 (${displayedEngineers.length}/${engineers.length})`}
                  </span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
        <span>
          {lang === "km" ? "សរុបជាងក្នុងខែនេះ:" : "Active Techs this Month:"}{" "}
          <strong className="text-zinc-900 dark:text-white font-semibold">
            {engineers.length}
          </strong>
        </span>
        <Link
          href="/engineer-report"
          className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
        >
          {lang === "km" ? "របាយការណ៍លម្អិតជាង" : "Engineer Analytics"}
        </Link>
      </div>
    </div>
  );
}
