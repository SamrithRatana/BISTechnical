"use client";

/**
 * @file stock-movement/page.tsx
 * @description Stock Movement Summary — per part, over a period: what the
 * shelf held at the start, what moved in and out, and what it held at the end.
 *
 * This is the reconciliation view. The ledger page answers "what happened";
 * this one answers "do the numbers balance", which is the question a stock
 * count is checked against.
 *
 * Opening and closing balances are NOT recomputed here — they come from the
 * audit log's own OldQuantity/NewQuantity columns, which were verified against
 * the live table to satisfy `NewQuantity == OldQuantity + QuantityChange` on
 * all 3,226 rows. Reconstructing them client-side would introduce a second
 * source of truth that could disagree with the audit trail.
 *
 * Columns live in public/templates/stock-movement.xlsx.
 */

import { useCallback, useMemo } from "react";
import PageWrapper from "@/components/PageWrapper";
import TemplateReportView, { type ReportData } from "@/components/TemplateReportView";
import { useI18n } from "@/i18n/LanguageProvider";
import { fetchStockMovementSummary } from "@/services/reports";
import { flat, formatDay } from "@/services/reportShaping";

export default function StockMovementPage() {
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
      const rows = await fetchStockMovementSummary(from, to);

      const totalIn = rows.reduce((sum, r) => sum + (r.totalIn ?? 0), 0);
      const totalOut = rows.reduce((sum, r) => sum + (r.totalOut ?? 0), 0);

      // A part whose closing balance disagrees with its live catalogue quantity
      // has moved since the window ended — expected for a past period, worth
      // noticing for the current one, so it is surfaced rather than hidden.
      const drifted = rows.filter((r) => r.closingBalance !== r.currentStock).length;

      return {
        groups: flat(rows as unknown as Record<string, unknown>[]),
        summary: [
          `${t("stock.parts")}: ${rows.length}`,
          `${t("stock.totalIn")}: ${totalIn}`,
          `${t("stock.totalOut")}: ${totalOut}`,
          `${t("stock.net")}: ${totalIn - totalOut}`,
          `${t("stock.movedSince")}: ${drifted}`,
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
    <PageWrapper titleKey="nav.stockMovement" subtitleKey="stock.movementSubtitle">
      <TemplateReportView
        template="stock-movement"
        title={t("stock.movementTitle")}
        subtitle={subtitle}
        load={load}
        fileName="stock-movement"
        initialFrom={bounds.from}
        initialTo={bounds.to}
      />
    </PageWrapper>
  );
}
