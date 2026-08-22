"use client";

/**
 * @file stock-reconciliation/page.tsx
 * @description Stock Reconciliation — why the Telegram stock-out feed and the
 * usage report disagree for a chosen period, itemised.
 *
 * ── The question this page answers ─────────────────────────────────────────
 *
 * "Telegram shows 13 stock-outs on 18 August, the report shows 9. Where did
 * the other 4 go?" That question was answered by hand once, against the live
 * database, and the answer was that three deductions had been returned within
 * hours of being made. Nothing in the app could show that, so the only way to
 * find out was to ask someone to query the tables.
 *
 * Pick a date range and this produces the same answer automatically:
 *
 *   Notifications sent   12   ← what the Telegram feed shows
 *   Recorded in ledger   11
 *   Reported as used      9   ← what the usage report shows
 *   Reversed pairs        3   ← the difference, itemised in the table
 *   Unrecorded            2
 *
 * ── Why the "In ledger?" column matters ────────────────────────────────────
 *
 * One of those three reversals — the Fuser Film Sleeve pair on ticket
 * 20260817-1695 — exists ONLY as notifications. The catalogue quantity moved
 * 8 → 7 → 8 and `SparepartStockAuditLog` recorded neither half. Reading the
 * ledger alone would explain two of the three and leave the third looking like
 * a genuinely missing unit, so this report reads both tables and marks which
 * side each pair came from. A row saying "No" is a movement the audit trail
 * never captured, and belongs on Stock Data Health as well.
 *
 * Columns live in public/templates/stock-reconciliation.xlsx.
 */

import { useCallback, useMemo } from "react";
import PageWrapper from "@/components/PageWrapper";
import TemplateReportView, { type ReportData } from "@/components/TemplateReportView";
import { useI18n } from "@/i18n/LanguageProvider";
import { fetchStockReconciliation } from "@/services/reports";
import { flat, formatDay, formatDayTime } from "@/services/reportShaping";

export default function StockReconciliationPage() {
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
      const result = await fetchStockReconciliation(from, to);

      const shaped = result.rows.map((r) => ({
        ...r,
        outLabel: formatDayTime(r.outAt),
        backLabel: formatDayTime(r.returnedAt),
        // Minutes up to an hour, then hours — "182 min" makes a reader do
        // arithmetic to notice it sat out for three hours.
        openLabel:
          r.minutesOut < 60
            ? `${r.minutesOut} ${t("recon.minutes")}`
            : `${Math.round((r.minutesOut / 60) * 10) / 10} ${t("recon.hours")}`,
        ledgerLabel: r.recordedInLedger ? t("common.yes") : t("recon.notRecorded"),
      }));

      return {
        groups: flat(shaped as unknown as Record<string, unknown>[]),
        // The whole explanation on one line, in the order someone reads it:
        // what Telegram said, what the report said, and what accounts for the gap.
        summary: [
          `${t("recon.notificationsSent")}: ${result.notificationsSent}`,
          `${t("recon.inLedger")}: ${result.ledgerStockOut}`,
          `${t("recon.reportedUsed")}: ${result.reportedUsage}`,
          `${t("recon.reversed")}: ${result.reversedPairs}`,
          `${t("recon.unrecorded")}: ${result.unrecordedMovements}`,
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
    <PageWrapper titleKey="nav.stockReconciliation" subtitleKey="recon.subtitle">
      <TemplateReportView
        template="stock-reconciliation"
        title={t("recon.title")}
        subtitle={subtitle}
        load={load}
        fileName="stock-reconciliation"
        initialFrom={bounds.from}
        initialTo={bounds.to}
      />
    </PageWrapper>
  );
}
