"use client";

/**
 * @file spareparts/brands/page.tsx
 * @description Spare-part Brand maintenance ("HP", "CANON", …). Names are
 * capitals by rule — the input upper-cases as you type, the shared
 * `validateBrand` refuses anything else, and the server and the database
 * CHECK constraint enforce it again. The logo is optional.
 */

import { useCallback, useMemo, useState } from "react";
import { BadgeCheck, Edit3, Trash2 } from "lucide-react";
import HighlightText from "@/components/HighlightText";
import { Badge, ConfirmDialog } from "@/components/av";
import { useI18n } from "@/i18n/LanguageProvider";
import { TAXONOMY_NAME_MAX_LENGTH, validateBrand } from "@/validation";
import {
  createSparePartBrand,
  deleteSparePartBrand,
  fetchSparePartBrands,
  updateSparePartBrand,
} from "@/services/sparepartTaxonomyApi";
import type { SparePartBrand } from "@/services/types";
import { TaxonomyPage, type TaxonomyColumn } from "@/components/sparepart-taxonomy/TaxonomyPage";
import { TAXONOMY_INPUT_CLASS, TaxonomyField, TaxonomyFormModal } from "@/components/sparepart-taxonomy/TaxonomyFormModal";
import { BrandLogoField } from "@/components/sparepart-taxonomy/BrandLogoField";
import { useTaxonomyList } from "@/components/sparepart-taxonomy/useTaxonomyList";
import { useTaxonomyCrud } from "@/components/sparepart-taxonomy/useTaxonomyCrud";

interface BrandForm {
  name: string;
  logoUrl: string;
}

const EMPTY_FORM: BrandForm = { name: "", logoUrl: "" };

const COLUMNS: TaxonomyColumn[] = [
  { labelKey: "spTax.logo", className: "w-16 text-center" },
  { labelKey: "spTax.name" },
  { labelKey: "spTax.partCount", className: "text-center" },
];

function toForm(row: SparePartBrand): BrandForm {
  return { name: row.name, logoUrl: row.logoUrl ?? "" };
}

export default function SparePartBrandsPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");

  const load = useCallback(() => fetchSparePartBrands(), []);
  const { items, status, reload } = useTaxonomyList(load);

  const crudOptions = useMemo(
    () => ({
      emptyForm: EMPTY_FORM,
      toForm,
      validate: (f: BrandForm) => validateBrand(f),
      create: (f: BrandForm) => createSparePartBrand(f),
      update: (id: string, f: BrandForm) => updateSparePartBrand(id, f),
      remove: deleteSparePartBrand,
      onChanged: reload,
    }),
    [reload]
  );
  const crud = useTaxonomyCrud<SparePartBrand, BrandForm>(crudOptions);

  const term = search.trim().toUpperCase();
  const rows = useMemo(() => (term ? items.filter((b) => b.name.includes(term)) : items), [items, term]);

  return (
    <TaxonomyPage
      titleKey="spTax.brandsTitle"
      subtitleKey="spTax.brandsSubtitle"
      searchPlaceholderKey="spTax.searchBrands"
      addLabelKey="spTax.addBrand"
      columns={COLUMNS}
      rows={rows}
      totalRows={items.length}
      status={status}
      search={search}
      onSearch={setSearch}
      onReload={reload}
      onAdd={crud.openAdd}
      rowKey={(b) => b.id}
      renderRow={(b) => (
        <>
          <td className="py-2 px-4 text-center">
            {b.logoUrl ? (
              // Arbitrary R2 / external host — next/image cannot be whitelisted for it.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.logoUrl} alt="" className="w-9 h-9 object-contain rounded-lg bg-cushion mx-auto" />
            ) : (
              <span className="inline-flex w-9 h-9 rounded-lg bg-cushion text-ink-muted items-center justify-center text-[11px] font-bold">
                {b.name.slice(0, 2)}
              </span>
            )}
          </td>
          <td className="py-2.5 sm:py-3 px-4 font-bold text-ink tracking-wide">
            <HighlightText text={b.name} query={search} />
          </td>
          <td className="py-2.5 sm:py-3 px-4 text-center">
            <Badge tone={b.partCount > 0 ? "accent" : "neutral"}>{b.partCount}</Badge>
          </td>
          <td className="py-2.5 sm:py-3 px-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <button
                type="button"
                onClick={() => crud.openEdit(b)}
                className="p-1.5 text-ink-secondary hover:text-accent hover:bg-accent-soft rounded-lg transition-colors"
                title={t("spTax.editBrand")} aria-label={t("spTax.editBrand")}
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => crud.requestDelete(b)}
                className="p-1.5 text-ink-secondary hover:text-danger hover:bg-danger-soft rounded-lg transition-colors"
                title={t("spTax.deleteBrand")} aria-label={t("spTax.deleteBrand")}
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
        title={crud.editing ? t("spTax.editBrand") : t("spTax.addBrand")}
        subtitle={crud.editing?.name}
        icon={BadgeCheck}
        busy={crud.busy}
        onClose={crud.closeForm}
        onSubmit={crud.submit}
      >
        <TaxonomyField label={t("spTax.name")} required hint={t("spTax.uppercaseHint")}>
          {(id) => (
            <input
              id={id}
              type="text"
              required
              autoFocus
              maxLength={TAXONOMY_NAME_MAX_LENGTH}
              value={crud.form.name}
              onChange={(e) => crud.setForm((prev) => ({ ...prev, name: e.target.value.toUpperCase() }))}
              placeholder="HP"
              className={`${TAXONOMY_INPUT_CLASS} uppercase tracking-wide`}
            />
          )}
        </TaxonomyField>
        {/* Functional update: the upload resolves seconds later, and must not
            overwrite a name typed in the meantime. */}
        <BrandLogoField value={crud.form.logoUrl} onChange={(logoUrl) => crud.setForm((prev) => ({ ...prev, logoUrl }))} />
      </TaxonomyFormModal>

      <ConfirmDialog
        open={crud.deleteOpen}
        title={t("spTax.deleteBrand")}
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
