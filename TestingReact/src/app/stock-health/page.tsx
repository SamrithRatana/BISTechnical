"use client";

/**
 * @file stock-health/page.tsx
 * @description Stock Data Health — the standing faults in the stock data,
 * ranked by how much they can mislead someone.
 *
 * ── Why this page exists ───────────────────────────────────────────────────
 *
 * Every fault it looks for was found by hand on 2026-08-19, and every one had
 * been sitting undetected. The trigger for looking was a user asking why
 * Telegram said 13 stock-outs and the usage report said 9. Nothing in the
 * system was checking, so the first symptom was a contradiction someone
 * happened to notice.
 *
 * What it found once the checks were written down:
 *   - 8 Telegram notifications for movements the ledger never recorded
 *   - 10 returns with no matching issue (these render as negative usage)
 *   - 1 part whose ledger implies a negative opening balance
 *   - 91 groups of identically-named catalogue entries, 11 of them with more
 *     than one entry holding stock — including "Formatter Board" (26 entries,
 *     6 in stock) and "Fuser Film Sleeve" (28 entries, 7 in stock)
 *
 * That last one is the root cause of the original complaint: a technician
 * picking "Fuser Film Sleeve" from a list of 28 identical names chose the
 * wrong row, and Telegram — which cannot retract a message — kept both.
 *
 * ── It reports; it does not repair ─────────────────────────────────────────
 *
 * Each category needs a different human decision: merging duplicate parts,
 * correcting a balance, or chasing a trigger. An automatic fix that guessed
 * wrong would corrupt the audit trail these checks exist to protect.
 *
 * Columns live in public/templates/stock-health.xlsx.
 */

import { useCallback, useMemo } from "react";
import PageWrapper from "@/components/PageWrapper";
import TemplateReportView, { type ReportData } from "@/components/TemplateReportView";
import { useI18n } from "@/i18n/LanguageProvider";
import { fetchStockHealth, type StockHealthIssue } from "@/services/reports";
import { flat, formatDayTime } from "@/services/reportShaping";

export default function StockHealthPage() {
  const { t } = useI18n();
  const today = useMemo(() => new Date(), []);

  const categoryLabel = useCallback(
    (c: StockHealthIssue["category"]) =>
      c === "OrphanNotification"
        ? t("health.orphanNotification")
        : c === "LedgerMismatch"
          ? t("health.ledgerMismatch")
          : c === "DuplicateName"
            ? t("health.duplicateName")
            : c === "NegativeStock"
              ? t("health.negativeStock")
              : t("health.orphanRestore"),
    [t]
  );

  const load = useCallback(async (): Promise<ReportData> => {
    const rows = await fetchStockHealth();

    const shaped = rows.map((r) => ({
      ...r,
      severityLabel:
        r.severity === "high"
          ? t("health.high")
          : r.severity === "medium"
            ? t("health.medium")
            : t("health.low"),
      categoryLabel: categoryLabel(r.category),
      whenLabel: r.occurredAt ? formatDayTime(r.occurredAt) : "—",
      reportNo: r.reportNo || "—",
    }));

    const high = rows.filter((r) => r.severity === "high").length;
    const lost = rows.filter((r) => r.category === "OrphanNotification").length;

    return {
      groups: flat(shaped as unknown as Record<string, unknown>[]),
      // Lead with the count that matters most: a notification with no ledger
      // row is the only category that means a movement may be unrecorded.
      summary: [
        `${t("health.totalIssues")}: ${rows.length}`,
        `${t("health.high")}: ${high}`,
        `${t("health.unrecordedMovements")}: ${lost}`,
      ].join("     "),
    };
  }, [t, categoryLabel]);

  const subtitle = useCallback(() => t("health.subtitleRange"), [t]);

  return (
    <PageWrapper titleKey="nav.stockHealth" subtitleKey="health.subtitle">
      <TemplateReportView
        template="stock-health"
        title={t("health.title")}
        subtitle={subtitle}
        load={load}
        fileName="stock-health"
        initialFrom={today}
        initialTo={today}
        showDateRange={false}
      />
    </PageWrapper>
  );
}
