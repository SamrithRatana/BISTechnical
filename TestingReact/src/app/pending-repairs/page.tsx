"use client";

/**
 * @file pending-repairs/page.tsx
 * @description Active Backlog & Work-in-Progress Report.
 *
 * Shows all incomplete service tickets (excluding Finished, Customer Rejected,
 * Unrepairable), grouped by status, with days stuck (aging), assigned engineer,
 * and bottleneck notes so technicians and supervisors can prioritize work.
 *
 * Columns live in public/templates/pending-repairs.xlsx.
 */

import { useCallback, useMemo } from "react";
import PageWrapper from "@/components/PageWrapper";
import TemplateReportView, { type ReportData } from "@/components/TemplateReportView";
import type { ReportFilterValues } from "@/components/ReportFilterBar";
import { useI18n } from "@/i18n/LanguageProvider";
import { translateStatus } from "@/i18n/statusLabel";
import { fetchPendingRepairsReport } from "@/services/reports";
import { formatDay, groupBy } from "@/services/reportShaping";

/** Who counts as the assigned engineer for the pending ticket. */
function engineerOf(row: Record<string, unknown>): string {
  return (
    (row.repairByName as string) ||
    (row.inspectByName as string) ||
    (row.inspectingByName as string) ||
    (row.createdByName as string) ||
    ""
  );
}

export default function PendingRepairsReportPage() {
  const { t } = useI18n();

  // Wide default range (beginning of current year to today) so all standing backlog is visible
  const bounds = useMemo(() => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), 0, 1),
      to: now,
    };
  }, []);

  const load = useCallback(
    async (from: Date, to: Date, filters: ReportFilterValues): Promise<ReportData> => {
      const rows = await fetchPendingRepairsReport({
        fromDate: from,
        toDate: to,
        searchTerm: filters.search,
        statuses: filters.statuses,
        serviceType: filters.serviceType,
        serviceLocation: filters.serviceLocation,
      });

      const shapedRows = rows.map((row) => ({
        ...row,
        engineer: engineerOf(row as unknown as Record<string, unknown>) || t("report.unassignedEngineer"),
      }));

      const overdueCount = shapedRows.filter((r) => (r.daysTaken ?? 0) > 7).length;

      return {
        groups: groupBy(
          shapedRows as unknown as Record<string, unknown>[],
          (row) => (row.status ? translateStatus(String(row.status), t) : ""),
          t("report.ungroupedStatus")
        ),
        summary: `${t("report.totalPending", { count: String(shapedRows.length) })} | ${t("report.overdueTickets", { count: String(overdueCount) })}`,
      };
    },
    [t]
  );

  const format = useCallback(
    (field: string, value: unknown) => {
      if (field === "serviceDate") return formatDay(value);
      if (field === "status" && value) return translateStatus(String(value), t);
      if (field === "daysTaken" && value !== null && value !== undefined) {
        return `${value} d`;
      }
      return value === null || value === undefined ? "" : String(value);
    },
    [t]
  );

  const subtitle = useCallback(
    () => t("report.pendingSubtitle"),
    [t]
  );

  return (
    <PageWrapper titleKey="nav.pendingRepairs" subtitleKey="report.pendingTitle">
      <TemplateReportView
        template="pending-repairs"
        title={t("report.pendingTitle")}
        subtitle={subtitle}
        load={load}
        filters={["search", "status", "serviceType", "location"]}
        format={format}
        fileName="active-backlog-report"
        initialFrom={bounds.from}
        initialTo={bounds.to}
      />
    </PageWrapper>
  );
}
