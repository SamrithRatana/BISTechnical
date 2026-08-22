"use client";

/**
 * @file faults-report/page.tsx
 * @description Common Faults & Diagnostics Report — analyzes reported machine problems,
 * diagnoses, and applied solutions grouped by model.
 * Columns defined in public/templates/faults-report.xlsx.
 */

import { useCallback, useMemo } from "react";
import PageWrapper from "@/components/PageWrapper";
import TemplateReportView, { type ReportData } from "@/components/TemplateReportView";
import type { ReportFilterValues } from "@/components/ReportFilterBar";
import { useI18n } from "@/i18n/LanguageProvider";
import { fetchFaultsReport } from "@/services/reports";
import { formatDay, formatDayTime, groupBy } from "@/services/reportShaping";

export default function FaultsReportPage() {
  const { t } = useI18n();

  const initialFrom = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1); // Defaults to past 1 year for broad diagnostic history
    return d;
  }, []);
  const initialTo = useMemo(() => new Date(), []);

  const load = useCallback(
    async (from: Date, to: Date, filters: ReportFilterValues): Promise<ReportData> => {
      const rows = await fetchFaultsReport({
        fromDate: from,
        toDate: to,
        searchTerm: filters.search,
        serviceType: filters.serviceType,
        serviceLocation: filters.serviceLocation,
      });

      return {
        groups: groupBy(
          rows as unknown as Record<string, unknown>[],
          (row) => String(row.itemName || t("report.unknownMachine")),
          t("report.unknownMachine")
        ),
      };
    },
    [t]
  );

  const format = useCallback((field: string, value: unknown) => {
    if (field === "serviceDate") return formatDayTime(value);
    return value === null || value === undefined ? "" : String(value);
  }, []);

  const subtitle = useCallback(
    (from: Date, to: Date) =>
      t("report.monthlyRange", {
        from: formatDay(from.toISOString()),
        to: formatDay(to.toISOString()),
      }),
    [t]
  );

  return (
    <PageWrapper titleKey="nav.faultsReport" subtitleKey="report.faultsTitle">
      <TemplateReportView
        template="faults-report"
        title={t("report.faultsTitle")}
        subtitle={subtitle}
        load={load}
        filters={["search", "serviceType", "location"]}
        format={format}
        fileName="faults-diagnostics-report"
        initialFrom={initialFrom}
        initialTo={initialTo}
      />
    </PageWrapper>
  );
}
