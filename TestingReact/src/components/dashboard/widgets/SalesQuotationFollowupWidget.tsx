"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { PhoneCall, ChevronRight, Clock, AlertTriangle, CheckCircle2, User, ArrowDown } from "lucide-react";
import { useTicketSeries, statusIs } from "@/hooks/useTicketSeries";
import { useDashboard } from "../useDashboardStore";
import { useI18n } from "@/i18n/LanguageProvider";

export default function SalesQuotationFollowupWidget() {
  const { items, loading } = useTicketSeries();
  const { isPrivacyMode } = useDashboard();
  const { lang } = useI18n();

  const PAGE_SIZE = 25;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Tickets awaiting customer quote confirmation
  const quoteTickets = useMemo(() => {
    if (!items || items.length === 0) return [];

    const now = Date.now();
    return items
      .filter((ticket) => {
        return (
          statusIs(ticket, "awaiting customer") ||
          statusIs(ticket, "waiting confirm") ||
          statusIs(ticket, "awaitingcustomerconfirm")
        );
      })
      .map((ticket) => {
        const rawDate = ticket.serviceDate;
        const createdMs = rawDate ? new Date(rawDate).getTime() : now;
        const daysWaiting = Math.max(0, Math.floor((now - createdMs) / (24 * 3600 * 1000)));
        return {
          ...ticket,
          daysWaiting,
          isAging: daysWaiting >= 3,
        };
      })
      .sort((a, b) => b.daysWaiting - a.daysWaiting);
  }, [items]);

  const displayedTickets = useMemo(() => {
    return quoteTickets.slice(0, visibleCount);
  }, [quoteTickets, visibleCount]);

  const hasMore = visibleCount < quoteTickets.length;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 40) {
      if (hasMore) {
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, quoteTickets.length));
      }
    }
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, quoteTickets.length));
  };

  return (
    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 p-4 shadow-xs flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <PhoneCall className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                {lang === "km" ? "តាមដានសម្រង់តម្លៃ (Awaiting Customer)" : "Quotation Follow-up Queue"}
              </h3>
              {quoteTickets.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
                  {hasMore ? `${displayedTickets.length}/${quoteTickets.length}` : quoteTickets.length}
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {lang === "km"
                ? "សម្រង់តម្លៃកំពុងរង់ចាំអតិថិជនយល់ព្រមជួសជុល (Alert បើ > ៣ ថ្ងៃ)"
                : "Quotes pending customer confirmation, sorted by waiting days"}
            </p>
          </div>
        </div>

        <Link
          href="/sales-followup"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 font-medium"
        >
          <span>{lang === "km" ? "មើលទាំងអស់" : "View all"}</span>
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
        ) : quoteTickets.length === 0 ? (
          <div className="py-8 text-center flex flex-col items-center justify-center gap-1.5 text-zinc-400 dark:text-zinc-500">
            <CheckCircle2 className="w-8 h-8 text-emerald-500/70" />
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              {lang === "km"
                ? "គ្មានសម្រង់តម្លៃរង់ចាំការឆ្លើយតបឡើយ!"
                : "No pending quotation backlog!"}
            </span>
            <span className="text-[11px]">
              {lang === "km"
                ? "អតិថិជនបានឆ្លើយតបរាល់សម្រង់តម្លៃទាំងអស់រួចរាល់"
                : "All client repair quotations have been processed and confirmed"}
            </span>
          </div>
        ) : (
          <>
            {displayedTickets.map((ticket) => {
              return (
                <div
                  key={ticket.id}
                  className={`p-2.5 rounded-xl border transition-colors flex items-center justify-between gap-3 ${
                    ticket.isAging
                      ? "bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-900/60 hover:bg-rose-100/50 dark:hover:bg-rose-950/40"
                      : "bg-zinc-50/50 dark:bg-zinc-800/30 border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/60"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                        {ticket.reportNo}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                          ticket.isAging
                            ? "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 animate-pulse"
                            : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                        }`}
                      >
                        <Clock className="w-2.5 h-2.5" />
                        {ticket.daysWaiting} {lang === "km" ? "ថ្ងៃ" : "days"}
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
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {ticket.phoneNumber ? (isPrivacyMode ? "•••-•••" : ticket.phoneNumber) : "No Phone"}
                    </span>
                    <Link
                      href={`/confirmed-sale?reportNo=${encodeURIComponent(ticket.reportNo)}`}
                      className="text-[10px] font-semibold px-2.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
                    >
                      {lang === "km" ? "សម្រេចលក់" : "Confirm"}
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
                  className="w-full py-1.5 px-2 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all shadow-2xs group cursor-pointer"
                >
                  <ArrowDown className="w-3 h-3 group-hover:translate-y-0.5 transition-transform" />
                  <span>
                    {lang === "km"
                      ? `រមូរចុះ ឬចុចផ្ទុក ២៥ ទៀត (${displayedTickets.length}/${quoteTickets.length})`
                      : `Scroll down or load next 25 (${displayedTickets.length}/${quoteTickets.length})`}
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
          {lang === "km" ? "សរុបសម្រង់រង់ចាំ:" : "Quotes in Review:"}{" "}
          <strong className="text-zinc-900 dark:text-white font-semibold">
            {quoteTickets.length}
          </strong>
        </span>
        <Link
          href="/confirmed-sale"
          className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
        >
          <span>{lang === "km" ? "បញ្ជីសម្រេចលក់" : "Confirmed Sales"}</span>
        </Link>
      </div>
    </div>
  );
}
