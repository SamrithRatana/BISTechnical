"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { TrendingUp, CheckCircle, XCircle, Clock, Percent, ArrowUpRight } from "lucide-react";
import { useTicketSeries, statusIs } from "@/hooks/useTicketSeries";
import { useI18n } from "@/i18n/LanguageProvider";

export default function SalesKpisWidget() {
  const { items, loading } = useTicketSeries();
  const { lang } = useI18n();

  const metrics = useMemo(() => {
    if (!items || items.length === 0) {
      return { pending: 0, won: 0, lost: 0, total: 0, conversionRate: 0 };
    }

    let pending = 0;
    let won = 0;
    let lost = 0;

    items.forEach((ticket) => {
      if (statusIs(ticket, "awaiting customer") || statusIs(ticket, "waiting confirm")) {
        pending++;
      } else if (statusIs(ticket, "sale confirmed") || statusIs(ticket, "saleconfirmed")) {
        won++;
      } else if (statusIs(ticket, "customer rejected") || statusIs(ticket, "rejected")) {
        lost++;
      }
    });

    const totalDecided = won + lost;
    const conversionRate = totalDecided > 0 ? Math.round((won / totalDecided) * 100) : 0;

    return { pending, won, lost, total: items.length, conversionRate };
  }, [items]);

  return (
    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 p-4 shadow-xs flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              {lang === "km" ? "សមត្ថភាពផ្នែកលក់ & សម្រង់តម្លៃ" : "Sales & Quote Performance"}
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {lang === "km"
                ? "អត្រាសម្រេចការលក់ និងស្ថានភាពសម្រង់តម្លៃសរុប"
                : "Conversion rates and quote win/loss ratio"}
            </p>
          </div>
        </div>

        <Link
          href="/sales-conversion-report"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 font-medium"
        >
          <span>{lang === "km" ? "របាយការណ៍លក់" : "Conversion Report"}</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Metric Tiles Grid */}
      <div className="grid grid-cols-3 gap-2.5 my-2">
        {/* Pending Quotes */}
        <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 text-xs font-semibold mb-1">
            <span>{lang === "km" ? "កំពុងចរចា" : "Pending"}</span>
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-extrabold text-amber-900 dark:text-amber-100">
            {loading ? "..." : metrics.pending}
          </div>
          <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80">
            {lang === "km" ? "រង់ចាំអតិថិជន" : "Awaiting Quote"}
          </span>
        </div>

        {/* Won / Confirmed Sales */}
        <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 text-xs font-semibold mb-1">
            <span>{lang === "km" ? "លក់សម្រេច" : "Won"}</span>
            <CheckCircle className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-900 dark:text-emerald-100">
            {loading ? "..." : metrics.won}
          </div>
          <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
            {lang === "km" ? "យល់ព្រមជួសជុល" : "Sale Confirmed"}
          </span>
        </div>

        {/* Lost / Rejected */}
        <div className="p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40">
          <div className="flex items-center justify-between text-rose-700 dark:text-rose-300 text-xs font-semibold mb-1">
            <span>{lang === "km" ? "បដិសេធ" : "Lost"}</span>
            <XCircle className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-extrabold text-rose-900 dark:text-rose-100">
            {loading ? "..." : metrics.lost}
          </div>
          <span className="text-[10px] text-rose-600/80 dark:text-rose-400/80">
            {lang === "km" ? "មិនជួសជុល" : "Customer Rejected"}
          </span>
        </div>
      </div>

      {/* Conversion Rate Meter */}
      <div className="mt-2 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-700/60">
        <div className="flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
          <span className="flex items-center gap-1">
            <Percent className="w-3.5 h-3.5 text-blue-500" />
            {lang === "km" ? "អត្រាសម្រេចការលក់ (Win Rate):" : "Quotation Conversion Rate:"}
          </span>
          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
            {metrics.conversionRate}%
          </span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden flex">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, metrics.conversionRate))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
