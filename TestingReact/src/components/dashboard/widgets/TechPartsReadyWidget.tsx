"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, User, Wrench, Sparkles, Play, ArrowDown } from "lucide-react";
import { useTicketSeries, statusIs } from "@/hooks/useTicketSeries";
import { useDashboard } from "../useDashboardStore";
import { useI18n } from "@/i18n/LanguageProvider";

export default function TechPartsReadyWidget() {
  const { items, loading } = useTicketSeries();
  const { isPrivacyMode } = useDashboard();
  const { lang } = useI18n();

  const PAGE_SIZE = 25;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Tickets where spare parts were dispatched from stock to technician
  const readyTickets = useMemo(() => {
    if (!items || items.length === 0) return [];

    return items.filter((ticket) => {
      return statusIs(ticket, "sent sparepart") || statusIs(ticket, "sentspareparts");
    });
  }, [items]);

  const displayedTickets = useMemo(() => {
    return readyTickets.slice(0, visibleCount);
  }, [readyTickets, visibleCount]);

  const hasMore = visibleCount < readyTickets.length;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 40) {
      if (hasMore) {
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, readyTickets.length));
      }
    }
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, readyTickets.length));
  };

  return (
    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 p-4 shadow-xs flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                {lang === "km" ? "គ្រឿងបន្លាស់មកដល់តុជាង (រួចរាល់)" : "Parts Ready on Bench"}
              </h3>
              {readyTickets.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                  {hasMore ? `${displayedTickets.length}/${readyTickets.length}` : readyTickets.length}
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {lang === "km"
                ? "គ្រឿងបន្លាស់បានបញ្ជូនពីឃ្លាំងរួចរាល់ អាចចាប់ផ្តើមជួសជុលបានភ្លាម"
                : "Spares dispatched to bench — ready for immediate installation"}
            </p>
          </div>
        </div>

        <Link
          href="/approve-repair"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 font-medium"
        >
          <span>{lang === "km" ? "ជួសជុល" : "Start Repairs"}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* List */}
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
        ) : readyTickets.length === 0 ? (
          <div className="py-8 text-center flex flex-col items-center justify-center gap-1.5 text-zinc-400 dark:text-zinc-500">
            <CheckCircle2 className="w-8 h-8 text-emerald-500/70" />
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              {lang === "km"
                ? "គ្មានម៉ាស៊ីនរង់ចាំដំឡើងគ្រឿងបន្លាស់ឡើយ!"
                : "No parts waiting on bench!"}
            </span>
            <span className="text-[11px]">
              {lang === "km"
                ? "រាល់គ្រឿងដែលបានបញ្ជូនមកត្រូវបានជាងដំឡើងជួសជុលរួចរាល់"
                : "All dispatched parts have been assembled and fixed"}
            </span>
          </div>
        ) : (
          <>
            {displayedTickets.map((ticket) => {
              const techName =
                ticket.repairByName ||
                ticket.inspectByName ||
                ticket.createdByName ||
                (lang === "km" ? "ជាងមិនទាន់បញ្ជាក់" : "Unassigned");

              return (
                <div
                  key={ticket.id}
                  className="p-2.5 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/30 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                        {ticket.reportNo}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        {lang === "km" ? "✓ គ្រឿងរួចរាល់" : "✓ Spares Ready"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                        {isPrivacyMode ? "••••••••" : ticket.companyName || "N/A"}
                      </span>
                      <span>•</span>
                      <span className="truncate">{ticket.itemName || "Machine"}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <User className="w-3 h-3 text-zinc-400" />
                      <span className="truncate max-w-[90px]">{techName}</span>
                    </div>
                    <Link
                      href={`/service-tickets?reportNo=${encodeURIComponent(ticket.reportNo)}`}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-2xs"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>{lang === "km" ? "ជួសជុលភ្លាម" : "Start Fix"}</span>
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
                  className="w-full py-1.5 px-2 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all shadow-2xs group cursor-pointer"
                >
                  <ArrowDown className="w-3 h-3 group-hover:translate-y-0.5 transition-transform" />
                  <span>
                    {lang === "km"
                      ? `រមូរចុះ ឬចុចផ្ទុក ២៥ ទៀត (${displayedTickets.length}/${readyTickets.length})`
                      : `Scroll down or load next 25 (${displayedTickets.length}/${readyTickets.length})`}
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
          {lang === "km" ? "សរុបគ្រឿងរួចរាល់លើតុ:" : "Ready on Tech Bench:"}{" "}
          <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">
            {readyTickets.length}
          </strong>
        </span>
        <Link
          href="/pending-repairs"
          className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
        >
          {lang === "km" ? "បញ្ជីកំពុងជួសជុល" : "Pending Repairs"}
        </Link>
      </div>
    </div>
  );
}
