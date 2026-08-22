"use client";

/**
 * @file sales-followup/page.tsx
 * @description Quotation Follow-up Tracker — tracks tickets in Awaiting Customer Confirm
 * with customer contacts, quoted spare parts, and days waiting.
 * Columns defined in public/templates/sales-followup.xlsx.
 */

import { useCallback, useMemo } from "react";
import PageWrapper from "@/components/PageWrapper";
import TemplateReportView, { type ReportData } from "@/components/TemplateReportView";
import type { ReportFilterValues } from "@/components/ReportFilterBar";
import { useI18n } from "@/i18n/LanguageProvider";
import { translateStatus } from "@/i18n/statusLabel";
import { fetchSalesFollowupReport } from "@/services/reports";
import { formatDay, formatDayTime, groupBy } from "@/services/reportShaping";

export default function SalesFollowupPage() {
  const { t } = useI18n();

  const initialFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); // Last 30 days
    return d;
  }, []);
  const initialTo = useMemo(() => new Date(), []);

  const load = useCallback(
    async (from: Date, to: Date, filters: ReportFilterValues): Promise<ReportData> => {
      const rows = await fetchSalesFollowupReport({
        fromDate: from,
        toDate: to,
        searchTerm: filters.search,
        serviceType: filters.serviceType,
        serviceLocation: filters.serviceLocation,
      });

      return {
        groups: groupBy(
          rows as unknown as Record<string, unknown>[],
          (row) => String(row.companyName || t("report.ungrouped")),
          t("report.ungrouped")
        ),
      };
    },
    [t]
  );

  const format = useCallback(
    (field: string, value: unknown) => {
      if (field === "awaitingDate") return formatDayTime(value);
      if (field === "serviceDate") return formatDayTime(value);
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
    <PageWrapper titleKey="nav.salesFollowup" subtitleKey="report.salesFollowupTitle">
      <TemplateReportView
        template="sales-followup"
        title={t("report.salesFollowupTitle")}
        subtitle={subtitle}
        load={load}
        filters={["search", "serviceType", "location"]}
        format={format}
        fileName="quotation-followup-report"
        initialFrom={initialFrom}
        initialTo={initialTo}
      />
    </PageWrapper>
  );
}
