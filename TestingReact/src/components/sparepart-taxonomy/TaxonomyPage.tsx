"use client";

import React from "react";
import { Plus, RefreshCw, Search } from "lucide-react";
import PageWrapper from "@/components/PageWrapper";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/av";
import { useI18n } from "@/i18n/LanguageProvider";
import type { TranslationKey } from "@/i18n/translations";
import type { TaxonomyListStatus } from "./useTaxonomyList";

export interface TaxonomyColumn {
  labelKey: TranslationKey;
  className?: string;
}

interface TaxonomyPageProps<T> {
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  searchPlaceholderKey: TranslationKey;
  addLabelKey: TranslationKey;
  columns: TaxonomyColumn[];
  /** Rows after the page's own search filter. */
  rows: T[];
  /** Rows before filtering, so "no match" can be told from "nothing yet". */
  totalRows: number;
  status: TaxonomyListStatus;
  search: string;
  onSearch: (value: string) => void;
  onReload: () => void;
  onAdd: () => void;
  rowKey: (row: T) => string;
  renderRow: (row: T) => React.ReactNode;
  /** Optional extra controls beside the search box (the types page's category filter). */
  toolbarExtra?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * The frame every spare-part taxonomy page shares — toolbar, table with its
 * loading / error / empty states (§12), footer count — with the columns and
 * row cells supplied by the page. Dialogs are passed as `children` so they
 * mount inside the same `PageWrapper`.
 */
export function TaxonomyPage<T>({
  titleKey,
  subtitleKey,
  searchPlaceholderKey,
  addLabelKey,
  columns,
  rows,
  totalRows,
  status,
  search,
  onSearch,
  onReload,
  onAdd,
  rowKey,
  renderRow,
  toolbarExtra,
  children,
}: TaxonomyPageProps<T>) {
  const { t } = useI18n();
  const colSpan = columns.length + 1;

  return (
    <PageWrapper titleKey={titleKey} subtitleKey={subtitleKey}>
      <div className="bg-surface rounded-2xl border border-subtle shadow-sm flex flex-col min-h-0 h-full overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-subtle flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative flex-1 min-w-0 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                type="search"
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                placeholder={t(searchPlaceholderKey)}
                aria-label={t(searchPlaceholderKey)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-subtle rounded-xl bg-surface outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              />
            </div>
            {toolbarExtra}
            <button
              type="button"
              onClick={onReload}
              title={t("header.refresh")}
              aria-label={t("header.refresh")}
              className="p-2 rounded-xl border border-subtle text-ink-secondary hover:bg-cushion hover:text-ink transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-accent rounded-xl hover:bg-accent-hover transition-colors shadow-sm shadow-accent/20 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t(addLabelKey)}</span>
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="sticky top-0 z-10 bg-cushion border-b border-subtle/80 text-[11px] font-bold text-ink-secondary uppercase tracking-wider">
                {columns.map((c) => (
                  <th key={c.labelKey} className={`py-2.5 sm:py-3 px-4 whitespace-nowrap ${c.className ?? ""}`}>
                    {t(c.labelKey)}
                  </th>
                ))}
                <th className="py-2.5 sm:py-3 px-4 text-center whitespace-nowrap">{t("field.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle text-ink">
              {status === "loading" ? (
                <SkeletonRows rows={5} columns={colSpan} />
              ) : status === "error" ? (
                <tr>
                  <td colSpan={colSpan}>
                    <ErrorState
                      title={t("spTax.loadFailed")}
                      onRetry={onReload}
                      retryLabel={t("action.retry")}
                      compact
                    />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={colSpan}>
                    <EmptyState
                      title={totalRows === 0 ? t("spTax.empty") : t("spTax.emptyFiltered")}
                      compact
                    />
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={rowKey(row)} className="hover:bg-cushion transition-colors">
                    {renderRow(row)}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-subtle bg-cushion/50 flex items-center justify-between shrink-0 text-xs text-ink-secondary">
          <span>
            {status === "ready" ? t("sp.loadedOf", { loaded: rows.length, total: totalRows }) : ""}
          </span>
        </div>
      </div>

      {children}
    </PageWrapper>
  );
}
