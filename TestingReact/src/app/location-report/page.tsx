"use client";

/**
 * @file location-report/page.tsx
 * @description Service Location Report — compares on-site technician visits to in-house repairs.
 * Columns defined in public/templates/location-report.xlsx.
 */

import { useCallback, useMemo } from "react";
import PageWrapper from "@/components/PageWrapper";
import TemplateReportView, { type ReportData } from "@/components/TemplateReportView";
import type { ReportFilterValues } from "@/components/ReportFilterBar";
import { useI18n } from "@/i18n/LanguageProvider";
import { translateStatus } from "@/i18n/statusLabel";
import { fetchLocationReport } from "@/services/reports";
import { formatDay, formatDayTime, groupBy } from "@/services/reportShaping";

export default function LocationReportPage() {
  const { t } = useI18n();

  const initialFrom = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  }, []);
  const initialTo = useMemo(() => new Date(), []);

  const load = useCallback(
    async (from: Date, to: Date, filters: ReportFilterValues): Promise<ReportData> => {
      const rows = await fetchLocationReport({
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
            row.serviceLocation === "OnSite"
              ? t("report.onSiteLocation")
              : t("report.inHouseLocation"),
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
      if (field === "locationLabel") {
        return value === "On-Site (At Client)"
          ? t("report.onSiteLocation")
          : t("report.inHouseLocation");
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
    <PageWrapper titleKey="nav.locationReport" subtitleKey="report.locationTitle">
      <TemplateReportView
        template="location-report"
        title={t("report.locationTitle")}
        subtitle={subtitle}
        load={load}
        filters={["search", "status", "serviceType", "location"]}
        format={format}
        fileName="service-location-report"
        initialFrom={initialFrom}
        initialTo={initialTo}
      />
    </PageWrapper>
  );
}
