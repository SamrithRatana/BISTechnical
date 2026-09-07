"use client";

/**
 * @file spareparts/categories/page.tsx
 * @description Spare-part Category maintenance — the top level of the
 * Category → Type hierarchy ("Printer part", "Photocopy part", …).
 * Fields and columns only; the list, dialogs and result handling are the
 * shared `components/sparepart-taxonomy` set.
 */

import { useCallback, useMemo, useState } from "react";
import { Edit3, FolderTree, Trash2 } from "lucide-react";
import HighlightText from "@/components/HighlightText";
import { Badge, ConfirmDialog } from "@/components/av";
import { useI18n } from "@/i18n/LanguageProvider";
import { TAXONOMY_DESCRIPTION_MAX_LENGTH, TAXONOMY_NAME_MAX_LENGTH, validateTaxonomyName } from "@/validation";
import {
  createSparePartCategory,
  deleteSparePartCategory,
  fetchSparePartCategories,
  updateSparePartCategory,
} from "@/services/sparepartTaxonomyApi";
import type { SparePartCategory } from "@/services/types";
import { TaxonomyPage, type TaxonomyColumn } from "@/components/sparepart-taxonomy/TaxonomyPage";
import { TAXONOMY_INPUT_CLASS, TaxonomyField, TaxonomyFormModal } from "@/components/sparepart-taxonomy/TaxonomyFormModal";
import { useTaxonomyList } from "@/components/sparepart-taxonomy/useTaxonomyList";
import { useTaxonomyCrud } from "@/components/sparepart-taxonomy/useTaxonomyCrud";

interface CategoryForm {
  name: string;
  description: string;
  sortOrder: number;
}

const EMPTY_FORM: CategoryForm = { name: "", description: "", sortOrder: 0 };

const COLUMNS: TaxonomyColumn[] = [
  { labelKey: "spTax.name" },
  { labelKey: "spTax.description" },
  { labelKey: "spTax.typeCount", className: "text-center" },
  { labelKey: "spTax.partCount", className: "text-center" },
];

function toForm(row: SparePartCategory): CategoryForm {
  return { name: row.name, description: row.description ?? "", sortOrder: row.sortOrder };
}

export default function SparePartCategoriesPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");

  const load = useCallback(() => fetchSparePartCategories(), []);
  const { items, status, reload } = useTaxonomyList(load);

  const crudOptions = useMemo(
    () => ({
      emptyForm: EMPTY_FORM,
      toForm,
      validate: (f: CategoryForm) => validateTaxonomyName(f),
      create: (f: CategoryForm) => createSparePartCategory(f),
      update: (id: string, f: CategoryForm) => updateSparePartCategory(id, f),
      remove: deleteSparePartCategory,
      onChanged: reload,
    }),
    [reload]
  );
  const crud = useTaxonomyCrud<SparePartCategory, CategoryForm>(crudOptions);

  const term = search.trim().toLowerCase();
  const rows = useMemo(
    () =>
      term
        ? items.filter(
            (c) => c.name.toLowerCase().includes(term) || (c.description ?? "").toLowerCase().includes(term)
          )
        : items,
    [items, term]
  );

  return (
    <TaxonomyPage
      titleKey="spTax.categoriesTitle"
      subtitleKey="spTax.categoriesSubtitle"
      searchPlaceholderKey="spTax.searchCategories"
      addLabelKey="spTax.addCategory"
      columns={COLUMNS}
      rows={rows}
      totalRows={items.length}
      status={status}
      search={search}
      onSearch={setSearch}
      onReload={reload}
      onAdd={crud.openAdd}
      rowKey={(c) => c.id}
      renderRow={(c) => (
        <>
          <td className="py-2.5 sm:py-3 px-4 font-bold text-ink">
            <HighlightText text={c.name} query={search} />
          </td>
          <td className="py-2.5 sm:py-3 px-4 text-ink-secondary">
            <HighlightText text={c.description || "—"} query={search} />
          </td>
          <td className="py-2.5 sm:py-3 px-4 text-center">
            <Badge tone={c.typeCount > 0 ? "info" : "neutral"}>{c.typeCount}</Badge>
          </td>
          <td className="py-2.5 sm:py-3 px-4 text-center">
            <Badge tone={c.partCount > 0 ? "accent" : "neutral"}>{c.partCount}</Badge>
          </td>
          <td className="py-2.5 sm:py-3 px-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <button
                type="button"
                onClick={() => crud.openEdit(c)}
                className="p-1.5 text-ink-secondary hover:text-accent hover:bg-accent-soft rounded-lg transition-colors"
                title={t("spTax.editCategory")} aria-label={t("spTax.editCategory")}
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => crud.requestDelete(c)}
                className="p-1.5 text-ink-secondary hover:text-danger hover:bg-danger-soft rounded-lg transition-colors"
                title={t("spTax.deleteCategory")} aria-label={t("spTax.deleteCategory")}
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
        title={crud.editing ? t("spTax.editCategory") : t("spTax.addCategory")}
        subtitle={crud.editing?.name}
        icon={FolderTree}
        busy={crud.busy}
        onClose={crud.closeForm}
        onSubmit={crud.submit}
      >
        <TaxonomyField label={t("spTax.name")} required>
          {(id) => (
            <input
              id={id}
              type="text"
              required
              autoFocus
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
        title={t("spTax.deleteCategory")}
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
