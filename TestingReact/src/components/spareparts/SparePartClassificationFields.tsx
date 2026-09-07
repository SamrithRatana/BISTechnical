"use client";

import React, { useId, useMemo } from "react";
import ModernSelect, { type ModernSelectOption } from "@/components/ModernSelect";
import { useI18n } from "@/i18n/LanguageProvider";
import type { SparePartClassification } from "@/services/types";

const NONE = "";

interface SparePartClassificationFieldsProps {
  value: SparePartClassification;
  onChange: (next: SparePartClassification) => void;
  categoryOptions: ModernSelectOption[];
  brandOptions: ModernSelectOption[];
  typeOptionsFor: (categoryId: string | null | undefined) => ModernSelectOption[];
}

/**
 * The Category / Type / Brand selects on the spare-part add/edit form. All
 * optional: "None" is a real choice and clears the field (the API takes
 * `null`). A type is only offered inside the chosen category — the select is
 * disabled (a real `disabled`) until one is picked — and changing the
 * category clears the type so the API never sees a type outside its category
 * (which it refuses with a 400).
 */
export function SparePartClassificationFields({
  value,
  onChange,
  categoryOptions,
  brandOptions,
  typeOptionsFor,
}: SparePartClassificationFieldsProps) {
  const { t } = useI18n();
  const categoryId = value.categoryId || NONE;

  const none = useMemo<ModernSelectOption>(() => ({ value: NONE, label: t("sp.noSelection") }), [t]);
  const categoryChoices = useMemo(() => [none, ...categoryOptions], [none, categoryOptions]);
  const typeChoices = useMemo(() => [none, ...typeOptionsFor(categoryId)], [none, typeOptionsFor, categoryId]);
  const brandChoices = useMemo(() => [none, ...brandOptions], [none, brandOptions]);

  const labelClass = "text-xs font-semibold text-ink";
  // Real <label htmlFor> bindings: the selects are buttons, which are
  // labelable, so a screen reader announces "Category" on focus.
  const baseId = useId();
  const categoryFieldId = `${baseId}-category`;
  const typeFieldId = `${baseId}-type`;
  const brandFieldId = `${baseId}-brand`;

  return (
    <div className="space-y-3 pt-1">
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{t("sp.classification")}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor={categoryFieldId} className={labelClass}>
            {t("sp.category")}
          </label>
          <ModernSelect
            id={categoryFieldId}
            value={categoryId}
            options={categoryChoices}
            onChange={(v) => onChange({ ...value, categoryId: v || null, typeId: null })}
            placeholder={t("sp.selectCategory")}
          />
        </div>
        <div className="space-y-1" title={!categoryId ? t("sp.filterTypeNeedsCategory") : undefined}>
          <label htmlFor={typeFieldId} className={labelClass}>
            {t("sp.type")}
          </label>
          <ModernSelect
            id={typeFieldId}
            value={value.typeId || NONE}
            options={typeChoices}
            onChange={(v) => onChange({ ...value, typeId: v || null })}
            placeholder={categoryId ? t("sp.selectType") : t("sp.filterTypeNeedsCategory")}
            disabled={!categoryId}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor={brandFieldId} className={labelClass}>
            {t("sp.brand")}
          </label>
          <ModernSelect
            id={brandFieldId}
            value={value.brandId || NONE}
            options={brandChoices}
            onChange={(v) => onChange({ ...value, brandId: v || null })}
            placeholder={t("sp.selectBrand")}
          />
        </div>
      </div>
    </div>
  );
}
