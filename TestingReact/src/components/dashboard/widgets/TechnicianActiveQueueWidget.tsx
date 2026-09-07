"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Wrench, ChevronRight, User, AlertCircle, CheckCircle2, Play, ArrowDown } from "lucide-react";
import { useTicketSeries, statusIs } from "@/hooks/useTicketSeries";
import { useDashboard } from "../useDashboardStore";
import { useI18n } from "@/i18n/LanguageProvider";

export default function TechnicianActiveQueueWidget() {
  const { items, loading } = useTicketSeries();
  const { isPrivacyMode } = useDashboard();
  const { lang } = useI18n();

  const PAGE_SIZE = 25;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Find active workshop repairs (Inspecting or Repairing)
  const activeTechTickets = useMemo(() => {
    if (!items || items.length === 0) return [];

    return items.filter((ticket) => {
      const isInspecting = statusIs(ticket, "inspect");
      const isRepairing = statusIs(ticket, "repair") && !statusIs(ticket, "finish");
      return isInspecting || isRepairing;
    });
  }, [items]);

  const displayedTickets = useMemo(() => {
    return activeTechTickets.slice(0, visibleCount);
  }, [activeTechTickets, visibleCount]);

  const hasMore = visibleCount < activeTechTickets.length;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 40) {
      if (hasMore) {
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, activeTechTickets.length));
      }
    }
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, activeTechTickets.length));
  };

  return (
    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 p-4 shadow-xs flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <Wrench className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                {lang === "km" ? "ជួរការងារជាងកំពុងដំណើរការ" : "Active Diagnosis & Repair Queue"}
              </h3>
              {activeTechTickets.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60">
                  {hasMore ? `${displayedTickets.length}/${activeTechTickets.length}` : activeTechTickets.length}
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {lang === "km"
                ? "ម៉ាស៊ីនស្ថិតក្នុងដំណាក់កាល កំពុងពិនិត្យ & កំពុងជួសជុលជាក់ស្តែង"
                : "Active machines currently in diagnosis or on technician benches"}
            </p>
          </div>
        </div>

        <Link
          href="/pending-repairs"
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
        ) : activeTechTickets.length === 0 ? (
          <div className="py-8 text-center flex flex-col items-center justify-center gap-1.5 text-zinc-400 dark:text-zinc-500">
            <CheckCircle2 className="w-8 h-8 text-teal-500/70" />
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              {lang === "km"
                ? "គ្មានម៉ាស៊ីនកកស្ទះក្នុងការពិនិត្យ ឬជួសជុលឡើយ!"
                : "No pending repair bottlenecks!"}
            </span>
            <span className="text-[11px]">
              {lang === "km"
                ? "រាល់ម៉ាស៊ីនទាំងអស់ត្រូវបានបំពេញការងាររួចរាល់តាមកាលវិភាគ"
                : "All workshop diagnosis and repair tasks are up to date"}
            </span>
          </div>
        ) : (
          <>
            {displayedTickets.map((ticket) => {
              const isInspecting = statusIs(ticket, "inspect");
              const techName =
                ticket.repairByName ||
                ticket.inspectByName ||
                ticket.createdByName ||
                (lang === "km" ? "ជាងមិនទាន់បញ្ជាក់" : "Unassigned");

              const isHighPriority =
                (ticket.servicePriority || "").toLowerCase().includes("high") ||
                (ticket.servicePriority || "").toLowerCase().includes("urgent");

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
                          isInspecting
                            ? "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800"
                            : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
                        }`}
                      >
                        {isInspecting
                          ? lang === "km"
                            ? "កំពុងពិនិត្យ"
                            : "Inspecting"
                          : lang === "km"
                          ? "កំពុងជួសជុល"
                          : "Repairing"}
                      </span>
                      {isHighPriority && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                          {lang === "km" ? "បន្ទាន់" : "Urgent"}
                        </span>
                      )}
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
                      className="text-[10px] font-semibold px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors flex items-center gap-1"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>{lang === "km" ? "ដំណើរការ" : "Action"}</span>
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
                  className="w-full py-1.5 px-2 rounded-xl border border-teal-200 dark:border-teal-900 bg-teal-50/70 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all shadow-2xs group cursor-pointer"
                >
                  <ArrowDown className="w-3 h-3 group-hover:translate-y-0.5 transition-transform" />
                  <span>
                    {lang === "km"
                      ? `រមូរចុះ ឬចុចផ្ទុក ២៥ ទៀត (${displayedTickets.length}/${activeTechTickets.length})`
                      : `Scroll down or load next 25 (${displayedTickets.length}/${activeTechTickets.length})`}
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
          {lang === "km" ? "សរុបកំពុងដំណើរការ:" : "Active in Workshop:"}{" "}
          <strong className="text-zinc-900 dark:text-white font-semibold">
            {activeTechTickets.length}
          </strong>
        </span>
        <Link
          href="/inspect-item"
          className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
        >
          <span>{lang === "km" ? "ពិនិត្យម៉ាស៊ីន (Inspect)" : "Inspect Center"}</span>
        </Link>
      </div>
    </div>
  );
}
