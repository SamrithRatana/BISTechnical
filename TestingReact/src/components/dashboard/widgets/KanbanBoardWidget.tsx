"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  Inbox,
  Search,
  Clock,
  Wrench,
  CheckCircle2,
  MoreHorizontal,
  ArrowRight,
  ArrowDown,
  ExternalLink,
  LayoutGrid,
  Columns3,
  X,
} from "lucide-react";
import { useTicketSeries, statusIs } from "@/hooks/useTicketSeries";
import { useDashboard } from "../useDashboardStore";
import { useI18n } from "@/i18n/LanguageProvider";
import { RepairServiceItem } from "@/services/types";

interface KanbanColumnDef {
  id: string;
  title: string;
  titleKm: string;
  icon: React.ElementType;
  color: string;
  badgeBg: string;
  accentBorder: string;
  match: (item: RepairServiceItem) => boolean;
}

const KANBAN_COLUMNS: KanbanColumnDef[] = [
  {
    id: "received",
    title: "Received",
    titleKm: "ទទួលម៉ាស៊ីន",
    icon: Inbox,
    color: "text-blue-600 dark:text-blue-400",
    badgeBg: "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60",
    accentBorder: "border-t-blue-500 dark:border-t-blue-400",
    match: (i) => statusIs(i, "reciev") || statusIs(i, "receiv"),
  },
  {
    id: "checking",
    title: "Checking",
    titleKm: "ត្រួតពិនិត្យ",
    icon: Search,
    color: "text-amber-600 dark:text-amber-400",
    badgeBg: "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60",
    accentBorder: "border-t-amber-500 dark:border-t-amber-400",
    match: (i) => statusIs(i, "check"),
  },
  {
    id: "awaiting",
    title: "Awaiting Approval",
    titleKm: "រង់ចាំសម្រេចចិត្ត",
    icon: Clock,
    color: "text-orange-600 dark:text-orange-400",
    badgeBg: "bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 border border-orange-200/60 dark:border-orange-800/60",
    accentBorder: "border-t-orange-500 dark:border-t-orange-400",
    match: (i) => statusIs(i, "awaiting") || statusIs(i, "quotation"),
  },
  {
    id: "repairing",
    title: "Repairing",
    titleKm: "កំពុងជួសជុល",
    icon: Wrench,
    color: "text-indigo-600 dark:text-indigo-400",
    badgeBg: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60",
    accentBorder: "border-t-indigo-500 dark:border-t-indigo-400",
    match: (i) => statusIs(i, "repairing"),
  },
  {
    id: "finished",
    title: "Finished",
    titleKm: "ជួសជុលរួចរាល់",
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
    badgeBg: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60",
    accentBorder: "border-t-emerald-500 dark:border-t-emerald-400",
    match: (i) => statusIs(i, "finish"),
  },
];

export default function KanbanBoardWidget() {
  const { items, loading } = useTicketSeries();
  const { isPrivacyMode } = useDashboard();
  const { lang } = useI18n();

  // Layout mode: "fit" fits all 5 columns cleanly on 1366x768; "spacious" provides wide scrollable columns
  const [layoutMode, setLayoutMode] = useState<"fit" | "spacious">("fit");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("kanban_layout_mode");
      if (saved === "fit" || saved === "spacious") {
        setLayoutMode(saved);
      }
    } catch {}
  }, []);

  const handleSetLayoutMode = (mode: "fit" | "spacious") => {
    setLayoutMode(mode);
    try {
      localStorage.setItem("kanban_layout_mode", mode);
    } catch {}
  };

  // Optimized 25-item pagination per column
  const PAGE_SIZE = 25;
  const [visibleLimits, setVisibleLimits] = useState<Record<string, number>>({
    received: PAGE_SIZE,
    checking: PAGE_SIZE,
    awaiting: PAGE_SIZE,
    repairing: PAGE_SIZE,
    finished: PAGE_SIZE,
  });

  // Reset limits when search query changes
  useEffect(() => {
    setVisibleLimits({
      received: PAGE_SIZE,
      checking: PAGE_SIZE,
      awaiting: PAGE_SIZE,
      repairing: PAGE_SIZE,
      finished: PAGE_SIZE,
    });
  }, [searchQuery]);

  // Filter items by quick search
  const filteredItems = useMemo(() => {
    if (!items || items.length === 0) return [];
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter((i) => {
      return (
        (i.reportNo && i.reportNo.toLowerCase().includes(q)) ||
        (i.itemName && i.itemName.toLowerCase().includes(q)) ||
        (i.companyName && i.companyName.toLowerCase().includes(q)) ||
        (i.serialNumber && i.serialNumber.toLowerCase().includes(q)) ||
        (i.serviceType && i.serviceType.toLowerCase().includes(q))
      );
    });
  }, [items, searchQuery]);

  const columnBuckets = useMemo(() => {
    const buckets: Record<string, RepairServiceItem[]> = {
      received: [],
      checking: [],
      awaiting: [],
      repairing: [],
      finished: [],
    };

    if (!filteredItems || filteredItems.length === 0) return buckets;

    filteredItems.forEach((item) => {
      for (const col of KANBAN_COLUMNS) {
        if (col.match(item)) {
          buckets[col.id].push(item);
          break;
        }
      }
    });

    return buckets;
  }, [filteredItems]);

  const totalVisibleCount = useMemo(() => {
    return Object.values(columnBuckets).reduce((acc, list) => acc + list.length, 0);
  }, [columnBuckets]);

  // On-scroll fast UI pagination: appends next 25 items when scrolling near bottom
  const handleColumnScroll = (colId: string, e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 60) {
      setVisibleLimits((prev) => {
        const current = prev[colId] ?? PAGE_SIZE;
        const total = columnBuckets[colId]?.length ?? 0;
        if (current >= total) return prev;
        return {
          ...prev,
          [colId]: Math.min(current + PAGE_SIZE, total),
        };
      });
    }
  };

  const handleLoadMore = (colId: string) => {
    setVisibleLimits((prev) => {
      const current = prev[colId] ?? PAGE_SIZE;
      const total = columnBuckets[colId]?.length ?? 0;
      if (current >= total) return prev;
      return {
        ...prev,
        [colId]: Math.min(current + PAGE_SIZE, total),
      };
    });
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs flex flex-col h-full overflow-hidden">
      {/* Top Header & Responsive Controls */}
      <div className="px-3.5 py-3 sm:px-4 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <span>
                {lang === "km"
                  ? "ក្ដារដំណាក់កាលការងារជួសជុល (Kanban Pipeline)"
                  : "Interactive Kanban Pipeline Board"}
              </span>
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              {totalVisibleCount} {lang === "km" ? "សំបុត្រ" : "tickets"}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            {lang === "km"
              ? "តាមដាន និងគ្រប់គ្រងសំបុត្រជួសជុលតាមដំណាក់កាលនីមួយៗ"
              : "Visually monitor repair throughput across all workflow stages"}
          </p>
        </div>

        {/* Right Controls: Search, View Density Toggle, Table Link */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Quick filter input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === "km" ? "ស្វែងរកក្នុងក្ដារ..." : "Filter kanban..."}
              className="pl-8 pr-7 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 w-32 sm:w-40 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* View mode toggle (Fit Screen vs Spacious) */}
          <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5 bg-zinc-100/80 dark:bg-zinc-800/80 text-xs">
            <button
              type="button"
              onClick={() => handleSetLayoutMode("fit")}
              title={
                lang === "km"
                  ? "ទិដ្ឋភាពសមស្របអេក្រង់ (Fit 5 Columns ស្មើគ្នា មិនកាត់ចុង)"
                  : "Fit Screen: show all 5 columns evenly"
              }
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
                layoutMode === "fit"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {lang === "km" ? "ពេញអេក្រង់" : "Fit"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSetLayoutMode("spacious")}
              title={
                lang === "km"
                  ? "ទិដ្ឋភាពទូលាយ (Spacious Scroll: ក្ដារធំរមូរផ្ដេក)"
                  : "Spacious: wide columns with horizontal scroll"
              }
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
                layoutMode === "spacious"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <Columns3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {lang === "km" ? "ទូលាយ" : "Wide"}
              </span>
            </button>
          </div>

          {/* Full Table Link */}
          <Link
            href="/service-tickets"
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center gap-1 font-semibold transition-colors"
          >
            <span>{lang === "km" ? "តារាងសំបុត្រ" : "Table View"}</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Kanban Columns Canvas */}
      <div className="p-2.5 sm:p-3.5 flex-1 min-h-0 overflow-hidden">
        <div
          className={
            layoutMode === "fit"
              ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5 items-stretch h-full"
              : "flex gap-3 sm:gap-3.5 overflow-x-auto pb-3 pt-1 px-0.5 items-stretch h-full scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700"
          }
        >
          {KANBAN_COLUMNS.map((col) => {
            const Icon = col.icon;
            const colTickets = columnBuckets[col.id] || [];
            const currentLimit = visibleLimits[col.id] ?? PAGE_SIZE;
            const displayedTickets = colTickets.slice(0, currentLimit);
            const hasMore = currentLimit < colTickets.length;

            return (
              <div
                key={col.id}
                className={`flex flex-col rounded-2xl bg-zinc-100/90 dark:bg-zinc-800/60 border border-zinc-200/90 dark:border-zinc-700/80 shadow-2xs transition-all border-t-[3.5px] ${
                  col.accentBorder
                } ${
                  layoutMode === "fit"
                    ? "min-w-0 flex-1 p-2 sm:p-2.5"
                    : "w-[270px] min-w-[270px] shrink-0 p-2.5 sm:p-3"
                }`}
              >
                {/* Column Header Card Bar */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-200/70 dark:border-zinc-700/60 shrink-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="p-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700/60 shadow-2xs shrink-0">
                      <Icon className={`w-3.5 h-3.5 ${col.color}`} />
                    </div>
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {lang === "km" ? col.titleKm : col.title}
                    </span>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ${col.badgeBg}`}
                  >
                    {colTickets.length > PAGE_SIZE ? (
                      <>
                        <span className="opacity-75 font-medium">{displayedTickets.length}/</span>
                        {colTickets.length}
                      </>
                    ) : (
                      colTickets.length
                    )}
                  </span>
                </div>

                {/* Ticket Cards List with Slim Scrollbar & Scroll-down Pagination */}
                <div
                  onScroll={(e) => handleColumnScroll(col.id, e)}
                  className="flex-1 space-y-2 overflow-y-auto max-h-[420px] pr-0.5 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-600 hover:scrollbar-thumb-zinc-400"
                >
                  {colTickets.length === 0 ? (
                    <div className="h-36 rounded-xl border border-dashed border-zinc-300/80 dark:border-zinc-700/60 flex flex-col items-center justify-center gap-1.5 text-zinc-400 dark:text-zinc-500 text-xs px-2 text-center">
                      <Icon className="w-5 h-5 opacity-40" />
                      <span className="font-medium text-[11px]">
                        {lang === "km" ? "គ្មានទិន្នន័យ" : "Empty stage"}
                      </span>
                    </div>
                  ) : (
                    <>
                      {displayedTickets.map((ticket) => {
                        const serviceTypeLower = (ticket.serviceType || "").toLowerCase();
                        const isFree = serviceTypeLower.includes("free");
                        const isCharge = serviceTypeLower.includes("charge");

                        return (
                          <div
                            key={ticket.id}
                            className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/70 shadow-2xs hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500 transition-all text-xs group flex flex-col justify-between gap-1"
                          >
                            {/* Top: Report No + Service Type Tag */}
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-zinc-900 dark:text-white truncate text-[11px]">
                                {ticket.reportNo || `#${ticket.id.slice(0, 8)}`}
                              </span>
                              {ticket.serviceType && (
                                <span
                                  className={`px-1.5 py-0.2 rounded-md text-[9px] font-bold shrink-0 ${
                                    isFree
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60"
                                      : isCharge
                                      ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60"
                                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60"
                                  }`}
                                >
                                  {ticket.serviceType}
                                </span>
                              )}
                            </div>

                            {/* Middle: Equipment Name */}
                            <p className="font-semibold text-zinc-800 dark:text-zinc-200 truncate text-[11px] leading-tight">
                              {ticket.itemName || (lang === "km" ? "ឧបករណ៍" : "Equipment")}
                            </p>

                            {/* Customer / Company Name */}
                            <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400 truncate">
                              {isPrivacyMode
                                ? "••••••••••"
                                : ticket.companyName ||
                                  (lang === "km" ? "គ្មានឈ្មោះក្រុមហ៊ុន" : "No Company")}
                            </p>

                            {/* Bottom: Date + Inspect Action */}
                            <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500">
                              <span>
                                {ticket.serviceDate
                                  ? new Date(ticket.serviceDate).toLocaleDateString(
                                      lang === "km" ? "km-KH" : "en-US",
                                      {
                                        month: "numeric",
                                        day: "numeric",
                                        year: "2-digit",
                                      }
                                    )
                                  : ""}
                              </span>
                              <Link
                                href={`/service-tickets?search=${encodeURIComponent(
                                  ticket.reportNo || ticket.id
                                )}`}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold flex items-center gap-0.5 hover:underline"
                              >
                                <span>{lang === "km" ? "ពិនិត្យ" : "Inspect"}</span>
                                <ArrowRight className="w-2.5 h-2.5" />
                              </Link>
                            </div>
                          </div>
                        );
                      })}

                      {/* Pagination scroll footer / button */}
                      {hasMore && (
                        <div className="pt-1.5 pb-1">
                          <button
                            type="button"
                            onClick={() => handleLoadMore(col.id)}
                            className="w-full py-1.5 px-2 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px] font-semibold flex items-center justify-center gap-1 transition-all shadow-2xs group cursor-pointer"
                          >
                            <ArrowDown className="w-2.5 h-2.5 group-hover:translate-y-0.5 transition-transform" />
                            <span>
                              {lang === "km"
                                ? `រមូរចុះ ឬចុចផ្ទុក ២៥ ទៀត (${displayedTickets.length}/${colTickets.length})`
                                : `Next 25 (${displayedTickets.length}/${colTickets.length})`}
                            </span>
                          </button>
                        </div>
                      )}

                      {colTickets.length > PAGE_SIZE && !hasMore && (
                        <div className="pt-1.5 pb-1 text-center text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                          ✓ {lang === "km" ? `បានបង្ហាញទាំងអស់ (${colTickets.length})` : `All ${colTickets.length} loaded`}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
