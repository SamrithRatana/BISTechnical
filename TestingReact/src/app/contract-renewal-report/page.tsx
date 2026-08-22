"use client";

/**
 * @file contract-renewal-report/page.tsx
 * @description Contract SLA Renewal Tracker — identifies expiring maintenance agreements
 * and high-frequency walk-in clients ready to upgrade to annual AMC.
 * Columns defined in public/templates/contract-renewal-report.xlsx.
 */

import { useCallback, useMemo } from "react";
import PageWrapper from "@/components/PageWrapper";
import TemplateReportView, { type ReportData } from "@/components/TemplateReportView";
import type { ReportFilterValues } from "@/components/ReportFilterBar";
import { useI18n } from "@/i18n/LanguageProvider";
import { fetchContractRenewalReport } from "@/services/reports";
import { formatDay, formatDayTime, groupBy } from "@/services/reportShaping";

export default function ContractRenewalReportPage() {
  const { t } = useI18n();

  const initialFrom = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1); // Past 1 year
    return d;
  }, []);
  const initialTo = useMemo(() => new Date(), []);

  const load = useCallback(
    async (from: Date, to: Date, filters: ReportFilterValues): Promise<ReportData> => {
      const rows = await fetchContractRenewalReport({
        fromDate: from,
        toDate: to,
        searchTerm: filters.search,
        serviceType: filters.serviceType,
        serviceLocation: filters.serviceLocation,
      });

      return {
        groups: groupBy(
          rows as unknown as Record<string, unknown>[],
          (row) => String(row.contractStatus || t("report.ungrouped")),
          t("report.ungrouped")
        ),
      };
    },
    [t]
  );

  const format = useCallback((field: string, value: unknown) => {
    if (field === "lastServiceDate") return formatDayTime(value);
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
    <PageWrapper titleKey="nav.contractRenewal" subtitleKey="report.contractRenewalTitle">
      <TemplateReportView
        template="contract-renewal-report"
        title={t("report.contractRenewalTitle")}
        subtitle={subtitle}
        load={load}
        filters={["search", "serviceType", "location"]}
        format={format}
        fileName="contract-renewal-report"
        initialFrom={initialFrom}
        initialTo={initialTo}
      />
    </PageWrapper>
  );
}
