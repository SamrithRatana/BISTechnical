"use client";

/**
 * @file sales-leads-report/page.tsx
 * @description New Machine Hot Sales Leads Report — tracks unrepairable and customer rejected jobs
 * to pitch new replacement equipment.
 * Columns defined in public/templates/sales-leads-report.xlsx.
 */

import { useCallback, useMemo } from "react";
import PageWrapper from "@/components/PageWrapper";
import TemplateReportView, { type ReportData } from "@/components/TemplateReportView";
import type { ReportFilterValues } from "@/components/ReportFilterBar";
import { useI18n } from "@/i18n/LanguageProvider";
import { translateStatus } from "@/i18n/statusLabel";
import { fetchSalesLeadsReport } from "@/services/reports";
import { formatDay, formatDayTime, groupBy } from "@/services/reportShaping";

export default function SalesLeadsReportPage() {
  const { t } = useI18n();

  const initialFrom = useMemo(() => {
    const d = new Date();
    d.setDate(1); // Start of month
    return d;
  }, []);
  const initialTo = useMemo(() => new Date(), []);

  const load = useCallback(
    async (from: Date, to: Date, filters: ReportFilterValues): Promise<ReportData> => {
      const rows = await fetchSalesLeadsReport({
        fromDate: from,
        toDate: to,
        searchTerm: filters.search,
        serviceType: filters.serviceType,
        serviceLocation: filters.serviceLocation,
      });

      const shapedRows = rows.map((row) => ({
        ...row,
        diagnosedBy: row.inspectByName || row.createdByName || "—",
      }));

      return {
        groups: groupBy(
          shapedRows as unknown as Record<string, unknown>[],
          (row) => (row.status ? translateStatus(String(row.status), t) : ""),
          t("report.ungroupedStatus")
        ),
      };
    },
    [t]
  );

  const format = useCallback(
    (field: string, value: unknown) => {
      if (field === "serviceDate") return formatDayTime(value);
      if (field === "diagnosedBy") return value ? String(value) : "—";
      if (field === "status" && value) return translateStatus(String(value), t);
      return value === null || value === undefined ? "" : String(value);
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
    <PageWrapper titleKey="nav.salesLeads" subtitleKey="report.salesLeadsTitle">
      <TemplateReportView
        template="sales-leads-report"
        title={t("report.salesLeadsTitle")}
        subtitle={subtitle}
        load={load}
        filters={["search", "serviceType", "location"]}
        format={format}
        fileName="new-machine-leads-report"
        initialFrom={initialFrom}
        initialTo={initialTo}
      />
    </PageWrapper>
  );
}
