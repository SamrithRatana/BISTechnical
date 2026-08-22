"use client";

/**
 * @file third-party-repairs/page.tsx
 * @description Third-Party Outsourced Repairs Report — tracks tickets sent to external vendor workshops.
 * Columns defined in public/templates/third-party-repairs.xlsx.
 */

import { useCallback, useMemo } from "react";
import PageWrapper from "@/components/PageWrapper";
import TemplateReportView, { type ReportData } from "@/components/TemplateReportView";
import type { ReportFilterValues } from "@/components/ReportFilterBar";
import { useI18n } from "@/i18n/LanguageProvider";
import { translateStatus } from "@/i18n/statusLabel";
import { fetchThirdPartyRepairsReport } from "@/services/reports";
import { formatDay, formatDayTime, groupBy } from "@/services/reportShaping";

export default function ThirdPartyRepairsPage() {
  const { t } = useI18n();

  const initialFrom = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  }, []);
  const initialTo = useMemo(() => new Date(), []);

  const load = useCallback(
    async (from: Date, to: Date, filters: ReportFilterValues): Promise<ReportData> => {
      const rows = await fetchThirdPartyRepairsReport({
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
          (row) => (row.status ? translateStatus(String(row.status), t) : ""),
          t("report.ungroupedStatus")
        ),
      };
    },
    [t]
  );

  const format = useCallback(
    (field: string, value: unknown) => {
      if (field === "thirdPartyRepairDate") return formatDayTime(value);
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
    <PageWrapper titleKey="nav.thirdPartyRepairs" subtitleKey="report.thirdPartyTitle">
      <TemplateReportView
        template="third-party-repairs"
        title={t("report.thirdPartyTitle")}
        subtitle={subtitle}
        load={load}
        filters={["search", "status", "serviceType", "location"]}
        format={format}
        fileName="third-party-repairs-report"
        initialFrom={initialFrom}
        initialTo={initialTo}
      />
    </PageWrapper>
  );
}
