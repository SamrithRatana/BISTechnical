"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { PackageSearch, ChevronRight, User, Wrench, CheckCircle2, ArrowDown } from "lucide-react";
import { useTicketSeries, statusIs } from "@/hooks/useTicketSeries";
import { useDashboard } from "../useDashboardStore";
import { useI18n } from "@/i18n/LanguageProvider";

export default function StockSpareRequestsWidget() {
  const { items, loading } = useTicketSeries();
  const { isPrivacyMode } = useDashboard();
  const { lang } = useI18n();

  const PAGE_SIZE = 25;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Find tickets waiting for spare parts or where spare parts were dispatched
  const spareTickets = useMemo(() => {
    if (!items || items.length === 0) return [];

    return items.filter((ticket) => {
      const isAwaitingSpares =
        statusIs(ticket, "awaiting sparepart") ||
        statusIs(ticket, "sparepart") ||
        statusIs(ticket, "awaitingsparepart");
      const isSentSpares = statusIs(ticket, "sent sparepart");
      return isAwaitingSpares || isSentSpares;
    });
  }, [items]);

  const displayedTickets = useMemo(() => {
    return spareTickets.slice(0, visibleCount);
  }, [spareTickets, visibleCount]);

  const hasMore = visibleCount < spareTickets.length;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 40) {
      if (hasMore) {
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, spareTickets.length));
      }
    }
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, spareTickets.length));
  };

  return (
    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 p-4 shadow-xs flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <PackageSearch className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                {lang === "km" ? "គ្រឿងបន្លាស់ស្នើសុំដោយជាង" : "Spare Parts Needed by Techs"}
              </h3>
              {spareTickets.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60">
                  {hasMore ? `${displayedTickets.length}/${spareTickets.length}` : spareTickets.length}
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {lang === "km"
                ? "ម៉ាស៊ីនកំពុងរង់ចាំគ្រឿងបន្លាស់ ឬទើបបានបញ្ជូនទៅជាង"
                : "Active repairs awaiting stock allocation or dispatched to bench"}
            </p>
          </div>
        </div>

        <Link
          href="/spare-request"
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
        ) : spareTickets.length === 0 ? (
          <div className="py-8 text-center flex flex-col items-center justify-center gap-1.5 text-zinc-400 dark:text-zinc-500">
            <CheckCircle2 className="w-8 h-8 text-emerald-500/70" />
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              {lang === "km"
                ? "គ្មានម៉ាស៊ីនរង់ចាំគ្រឿងបន្លាស់ឡើយ!"
                : "No pending spare part bottlenecks!"}
            </span>
            <span className="text-[11px]">
              {lang === "km"
                ? "គ្រឿងបន្លាស់ទាំងអស់ត្រូវបានផ្គត់ផ្គង់ដល់ជាងរួចរាល់"
                : "All workshop repairs have necessary spare parts supplied"}
            </span>
          </div>
        ) : (
          <>
            {displayedTickets.map((ticket) => {
              const isSent = statusIs(ticket, "sent sparepart");
              const techName =
                ticket.repairByName ||
                ticket.inspectByName ||
                ticket.createdByName ||
                (lang === "km" ? "ជាងមិនទាន់បញ្ជាក់" : "Unassigned Tech");

              return (
                <div
                  key={ticket.id}
                  className="p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-800/30 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/60 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                        {ticket.reportNo}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          isSent
                            ? "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                            : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                        }`}
                      >
                        {isSent
                          ? lang === "km"
                            ? "បានបញ្ជូនគ្រឿងទៅជាង"
                            : "Spares Sent to Tech"
                          : lang === "km"
                          ? "រង់ចាំគ្រឿងបន្លាស់"
                          : "Awaiting Spare Part"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate">
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
                      className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                    >
                      {lang === "km" ? "ពិនិត្យ" : "Open"}
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
                  className="w-full py-1.5 px-2 rounded-xl border border-purple-200 dark:border-purple-900 bg-purple-50/70 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all shadow-2xs group cursor-pointer"
                >
                  <ArrowDown className="w-3 h-3 group-hover:translate-y-0.5 transition-transform" />
                  <span>
                    {lang === "km"
                      ? `រមូរចុះ ឬចុចផ្ទុក ២៥ ទៀត (${displayedTickets.length}/${spareTickets.length})`
                      : `Scroll down or load next 25 (${displayedTickets.length}/${spareTickets.length})`}
                  </span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer shortcut */}
      <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
        <span>
          {lang === "km" ? "សរុបរង់ចាំ/បញ្ជូន:" : "Pending Parts Queue:"}{" "}
          <strong className="text-zinc-900 dark:text-white font-semibold">
            {spareTickets.length}
          </strong>
        </span>
        <Link
          href="/spareparts"
          className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
        >
          <Wrench className="w-3 h-3" />
          <span>{lang === "km" ? "ស្តុកគ្រឿងបន្លាស់" : "Spare Parts Catalog"}</span>
        </Link>
      </div>
    </div>
  );
}
