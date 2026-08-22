"use client";

/**
 * @file stock-adjustments/page.tsx
 * @description Inventory Adjustments — stock changes made by editing the
 * catalogue quantity directly, rather than through a repair job.
 *
 * ── Why this deserves its own page rather than a filter ────────────────────
 *
 * Every other movement in the ledger is a side effect of work: a part was
 * fitted to a machine, or returned from one, and the trigger recorded it. An
 * adjustment is different in kind — someone typed a new number over the old
 * one. There is no ticket behind it, so nothing else in the system explains
 * why the figure changed except the reason text on the row.
 *
 * That makes it the audit-sensitive category, and the one a manager checking
 * for shrinkage or miscounts wants on a page by itself rather than as 41 rows
 * buried among a thousand.
 *
 * Before and After are both shown deliberately: an adjustment is only
 * meaningful as a delta against what the system previously believed.
 *
 * Columns live in public/templates/stock-adjustments.xlsx.
 */

import { useCallback, useMemo } from "react";
import PageWrapper from "@/components/PageWrapper";
import TemplateReportView, { type ReportData } from "@/components/TemplateReportView";
import { useI18n } from "@/i18n/LanguageProvider";
import { fetchStockTransactions } from "@/services/reports";
import { flat, formatDay, formatDayTime } from "@/services/reportShaping";

export default function StockAdjustmentsPage() {
  const { t } = useI18n();

  const bounds = useMemo(() => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    };
  }, []);

  const load = useCallback(
    async (from: Date, to: Date): Promise<ReportData> => {
      const rows = await fetchStockTransactions(from, to, { source: "Adjustment" });

      const shaped = rows.map((r) => ({
        ...r,
        when: formatDayTime(r.timestamp),
        typeLabel: r.direction === "In" ? t("stock.increase") : t("stock.decrease"),
        signedQty: r.direction === "In" ? `+${r.quantity}` : `-${r.quantity}`,
      }));

      const increased = rows
        .filter((r) => r.direction === "In")
        .reduce((sum, r) => sum + r.quantity, 0);
      const decreased = rows
        .filter((r) => r.direction === "Out")
        .reduce((sum, r) => sum + r.quantity, 0);

      return {
        groups: flat(shaped as unknown as Record<string, unknown>[]),
        summary: [
          `${t("stock.adjustments")}: ${rows.length}`,
          `${t("stock.increased")}: +${increased}`,
          `${t("stock.decreased")}: -${decreased}`,
          `${t("stock.net")}: ${increased - decreased}`,
        ].join("     "),
      };
    },
    [t]
  );

  const subtitle = useCallback(
    (from: Date, to: Date) =>
      t("report.monthlyRange", {
        from: formatDay(from.toISOString()),
        to: formatDay(to.toISOString()),
      }),
    [t]
  );

  return (
    <PageWrapper titleKey="nav.stockAdjustments" subtitleKey="stock.adjustmentsSubtitle">
      <TemplateReportView
        template="stock-adjustments"
        title={t("stock.adjustmentsTitle")}
        subtitle={subtitle}
        load={load}
        fileName="stock-adjustments"
        initialFrom={bounds.from}
        initialTo={bounds.to}
      />
    </PageWrapper>
  );
}
