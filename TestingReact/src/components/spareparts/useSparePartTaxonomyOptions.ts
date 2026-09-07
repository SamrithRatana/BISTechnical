"use client";

import { useCallback, useMemo } from "react";
import type { ModernSelectOption } from "@/components/ModernSelect";
import { useTaxonomyList } from "@/components/sparepart-taxonomy/useTaxonomyList";
import type { SparePartFilters } from "@/services/api";
import {
  fetchSparePartBrands,
  fetchSparePartCategories,
  fetchSparePartTypes,
} from "@/services/sparepartTaxonomyApi";

/**
 * The three lookup lists the catalogue page's filter bar and form share,
 * loaded once per mount through the same cached client the taxonomy pages
 * use (60s client cache; every taxonomy write invalidates it). Types are
 * loaded whole and narrowed per category on the client — the list is small,
 * and it saves a request every time the category select changes.
 */
export function useSparePartTaxonomyOptions() {
  const loadCategories = useCallback(() => fetchSparePartCategories(), []);
  const loadTypes = useCallback(() => fetchSparePartTypes(), []);
  const loadBrands = useCallback(() => fetchSparePartBrands(), []);

  const categories = useTaxonomyList(loadCategories);
  const types = useTaxonomyList(loadTypes);
  const brands = useTaxonomyList(loadBrands);

  const categoryOptions = useMemo<ModernSelectOption[]>(
    () => categories.items.map((c) => ({ value: c.id, label: c.name })),
    [categories.items]
  );
  const brandOptions = useMemo<ModernSelectOption[]>(
    () => brands.items.map((b) => ({ value: b.id, label: b.name })),
    [brands.items]
  );

  /** Type options inside one category; empty until a category is chosen. */
  const typeOptionsFor = useCallback(
    (categoryId: string | null | undefined): ModernSelectOption[] =>
      categoryId
        ? types.items.filter((t) => t.categoryId === categoryId).map((t) => ({ value: t.id, label: t.name }))
        : [],
    [types.items]
  );

  const ready = categories.status === "ready" && types.status === "ready" && brands.status === "ready";
  const loading = categories.status === "loading" || types.status === "loading" || brands.status === "loading";
  const error = categories.status === "error" || types.status === "error" || brands.status === "error";

  // Depend on the stable `reload` callbacks, not the result objects (fresh
  // literals every render), so `retry` keeps one identity.
  const reloadCategories = categories.reload;
  const reloadTypes = types.reload;
  const reloadBrands = brands.reload;
  const retry = useCallback(() => {
    reloadCategories();
    reloadTypes();
    reloadBrands();
  }, [reloadCategories, reloadTypes, reloadBrands]);

  /**
   * Drops filter ids that no longer name a row — a category deleted since
   * the link was shared, a type outside its category, a brand that is gone.
   * Left in place, such an id would keep the API filtering (empty list)
   * while the select shows "All …". Only applied once all three lists have
   * loaded: with the lists unknown, the ids are trusted as they are.
   */
  const pruneFilters = useCallback(
    (filters: SparePartFilters): SparePartFilters => {
      if (!ready) return filters;
      const categoryId =
        filters.categoryId && categories.items.some((c) => c.id === filters.categoryId) ? filters.categoryId : null;
      const typeId =
        filters.typeId && categoryId && types.items.some((t) => t.id === filters.typeId && t.categoryId === categoryId)
          ? filters.typeId
          : null;
      const brandId = filters.brandId && brands.items.some((b) => b.id === filters.brandId) ? filters.brandId : null;
      if (categoryId === (filters.categoryId ?? null) && typeId === (filters.typeId ?? null) && brandId === (filters.brandId ?? null)) {
        return filters; // unchanged — keep the identity so memoised consumers stay put
      }
      return { categoryId, typeId, brandId };
    },
    [ready, categories.items, types.items, brands.items]
  );

  return { categoryOptions, brandOptions, typeOptionsFor, pruneFilters, loading, error, retry };
}
