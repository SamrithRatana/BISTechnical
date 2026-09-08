"use client";

/**
 * @file stage-report/page.tsx
 * @description Stage Activity Report — tracks workflow throughput by specific
 * milestone transition dates (Inspection, Await Confirm, Repairing, Finished, etc.)
 * with zero "ALL" ambiguity.
 */

import { useCallback, useMemo, useState } from "react";
import PageWrapper from "@/components/PageWrapper";
import TemplateReportView, { type ReportData } from "@/components/TemplateReportView";
import type { ReportFilterValues } from "@/components/ReportFilterBar";
import { useI18n } from "@/i18n/LanguageProvider";
import { translateStatus } from "@/i18n/statusLabel";
import {
  fetchStageActivityReport,
  type ServiceStageKey,
} from "@/services/reports";
import { formatDay, formatDayTime, groupBy } from "@/services/reportShaping";

const STAGES: { key: ServiceStageKey; labelKey: string }[] = [
  { key: "Item Recieved", labelKey: "status.itemRecieved" },
  { key: "Inspection", labelKey: "status.inspection" },
  { key: "Inspecting", labelKey: "status.inspecting" },
  { key: "Awaiting Customer Confirm", labelKey: "status.awaitingCustomerConfirm" },
  { key: "Awaiting Sparepart", labelKey: "status.awaitingSparepart" },
  { key: "Sale Confirmed", labelKey: "status.saleConfirmed" },
  { key: "Sent Spareparts", labelKey: "status.sentSpareparts" },
  { key: "Repairing", labelKey: "status.repairing" },
  { key: "Finished", labelKey: "status.finished" },
  { key: "Customer Rejected", labelKey: "status.customerRejected" },
  { key: "Unrepairable", labelKey: "status.unrepairable" },
  { key: "Repair by Third-Party", labelKey: "status.repairByThirdParty" },
];

export default function StageReportPage() {
  const { t, lang } = useI18n();
  const isKhmer = lang === "km";

  // Active Stage selection — NO "ALL" option
  const [selectedStage, setSelectedStage] = useState<ServiceStageKey>("Inspection");
  const [totalCount, setTotalCount] = useState(0);

  const bounds = useMemo(() => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    };
  }, []);

  const load = useCallback(
    async (from: Date, to: Date, filters: ReportFilterValues): Promise<ReportData> => {
      const rows = await fetchStageActivityReport({
        stage: selectedStage,
        fromDate: from,
        toDate: to,
        searchTerm: filters.search,
        serviceType: filters.serviceType,
        serviceLocation: filters.serviceLocation,
      });

      setTotalCount(rows.length);

      return {
        groups: groupBy(
          rows as unknown as Record<string, unknown>[],
          (row) => String(row.performedBy || t("report.unassignedEngineer")),
          t("report.unassignedEngineer")
        ),
      };
    },
    [selectedStage, t]
  );

  const format = useCallback(
    (field: string, value: unknown) => {
      if (field === "stageDate") return formatDayTime(value);
      if (field === "serviceDate") return formatDay(value);
      if (field === "status" && value) return translateStatus(String(value), t);
      return value === null || value === undefined ? "" : String(value);
    },
    [t]
  );

  const subtitle = useCallback(
    (from: Date, to: Date) => {
      const stageName = translateStatus(selectedStage, t);
      return `${stageName} • ${t("report.monthlyRange", {
        from: formatDay(from.toISOString()),
        to: formatDay(to.toISOString()),
      })}`;
    },
    [selectedStage, t]
  );

  return (
    <PageWrapper titleKey="nav.stageReport" subtitleKey="report.stageSubtitle">
      {/* Stage Selector Header Strip */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-subtle bg-surface p-3 shadow-xs">
        <span className="text-xs font-semibold text-ink-primary">
          {t("report.selectStage")}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {STAGES.map((s) => {
            const active = selectedStage === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSelectedStage(s.key)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-[color,background-color,border-color] ${
                  active
                    ? "bg-accent text-white shadow-xs"
                    : "border border-subtle bg-cushion text-ink-secondary hover:bg-surface hover:text-ink-primary"
                }`}
              >
                {translateStatus(s.key, t)}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-subtle bg-surface px-3 py-2 text-xs shadow-xs">
          <span className="font-semibold text-ink-primary">
            {t("report.stageCount", { count: totalCount })}
          </span>
          <span className="text-ink-muted">
            ({translateStatus(selectedStage, t)})
          </span>
        </div>
      </div>

      {/* Informative Process Date Filtering Note */}
      <div className="mb-4 rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs leading-relaxed text-sky-950 dark:text-sky-200 shadow-xs">
        <div className="flex items-start gap-2">
          <span className="shrink-0 text-sm">📌</span>
          <div>
            <span className="font-bold text-sky-800 dark:text-sky-300">
              {isKhmer ? "ចំណាំអំពីការទាញទិន្នន័យ (Process Date Filtering) ៖ " : "Data Filtering Note: "}
            </span>
            <span>
              {isKhmer
                ? `របាយការណ៍នេះបង្ហាញរាល់សំបុត្រដែលបានឆ្លងកាត់ ឬស្ថិតក្នុងដំណាក់កាល «${translateStatus(selectedStage, t)}» ក្នុងចន្លោះថ្ងៃ ខែ ឆ្នាំដែលបានជ្រើសរើស (Process Date) — ដោយមិនខ្វល់ថាសំបុត្រនោះបច្ចុប្បន្នស្ថិតនៅដំណាក់កាលណា ឬបានជួសជុលរួចរាល់ (Finished) ហើយនោះឡើយ (ទោះជាជួសជុលរួចហើយ ក៏ទាញមកដែរឱ្យតែបានចូល ឬមានសកម្មភាពក្នុងចន្លោះកាលបរិច្ឆេទនេះ)។`
                : `This report queries all tickets that transitioned through '${translateStatus(selectedStage, t)}' within the selected date range — regardless of where the ticket sits today (even if already completed or delivered).`}
            </span>
          </div>
        </div>
      </div>

      <TemplateReportView
        key={selectedStage}
        template="stage-report"
        title={`${t("report.stageTitle")} - ${translateStatus(selectedStage, t)}`}
        subtitle={subtitle}
        load={load}
        filters={["search", "serviceType", "location"]}
        format={format}
        fileName={`stage-${selectedStage.toLowerCase().replace(/\s+/g, "-")}`}
        initialFrom={bounds.from}
        initialTo={bounds.to}
      />
    </PageWrapper>
  );
}
