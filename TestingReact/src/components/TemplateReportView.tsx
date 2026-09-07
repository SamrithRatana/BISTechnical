"use client";

/**
 * @file TemplateReportView.tsx
 * @description Shared body for every report page: date filters, load, fill the
 * template, render the workbook, export it.
 *
 * Each page supplies only what makes it that report — which template, what to
 * fetch, how to group, how to format — so a report page is a short file of
 * decisions rather than a copy of this plumbing eight times over. When the
 * export or the loading behaviour needs to change, it changes once.
 *
 * Layout is *not* one of the decisions a page makes: that lives in the .xlsx.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Workbook } from "exceljs";
import toast from "react-hot-toast";
import { Download, Printer, Loader2 } from "lucide-react";
import ExcelViewer from "@/components/ExcelViewer";
import { ErrorState } from "@/components/av";
import ReportFilterBar, {
  EMPTY_FILTERS,
  type ReportFilterKind,
  type ReportFilterValues,
} from "@/components/ReportFilterBar";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useRealtimeTickets } from "@/hooks/useRealtimeTickets";
import { useI18n } from "@/i18n/LanguageProvider";
import { fillTemplate, downloadWorkbook, type TemplateGroup } from "@/services/excelTemplate";

/**
 * How long the date inputs must be quiet before the report reloads.
 *
 * A native `<input type="date">` raises change as each segment completes, so
 * typing a year runs through 0002 → 0020 → 0202 → 2026 — four complete, valid
 * dates, and before this, four full report requests, three of them for periods
 * the user never asked for and the first of which can scan a two-thousand-year
 * range. The search box in `ReportFilterBar` has always debounced at 400ms;
 * this is the same treatment for the other input that feeds the same query.
 *
 * The status / type / location dropdowns are deliberately NOT debounced: each
 * click is one deliberate choice, and delaying it only feels slow.
 */
const DATE_INPUT_DEBOUNCE_MS = 400;

/** What a page must produce for a given period. */
export interface ReportData {
  groups: TemplateGroup[];
  /** Optional breakdown line under the grand total. */
  summary?: string;
  /** Optional custom totals or column sums */
  columnTotals?: Record<string, number | string>;
}

interface TemplateReportViewProps {
  /** Path under /templates, e.g. "daily-report". */
  template: string;
  title: string;
  /** Builds the subtitle from the active range. */
  subtitle: (from: Date, to: Date) => string;
  /** Fetches and shapes the data for a period and filter set. */
  load: (from: Date, to: Date, filters: ReportFilterValues) => Promise<ReportData>;
  /** Which filter controls to offer. Omitted means none. */
  filters?: ReportFilterKind[];
  /** Presentation only — which field goes in which column is the template's call. */
  format?: (field: string, value: unknown) => string;
  fileName: string;
  initialFrom: Date;
  initialTo: Date;
  /** Hide the date inputs for reports that describe "now" rather than a period. */
  showDateRange?: boolean;
}

function toInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromInputValue(value: string): Date {
  // Split rather than `new Date(value)`: that form parses as UTC and lands on
  // the previous day for anyone east of Greenwich.
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function TemplateReportView({
  template,
  title,
  subtitle,
  load,
  filters,
  format,
  fileName,
  initialFrom,
  initialTo,
  showDateRange = true,
}: TemplateReportViewProps) {
  const { t } = useI18n();

  const [fromDate, setFromDate] = useState<Date>(initialFrom);
  const [toDate, setToDate] = useState<Date>(initialTo);
  const [filterValues, setFilterValues] = useState<ReportFilterValues>(EMPTY_FILTERS);
  const [workbook, setWorkbook] = useState<Workbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  /**
   * A failure, kept distinct from "the period is empty".
   *
   * Before this, a failed load set `workbook` to null and showed
   * `report.noData` — "No records in this period" — with only a toast to say
   * otherwise, and the toast is gone in seconds. So a backend outage rendered
   * as a confident statement that nothing happened that month, on a screen
   * whose entire job is answering that question. There was also no way back
   * short of reloading the browser, since the effect only re-runs when a
   * filter or date changes.
   */
  const [failed, setFailed] = useState(false);

  /**
   * Bumping this re-runs the load effect with identical inputs, which is what
   * a Retry button needs and what `useEffect`'s dependency list otherwise makes
   * impossible — every other dependency is unchanged after a failure.
   */
  const [retryToken, setRetryToken] = useState(0);

  const handleRealtimeUpdate = useCallback(() => {
    setRetryToken((prev) => prev + 1);
  }, []);

  useRealtimeTickets("All", handleRealtimeUpdate);

  /**
   * Which request the displayed workbook belongs to.
   *
   * Fetch plus `fillTemplate` is not instant, and nothing made these calls
   * mutually exclusive: two overlapping loads both resolved and both called
   * `setWorkbook`, so the report showed whichever *finished* last rather than
   * whichever was *asked for* last. Widen a range (slow) then narrow it
   * (fast) and the screen settles on the wide result while the inputs read
   * narrow — a wrong report that looks completely legitimate, which on a page
   * whose whole purpose is checking a number is worse than being slow.
   *
   * A counter rather than an AbortController because the cost being avoided is
   * the stale *render*, not the request: cancelling would mean threading a
   * signal through all eight pages' `load` functions, and a superseded
   * response is discarded here either way.
   */
  const latestRequest = useRef(0);

  const build = useCallback(
    async (from: Date, to: Date, active: ReportFilterValues) => {
      const requestId = ++latestRequest.current;
      setLoading(true);
      setFailed(false);
      try {
        const { groups, summary, columnTotals } = await load(from, to, active);
        const filled = await fillTemplate({
          templateUrl: `/templates/${template}.xlsx`,
          title,
          subtitle: subtitle(from, to),
          groups,
          labels: { subtotal: t("report.total"), grandTotal: t("report.grandTotal") },
          summary,
          format,
          columnTotals,
        });
        // Superseded while we were building: drop it silently. The newer
        // request owns the screen, including its own loading state.
        if (requestId !== latestRequest.current) return;
        setWorkbook(filled);
      } catch (err) {
        if (requestId !== latestRequest.current) return;
        setWorkbook(null);
        setFailed(true);
        // Logged with the template and the window that failed, because a toast
        // nobody sees after five seconds is the only other trace this leaves.
        // Keeping the template distinguishes one broken report from the backend
        // being down for all eight. (This used to go to Sentry; the SDK was
        // removed — see the note in `app/global-error.tsx`.)
        console.error("Report load failed", {
          area: "report",
          template,
          from: from.toISOString(),
          to: to.toISOString(),
          statuses: active.statuses,
          error: err,
        });
        toast.error(t("report.loadFailed"));
      } finally {
        // Only the newest request may clear the spinner — otherwise an early
        // straggler returning mid-flight shows the previous workbook as though
        // the load had finished.
        if (requestId === latestRequest.current) setLoading(false);
      }
    },
    [load, template, title, subtitle, format, t]
  );

  // Debounced so a half-typed year doesn't run the report three times on its
  // way to the year the user meant. Both are seeded with the real value, so the
  // first load still fires immediately on mount.
  const debouncedFrom = useDebouncedValue(fromDate, DATE_INPUT_DEBOUNCE_MS);
  const debouncedTo = useDebouncedValue(toDate, DATE_INPUT_DEBOUNCE_MS);

  useEffect(() => {
    // Nested so the effect body itself never calls setState synchronously.
    const run = () => void build(debouncedFrom, debouncedTo, filterValues);
    run();
    // `retryToken` is intentionally a dependency with no other use: it is the
    // only thing that changes when the user asks for the same report again.
  }, [build, debouncedFrom, debouncedTo, filterValues, retryToken]);

  const handleExport = async () => {
    if (!workbook) return;
    setExporting(true);
    try {
      await downloadWorkbook(workbook, fileName);
    } catch {
      toast.error(t("report.exportFailed"));
    } finally {
      setExporting(false);
    }
  };

  const applyMonth = (offset: number) => {
    const target = new Date();
    target.setMonth(target.getMonth() + offset);
    setFromDate(new Date(target.getFullYear(), target.getMonth(), 1));
    setToDate(new Date(target.getFullYear(), target.getMonth() + 1, 0));
  };

  const dateInputClass =
    "rounded-lg border border-subtle bg-surface px-2 py-1.5 text-xs text-ink ";
  const buttonClass =
    "flex items-center gap-1.5 rounded-lg border border-subtle bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:bg-cushion disabled:opacity-40 ";

  const sheet = workbook?.worksheets[0] ?? null;

  const exportAndPrintActions = (
    <>
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={loading || exporting || !workbook}
        className="flex items-center gap-1.5 rounded-lg border border-success bg-success-soft px-2.5 py-1 text-xs font-medium text-success-fg transition-colors hover:bg-success-soft disabled:opacity-40 "
      >
        {exporting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        {t("report.exportExcel")}
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        disabled={loading || !workbook}
        className="flex items-center gap-1.5 rounded-lg border border-subtle bg-surface px-2.5 py-1 text-xs font-medium text-ink-secondary transition-colors hover:bg-cushion disabled:opacity-40 "
      >
        <Printer className="h-3.5 w-3.5" />
        {t("report.print")}
      </button>
    </>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full w-full gap-2.5 overflow-hidden">
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2.5 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          {showDateRange && (
            <>
              <label className="flex items-center gap-1.5 text-xs text-ink-secondary ">
                {t("report.from")}
                <input
                  type="date"
                  value={toInputValue(fromDate)}
                  onChange={(e) => e.target.value && setFromDate(fromInputValue(e.target.value))}
                  className={dateInputClass}
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-ink-secondary ">
                {t("report.to")}
                <input
                  type="date"
                  value={toInputValue(toDate)}
                  onChange={(e) => e.target.value && setToDate(fromInputValue(e.target.value))}
                  className={dateInputClass}
                />
              </label>
              <button type="button" onClick={() => applyMonth(0)} className={buttonClass}>
                {t("report.thisMonth")}
              </button>
              <button type="button" onClick={() => applyMonth(-1)} className={buttonClass}>
                {t("report.lastMonth")}
              </button>
            </>
          )}

          {filters && filters.length > 0 && (
            <ReportFilterBar show={filters} value={filterValues} onChange={setFilterValues} />
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 w-full overflow-hidden">
        {loading && (
          <div className="flex h-full w-full items-center justify-center rounded-2xl border border-subtle/90 bg-surface p-16 text-center text-sm text-ink-muted shadow-sm ">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-accent" />
              <span>{t("report.loading")}</span>
            </div>
          </div>
        )}
        {/* Failure first — a failed load must never fall through to the
            "nothing happened this period" message below it. */}
        {!loading && failed && (
          <div className="flex h-full w-full items-center justify-center rounded-2xl border border-subtle/90 bg-surface p-8 shadow-sm">
            <ErrorState
              title={t("report.loadFailedTitle")}
              description={t("report.loadFailed")}
              retryLabel={t("state.retry")}
              onRetry={() => setRetryToken((n) => n + 1)}
            />
          </div>
        )}
        {!loading && !failed && !sheet && (
          <div className="flex h-full w-full items-center justify-center rounded-2xl border border-subtle/90 bg-surface p-16 text-center text-sm text-ink-muted shadow-sm ">
            {t("report.noData")}
          </div>
        )}
        {!loading && !failed && sheet && (
          <ExcelViewer
            sheet={sheet}
            title={title}
            extraActions={exportAndPrintActions}
            className="h-full w-full"
          />
        )}
      </div>
    </div>
  );
}
