"use client";

/**
 * @file completed-repairs/page.tsx
 * @description Completed Repair Services Report.
 *
 * Shows all service tickets finished within a chosen FinishedDate range,
 * grouped by engineer, showing turnaround time (Days Taken), solution,
 * and repair performance for throughput tracking and quality control.
 *
 * Columns live in public/templates/completed-repairs.xlsx.
 */

import { useCallback, useMemo } from "react";
import PageWrapper from "@/components/PageWrapper";
import TemplateReportView, { type ReportData } from "@/components/TemplateReportView";
import type { ReportFilterValues } from "@/components/ReportFilterBar";
import { useI18n } from "@/i18n/LanguageProvider";
import { fetchCompletedRepairsReport } from "@/services/reports";
import { formatDay, groupBy } from "@/services/reportShaping";

/** Who counts as the repairing technician for the finished ticket. */
function engineerOf(row: Record<string, unknown>): string {
  return (
    (row.repairByName as string) ||
    (row.verifiedByName as string) ||
    (row.inspectByName as string) ||
    ""
  );
}

export default function CompletedRepairsReportPage() {
  const { t } = useI18n();

  // Defaults to current month
  const bounds = useMemo(() => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    };
  }, []);

  const load = useCallback(
    async (from: Date, to: Date, filters: ReportFilterValues): Promise<ReportData> => {
      const rows = await fetchCompletedRepairsReport({
        fromDate: from,
        toDate: to,
        searchTerm: filters.search,
        serviceType: filters.serviceType,
        serviceLocation: filters.serviceLocation,
      });

      const shapedRows = rows.map((row) => ({
        ...row,
        engineer: engineerOf(row as unknown as Record<string, unknown>) || t("report.unassignedEngineer"),
        solution: row.solution || "—",
      }));

      const totalCount = shapedRows.length;
      const totalDays = shapedRows.reduce((sum, r) => sum + (r.daysTaken ?? 0), 0);
      const avgDays = totalCount > 0 ? (totalDays / totalCount).toFixed(1) : "0";

      return {
        groups: groupBy(
          shapedRows as unknown as Record<string, unknown>[],
          engineerOf,
          t("report.unassignedEngineer")
        ),
        summary: `${t("report.totalCompleted", { count: String(totalCount) })} | ${t("report.avgTurnaround", { days: avgDays })}`,
      };
    },
    [t]
  );

  const format = useCallback(
    (field: string, value: unknown) => {
      if (field === "finishedDate" || field === "serviceDate") return formatDay(value);
      if (field === "daysTaken" && value !== null && value !== undefined) {
        return `${value} d`;
      }
      return value === null || value === undefined ? "" : String(value);
    },
    []
  );

  const subtitle = useCallback(
    (from: Date, to: Date) =>
      t("report.monthlyRange", { from: formatDay(from.toISOString()), to: formatDay(to.toISOString()) }),
    [t]
  );

  return (
    <PageWrapper titleKey="nav.completedRepairs" subtitleKey="report.completedTitle">
      <TemplateReportView
        template="completed-repairs"
        title={t("report.completedTitle")}
        subtitle={subtitle}
        load={load}
        filters={["search", "serviceType", "location"]}
        format={format}
        fileName="completed-repairs-report"
        initialFrom={bounds.from}
        initialTo={bounds.to}
      />
    </PageWrapper>
  );
}
