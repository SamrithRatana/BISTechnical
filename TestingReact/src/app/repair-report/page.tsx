"use client";

/**
 * @file repair-report/page.tsx
 * @description Repair Summary Report — port of the Blazor `/repair-report`
 * (Pages/Reports/SummaryReport/SummaryReportPage.razor).
 *
 * The only report here that is a **matrix rather than a list**: one row per
 * engineer, one column per month. That shape is why it uses a flat (ungrouped)
 * template — the months are the columns, so there is nothing left to group by.
 *
 * Columns live in public/templates/repair-report.xlsx.
 */

import { useCallback, useMemo } from "react";
import PageWrapper from "@/components/PageWrapper";
import TemplateReportView, { type ReportData } from "@/components/TemplateReportView";
import type { ReportFilterValues } from "@/components/ReportFilterBar";
import { useI18n } from "@/i18n/LanguageProvider";
import { fetchServiceReport } from "@/services/reports";
import { flat } from "@/services/reportShaping";
import type { RepairServiceItem } from "@/services/types";

/** Whoever carried the job furthest — see engineer-report for the reasoning. */
function engineerOf(row: RepairServiceItem): string {
  return row.repairByName || row.inspectByName || row.verifiedByName || "";
}

export default function RepairSummaryReportPage() {
  const { t } = useI18n();

  // A whole calendar year: the columns are months, so anything shorter leaves
  // most of the sheet empty.
  const bounds = useMemo(() => {
    const year = new Date().getFullYear();
    return { from: new Date(year, 0, 1), to: new Date(year, 11, 31) };
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

      const byEngineer = new Map<string, number[]>();
      for (const row of rows) {
        const name = engineerOf(row) || t("report.unassignedEngineer");
        const date = new Date(row.serviceDate ?? "");
        if (Number.isNaN(date.getTime())) continue;

        const months = byEngineer.get(name) ?? new Array<number>(12).fill(0);
        months[date.getMonth()] += 1;
        byEngineer.set(name, months);
      }

      const matrix = Array.from(byEngineer.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([engineer, months]) => {
          const record: Record<string, unknown> = { engineer };
          months.forEach((count, index) => {
            // Blank rather than 0: a sheet of zeroes hides the months that
            // actually have work in them.
            record[`m${index + 1}`] = count || "";
          });
          record.totalJobs = months.reduce((sum, n) => sum + n, 0);
          return record;
        });

      const monthTotals = new Array<number>(12).fill(0);
      for (const months of byEngineer.values()) {
        months.forEach((count, index) => {
          monthTotals[index] += count;
        });
      }
      const grandTotalJobs = monthTotals.reduce((sum, n) => sum + n, 0);

      const columnTotals: Record<string, number | string> = {};
      monthTotals.forEach((count, index) => {
        columnTotals[`total_m${index + 1}`] = count || "";
      });
      columnTotals["total"] = grandTotalJobs;

      return {
        groups: flat(matrix),
        columnTotals,
      };
    },
    [t]
  );

  const subtitle = useCallback(
    (from: Date) => t("report.janThroughDec", { year: String(from.getFullYear()) }),
    [t]
  );

  return (
    <PageWrapper titleKey="nav.repairReport" subtitleKey="report.repairTitle">
      <TemplateReportView
        template="repair-report"
        title={t("report.repairTitle")}
        subtitle={subtitle}
        load={load}
        filters={["serviceType", "location"]}
        fileName="repair-summary-report"
        initialFrom={bounds.from}
        initialTo={bounds.to}
      />
    </PageWrapper>
  );
}
