"use client";

/**
 * @file sparepart-usage/page.tsx
 * @description Spare Part Usage Report — port of the Blazor `/sparepart-usage`.
 * What was consumed over the period, split by whether it left stock through a
 * service job or a manual stock-out.
 *
 * Columns live in public/templates/sparepart-usage.xlsx.
 */

import { useCallback, useMemo } from "react";
import PageWrapper from "@/components/PageWrapper";
import TemplateReportView, { type ReportData } from "@/components/TemplateReportView";
import { type ReportFilterValues } from "@/components/ReportFilterBar";
import { useI18n } from "@/i18n/LanguageProvider";
import { fetchSparepartUsage } from "@/services/reports";
import { flat, formatDay } from "@/services/reportShaping";

export default function SparepartUsageReportPage() {
  const { t } = useI18n();

  const bounds = useMemo(() => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    };
  }, []);

  const load = useCallback(
    async (from: Date, to: Date, filters: ReportFilterValues): Promise<ReportData> => {
      const rows = await fetchSparepartUsage(from, to, filters.dateMode);

      const totalUsed = rows.reduce((sum, r) => sum + (r.usedQuantity ?? 0), 0);
      const fromService = rows.reduce((sum, r) => sum + (r.serviceUsedQty ?? 0), 0);
      const manual = rows.reduce((sum, r) => sum + (r.manualUsedQty ?? 0), 0);

      return {
        groups: flat(rows as unknown as Record<string, unknown>[]),
        summary: [
          `${t("report.totalUsed")}: ${totalUsed}`,
          `${t("report.fromService")}: ${fromService}`,
          `${t("report.manualOut")}: ${manual}`,
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
    <PageWrapper titleKey="nav.sparepartUsage" subtitleKey="report.usageTitle">
      <TemplateReportView
        template="sparepart-usage"
        title={t("report.usageTitle")}
        subtitle={subtitle}
        load={load}
        fileName="sparepart-usage-report"
        filters={["dateMode"]}
        initialFrom={bounds.from}
        initialTo={bounds.to}
      />
    </PageWrapper>
  );
}
