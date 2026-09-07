"use client";

/**
 * @file customer-report/page.tsx
 * @description Customer Report — port of the Blazor `/customer-report`.
 * Tickets grouped by **company**, with the contact and phone alongside, so a
 * customer's whole history for the period reads as one block.
 *
 * Columns live in public/templates/customer-report.xlsx.
 */

import { useCallback, useMemo } from "react";
import PageWrapper from "@/components/PageWrapper";
import TemplateReportView, { type ReportData } from "@/components/TemplateReportView";
import type { ReportFilterValues } from "@/components/ReportFilterBar";
import { useI18n } from "@/i18n/LanguageProvider";
import { translateStatus } from "@/i18n/statusLabel";
import { fetchServiceReport } from "@/services/reports";
import { formatDay, groupBy } from "@/services/reportShaping";

export default function CustomerReportPage() {
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
      const rows = await fetchServiceReport({
        fromDate: from,
        toDate: to,
        searchTerm: filters.search,
        statuses: filters.statuses,
        serviceType: filters.serviceType,
        serviceLocation: filters.serviceLocation,
      });
      const shapedRows = rows.map((row) => ({
        ...row,
        engineer: row.repairByName || row.inspectByName || row.createdByName || "—",
      }));

      return {
        groups: groupBy(
          shapedRows as unknown as Record<string, unknown>[],
          (row) => (row.companyName as string) ?? "",
          t("report.ungrouped")
        ),
      };
    },
    [t]
  );

  const format = useCallback(
    (field: string, value: unknown) => {
      if (field === "serviceDate") return formatDay(value);
      if (field === "engineer") return value ? String(value) : "—";
      if (field === "status" && value) return translateStatus(String(value), t);
      return value === null || value === undefined ? "" : String(value);
    },
    [t]
  );

  const subtitle = useCallback(
    (from: Date, to: Date) =>
      t("report.monthlyRange", { from: formatDay(from.toISOString()), to: formatDay(to.toISOString()) }),
    [t]
  );

  return (
    <PageWrapper titleKey="nav.customerReport" subtitleKey="report.customerTitle">
      <TemplateReportView
        template="customer-report"
        title={t("report.customerTitle")}
        subtitle={subtitle}
        load={load}
        filters={["search", "status"]}
        format={format}
        fileName="customer-report"
        initialFrom={bounds.from}
        initialTo={bounds.to}
      />
    </PageWrapper>
  );
}
