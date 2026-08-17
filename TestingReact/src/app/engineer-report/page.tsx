"use client";

/**
 * @file engineer-report/page.tsx
 * @description Engineer Report — port of the Blazor `/engineer-report`.
 * Tickets grouped by the engineer who worked them, so each technician's
 * workload for the period reads as one block.
 *
 * Columns live in public/templates/engineer-report.xlsx.
 */

import { useCallback, useMemo } from "react";
import PageWrapper from "@/components/PageWrapper";
import TemplateReportView, { type ReportData } from "@/components/TemplateReportView";
import type { ReportFilterValues } from "@/components/ReportFilterBar";
import { useI18n } from "@/i18n/LanguageProvider";
import { translateStatus } from "@/i18n/statusLabel";
import { fetchServiceReport } from "@/services/reports";
import { formatDay, groupBy } from "@/services/reportShaping";

/**
 * Who counts as "the engineer" for a ticket.
 *
 * A job passes through several hands, and the name that matters is whoever
 * carried it furthest: the repairer if it reached repair, else the inspector.
 * Falling straight through to "unassigned" would hide inspected-but-not-yet-
 * repaired work, which is exactly the backlog this report exists to show.
 */
function engineerOf(row: Record<string, unknown>): string {
  return (
    (row.repairByName as string) ||
    (row.inspectByName as string) ||
    (row.verifiedByName as string) ||
    ""
  );
}

export default function EngineerReportPage() {
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
      return {
        groups: groupBy(
          rows as unknown as Record<string, unknown>[],
          engineerOf,
          t("report.unassignedEngineer")
        ),
      };
    },
    [t]
  );

  const format = useCallback(
    (field: string, value: unknown) => {
      if (field === "serviceDate") return formatDay(value);
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
    <PageWrapper titleKey="nav.engineerReport" subtitleKey="report.engineerTitle">
      <TemplateReportView
        template="engineer-report"
        title={t("report.engineerTitle")}
        subtitle={subtitle}
        load={load}
        filters={["search", "status", "serviceType", "location"]}
        format={format}
        fileName="engineer-report"
        initialFrom={bounds.from}
        initialTo={bounds.to}
      />
    </PageWrapper>
  );
}
