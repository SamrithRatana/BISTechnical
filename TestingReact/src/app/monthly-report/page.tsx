"use client";

/**
 * @file monthly-report/page.tsx
 * @description Monthly Repair Report — port of the Blazor `/monthly-report`
 * (Pages/Reports/MonthlyReport/MonthlyReportPage.razor). Tickets grouped by
 * **company**, with the Fixed / Customer Rejected / Unrepairable breakdown the
 * original carried under its grand total.
 *
 * Columns live in public/templates/monthly-report.xlsx — open it in Excel to
 * change them.
 */

import { useCallback, useMemo } from "react";
import PageWrapper from "@/components/PageWrapper";
import TemplateReportView, { type ReportData } from "@/components/TemplateReportView";
import type { ReportFilterValues } from "@/components/ReportFilterBar";
import { useI18n } from "@/i18n/LanguageProvider";
import { translateStatus } from "@/i18n/statusLabel";
import { fetchServiceReport } from "@/services/reports";
import { formatDay, groupBy } from "@/services/reportShaping";

export default function MonthlyReportPage() {
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

      const count = (status: string) => rows.filter((r) => r.status === status).length;

      const shapedRows = rows.map((row) => ({
        ...row,
        engineer:
          row.repairByName ||
          row.verifiedByName ||
          row.inspectByName ||
          row.createdByName ||
          "—",
      }));

      return {
        groups: groupBy(
          shapedRows as unknown as Record<string, unknown>[],
          (row) => (row.companyName as string) ?? "",
          t("report.ungrouped")
        ),
        summary: [
          `${t("report.statFixed")}: ${count("Finished")}`,
          `${t("report.statCustomerRejected")}: ${count("Customer Rejected")}`,
          `${t("report.statUnrepairable")}: ${count("Unrepairable")}`,
        ].join("     "),
      };
    },
    [t]
  );

  const format = useCallback(
    (field: string, value: unknown) => {
      if (field === "serviceDate") return formatDay(value);
      if (field === "engineer") return value ? String(value) : "—";
      // Translated at render only — the raw English status stays in state and
      // on the wire, per the app's rule for backend enum values.
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
    <PageWrapper titleKey="nav.monthlyReport" subtitleKey="report.monthlyTitle">
      <TemplateReportView
        template="monthly-report"
        title={t("report.monthlyTitle")}
        subtitle={subtitle}
        load={load}
        filters={["search", "status", "serviceType"]}
        format={format}
        fileName="monthly-repair-report"
        initialFrom={bounds.from}
        initialTo={bounds.to}
      />
    </PageWrapper>
  );
}
