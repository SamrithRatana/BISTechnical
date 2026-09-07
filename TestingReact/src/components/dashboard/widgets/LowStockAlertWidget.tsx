"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, PlusCircle, ArrowUpRight, ArrowDown, CheckCircle2 } from "lucide-react";
import { fetchSparePartsInventory, type SparePartItem } from "@/services/api";
import { useDashboard } from "../useDashboardStore";
import { useI18n } from "@/i18n/LanguageProvider";

export default function LowStockAlertWidget() {
  const [lowParts, setLowParts] = useState<SparePartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { isPrivacyMode } = useDashboard();
  const { lang } = useI18n();

  const PAGE_SIZE = 25;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    let active = true;
    async function loadStock() {
      try {
        const res = await fetchSparePartsInventory(1, 100);
        if (active && res && res.items) {
          // Filter items with quantity <= 5
          const low = res.items
            .filter((p) => (p.quantity ?? 0) <= 5)
            .sort((a, b) => (a.quantity ?? 0) - (b.quantity ?? 0));
          setLowParts(low);
        }
      } catch (err) {
        console.warn("Failed to load spare parts stock:", err);
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadStock();
    return () => {
      active = false;
    };
  }, []);

  const displayedParts = useMemo(() => {
    return lowParts.slice(0, visibleCount);
  }, [lowParts, visibleCount]);

  const hasMore = visibleCount < lowParts.length;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 40) {
      if (hasMore) {
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, lowParts.length));
      }
    }
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, lowParts.length));
  };

  return (
    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 p-4 shadow-xs flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                {lang === "km" ? "គ្រឿងបន្លាស់ជិតអស់ស្តុក" : "Low Stock Spare Parts"}
              </h3>
              {lowParts.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
                  {hasMore ? `${displayedParts.length}/${lowParts.length}` : lowParts.length}
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {lang === "km"
                ? "គ្រឿងបន្លាស់ដែលមានចំនួនក្នុងស្តុក ≤ ៥"
                : "Inventory items requiring immediate restock"}
            </p>
          </div>
        </div>

        <Link
          href="/spare-parts"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 font-medium"
        >
          <span>{lang === "km" ? "គ្រប់គ្រងស្តុក" : "Inventory"}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div
        onScroll={handleScroll}
        className="flex-1 space-y-2 overflow-y-auto max-h-[340px] pr-1 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-600"
      >
        {loading ? (
          <div className="py-8 text-center text-xs text-zinc-400 animate-pulse">
            {lang === "km" ? "កំពុងពិនិត្យស្តុក..." : "Checking inventory levels..."}
          </div>
        ) : lowParts.length === 0 ? (
          <div className="py-8 text-center text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/40 dark:border-emerald-900/40">
            ✓ {lang === "km" ? "ស្តុកគ្រឿងបន្លាស់ទាំងអស់មានគ្រប់គ្រាន់!" : "All spare parts are well-stocked!"}
          </div>
        ) : (
          <>
            {displayedParts.map((part) => {
              const isCritical = (part.quantity ?? 0) === 0;

              return (
                <div
                  key={part.id}
                  className="p-2.5 rounded-xl bg-zinc-50/60 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-900 dark:text-white truncate">
                        {part.itemName}
                      </span>
                      {part.partNumber && (
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {part.partNumber}
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                      {part.useFor || "General"} • Unit Price:{" "}
                      {isPrivacyMode ? "$•••" : `$${(part.defaultPrice ?? 0).toFixed(2)}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                        isCritical
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900"
                      }`}
                    >
                      {part.quantity ?? 0} left
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
                      ? `រមូរចុះ ឬចុចផ្ទុក ២៥ ទៀត (${displayedParts.length}/${lowParts.length})`
                      : `Scroll down or load next 25 (${displayedParts.length}/${lowParts.length})`}
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
          {lang === "km" ? "សរុបជិតអស់ស្តុក:" : "Total Low Stock:"}{" "}
          <strong className="text-amber-600 dark:text-amber-400 font-semibold">
            {lowParts.length}
          </strong>
        </span>
        <Link
          href="/spareparts"
          className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
        >
          {lang === "km" ? "ពិនិត្យស្តុកពេញលេញ" : "View Catalog"}
        </Link>
      </div>
    </div>
  );
}
