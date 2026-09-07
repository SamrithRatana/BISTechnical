"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Activity,
  Layers,
  FileText,
  Clock,
  Building2,
  Maximize2,
} from "lucide-react";
import {
  fetchSparepartTransactions,
  getCached,
  type PaginatedResult,
  type SparepartTransaction,
} from "@/services/api";
import { useI18n } from "@/i18n/LanguageProvider";
import { useDashboard } from "../useDashboardStore";
import MediaLightbox from "@/components/MediaLightbox";

function getImageUrl(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return url;
  return `/${url}`;
}

function parseUtcTimestamp(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  // If string has no timezone indicator, append Z (backend timestamps are stored in UTC)
  const hasTimezone = dateStr.endsWith("Z") || /[+-]\d{2}(:\d{2})?$/.test(dateStr);
  const normalized = hasTimezone ? dateStr : `${dateStr}Z`;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? new Date(dateStr) : d;
}

function formatStockTimestamp(
  dateStr?: string | null,
  lang: string = "km"
): { relative: string; exact: string } {
  const d = parseUtcTimestamp(dateStr);
  if (!d || isNaN(d.getTime())) return { relative: "-", exact: dateStr || "" };

  const tz = "Asia/Phnom_Penh";
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - d.getTime());
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  let relative = "";
  if (diffMin < 1) {
    relative = lang === "km" ? "ទើបតែឥឡូវ" : "Just now";
  } else if (diffMin < 60) {
    relative = lang === "km" ? `${diffMin} នាទីមុន` : `${diffMin}m ago`;
  } else if (diffHrs < 24) {
    relative = lang === "km" ? `${diffHrs} ម៉ោងមុន` : `${diffHrs}h ago`;
  } else if (diffDays < 7) {
    relative = lang === "km" ? `${diffDays} ថ្ងៃមុន` : `${diffDays}d ago`;
  } else {
    try {
      relative = d.toLocaleDateString(lang === "km" ? "km-KH" : "en-US", {
        timeZone: tz,
        month: "short",
        day: "numeric",
      });
    } catch {
      relative = d.toLocaleDateString();
    }
  }

  // Format exact local time in Cambodia Timezone matching Telegram (e.g. 2026-09-04 1:32 PM)
  let exact = "";
  try {
    const time12 = d.toLocaleTimeString("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const dateFormatted = d.toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD
    exact = `${dateFormatted} ${time12}`;
  } catch {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    exact = `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  }

  return { relative, exact };
}

export default function StockMovementLiveWidget() {
  const { lang } = useI18n();
  const { isPrivacyMode } = useDashboard();

  const [directionFilter, setDirectionFilter] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const initialCache = getCached<PaginatedResult<SparepartTransaction>>(
    `spareparts:transactions:p1:s${pageSize}:dAll:q`
  );

  const [transactions, setTransactions] = useState<SparepartTransaction[]>(() => initialCache?.items ?? []);
  const [totalCount, setTotalCount] = useState(() => initialCache?.totalCount ?? 0);
  const [totalPages, setTotalPages] = useState(() => initialCache?.totalPages ?? 1);
  const [loading, setLoading] = useState(() => initialCache === null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [previewItem, setPreviewItem] = useState<SparepartTransaction | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadData = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else if (!initialCache || page !== 1 || directionFilter !== "All" || debouncedSearch !== "") {
        setLoading(true);
      }

      try {
        const res = await fetchSparepartTransactions(
          page,
          pageSize,
          directionFilter,
          debouncedSearch,
          isManualRefresh
        );
        setTransactions(res.items);
        setTotalCount(res.totalCount);
        setTotalPages(res.totalPages);
        setLastUpdated(new Date());
      } catch (err) {
        console.error("Failed to load stock movements:", err);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [page, pageSize, directionFilter, debouncedSearch]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh periodically (every 25 seconds for real-time monitoring)
  useEffect(() => {
    const interval = setInterval(() => {
      loadData(true);
    }, 25000);
    return () => clearInterval(interval);
  }, [loadData]);

  return (
    <div className="bg-white/85 dark:bg-zinc-900/85 backdrop-blur-md rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-4 shadow-xs flex flex-col h-full overflow-hidden">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200/60 dark:border-zinc-800/60">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                {lang === "km"
                  ? "ចរន្តស្តុកគ្រឿងបន្លាស់ Real-Time"
                  : "Live Stock Movements (In / Out)"}
              </h3>
              {/* Pulsing LIVE badge */}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                LIVE
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {lang === "km"
                ? "បញ្ជីនាំចូល និងដកប្រើប្រាស់គ្រឿងបន្លាស់ជាក់ស្តែងតាមសំបុត្រជួសជុល"
                : "Real-time ledger of spare parts stocked in and consumed by repair services"}
            </p>
          </div>
        </div>

        {/* Action Controls: Search, Tabs, Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Direction Filter Tabs */}
          <div className="inline-flex p-0.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/70 border border-zinc-200/80 dark:border-zinc-700/60 text-xs">
            <button
              type="button"
              onClick={() => {
                setDirectionFilter("All");
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                directionFilter === "All"
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              {lang === "km" ? "ទាំងអស់" : "All"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDirectionFilter("In");
                setPage(1);
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all ${
                directionFilter === "In"
                  ? "bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <ArrowDownLeft className="w-3 h-3 text-emerald-500" />
              {lang === "km" ? "ចូលស្តុក" : "Stock In"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDirectionFilter("Out");
                setPage(1);
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all ${
                directionFilter === "Out"
                  ? "bg-white dark:bg-zinc-700 text-rose-600 dark:text-rose-400 shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <ArrowUpRight className="w-3 h-3 text-rose-500" />
              {lang === "km" ? "ចេញស្តុក" : "Stock Out"}
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={lang === "km" ? "ស្វែងរកគ្រឿងបន្លាស់..." : "Search part or ticket..."}
              className="w-36 sm:w-44 pl-8 pr-2.5 py-1 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
            />
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            title={lang === "km" ? "ទាញទិន្នន័យថ្មី" : "Refresh live data"}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-emerald-500" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* ── Table Container ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[380px] my-2 -mx-4 px-4 min-h-[200px] scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-600">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xs z-10 shadow-2xs">
            <tr className="border-b border-zinc-100 dark:border-zinc-800 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              <th className="py-2 px-2.5 text-center w-12">{lang === "km" ? "រូបភាព" : "Image"}</th>
              <th className="py-2 px-3">{lang === "km" ? "គ្រឿងបន្លាស់" : "Spare Part Item"}</th>
              <th className="py-2 px-3">{lang === "km" ? "ចរន្តស្តុក" : "Movement"}</th>
              <th className="py-2 px-3 text-center">{lang === "km" ? "ស្តុកនៅសល់" : "Balance"}</th>
              <th className="py-2 px-3">{lang === "km" ? "ឯកសារ / ភ្ញៀវ" : "Reference & Customer"}</th>
              <th className="py-2 px-3 text-right">{lang === "km" ? "កាលបរិច្ឆេទ" : "Timestamp"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {loading && transactions.length === 0 ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="py-3 px-2.5 text-center">
                    <div className="w-10 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-800 mx-auto" />
                  </td>
                  <td className="py-3 px-3 space-y-1.5">
                    <div className="w-36 h-3.5 rounded bg-zinc-200 dark:bg-zinc-800" />
                    <div className="w-20 h-3 rounded bg-zinc-200 dark:bg-zinc-800" />
                  </td>
                  <td className="py-3 px-3">
                    <div className="w-16 h-5 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="w-12 h-5 rounded-full bg-zinc-200 dark:bg-zinc-800 mx-auto" />
                  </td>
                  <td className="py-3 px-3 space-y-1">
                    <div className="w-28 h-3.5 rounded bg-zinc-200 dark:bg-zinc-800" />
                    <div className="w-20 h-3 rounded bg-zinc-200 dark:bg-zinc-800" />
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="w-16 h-3 rounded bg-zinc-200 dark:bg-zinc-800 ml-auto" />
                  </td>
                </tr>
              ))
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-zinc-400 dark:text-zinc-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Package className="w-8 h-8 text-zinc-300 dark:text-zinc-600 stroke-[1.5]" />
                    <p className="text-xs font-medium">
                      {lang === "km"
                        ? "មិនមានទិន្នន័យចរន្តស្តុកគ្រឿងបន្លាស់ឡើយ"
                        : "No sparepart movement records found"}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              transactions.map((tx) => {
                const isIn = tx.quantityChange > 0 || tx.direction === "In";
                const isOut = tx.quantityChange < 0 || tx.direction === "Out";
                const qtyDisplay = Math.abs(tx.quantityChange || tx.quantity);
                const hasImg = Boolean(tx.pictureUrl && tx.pictureUrl.trim());

                return (
                  <tr
                    key={tx.id}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors group"
                  >
                    {/* Image Thumbnail with Lightbox trigger */}
                    <td className="py-2.5 px-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => setPreviewItem(tx)}
                        className="relative group/thumb w-10 h-10 mx-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden hover:border-emerald-500 transition-all shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        title={lang === "km" ? "ចុចដើម្បីមើលរូបភាពធំ" : "Click to view full image"}
                      >
                        {hasImg ? (
                          <img
                            src={getImageUrl(tx.pictureUrl)}
                            alt={tx.itemName}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-200 group-hover/thumb:scale-115"
                            onError={(e) => {
                              // If image 404s, replace with placeholder icon
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <Package className="w-4 h-4 text-zinc-400 group-hover/thumb:text-emerald-500 transition-colors" />
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Maximize2 className="w-3 h-3" />
                        </div>
                      </button>
                    </td>

                    {/* Part Details: Item Name & Serial / Part Number */}
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[220px]">
                        {tx.itemName || (lang === "km" ? "គ្រឿងបន្លាស់" : "Spare Part")}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="inline-block px-1.5 py-0.2 rounded font-mono text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60">
                          {tx.serialNumber || "N/A"}
                        </span>
                        {tx.isReversal && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                            {lang === "km" ? "ត្រឡប់វិញ" : "Reversal"}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Movement Pill */}
                    <td className="py-2.5 px-3">
                      {isIn ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                          <ArrowDownLeft className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          +{qtyDisplay} {lang === "km" ? "ចូល" : "In"}
                        </span>
                      ) : isOut ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                          <ArrowUpRight className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                          -{qtyDisplay} {lang === "km" ? "ចេញ" : "Out"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          0
                        </span>
                      )}
                    </td>

                    {/* Balance After */}
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md font-mono font-bold text-xs ${
                          tx.balanceAfter <= 0
                            ? "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300/60"
                            : tx.balanceAfter <= 2
                            ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300/60"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                        }`}
                      >
                        {tx.balanceAfter}
                      </span>
                    </td>

                    {/* Reference: Report No, Company or Reason */}
                    <td className="py-2.5 px-3">
                      <div className="flex flex-col gap-0.5 max-w-[200px]">
                        {tx.reportNo ? (
                          <div className="flex items-center gap-1 text-zinc-800 dark:text-zinc-200 font-medium truncate">
                            <FileText className="w-3 h-3 text-blue-500 shrink-0" />
                            <span className="truncate">{tx.reportNo}</span>
                          </div>
                        ) : null}
                        {tx.companyName ? (
                          <div
                            className={`flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 truncate ${
                              isPrivacyMode ? "blur-[5px] select-none" : ""
                            }`}
                          >
                            <Building2 className="w-3 h-3 shrink-0 text-zinc-400" />
                            <span className="truncate">{tx.companyName}</span>
                          </div>
                        ) : tx.reason ? (
                          <span
                            className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate"
                            title={tx.reason}
                          >
                            {tx.reason}
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-400">-</span>
                        )}
                      </div>
                    </td>

                    {/* Timestamp */}
                    <td className="py-2.5 px-3 text-right text-[11px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      {(() => {
                        const { relative, exact } = formatStockTimestamp(tx.timestamp, lang);
                        return (
                          <>
                            <div className="flex items-center justify-end gap-1 font-medium">
                              <Clock className="w-3 h-3 text-zinc-400" />
                              <span>{relative}</span>
                            </div>
                            <span className="text-[10px] text-zinc-400 font-mono block mt-0.5" title={exact}>
                              {exact}
                            </span>
                          </>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer: Pagination & Inventory Link ────────────────────────────── */}
      <div className="flex items-center justify-between pt-2.5 border-t border-zinc-200/60 dark:border-zinc-800/60 text-xs text-zinc-500 dark:text-zinc-400">
        <div className="flex items-center gap-2">
          <span>
            {lang === "km"
              ? `សរុប ${totalCount.toLocaleString()} ចរន្ត`
              : `Total ${totalCount.toLocaleString()} movements`}
          </span>
          <span className="text-zinc-300 dark:text-zinc-700">•</span>
          <Link
            href="/spareparts"
            className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
          >
            <span>{lang === "km" ? "គ្រប់គ្រងស្តុកពេញលេញ" : "Open Inventory Ledger"}</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {/* Page Switcher */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 font-medium">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── Media Lightbox Modal for Spare Part Image ──────────────────────── */}
      {previewItem && (
        <MediaLightbox
          open={Boolean(previewItem)}
          onClose={() => setPreviewItem(null)}
          title={previewItem.itemName || (lang === "km" ? "គ្រឿងបន្លាស់" : "Spare Part")}
          subtitle={`Part No: ${previewItem.serialNumber || "N/A"} • ${lang === "km" ? "ស្តុកនៅសល់" : "Stock balance"}: ${previewItem.balanceAfter}`}
          imageUrl={getImageUrl(previewItem.pictureUrl)}
          kind="image"
          part={{
            itemName: previewItem.itemName,
            serialNumber: previewItem.serialNumber,
            partNumber: previewItem.serialNumber,
            pictureUrl: previewItem.pictureUrl || undefined,
            stockQty: previewItem.balanceAfter,
            description: previewItem.reason || previewItem.reportNo,
          }}
        />
      )}
    </div>
  );
}
