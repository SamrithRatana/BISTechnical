"use client";

/**
 * @file engineer-kpi-report/page.tsx
 * @description Technician KPI & Performance Scorecard — ranks and grades each engineer
 * by completed jobs, MTTR, fix success rate %, and active WIP load.
 * Columns defined in public/templates/engineer-kpi-report.xlsx.
 */

import { useCallback, useMemo } from "react";
import PageWrapper from "@/components/PageWrapper";
import TemplateReportView, { type ReportData } from "@/components/TemplateReportView";
import type { ReportFilterValues } from "@/components/ReportFilterBar";
import { useI18n } from "@/i18n/LanguageProvider";
import { fetchEngineerKpiReport } from "@/services/reports";
import { flat, formatDay } from "@/services/reportShaping";

export default function EngineerKpiReportPage() {
  const { t } = useI18n();

  const initialFrom = useMemo(() => {
    const d = new Date();
    d.setDate(1); // First day of current month
    return d;
  }, []);
  const initialTo = useMemo(() => new Date(), []);

  const load = useCallback(
    async (from: Date, to: Date, filters: ReportFilterValues): Promise<ReportData> => {
      const rows = await fetchEngineerKpiReport({
        fromDate: from,
        toDate: to,
        searchTerm: filters.search,
        serviceType: filters.serviceType,
        serviceLocation: filters.serviceLocation,
      });

      return {
        groups: flat(rows as unknown as Record<string, unknown>[]),
      };
    },
    []
  );

  const format = useCallback((field: string, value: unknown) => {
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
    <PageWrapper titleKey="nav.engineerKpi" subtitleKey="report.engineerKpiTitle">
      <TemplateReportView
        template="engineer-kpi-report"
        title={t("report.engineerKpiTitle")}
        subtitle={subtitle}
        load={load}
        filters={["search", "serviceType", "location"]}
        format={format}
        fileName="engineer-kpi-scorecard-report"
        initialFrom={initialFrom}
        initialTo={initialTo}
      />
    </PageWrapper>
  );
}
