"use client";

/**
 * @file stock-dead/page.tsx
 * @description Dead Stock — parts sitting on the shelf that nothing has
 * touched for 90 days, and how much of that is already promised elsewhere.
 *
 * ── What this answers that no other report does ────────────────────────────
 *
 * Every other stock report is about movement. This one is about the absence of
 * it: capital tied up in parts that are not turning over. Measured on the live
 * catalogue, 78 parts holding 397 units have had no movement in 90 days.
 *
 * ── No date range, and no monetary value ───────────────────────────────────
 *
 * "Idle" describes a window ending now, not an arbitrary past period, so the
 * date inputs are hidden the same way `/sparepart-hold` hides them.
 *
 * There is deliberately no stock-value column. `Spareparts.DefaultPrice` is
 * 0.00 on all 666 catalogue rows, so a value column would read zero for every
 * part and imply the stock is worthless rather than unpriced. Add the column
 * when the prices are populated, not before.
 *
 * ── A caveat worth reading before acting on this page ──────────────────────
 *
 * The audit log only begins 2026-02-19, when the triggers were installed. A
 * part whose last real movement predates that has no ledger row at all and is
 * reported here as "never moved" — which is true of the ledger, not
 * necessarily of the part. Those rows sort first because never-moved is the
 * strongest signal, but confirm against the physical shelf before writing
 * anything off.
 *
 * Columns live in public/templates/stock-dead.xlsx.
 */

import { useCallback, useMemo } from "react";
import PageWrapper from "@/components/PageWrapper";
import TemplateReportView, { type ReportData } from "@/components/TemplateReportView";
import { useI18n } from "@/i18n/LanguageProvider";
import { fetchStockDead } from "@/services/reports";
import { flat, formatDay } from "@/services/reportShaping";

/** Days without movement before a part counts as dead. */
const IDLE_DAYS = 90;

export default function StockDeadPage() {
  const { t } = useI18n();
  const today = useMemo(() => new Date(), []);

  const load = useCallback(async (): Promise<ReportData> => {
    const rows = await fetchStockDead(IDLE_DAYS);

    const shaped = rows.map((r) => ({
      ...r,
      // Available is what a storekeeper can actually promise: held stock is
      // idle too, but it is already committed to a job.
      availableQty: (r.quantity ?? 0) - (r.heldQuantity ?? 0),
      lastMovementLabel: r.lastMovement ? formatDay(r.lastMovement) : t("stock.neverMoved"),
      daysIdleLabel: r.daysSinceMovement != null ? String(r.daysSinceMovement) : "—",
    }));

    const totalUnits = rows.reduce((sum, r) => sum + (r.quantity ?? 0), 0);
    const neverMoved = rows.filter((r) => r.lastMovement == null).length;

    return {
      groups: flat(shaped as unknown as Record<string, unknown>[]),
      summary: [
        `${t("stock.deadParts")}: ${rows.length}`,
        `${t("stock.deadUnits")}: ${totalUnits}`,
        `${t("stock.neverMoved")}: ${neverMoved}`,
      ].join("     "),
    };
  }, [t]);

  const subtitle = useCallback(
    () => t("stock.deadRange", { days: String(IDLE_DAYS) }),
    [t]
  );

  return (
    <PageWrapper titleKey="nav.stockDead" subtitleKey="stock.deadSubtitle">
      <TemplateReportView
        template="stock-dead"
        title={t("stock.deadTitle")}
        subtitle={subtitle}
        load={load}
        fileName="stock-dead"
        initialFrom={today}
        initialTo={today}
        showDateRange={false}
      />
    </PageWrapper>
  );
}
