"use client";

/**
 * @file contract-report/page.tsx
 * @description Contract vs Walk-in Service Report — breaks down service volume
 * between annual SLA maintenance contracts (hasContract=true) and walk-in customers.
 * Columns defined in public/templates/contract-report.xlsx.
 */

import { useCallback, useMemo } from "react";
import PageWrapper from "@/components/PageWrapper";
import TemplateReportView, { type ReportData } from "@/components/TemplateReportView";
import type { ReportFilterValues } from "@/components/ReportFilterBar";
import { useI18n } from "@/i18n/LanguageProvider";
import { translateStatus } from "@/i18n/statusLabel";
import { fetchContractReport } from "@/services/reports";
import { formatDay, formatDayTime, groupBy } from "@/services/reportShaping";

export default function ContractReportPage() {
  const { t } = useI18n();

  const initialFrom = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  }, []);
  const initialTo = useMemo(() => new Date(), []);

  const load = useCallback(
    async (from: Date, to: Date, filters: ReportFilterValues): Promise<ReportData> => {
      const rows = await fetchContractReport({
        fromDate: from,
        toDate: to,
        searchTerm: filters.search,
        statuses: filters.statuses,
        serviceType: filters.serviceType,
        serviceLocation: filters.serviceLocation,
      });

      return {
        groups: groupBy(
          rows as unknown as Record<string, unknown>[],
          (row) =>
            row.hasContract
              ? t("report.underContract")
              : t("report.walkIn"),
          t("report.ungrouped")
        ),
      };
    },
    [t]
  );

  const format = useCallback(
    (field: string, value: unknown) => {
      if (field === "serviceDate") return formatDayTime(value);
      if (field === "status" && value) return translateStatus(String(value), t);
      if (field === "contractLabel") {
        return value === "Under Contract" ? t("report.underContract") : t("report.walkIn");
      }
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
    <PageWrapper titleKey="nav.contractReport" subtitleKey="report.contractTitle">
      <TemplateReportView
        template="contract-report"
        title={t("report.contractTitle")}
        subtitle={subtitle}
        load={load}
        filters={["search", "status", "serviceType", "location"]}
        format={format}
        fileName="contract-service-report"
        initialFrom={initialFrom}
        initialTo={initialTo}
      />
    </PageWrapper>
  );
}
