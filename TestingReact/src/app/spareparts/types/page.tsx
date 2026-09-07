"use client";

/**
 * @file spareparts/types/page.tsx
 * @description Spare-part Type maintenance — the second level of the
 * hierarchy ("ADF", "PrintHead", "Cable"), each inside one Category.
 * A type in use cannot be moved to another category; the API refuses with
 * 409 and the toast says how many parts hold it.
 */

import { useCallback, useMemo, useState } from "react";
import { Edit3, Tags, Trash2 } from "lucide-react";
import HighlightText from "@/components/HighlightText";
import ModernSelect, { type ModernSelectOption } from "@/components/ModernSelect";
import { Badge, ConfirmDialog } from "@/components/av";
import { useI18n } from "@/i18n/LanguageProvider";
import { TAXONOMY_DESCRIPTION_MAX_LENGTH, TAXONOMY_NAME_MAX_LENGTH, validateTaxonomyType } from "@/validation";
import {
  createSparePartType,
  deleteSparePartType,
  fetchSparePartCategories,
  fetchSparePartTypes,
  updateSparePartType,
} from "@/services/sparepartTaxonomyApi";
import type { SparePartType } from "@/services/types";
import { TaxonomyPage, type TaxonomyColumn } from "@/components/sparepart-taxonomy/TaxonomyPage";
import { TAXONOMY_INPUT_CLASS, TaxonomyField, TaxonomyFormModal } from "@/components/sparepart-taxonomy/TaxonomyFormModal";
import { useTaxonomyList } from "@/components/sparepart-taxonomy/useTaxonomyList";
import { useTaxonomyCrud } from "@/components/sparepart-taxonomy/useTaxonomyCrud";

interface TypeForm {
  categoryId: string;
  name: string;
  description: string;
  sortOrder: number;
}

const ALL = "";
const EMPTY_FORM: TypeForm = { categoryId: "", name: "", description: "", sortOrder: 0 };

const COLUMNS: TaxonomyColumn[] = [
  { labelKey: "spTax.name" },
  { labelKey: "spTax.parentCategory" },
  { labelKey: "spTax.description" },
  { labelKey: "spTax.partCount", className: "text-center" },
];

function toForm(row: SparePartType): TypeForm {
  return { categoryId: row.categoryId, name: row.name, description: row.description ?? "", sortOrder: row.sortOrder };
}

export default function SparePartTypesPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(ALL);

  const loadTypes = useCallback(() => fetchSparePartTypes(), []);
  const loadCategories = useCallback(() => fetchSparePartCategories(), []);
  const { items, status, reload } = useTaxonomyList(loadTypes);
  const categories = useTaxonomyList(loadCategories);

  const categoryOptions = useMemo<ModernSelectOption[]>(
    () => categories.items.map((c) => ({ value: c.id, label: c.name })),
    [categories.items]
  );
  const filterOptions = useMemo<ModernSelectOption[]>(
    () => [{ value: ALL, label: t("sp.filterCategory") }, ...categoryOptions],
    [categoryOptions, t]
  );

  const crudOptions = useMemo(
    () => ({
      emptyForm: EMPTY_FORM,
      toForm,
      validate: (f: TypeForm) => validateTaxonomyType(f),
      create: (f: TypeForm) => createSparePartType(f),
      update: (id: string, f: TypeForm) => updateSparePartType(id, f),
      remove: deleteSparePartType,
      onChanged: reload,
    }),
    [reload]
  );
  const crud = useTaxonomyCrud<SparePartType, TypeForm>(crudOptions);

  // A filter pointing at a category deleted meanwhile (realtime reload)
  // falls back to "all" — derived here rather than reset in an effect.
  const effectiveFilter =
    categoryFilter !== ALL && !categoryOptions.some((o) => o.value === categoryFilter) ? ALL : categoryFilter;

  const term = search.trim().toLowerCase();
  const rows = useMemo(
    () =>
      items.filter(
        (r) =>
          (effectiveFilter === ALL || r.categoryId === effectiveFilter) &&
          (!term ||
            r.name.toLowerCase().includes(term) ||
            r.categoryName.toLowerCase().includes(term) ||
            (r.description ?? "").toLowerCase().includes(term))
      ),
    [items, term, effectiveFilter]
  );

  return (
    <TaxonomyPage
      titleKey="spTax.typesTitle"
      subtitleKey="spTax.typesSubtitle"
      searchPlaceholderKey="spTax.searchTypes"
      addLabelKey="spTax.addType"
      columns={COLUMNS}
      rows={rows}
      totalRows={items.length}
      status={status}
      search={search}
      onSearch={setSearch}
      onReload={reload}
      onAdd={crud.openAdd}
      rowKey={(r) => r.id}
      toolbarExtra={
        <div className="w-48 shrink-0">
          <ModernSelect value={effectiveFilter} options={filterOptions} onChange={setCategoryFilter} dense />
        </div>
      }
      renderRow={(r) => (
        <>
          <td className="py-2.5 sm:py-3 px-4 font-bold text-ink">
            <HighlightText text={r.name} query={search} />
          </td>
          <td className="py-2.5 sm:py-3 px-4 text-ink-secondary">
            <HighlightText text={r.categoryName} query={search} />
          </td>
          <td className="py-2.5 sm:py-3 px-4 text-ink-secondary">
            <HighlightText text={r.description || "—"} query={search} />
          </td>
          <td className="py-2.5 sm:py-3 px-4 text-center">
            <Badge tone={r.partCount > 0 ? "accent" : "neutral"}>{r.partCount}</Badge>
          </td>
          <td className="py-2.5 sm:py-3 px-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <button
                type="button"
                onClick={() => crud.openEdit(r)}
                className="p-1.5 text-ink-secondary hover:text-accent hover:bg-accent-soft rounded-lg transition-colors"
                title={t("spTax.editType")} aria-label={t("spTax.editType")}
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => crud.requestDelete(r)}
                className="p-1.5 text-ink-secondary hover:text-danger hover:bg-danger-soft rounded-lg transition-colors"
                title={t("spTax.deleteType")} aria-label={t("spTax.deleteType")}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </td>
        </>
      )}
    >
      <TaxonomyFormModal
        open={crud.formOpen}
        title={crud.editing ? t("spTax.editType") : t("spTax.addType")}
        subtitle={crud.editing?.name}
        icon={Tags}
        busy={crud.busy}
        onClose={crud.closeForm}
        onSubmit={crud.submit}
      >
        <TaxonomyField
          label={t("spTax.parentCategory")}
          required
          hint={categories.status === "error" ? t("spTax.loadFailed") : undefined}
        >
          {(id) => (
            <ModernSelect
              id={id}
              value={crud.form.categoryId}
              options={categoryOptions}
              onChange={(v) => crud.setForm((prev) => ({ ...prev, categoryId: v }))}
              placeholder={t("sp.selectCategory")}
            />
          )}
        </TaxonomyField>
        <TaxonomyField label={t("spTax.name")} required>
          {(id) => (
            <input
              id={id}
              type="text"
              required
              maxLength={TAXONOMY_NAME_MAX_LENGTH}
              value={crud.form.name}
              onChange={(e) => crud.setForm((prev) => ({ ...prev, name: e.target.value }))}
              className={TAXONOMY_INPUT_CLASS}
            />
          )}
        </TaxonomyField>
        <TaxonomyField label={t("spTax.description")}>
          {(id) => (
            <textarea
              id={id}
              rows={2}
              maxLength={TAXONOMY_DESCRIPTION_MAX_LENGTH}
              value={crud.form.description}
              onChange={(e) => crud.setForm((prev) => ({ ...prev, description: e.target.value }))}
              className={TAXONOMY_INPUT_CLASS}
            />
          )}
        </TaxonomyField>
      </TaxonomyFormModal>

      <ConfirmDialog
        open={crud.deleteOpen}
        title={t("spTax.deleteType")}
        description={t("spTax.deleteBody", { name: crud.deleteTarget?.name ?? "" })}
        confirmLabel={t("table.confirmDelete")}
        cancelLabel={t("action.cancel")}
        tone="danger"
        busy={crud.busy}
        busyLabel={t("table.deleting")}
        onConfirm={crud.confirmDelete}
        onCancel={crud.cancelDelete}
      />
    </TaxonomyPage>
  );
}
