"use client";

/**
 * @file sparepart-hold/page.tsx
 * @description Spare Part Hold Report — port of the Blazor `/sparepart-hold`.
 * Parts committed to open jobs but not yet consumed, and what that leaves
 * genuinely available.
 *
 * No date range: "on hold" describes right now, not a period — so the range
 * inputs are hidden rather than shown and quietly ignored.
 *
 * Columns live in public/templates/sparepart-hold.xlsx.
 */

import { useCallback, useMemo } from "react";
import PageWrapper from "@/components/PageWrapper";
import TemplateReportView, { type ReportData } from "@/components/TemplateReportView";
import { useI18n } from "@/i18n/LanguageProvider";
import { fetchSparepartHold } from "@/services/reports";
import { flat } from "@/services/reportShaping";

export default function SparepartHoldReportPage() {
  const { t } = useI18n();
  const today = useMemo(() => new Date(), []);

  const load = useCallback(async (): Promise<ReportData> => {
    const rows = await fetchSparepartHold();

    // Effective stock is the number that answers "can I promise this part to
    // another job?", and it is not on the wire — the API sends current stock
    // and held quantity separately, leaving the subtraction to the caller.
    const withEffective = rows.map((row) => ({
      ...row,
      effectiveStock: (row.currentStock ?? 0) - (row.totalHoldQty ?? 0),
    }));

    const totalHeld = withEffective.reduce((sum, r) => sum + (r.totalHoldQty ?? 0), 0);
    // Negative effective stock means more is promised than exists — the row a
    // storekeeper needs to see first.
    const oversold = withEffective.filter((r) => r.effectiveStock < 0).length;

    return {
      groups: flat(withEffective as unknown as Record<string, unknown>[]),
      summary: `${t("report.totalHeld")}: ${totalHeld}     ${t("report.oversold")}: ${oversold}`,
    };
  }, [t]);

  const subtitle = useCallback(() => t("report.asOfNow"), [t]);

  return (
    <PageWrapper titleKey="nav.sparepartHold" subtitleKey="report.holdTitle">
      <TemplateReportView
        template="sparepart-hold"
        title={t("report.holdTitle")}
        subtitle={subtitle}
        load={load}
        fileName="sparepart-hold-report"
        initialFrom={today}
        initialTo={today}
        showDateRange={false}
      />
    </PageWrapper>
  );
}
