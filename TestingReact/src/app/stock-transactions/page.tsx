"use client";

/**
 * @file stock-transactions/page.tsx
 * @description Stock Transaction Ledger — every movement of every spare part,
 * newest first, exactly as the SQL triggers recorded it.
 *
 * ── Why this exists alongside the usage report ─────────────────────────────
 *
 * `/sparepart-usage` aggregates to a net figure per part, so an issue and a
 * return cancel each other out and neither is visible. Measured on the live
 * ledger, ~100 units came back to stock over six months while only a handful
 * of rows ever showed it — and those only because the net went negative, which
 * read as a stock deficit rather than a return.
 *
 * This page is the other half: the movements themselves. Nothing is netted, so
 * a part that went out and came back is two readable lines.
 *
 * The Type filter is what lets one page serve four questions — stock in, stock
 * out, inventory adjustments and manual stock-outs — without four
 * near-identical screens.
 *
 * Columns live in public/templates/stock-transactions.xlsx.
 */

import { useCallback, useMemo, useState } from "react";
import PageWrapper from "@/components/PageWrapper";
import TemplateReportView, { type ReportData } from "@/components/TemplateReportView";
import { useI18n } from "@/i18n/LanguageProvider";
import {
  fetchStockTransactions,
  type StockDirection,
  type StockSource,
} from "@/services/reports";
import { flat, formatDay, formatDayTime } from "@/services/reportShaping";

/**
 * The one control this page adds: which movements to show.
 *
 * `adjustment` and `manual` are both "no repair ticket", but they are different
 * events and worth separating: an adjustment is someone editing the catalogue
 * quantity directly, while a manual stock-out is stock deliberately issued with
 * a reason from the spare-parts page. They also occupy different periods in the
 * data — manual stock-outs run Feb–Apr 2026, adjustments start in August — so a
 * single "no ticket" filter would hide that split entirely.
 */
type LedgerFilter = "all" | "in" | "out" | "adjustment" | "manual";

export default function StockTransactionsPage() {
  const { t } = useI18n();
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>("all");

  const bounds = useMemo(() => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    };
  }, []);

  const load = useCallback(
    async (from: Date, to: Date): Promise<ReportData> => {
      const direction: StockDirection | undefined =
        ledgerFilter === "in" ? "In" : ledgerFilter === "out" ? "Out" : undefined;
      const source: StockSource | undefined =
        ledgerFilter === "adjustment"
          ? "Adjustment"
          : ledgerFilter === "manual"
            ? "Manual"
            : undefined;

      const rows = await fetchStockTransactions(from, to, { direction, source });

      const shaped = rows.map((r) => ({
        ...r,
        when: formatDayTime(r.timestamp),
        // A movement that was undone, or that undoes one, is marked in the
        // Type column. This is what makes the Telegram feed reconcilable: on
        // 2026-08-18 Telegram showed 12 stock-outs and this report showed 9,
        // and the three-row difference is exactly these pairs. Without the
        // marker the report just looks like it lost three units.
        //
        // Both markers are appended rather than replacing the direction, and
        // that matters: `isReversal` means "an opposite movement exists
        // earlier", which is true of OUT rows as well as IN rows. Measured on
        // the live ledger, 64 of the 140 rows carrying that flag are stock
        // OUTS — so collapsing the flag into a single "Stock Return" label
        // would have renamed 64 outbound movements as returns.
        typeLabel:
          (r.direction === "In" ? t("stock.in") : t("stock.out")) +
          (r.reversedLater ? ` (${t("stock.reversed")})` : "") +
          (r.isReversal ? ` (${t("stock.isReversal")})` : ""),
        sourceLabel:
          r.source === "Service"
            ? t("stock.sourceService")
            : r.source === "Adjustment"
              ? t("stock.sourceAdjustment")
              : t("stock.sourceManual"),
        // Signed for the ledger column: a reader scanning down needs the
        // direction without cross-referencing the Type column.
        signedQty: r.direction === "In" ? `+${r.quantity}` : `-${r.quantity}`,
      }));

      const totalIn = rows
        .filter((r) => r.direction === "In")
        .reduce((sum, r) => sum + r.quantity, 0);
      const totalOut = rows
        .filter((r) => r.direction === "Out")
        .reduce((sum, r) => sum + r.quantity, 0);
      const reversedPairs = rows.filter((r) => r.reversedLater).length;

      return {
        groups: flat(shaped as unknown as Record<string, unknown>[]),
        summary: [
          `${t("stock.movements")}: ${rows.length}`,
          `${t("stock.totalIn")}: ${totalIn}`,
          `${t("stock.totalOut")}: ${totalOut}`,
          `${t("stock.net")}: ${totalIn - totalOut}`,
          `${t("stock.reversedCount")}: ${reversedPairs}`,
        ].join("     "),
      };
    },
    [t, ledgerFilter]
  );

  const subtitle = useCallback(
    (from: Date, to: Date) =>
      t("report.monthlyRange", {
        from: formatDay(from.toISOString()),
        to: formatDay(to.toISOString()),
      }),
    [t]
  );

  const options: { value: LedgerFilter; label: string }[] = [
    { value: "all", label: t("stock.filterAll") },
    { value: "in", label: t("stock.filterIn") },
    { value: "out", label: t("stock.filterOut") },
    { value: "adjustment", label: t("stock.filterAdjustment") },
    { value: "manual", label: t("stock.filterManual") },
  ];

  return (
    <PageWrapper titleKey="nav.stockTransactions" subtitleKey="stock.ledgerSubtitle">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-ink-secondary">
          {t("stock.showLabel")}
        </span>
        {options.map((opt) => {
          const active = ledgerFilter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setLedgerFilter(opt.value)}
              aria-pressed={active}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-[color,background-color,border-color,box-shadow] ${
                active
                  ? "border-accent bg-accent-soft text-accent-soft-fg"
                  : "border-subtle bg-surface text-ink-secondary hover:bg-cushion"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <TemplateReportView
        // Deliberately NOT keyed on `ledgerFilter`.
        //
        // It was, briefly, on the belief that the view only reloads when a date
        // changes. That was wrong: its load effect depends on `build`, which
        // depends on the `load` prop, and `load` below is rebuilt whenever
        // `ledgerFilter` changes — so switching filters already triggers a
        // reload without remounting.
        //
        // Keying it did trigger the reload, but by REMOUNTING, which reset the
        // date inputs to `initialFrom`/`initialTo`. Measured: with the range set
        // to 2026-02-01 → 2026-04-30, clicking a filter silently sent
        // 2026-08-01 → 2026-08-31 instead, so a manual stock-out search over
        // Feb–Apr returned nothing and looked like there was no such data.
        template="stock-transactions"
        title={t("stock.ledgerTitle")}
        subtitle={subtitle}
        load={load}
        fileName="stock-transactions"
        initialFrom={bounds.from}
        initialTo={bounds.to}
      />
    </PageWrapper>
  );
}
