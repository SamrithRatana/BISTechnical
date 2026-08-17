"use client";

/**
 * @file history-report/page.tsx
 * @description Machine History Report — port of the Blazor `/history-report`.
 * Tickets grouped by **serial number**, so one machine's entire repair history
 * reads top to bottom: what was wrong each time and what was done about it.
 *
 * Columns live in public/templates/history-report.xlsx.
 */

import { useCallback, useMemo } from "react";
import PageWrapper from "@/components/PageWrapper";
import TemplateReportView, { type ReportData } from "@/components/TemplateReportView";
import type { ReportFilterValues } from "@/components/ReportFilterBar";
import { useI18n } from "@/i18n/LanguageProvider";
import { translateStatus } from "@/i18n/statusLabel";
import { fetchServiceReport } from "@/services/reports";
import { formatDay, groupBy } from "@/services/reportShaping";

export default function HistoryReportPage() {
  const { t } = useI18n();
  const bounds = useMemo(() => {
    const now = new Date();
    // A machine's history is worth a year, not a month — a printer serviced
    // twice a year shows nothing useful in a 30-day window.
    return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear(), 11, 31) };
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
          (row) => {
            const serial = (row.serialNumber as string)?.trim();
            const name = (row.itemName as string)?.trim();
            // Serial alone is meaningless on a printed page; pairing it with the
            // model is how staff actually identify a machine.
            return serial ? `${serial}${name ? ` — ${name}` : ""}` : "";
          },
          t("report.unknownMachine")
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
    <PageWrapper titleKey="nav.historyReport" subtitleKey="report.historyTitle">
      <TemplateReportView
        template="history-report"
        title={t("report.historyTitle")}
        subtitle={subtitle}
        load={load}
        filters={["search", "status"]}
        format={format}
        fileName="machine-history-report"
        initialFrom={bounds.from}
        initialTo={bounds.to}
      />
    </PageWrapper>
  );
}
