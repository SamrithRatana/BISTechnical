"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Clock, ChevronRight, EyeOff, ArrowDown } from "lucide-react";
import { useTicketSeries, statusIs } from "@/hooks/useTicketSeries";
import { useDashboard } from "../useDashboardStore";
import { useI18n } from "@/i18n/LanguageProvider";
import { Badge } from "@/components/av";

export default function UrgentTicketsWidget() {
  const { items, loading } = useTicketSeries();
  const { isPrivacyMode } = useDashboard();
  const { lang } = useI18n();

  const PAGE_SIZE = 25;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const urgentTickets = useMemo(() => {
    if (!items || items.length === 0) return [];

    const now = Date.now();
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

    // Filter tickets that are not finished or delivered, and have aged > 3 days or marked priority
    return items.filter((ticket) => {
      const isClosed = statusIs(ticket, "finish") || statusIs(ticket, "deliver");
      if (isClosed) return false;

      const dateStr = ticket.serviceDate;
      if (!dateStr) return false;
      const createdTime = new Date(dateStr).getTime();
      const ageMs = now - createdTime;

      return ageMs >= THREE_DAYS_MS;
    });
  }, [items]);

  const displayedTickets = useMemo(() => {
    return urgentTickets.slice(0, visibleCount);
  }, [urgentTickets, visibleCount]);

  const hasMore = visibleCount < urgentTickets.length;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 40) {
      if (hasMore) {
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, urgentTickets.length));
      }
    }
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, urgentTickets.length));
  };

  return (
    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 p-4 shadow-xs flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                {lang === "km" ? "ជួសជុលបន្ទាន់ & រង់ចាំយូរ (> ៣ ថ្ងៃ)" : "Urgent & Aging Queue (> 3 Days)"}
              </h3>
              {urgentTickets.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60">
                  {hasMore ? `${displayedTickets.length}/${urgentTickets.length}` : urgentTickets.length}
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {lang === "km"
                ? "ម៉ាស៊ីនដែលមិនទាន់ដំណើរការរួចរាល់លើសពី ៣ ថ្ងៃ"
                : "Active tickets waiting longer than standard turnaround"}
            </p>
          </div>
        </div>

        <Link
          href="/service-tickets"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 font-medium"
        >
          <span>{lang === "km" ? "មើលទាំងអស់" : "View all"}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div
        onScroll={handleScroll}
        className="flex-1 space-y-2 overflow-y-auto max-h-[340px] pr-1 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-600"
      >
        {loading && urgentTickets.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-400 animate-pulse">
            {lang === "km" ? "កំពុងផ្ទុកទិន្នន័យ..." : "Scanning tickets..."}
          </div>
        ) : urgentTickets.length === 0 ? (
          <div className="py-8 text-center text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/40 dark:border-emerald-900/40">
            ✓ {lang === "km" ? "គ្មានសំបុត្រដែលរង់ចាំយូរហួសកំណត់ឡើយ!" : "No aging or overdue tickets pending!"}
          </div>
        ) : (
          <>
            {displayedTickets.map((ticket) => {
              const ageDays = Math.max(
                1,
                Math.floor(
                  (Date.now() - new Date(ticket.serviceDate || "").getTime()) /
                    (24 * 60 * 60 * 1000)
                )
              );

              return (
                <div
                  key={ticket.id}
                  className="p-2.5 rounded-xl bg-zinc-50/60 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-900 dark:text-white truncate">
                        {ticket.reportNo || `#${ticket.id.slice(0, 8)}`}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                        {ageDays}d old
                      </span>
                    </div>

                    <p className="text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                      {isPrivacyMode
                        ? "••••••••••"
                        : ticket.companyName || (lang === "km" ? "គ្មានឈ្មោះក្រុមហ៊ុន" : "No Company")}{" "}
                      - {ticket.itemName || (lang === "km" ? "ម៉ាស៊ីន" : "Machine")}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge tone="warning">
                      {ticket.status || "Pending"}
                    </Badge>
                  </div>
                </div>
              );
            })}

            {hasMore && (
              <div className="pt-2 pb-1">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  className="w-full py-1.5 px-2 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all shadow-2xs group cursor-pointer"
                >
                  <ArrowDown className="w-3 h-3 group-hover:translate-y-0.5 transition-transform" />
                  <span>
                    {lang === "km"
                      ? `រមូរចុះ ឬចុចផ្ទុក ២៥ ទៀត (${displayedTickets.length}/${urgentTickets.length})`
                      : `Scroll down or load next 25 (${displayedTickets.length}/${urgentTickets.length})`}
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
          {lang === "km" ? "សរុបបន្ទាន់/រង់ចាំយូរ:" : "Total Aging Tickets:"}{" "}
          <strong className="text-rose-600 dark:text-rose-400 font-semibold">
            {urgentTickets.length}
          </strong>
        </span>
        <Link
          href="/service-tickets"
          className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
        >
          {lang === "km" ? "គ្រប់គ្រងសំបុត្រ" : "Manage Tickets"}
        </Link>
      </div>
    </div>
  );
}
