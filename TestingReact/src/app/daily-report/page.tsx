"use client";

/**
 * @file daily-report/page.tsx
 * @description Daily Repair Report — port of the Blazor `/daily-report`
 * (Pages/Reports/Daily ReportFolder/DailyReportPage.razor), which groups the
 * day's tickets by **status** so a supervisor can see what is stuck where.
 *
 * Columns live in public/templates/daily-report.xlsx.
 */

import { useCallback, useMemo } from "react";
import PageWrapper from "@/components/PageWrapper";
import TemplateReportView, { type ReportData } from "@/components/TemplateReportView";
import type { ReportFilterValues } from "@/components/ReportFilterBar";
import { useI18n } from "@/i18n/LanguageProvider";
import { translateStatus } from "@/i18n/statusLabel";
import { fetchDailyReport } from "@/services/reports";
import { formatDay, formatDayTime, groupBy } from "@/services/reportShaping";

export default function DailyReportPage() {
  const { t } = useI18n();

  // Defaults to today — this is the *daily* report.
  const today = useMemo(() => new Date(), []);

  const load = useCallback(
    async (from: Date, to: Date, filters: ReportFilterValues): Promise<ReportData> => {
      const rows = await fetchDailyReport({
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
      if (field === "serviceDate") return formatDayTime(value);
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
    <PageWrapper titleKey="nav.dailyReport" subtitleKey="report.dailyTitle">
      <TemplateReportView
        template="daily-report"
        title={t("report.dailyTitle")}
        subtitle={subtitle}
        load={load}
        filters={["search", "status", "serviceType", "location"]}
        format={format}
        fileName="daily-repair-report"
        initialFrom={today}
        initialTo={today}
      />
    </PageWrapper>
  );
}
