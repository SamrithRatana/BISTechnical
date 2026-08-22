"use client";

/**
 * @file top-customers-report/page.tsx
 * @description Top Customer Accounts — ranks enterprise and VIP clients by service frequency and parts usage.
 * Columns defined in public/templates/top-customers-report.xlsx.
 */

import { useCallback, useMemo } from "react";
import PageWrapper from "@/components/PageWrapper";
import TemplateReportView, { type ReportData } from "@/components/TemplateReportView";
import type { ReportFilterValues } from "@/components/ReportFilterBar";
import { useI18n } from "@/i18n/LanguageProvider";
import { fetchTopCustomersReport } from "@/services/reports";
import { flat, formatDay } from "@/services/reportShaping";

export default function TopCustomersReportPage() {
  const { t } = useI18n();

  const initialFrom = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1); // Past 1 year
    return d;
  }, []);
  const initialTo = useMemo(() => new Date(), []);

  const load = useCallback(
    async (from: Date, to: Date, filters: ReportFilterValues): Promise<ReportData> => {
      const rows = await fetchTopCustomersReport({
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
    <PageWrapper titleKey="nav.topCustomers" subtitleKey="report.topCustomersTitle">
      <TemplateReportView
        template="top-customers-report"
        title={t("report.topCustomersTitle")}
        subtitle={subtitle}
        load={load}
        filters={["search", "serviceType", "location"]}
        format={format}
        fileName="top-customers-report"
        initialFrom={initialFrom}
        initialTo={initialTo}
      />
    </PageWrapper>
  );
}
