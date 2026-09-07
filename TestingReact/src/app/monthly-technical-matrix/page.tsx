"use client";

/**
 * @file monthly-technical-matrix/page.tsx
 * @description Monthly Technical Department Performance Report & Summary Matrix
 * (របាយការណ៍បូកសរុបការងារបច្ចេកទេសប្រចាំខែ & ព្យាករណ៍សកម្មភាពជាង)
 *
 * Implements:
 * 1. 12-Month Grid (Jan-Dec) with 5 Auto Database rows and 7 Manual User Input rows.
 * 2. Permanent persistence via LocalStorage per calendar year (past & future months preserved).
 * 3. Editable notes/forecast and signatures.
 * 4. 1-Click Excel Template Export (.xlsx) and Printable layout.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import PageWrapper from "@/components/PageWrapper";
import { useI18n } from "@/i18n/LanguageProvider";
import { useRealtimeTickets } from "@/hooks/useRealtimeTickets";
import {
  fetchAnnualTechnicalMatrix,
  type AnnualTechnicalAutoData,
} from "@/services/reports";
import {
  exportAnnualTechnicalExcel,
  type MonthlyMatrixData,
} from "@/services/annualTechnicalExcel";
import {
  Calendar,
  Download,
  Printer,
  RotateCcw,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface ManualMatrixState {
  doubleTT: number[];
  tonerIssues: number[];
  onsiteService: number[];
  dailyResolved: number[];
  inHouseResolved: number[];
  pendingUnresolved: number[];
  tonerReplace: number[];
  tonerFix: number[];
}

const DEFAULT_MANUAL_STATE: ManualMatrixState = {
  doubleTT: Array(12).fill(0),
  tonerIssues: Array(12).fill(0),
  onsiteService: Array(12).fill(0),
  dailyResolved: Array(12).fill(0),
  inHouseResolved: Array(12).fill(0),
  pendingUnresolved: Array(12).fill(0),
  tonerReplace: Array(12).fill(0),
  tonerFix: Array(12).fill(0),
};

export default function MonthlyTechnicalMatrixPage() {
  const { t } = useI18n();

  const [year, setYear] = useState<number>(() => new Date().getFullYear());
  const [loading, setLoading] = useState<boolean>(true);
  const [autoData, setAutoData] = useState<AnnualTechnicalAutoData | null>(null);
  const [manualData, setManualData] = useState<ManualMatrixState>(DEFAULT_MANUAL_STATE);

  const [summaryNotes, setSummaryNotes] = useState<string>("");
  const [preparedDate, setPreparedDate] = useState<string>("");
  const [preparedBy, setPreparedBy] = useState<string>("");
  const [headDate, setHeadDate] = useState<string>("");
  const [headOfTechnical, setHeadOfTechnical] = useState<string>("");

  const [savedBadge, setSavedBadge] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);

  const yrShort = useMemo(() => String(year).slice(-2), [year]);
  const monthLabels = useMemo(
    () => [
      `Jan-${yrShort}`,
      `Feb-${yrShort}`,
      `Mar-${yrShort}`,
      `Apr-${yrShort}`,
      `May-${yrShort}`,
      `Jun-${yrShort}`,
      `Jul-${yrShort}`,
      `Aug-${yrShort}`,
      `Sep-${yrShort}`,
      `Oct-${yrShort}`,
      `Nov-${yrShort}`,
      `Dec-${yrShort}`,
    ],
    [yrShort]
  );

  // Load manual state, cached DB matrix, and metadata from LocalStorage when year changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    queueMicrotask(() => {
      try {
        const savedMatrix = localStorage.getItem(`monthly_tech_matrix_${year}`);
        const cachedAuto = localStorage.getItem(`monthly_tech_autodb_${year}`);
        const parsedCachedAuto = cachedAuto ? JSON.parse(cachedAuto) : null;
        if (cachedAuto) {
          setAutoData(parsedCachedAuto);
        }

        if (savedMatrix) {
          const parsed = JSON.parse(savedMatrix);
          // If onsiteService was previously auto-seeded from backend DB, reset to 0 for user manual entry
          const legacyAutoPattern = [57, 46, 39, 58, 68, 80, 79, 57];
          const isLegacyAuto =
            (parsed.onsiteService && parsedCachedAuto?.onsiteService &&
              JSON.stringify(parsed.onsiteService) === JSON.stringify(parsedCachedAuto.onsiteService)) ||
            (Array.isArray(parsed.onsiteService) &&
              legacyAutoPattern.every((v, i) => parsed.onsiteService[i] === v));

          const cleanOnsite = isLegacyAuto ? Array(12).fill(0) : (parsed.onsiteService ?? Array(12).fill(0));
          const cleanMatrix = {
            ...DEFAULT_MANUAL_STATE,
            ...parsed,
            onsiteService: cleanOnsite,
          };
          setManualData(cleanMatrix);
          if (isLegacyAuto && typeof window !== "undefined") {
            localStorage.setItem(`monthly_tech_matrix_${year}`, JSON.stringify(cleanMatrix));
          }
        } else {
          setManualData(DEFAULT_MANUAL_STATE);
        }

        const savedMeta = localStorage.getItem(`monthly_tech_meta_${year}`);
        if (savedMeta) {
          const parsed = JSON.parse(savedMeta);
          setSummaryNotes(parsed.summaryNotes || "");
          setPreparedDate(parsed.preparedDate || "");
          setPreparedBy(parsed.preparedBy || "");
          setHeadDate(parsed.headDate || "");
          setHeadOfTechnical(parsed.headOfTechnical || "");
        } else {
          setSummaryNotes("");
          setPreparedDate(`01 / 05 / ${year}`);
          setPreparedBy("");
          setHeadDate(`01 / 04 / ${year}`);
          setHeadOfTechnical("");
        }
      } catch (e) {
        console.error("Failed to load local persistence", e);
      }
    });
  }, [year]);

  // Fetch automated DB data for this year and save to cache
  const loadDatabaseData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAnnualTechnicalMatrix(year);
      setAutoData(data);
      if (typeof window !== "undefined") {
        localStorage.setItem(`monthly_tech_autodb_${year}`, JSON.stringify(data));
      }
    } catch (err) {
      console.error("Failed to load annual technical metrics", err);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadDatabaseData();
    });
  }, [loadDatabaseData]);

  useRealtimeTickets("All", loadDatabaseData);

  // Helper to update manual cell value
  const handleCellChange = useCallback(
    (key: keyof ManualMatrixState, monthIndex: number, val: string) => {
      const num = parseInt(val, 10);
      const safeNum = isNaN(num) || num < 0 ? 0 : num;

      setManualData((prev) => {
        const row = [...prev[key]];
        row[monthIndex] = safeNum;
        const next = { ...prev, [key]: row };
        if (typeof window !== "undefined") {
          localStorage.setItem(`monthly_tech_matrix_${year}`, JSON.stringify(next));
        }
        return next;
      });

      setSavedBadge(true);
      setTimeout(() => setSavedBadge(false), 2000);
    },
    [year]
  );

  // Helper to update metadata fields
  const handleMetaChange = useCallback(
    (field: string, value: string) => {
      if (field === "notes") setSummaryNotes(value);
      if (field === "preparedDate") setPreparedDate(value);
      if (field === "preparedBy") setPreparedBy(value);
      if (field === "headDate") setHeadDate(value);
      if (field === "headOfTechnical") setHeadOfTechnical(value);

      if (typeof window !== "undefined") {
        const meta = {
          summaryNotes: field === "notes" ? value : summaryNotes,
          preparedDate: field === "preparedDate" ? value : preparedDate,
          preparedBy: field === "preparedBy" ? value : preparedBy,
          headDate: field === "headDate" ? value : headDate,
          headOfTechnical: field === "headOfTechnical" ? value : headOfTechnical,
        };
        localStorage.setItem(`monthly_tech_meta_${year}`, JSON.stringify(meta));
      }
      setSavedBadge(true);
      setTimeout(() => setSavedBadge(false), 2000);
    },
    [year, summaryNotes, preparedDate, preparedBy, headDate, headOfTechnical]
  );

  // Export to Excel
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const payload: MonthlyMatrixData = {
        year,
        machineIn: autoData?.machineIn || Array(12).fill(0),
        machineOut: autoData?.machineOut || Array(12).fill(0),
        unrepairable: autoData?.unrepairable || Array(12).fill(0),
        awaitingConfirm: autoData?.awaitingConfirm || Array(12).fill(0),
        doubleTT: manualData.doubleTT,
        tonerIssues: manualData.tonerIssues,
        onsiteService: manualData.onsiteService,
        dailyResolved: manualData.dailyResolved,
        inHouseResolved: manualData.inHouseResolved,
        pendingUnresolved: manualData.pendingUnresolved,
        tonerReplace: manualData.tonerReplace,
        tonerFix: manualData.tonerFix,
        summaryNotes,
        preparedDate,
        preparedBy,
        headDate,
        headOfTechnical,
      };

      await exportAnnualTechnicalExcel(payload);
    } catch (e) {
      console.error("Export failed", e);
    } finally {
      setExporting(false);
    }
  };

  // Reset Year manual data
  const handleReset = () => {
    if (!window.confirm(t("matrix.confirmClear", { year: String(year) }))) return;
    setManualData(DEFAULT_MANUAL_STATE);
    setSummaryNotes("");
    if (typeof window !== "undefined") {
      localStorage.removeItem(`monthly_tech_matrix_${year}`);
      localStorage.removeItem(`monthly_tech_meta_${year}`);
    }
  };

  return (
    <PageWrapper
      titleKey="nav.monthlyReport"
      subtitleKey="report.monthlyTitle"
    >
      <div className="flex-1 min-h-0 overflow-y-auto space-y-6 print:space-y-4 print:overflow-visible print:h-auto pr-1">
        {/* ── Top Bar Controls ──────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 print:hidden flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setYear((y) => y - 1)}
                className="p-1.5 hover:bg-white dark:hover:bg-gray-600 rounded-md transition-colors text-gray-700 dark:text-gray-200"
                title={t("matrix.prevYear")}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5 px-3 py-1 font-semibold text-gray-900 dark:text-white">
                <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>{year}</span>
              </div>
              <button
                type="button"
                onClick={() => setYear((y) => y + 1)}
                className="p-1.5 hover:bg-white dark:hover:bg-gray-600 rounded-md transition-colors text-gray-700 dark:text-gray-200"
                title={t("matrix.nextYear")}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={loadDatabaseData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? t("matrix.refreshing") : t("matrix.refreshDb")}</span>
            </button>

            {savedBadge && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 animate-fade-in font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t("matrix.autoSaved")}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
              title={t("matrix.resetManual")}
            >
              {t("matrix.clearManual")}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              {t("matrix.printPdf")}
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              {exporting ? t("matrix.generating") : t("matrix.exportExcel")}
            </button>
          </div>
        </div>

        {/* ── Official Matrix Container ────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden p-6 print:p-0 print:border-none print:shadow-none">
          {/* Header Title Bar matching template */}
          <div className="grid grid-cols-12 border border-gray-400 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 font-bold text-sm text-gray-900 dark:text-white">
            <div className="col-span-4 p-2.5 border-r border-gray-400 dark:border-gray-600 flex items-center">
              <span>Monthly technical report</span>
            </div>
            <div className="col-span-8 p-2.5 flex items-center justify-center">
              <span>Technical dept/team</span>
            </div>
          </div>

          {/* Table 1: Technical for month */}
          <div className="overflow-x-auto mt-0 border-x border-b border-gray-400 dark:border-gray-600">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-bold border-b border-gray-400 dark:border-gray-600">
                  <th className="p-2 border-r border-gray-400 dark:border-gray-600 w-64 min-w-[220px]">
                    technical for month
                  </th>
                  {monthLabels.map((m) => (
                    <th
                      key={m}
                      className="p-2 border-r border-gray-400 dark:border-gray-600 text-center min-w-[55px]"
                    >
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300 dark:divide-gray-700 text-gray-900 dark:text-gray-100">
                {/* 1. ម៉ាស៊ីនចូល (Auto) */}
                <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                  <td className="p-2 font-medium border-r border-gray-300 dark:border-gray-700 flex items-center justify-between">
                    <span>ម៉ាស៊ីនចូល</span>
                    <span className="text-[10px] px-1 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded font-semibold print:hidden">
                      Auto
                    </span>
                  </td>
                  {Array.from({ length: 12 }).map((_, idx) => (
                    <td
                      key={idx}
                      className="p-1.5 border-r border-gray-300 dark:border-gray-700 text-center font-semibold text-gray-800 dark:text-gray-200"
                    >
                      {autoData?.machineIn[idx] ?? 0}
                    </td>
                  ))}
                </tr>

                {/* 2. ម៉ាស៊ីនចេញ (Auto) */}
                <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                  <td className="p-2 font-medium border-r border-gray-300 dark:border-gray-700 flex items-center justify-between">
                    <span>ម៉ាស៊ីនចេញ</span>
                    <span className="text-[10px] px-1 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded font-semibold print:hidden">
                      Auto
                    </span>
                  </td>
                  {Array.from({ length: 12 }).map((_, idx) => (
                    <td
                      key={idx}
                      className="p-1.5 border-r border-gray-300 dark:border-gray-700 text-center font-semibold text-gray-800 dark:text-gray-200"
                    >
                      {autoData?.machineOut[idx] ?? 0}
                    </td>
                  ))}
                </tr>

                {/* 3. ម៉ាស៊ីនជួសជុលមិនបាន (Auto) */}
                <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                  <td className="p-2 font-medium border-r border-gray-300 dark:border-gray-700 flex items-center justify-between">
                    <span>ម៉ាស៊ីនជួសជុលមិនបាន</span>
                    <span className="text-[10px] px-1 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded font-semibold print:hidden">
                      Auto
                    </span>
                  </td>
                  {Array.from({ length: 12 }).map((_, idx) => (
                    <td
                      key={idx}
                      className="p-1.5 border-r border-gray-300 dark:border-gray-700 text-center font-semibold text-gray-800 dark:text-gray-200"
                    >
                      {autoData?.unrepairable[idx] ?? 0}
                    </td>
                  ))}
                </tr>

                {/* 4. ម៉ាស៊ីនរង់ចាំការយល់ព្រមជួសជុល (Auto) */}
                <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                  <td className="p-2 font-medium border-r border-gray-300 dark:border-gray-700 flex items-center justify-between">
                    <span>ម៉ាស៊ីនរង់ចាំការយល់ព្រមជួសជុល</span>
                    <span className="text-[10px] px-1 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded font-semibold print:hidden">
                      Auto
                    </span>
                  </td>
                  {Array.from({ length: 12 }).map((_, idx) => (
                    <td
                      key={idx}
                      className="p-1.5 border-r border-gray-300 dark:border-gray-700 text-center font-semibold text-gray-800 dark:text-gray-200"
                    >
                      {autoData?.awaitingConfirm[idx] ?? 0}
                    </td>
                  ))}
                </tr>

                {/* 5. ម៉ាស៊ីនជួសជុល Double TT (Manual) */}
                <tr className="hover:bg-amber-50/30 dark:hover:bg-amber-950/20">
                  <td className="p-2 font-medium border-r border-gray-300 dark:border-gray-700 flex items-center justify-between">
                    <span>ម៉ាស៊ីនជួសជុល Double TT</span>
                    <span className="text-[10px] px-1 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded font-medium print:hidden">
                      Manual
                    </span>
                  </td>
                  {Array.from({ length: 12 }).map((_, idx) => (
                    <td key={idx} className="p-0.5 border-r border-gray-300 dark:border-gray-700">
                      <input
                        type="number"
                        min="0"
                        value={manualData.doubleTT[idx] || ""}
                        onChange={(e) => handleCellChange("doubleTT", idx, e.target.value)}
                        placeholder="0"
                        className="w-full min-h-6 text-center py-1 bg-transparent hover:bg-amber-50/50 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500 rounded font-semibold text-gray-900 dark:text-gray-100"
                      />
                    </td>
                  ))}
                </tr>

                {/* 6. បញ្ហាទឹកថ្នាំ (Manual) */}
                <tr className="hover:bg-amber-50/30 dark:hover:bg-amber-950/20">
                  <td className="p-2 font-medium border-r border-gray-300 dark:border-gray-700 flex items-center justify-between">
                    <span>បញ្ហាទឹកថ្នាំ</span>
                    <span className="text-[10px] px-1 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded font-medium print:hidden">
                      Manual
                    </span>
                  </td>
                  {Array.from({ length: 12 }).map((_, idx) => (
                    <td key={idx} className="p-0.5 border-r border-gray-300 dark:border-gray-700">
                      <input
                        type="number"
                        min="0"
                        value={manualData.tonerIssues[idx] || ""}
                        onChange={(e) => handleCellChange("tonerIssues", idx, e.target.value)}
                        placeholder="0"
                        className="w-full min-h-6 text-center py-1 bg-transparent hover:bg-amber-50/50 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500 rounded font-semibold text-gray-900 dark:text-gray-100"
                      />
                    </td>
                  ))}
                </tr>

                {/* 7. ឆែក&ជួសជុលម៉ាស៊ីនខាងក្រៅ (Manual) */}
                <tr className="hover:bg-amber-50/30 dark:hover:bg-amber-950/20">
                  <td className="p-2 font-medium border-r border-gray-300 dark:border-gray-700 flex items-center justify-between">
                    <span>ឆែក&ជួសជុលម៉ាស៊ីនខាងក្រៅ</span>
                    <span className="text-[10px] px-1 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded font-medium print:hidden">
                      Manual
                    </span>
                  </td>
                  {Array.from({ length: 12 }).map((_, idx) => (
                    <td key={idx} className="p-0.5 border-r border-gray-300 dark:border-gray-700">
                      <input
                        type="number"
                        min="0"
                        value={manualData.onsiteService[idx] || ""}
                        onChange={(e) => handleCellChange("onsiteService", idx, e.target.value)}
                        placeholder="0"
                        className="w-full min-h-6 text-center py-1 bg-transparent hover:bg-amber-50/50 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500 rounded font-semibold text-gray-900 dark:text-gray-100"
                      />
                    </td>
                  ))}
                </tr>

                {/* 8. ដោះស្រាយបញ្ហាប្រចាំថ្ងៃ (Manual) */}
                <tr className="hover:bg-amber-50/30 dark:hover:bg-amber-950/20">
                  <td className="p-2 font-medium border-r border-gray-300 dark:border-gray-700 flex items-center justify-between">
                    <span>ដោះស្រាយបញ្ហាប្រចាំថ្ងៃ</span>
                    <span className="text-[10px] px-1 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded font-medium print:hidden">
                      Manual
                    </span>
                  </td>
                  {Array.from({ length: 12 }).map((_, idx) => (
                    <td key={idx} className="p-0.5 border-r border-gray-300 dark:border-gray-700">
                      <input
                        type="number"
                        min="0"
                        value={manualData.dailyResolved[idx] || ""}
                        onChange={(e) => handleCellChange("dailyResolved", idx, e.target.value)}
                        placeholder="0"
                        className="w-full min-h-6 text-center py-1 bg-transparent hover:bg-amber-50/50 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500 rounded font-semibold text-gray-900 dark:text-gray-100"
                      />
                    </td>
                  ))}
                </tr>

                {/* 9. ដោះស្រាយផ្ទាល់ (Manual) */}
                <tr className="hover:bg-amber-50/30 dark:hover:bg-amber-950/20">
                  <td className="p-2 font-medium border-r border-gray-300 dark:border-gray-700 flex items-center justify-between">
                    <span>ដោះស្រាយផ្ទាល់</span>
                    <span className="text-[10px] px-1 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded font-medium print:hidden">
                      Manual
                    </span>
                  </td>
                  {Array.from({ length: 12 }).map((_, idx) => (
                    <td key={idx} className="p-0.5 border-r border-gray-300 dark:border-gray-700">
                      <input
                        type="number"
                        min="0"
                        value={manualData.inHouseResolved[idx] || ""}
                        onChange={(e) => handleCellChange("inHouseResolved", idx, e.target.value)}
                        placeholder="0"
                        className="w-full min-h-6 text-center py-1 bg-transparent hover:bg-amber-50/50 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500 rounded font-semibold text-gray-900 dark:text-gray-100"
                      />
                    </td>
                  ))}
                </tr>

                {/* 10. បញ្ហាដោះស្រាយមិនទាន់ចប់ក្នុងថ្ងៃ (Manual) */}
                <tr className="hover:bg-amber-50/30 dark:hover:bg-amber-950/20">
                  <td className="p-2 font-medium border-r border-gray-300 dark:border-gray-700 flex items-center justify-between">
                    <span>បញ្ហាដោះស្រាយមិនទាន់ចប់ក្នុងថ្ងៃ</span>
                    <span className="text-[10px] px-1 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded font-medium print:hidden">
                      Manual
                    </span>
                  </td>
                  {Array.from({ length: 12 }).map((_, idx) => (
                    <td key={idx} className="p-0.5 border-r border-gray-300 dark:border-gray-700">
                      <input
                        type="number"
                        min="0"
                        value={manualData.pendingUnresolved[idx] || ""}
                        onChange={(e) => handleCellChange("pendingUnresolved", idx, e.target.value)}
                        placeholder="0"
                        className="w-full min-h-6 text-center py-1 bg-transparent hover:bg-amber-50/50 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500 rounded font-semibold text-gray-900 dark:text-gray-100"
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Table 2: Toner error & Chip */}
          <div className="overflow-x-auto border-x border-b border-gray-400 dark:border-gray-600">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-bold border-b border-gray-400 dark:border-gray-600">
                  <th className="p-2 border-r border-gray-400 dark:border-gray-600 w-64 min-w-[220px] text-right">
                    Toner error & Chip
                  </th>
                  {monthLabels.map((m) => (
                    <th
                      key={m}
                      className="p-2 border-r border-gray-400 dark:border-gray-600 text-center min-w-[55px]"
                    >
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300 dark:divide-gray-700 text-gray-900 dark:text-gray-100">
                {/* 11. Replace (Manual) */}
                <tr className="hover:bg-amber-50/30 dark:hover:bg-amber-950/20">
                  <td className="p-2 font-medium border-r border-gray-300 dark:border-gray-700 text-right pr-4">
                    Replace
                  </td>
                  {Array.from({ length: 12 }).map((_, idx) => (
                    <td key={idx} className="p-0.5 border-r border-gray-300 dark:border-gray-700">
                      <input
                        type="number"
                        min="0"
                        value={manualData.tonerReplace[idx] || ""}
                        onChange={(e) => handleCellChange("tonerReplace", idx, e.target.value)}
                        placeholder="0"
                        className="w-full min-h-6 text-center py-1 bg-transparent hover:bg-amber-50/50 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500 rounded font-semibold text-gray-900 dark:text-gray-100"
                      />
                    </td>
                  ))}
                </tr>

                {/* 12. Fix (Manual) */}
                <tr className="hover:bg-amber-50/30 dark:hover:bg-amber-950/20">
                  <td className="p-2 font-medium border-r border-gray-300 dark:border-gray-700 text-right pr-4">
                    Fix
                  </td>
                  {Array.from({ length: 12 }).map((_, idx) => (
                    <td key={idx} className="p-0.5 border-r border-gray-300 dark:border-gray-700">
                      <input
                        type="number"
                        min="0"
                        value={manualData.tonerFix[idx] || ""}
                        onChange={(e) => handleCellChange("tonerFix", idx, e.target.value)}
                        placeholder="0"
                        className="w-full min-h-6 text-center py-1 bg-transparent hover:bg-amber-50/50 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500 rounded font-semibold text-gray-900 dark:text-gray-100"
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Label: summary/forecast of technical performance and activities */}
          <div className="text-right text-[11px] italic text-gray-500 dark:text-gray-400 mt-3 mb-1">
            summary/forecast of technical performance and activities
          </div>

          {/* Bottom Notes & Signatures Box matching template */}
          <div className="border border-gray-400 dark:border-gray-600 rounded p-4 bg-gray-50/40 dark:bg-gray-800/40 space-y-6">
            {/* Editable Notes / Summary textarea */}
            <div>
              <textarea
                value={summaryNotes}
                onChange={(e) => handleMetaChange("notes", e.target.value)}
                placeholder={t("matrix.notesPlaceholder")}
                rows={4}
                className="w-full p-2.5 text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
              />
            </div>

            {/* Signature Blocks */}
            <div className="grid grid-cols-2 gap-8 pt-2">
              {/* Left: Prepared By */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-800 dark:text-gray-200">
                  <span>{t("matrix.date")}</span>
                  <input
                    type="text"
                    value={preparedDate}
                    onChange={(e) => handleMetaChange("preparedDate", e.target.value)}
                    placeholder="01 / 05 / 2026"
                    className="min-h-6 px-2 py-0.5 text-xs bg-transparent border-b border-gray-400 dark:border-gray-600 focus:border-blue-500 focus:outline-none w-36"
                  />
                </div>
                <div className="text-xs font-bold text-gray-900 dark:text-gray-100">
                  Prepared by:
                </div>
                <div className="pt-8">
                  <input
                    type="text"
                    value={preparedBy}
                    onChange={(e) => handleMetaChange("preparedBy", e.target.value)}
                    placeholder={t("matrix.preparedByPlaceholder")}
                    className="px-2 py-1 text-xs bg-transparent border-b border-gray-400 dark:border-gray-600 focus:border-blue-500 focus:outline-none w-48 font-medium"
                  />
                </div>
              </div>

              {/* Right: Head of Technical */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-800 dark:text-gray-200">
                  <span>{t("matrix.date")}</span>
                  <input
                    type="text"
                    value={headDate}
                    onChange={(e) => handleMetaChange("headDate", e.target.value)}
                    placeholder="01 / 04 / 2026"
                    className="min-h-6 px-2 py-0.5 text-xs bg-transparent border-b border-gray-400 dark:border-gray-600 focus:border-blue-500 focus:outline-none w-36"
                  />
                </div>
                <div className="text-xs font-bold text-gray-900 dark:text-gray-100">
                  Head of Technical
                </div>
                <div className="pt-8">
                  <input
                    type="text"
                    value={headOfTechnical}
                    onChange={(e) => handleMetaChange("headOfTechnical", e.target.value)}
                    placeholder={t("matrix.headOfTechPlaceholder")}
                    className="px-2 py-1 text-xs bg-transparent border-b border-gray-400 dark:border-gray-600 focus:border-blue-500 focus:outline-none w-48 font-medium"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
