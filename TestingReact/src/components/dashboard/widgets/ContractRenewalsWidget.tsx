"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { FileCheck, ChevronRight, Phone, Building2, RefreshCw, AlertCircle, ArrowDown } from "lucide-react";
import { fetchContractRenewalReport, type ContractRenewalRow } from "@/services/reports";
import { useDashboard } from "../useDashboardStore";
import { useI18n } from "@/i18n/LanguageProvider";

export default function ContractRenewalsWidget() {
  const [contracts, setContracts] = useState<ContractRenewalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { isPrivacyMode } = useDashboard();
  const { lang } = useI18n();

  const PAGE_SIZE = 25;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    let alive = true;
    async function loadContracts() {
      try {
        const from = new Date();
        from.setDate(from.getDate() - 90); // last 90 days of contract data
        const to = new Date();

        const rows = await fetchContractRenewalReport({
          fromDate: from,
          toDate: to,
        });

        if (alive) {
          setContracts(rows);
        }
      } catch (err) {
        console.warn("Failed to load contract renewals:", err);
      } finally {
        if (alive) setLoading(false);
      }
    }

    void loadContracts();
    return () => {
      alive = false;
    };
  }, []);

  const displayedContracts = useMemo(() => {
    return contracts.slice(0, visibleCount);
  }, [contracts, visibleCount]);

  const hasMore = visibleCount < contracts.length;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 40) {
      if (hasMore) {
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, contracts.length));
      }
    }
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, contracts.length));
  };

  return (
    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 p-4 shadow-xs flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <FileCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                {lang === "km" ? "កិច្ចសន្យាថែទាំ & បន្តកុងត្រា (AMC)" : "Service Contract Renewals"}
              </h3>
              {contracts.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                  {hasMore ? `${displayedContracts.length}/${contracts.length}` : contracts.length}
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {lang === "km"
                ? "អតិថិជនសាជីវកម្មមានកិច្ចសន្យា ឬមកជួសជុលញឹកញាប់"
                : "Corporate accounts with maintenance SLA or recurring repairs"}
            </p>
          </div>
        </div>

        <Link
          href="/contract-renewal-report"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 font-medium"
        >
          <span>{lang === "km" ? "មើលទាំងអស់" : "View all"}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Contract List */}
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
        ) : contracts.length === 0 ? (
          <div className="py-8 text-center flex flex-col items-center justify-center gap-1.5 text-zinc-400 dark:text-zinc-500">
            <Building2 className="w-8 h-8 text-zinc-400/70" />
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              {lang === "km"
                ? "មិនទាន់មានកិច្ចសន្យាជិតផុតកំណត់ឡើយ"
                : "No pending contract renewals"}
            </span>
          </div>
        ) : (
          <>
            {displayedContracts.map((c) => {
              const hasContract = c.contractStatus === "Active Contract";

              return (
                <div
                  key={c.companyName}
                  className="p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-800/30 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/60 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                        {isPrivacyMode ? "Corporate Client" : c.companyName}
                      </span>
                      <span
                        className={`px-2 py-0.2 rounded-full text-[9px] font-bold border ${
                          hasContract
                            ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
                            : "bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800"
                        }`}
                      >
                        {hasContract
                          ? lang === "km"
                            ? "មានកិច្ចសន្យា"
                            : "Active AMC"
                          : lang === "km"
                          ? "ជួសជុលញឹកញាប់"
                          : "High Walk-in"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      <span className="truncate">
                        {c.contactName || (lang === "km" ? "ទំនាក់ទំនង" : "Contact")}
                      </span>
                      <span>•</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {c.totalRepairs} {lang === "km" ? "ជួសជុល" : "repairs"}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <span className="text-[10px] text-zinc-500 truncate max-w-[130px]">
                      {c.suggestedAction}
                    </span>
                    <Link
                      href={`/contract-renewal-report?search=${encodeURIComponent(c.companyName)}`}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors flex items-center gap-1"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>{lang === "km" ? "បន្តកិច្ចសន្យា" : "Renew AMC"}</span>
                    </Link>
                  </div>
                </div>
              );
            })}

            {hasMore && (
              <div className="pt-2 pb-1">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  className="w-full py-1.5 px-2 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all shadow-2xs group cursor-pointer"
                >
                  <ArrowDown className="w-3 h-3 group-hover:translate-y-0.5 transition-transform" />
                  <span>
                    {lang === "km"
                      ? `រមូរចុះ ឬចុចផ្ទុក ២៥ ទៀត (${displayedContracts.length}/${contracts.length})`
                      : `Scroll down or load next 25 (${displayedContracts.length}/${contracts.length})`}
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
          {lang === "km" ? "សរុបគណនីសាជីវកម្ម:" : "Corporate Accounts:"}{" "}
          <strong className="text-indigo-600 dark:text-indigo-400 font-semibold">
            {contracts.length}
          </strong>
        </span>
        <Link
          href="/contract-report"
          className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
        >
          {lang === "km" ? "របាយការណ៍កិច្ចសន្យា" : "Contracts Directory"}
        </Link>
      </div>
    </div>
  );
}
