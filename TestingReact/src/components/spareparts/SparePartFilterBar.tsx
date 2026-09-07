"use client";

import React, { useMemo } from "react";
import { RefreshCw, X } from "lucide-react";
import ModernSelect, { type ModernSelectOption } from "@/components/ModernSelect";
import { useI18n } from "@/i18n/LanguageProvider";
import type { SparePartFilters } from "@/services/api";

const ALL = "";

interface SparePartFilterBarProps {
  value: SparePartFilters;
  onChange: (next: SparePartFilters) => void;
  categoryOptions: ModernSelectOption[];
  brandOptions: ModernSelectOption[];
  typeOptionsFor: (categoryId: string | null | undefined) => ModernSelectOption[];
  /** The lookups are still loading — the selects are disabled and say so. */
  loading?: boolean;
  /** The lookups could not be loaded — a hint and a Retry are shown (§12). */
  error?: boolean;
  onRetry?: () => void;
}

/**
 * Category → Type → Brand filters for the catalogue list. Type depends on
 * Category: with no category chosen the type select is disabled (a real
 * `disabled` — not tabbable, announced as such) and its placeholder says
 * why; changing the category drops a type that is not inside it. Brand is
 * independent. Empty string is "all" — the API treats an absent parameter
 * as no filter.
 */
export function SparePartFilterBar({
  value,
  onChange,
  categoryOptions,
  brandOptions,
  typeOptionsFor,
  loading = false,
  error = false,
  onRetry,
}: SparePartFilterBarProps) {
  const { t } = useI18n();
  const categoryId = value.categoryId || ALL;
  const typeId = value.typeId || ALL;
  const brandId = value.brandId || ALL;

  const categoryChoices = useMemo<ModernSelectOption[]>(
    () => [{ value: ALL, label: t("sp.filterCategory") }, ...categoryOptions],
    [categoryOptions, t]
  );
  const typeChoices = useMemo<ModernSelectOption[]>(
    () => [{ value: ALL, label: t("sp.filterType") }, ...typeOptionsFor(categoryId)],
    [typeOptionsFor, categoryId, t]
  );
  const brandChoices = useMemo<ModernSelectOption[]>(
    () => [{ value: ALL, label: t("sp.filterBrand") }, ...brandOptions],
    [brandOptions, t]
  );

  const active = Boolean(categoryId || typeId || brandId);
  const loadingLabel = loading ? t("common.loading") : undefined;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap" role="group" aria-label={t("sp.classification")}>
      <div className="w-32 sm:w-36 lg:w-40">
        <ModernSelect
          value={categoryId}
          options={categoryChoices}
          // A new category invalidates the type; the brand is unrelated.
          onChange={(v) => onChange({ ...value, categoryId: v || null, typeId: null })}
          placeholder={loadingLabel ?? t("sp.filterCategory")}
          disabled={loading}
          dense
        />
      </div>
      <div className="w-32 sm:w-36 lg:w-40" title={!categoryId ? t("sp.filterTypeNeedsCategory") : undefined}>
        <ModernSelect
          value={typeId}
          options={typeChoices}
          onChange={(v) => onChange({ ...value, typeId: v || null })}
          placeholder={loadingLabel ?? (categoryId ? t("sp.filterType") : t("sp.filterTypeNeedsCategory"))}
          disabled={loading || !categoryId}
          dense
        />
      </div>
      <div className="w-28 sm:w-32 lg:w-36">
        <ModernSelect
          value={brandId}
          options={brandChoices}
          onChange={(v) => onChange({ ...value, brandId: v || null })}
          placeholder={loadingLabel ?? t("sp.filterBrand")}
          disabled={loading}
          dense
        />
      </div>
      {active && (
        <button
          type="button"
          onClick={() => onChange({})}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-ink-secondary border border-subtle bg-surface hover:bg-cushion hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
        >
          <X className="w-3 h-3" />
          {t("sp.clearFilters")}
        </button>
      )}
      {error && (
        <span className="inline-flex items-center gap-2 text-[11px] text-danger" role="status">
          {t("spTax.loadFailed")}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-subtle bg-surface text-ink-secondary hover:bg-cushion hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
            >
              <RefreshCw className="w-3 h-3" />
              {t("action.retry")}
            </button>
          )}
        </span>
      )}
    </div>
  );
}
