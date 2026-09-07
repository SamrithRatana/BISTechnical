"use client";

/**
 * @file received-inventory/page.tsx
 * @description Item Models Inventory page — matches ItemModelList.razor.
 * Shows all item models logged in the inventory with their serial number and item type.
 * Fully integrates the unified Enterprise Ribbon CRUD & DataLayout system.
 *
 * Columns:
 *  - ITEM NAME
 *  - SERIAL NUMBER
 *  - ITEM TYPE
 *  - ACTIONS (View, Edit, Delete, Print)
 */

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useRealtimeResource } from "@/hooks/useRealtimeTickets";
import { useSearchQueryParam } from "@/hooks/useSearchQueryParam";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { useSearchAction } from "@/hooks/useSearchAction";
import { useActionHandler, type ActionValues } from "@/components/ActionBus";
import { useI18n } from "@/i18n/LanguageProvider";
import { firstValidationMessage } from "@/i18n/validationMessage";
import { validateItemModel } from "@/validation";
import InfiniteScrollStatus from "@/components/InfiniteScrollStatus";
import PageWrapper from "@/components/PageWrapper";
import HighlightText from "@/components/HighlightText";
import { Download, Eye, Edit3, Trash2, Search, Plus, RefreshCw, AlertTriangle, X, Printer } from "lucide-react";
import { fetchItemsInventory, type ItemModel, invalidateCachePrefix } from "@/services/api";
import { ModalWrapper } from "@/components/av/ModalWrapper";
import { useTheme } from "@/theme/ThemeProvider";
import EnterpriseRibbonToolbar from "@/components/crud/EnterpriseRibbonToolbar";
import ColumnVisibilityDropdown, { type ColumnDefinition } from "@/components/crud/ColumnVisibilityDropdown";
import ColumnHeaderFilter from "@/components/crud/ColumnHeaderFilter";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

function getAuthHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("jwt_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export default function ReceivedInventoryPage() {
  const { t, lang } = useI18n();
  const { prefs } = useTheme();
  const crudStyle = prefs.crudStyle || "enterprise-ribbon";
  const isRibbonMode = crudStyle === "enterprise-ribbon";

  const [searchTerm, setSearchTerm] = useState("");
  const pageSize = 25;
  const [selectedItem, setSelectedItem] = useState<ItemModel | null>(null);
  const [checkedRow, setCheckedRow] = useState<ItemModel | null>(null);
  const [activeModal, setActiveModal] = useState<"view" | "edit" | "delete" | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Column definitions for ColumnVisibilityDropdown
  const [columnsState, setColumnsState] = useState<ColumnDefinition[]>([
    { key: "itemName", label: t("field.itemName"), visible: true, permanent: true },
    { key: "serialNumber", label: t("field.serialNumber"), visible: true },
    { key: "itemType", label: t("field.itemType"), visible: true },
    { key: "actions", label: t("field.actions"), visible: true, permanent: true },
  ]);

  useEffect(() => {
    setColumnsState((prev) =>
      prev.map((c) => {
        if (c.key === "itemName") return { ...c, label: t("field.itemName") };
        if (c.key === "serialNumber") return { ...c, label: t("field.serialNumber") };
        if (c.key === "itemType") return { ...c, label: t("field.itemType") };
        if (c.key === "actions") return { ...c, label: t("field.actions") };
        return c;
      })
    );
  }, [t]);

  const isColVisible = useCallback(
    (colKey: string) => columnsState.find((c) => c.key === colKey)?.visible ?? true,
    [columnsState]
  );

  const handleToggleColumn = useCallback((colKey: string) => {
    setColumnsState((prev) =>
      prev.map((col) => (col.key === colKey && !col.permanent ? { ...col, visible: !col.visible } : col))
    );
  }, []);

  const handleResetColumns = useCallback(() => {
    setColumnsState((prev) => prev.map((col) => ({ ...col, visible: true })));
  }, []);

  // Column-level quick filter & sort
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: "asc" | "desc" } | null>(null);

  const handleColumnFilterChange = useCallback((field: string, val: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (!val || val.trim() === "") {
        delete next[field];
      } else {
        next[field] = val.trim().toLowerCase();
      }
      return next;
    });
  }, []);

  const handleColumnSortChange = useCallback((field: string, direction: "asc" | "desc" | null) => {
    if (!direction) {
      setSortConfig(null);
    } else {
      setSortConfig({ field, direction });
    }
  }, []);

  // Edit / Add Form State
  const [formState, setFormState] = useState<ItemModel>({
    id: "",
    itemName: "",
    serialNumber: "",
    itemType: "Printer",
  });

  // Seed from ?q= when arriving via the header's global search.
  useSearchQueryParam(setSearchTerm);

  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const term = debouncedSearch.trim();

  const {
    items,
    totalCount,
    isLoading,
    isLoadingMore,
    reachedEnd,
    limitReached,
    scrollRootRef,
    sentinelRef,
    refresh: loadData,
  } = useInfiniteList<ItemModel, HTMLDivElement, HTMLTableRowElement>({
    fetchPage: (pageNumber, size) => fetchItemsInventory(pageNumber, size, term),
    pageSize,
    resetKey: `item-models:${term}`,
    getId: (i) => i?.id,
  });

  // Live updates
  const handleRealtimeUpdate = useCallback(() => {
    invalidateCachePrefix("items");
    void loadData();
  }, [loadData]);

  useRealtimeResource("item", handleRealtimeUpdate);

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    const check = validateItemModel({
      itemName: formState.itemName,
      serialNumber: formState.serialNumber,
    });
    if (!check.isValid) {
      setModalError(firstValidationMessage(check, t));
      return;
    }

    setIsSaving(true);
    setModalError(null);
    try {
      if (formState.id) {
        // Update existing item model
        const response = await fetch("/api/proxy/items", {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify(formState),
        });
        if (!response.ok) throw new Error(t("items.updateFailed"));
        toast.success(lang === "km" ? "កែប្រែទិន្នន័យបានជោគជ័យ" : "Item model updated successfully");
      } else {
        // Create new item model
        const { id: _unusedId, ...payload } = formState;
        const response = await fetch("/api/proxy/items", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(t("items.createFailed"));
        toast.success(lang === "km" ? "បង្កើតថ្មីបានជោគជ័យ" : "Item model created successfully");
      }
      invalidateCachePrefix("items");
      await loadData();
      setActiveModal(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("items.genericError");
      setModalError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem?.id) return;
    setIsSaving(true);
    setModalError(null);
    try {
      const response = await fetch(`/api/proxy/items/${selectedItem.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error(t("items.deleteFailed"));
      toast.success(lang === "km" ? "លុបទិន្នន័យបានជោគជ័យ" : "Item model deleted successfully");
      invalidateCachePrefix("items");
      await loadData();
      if (checkedRow?.id === selectedItem.id) setCheckedRow(null);
      setActiveModal(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("items.genericError");
      setModalError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportCSV = () => {
    if (!items.length) return;
    const headers = [t("field.itemName"), t("field.serialNumber"), t("field.itemType")];
    const rows = items.map((item) => [
      `"${(item.itemName || "").replace(/"/g, '""')}"`,
      `"${(item.serialNumber || "").replace(/"/g, '""')}"`,
      `"${(item.itemType || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `item_models_inventory_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered & sorted rows
  const displayedItems = useMemo(() => {
    let list = items;

    // Apply column-level filters
    const filterKeys = Object.keys(columnFilters);
    if (filterKeys.length > 0) {
      list = list.filter((item) => {
        return filterKeys.every((key) => {
          const filterVal = columnFilters[key];
          if (!filterVal) return true;
          let cellVal = "";
          if (key === "itemName") cellVal = item.itemName || "";
          else if (key === "serialNumber") cellVal = item.serialNumber || "";
          else if (key === "itemType") cellVal = item.itemType || "";
          return cellVal.toLowerCase().includes(filterVal);
        });
      });
    }

    // Apply sorting
    if (sortConfig) {
      list = [...list].sort((a, b) => {
        let valA = "";
        let valB = "";
        if (sortConfig.field === "itemName") {
          valA = a.itemName || "";
          valB = b.itemName || "";
        } else if (sortConfig.field === "serialNumber") {
          valA = a.serialNumber || "";
          valB = b.serialNumber || "";
        } else if (sortConfig.field === "itemType") {
          valA = a.itemType || "";
          valB = b.itemType || "";
        }
        const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: "base" });
        return sortConfig.direction === "asc" ? cmp : -cmp;
      });
    }

    return list;
  }, [items, columnFilters, sortConfig]);

  // Action Handlers
  const handleOpenAdd = useCallback(() => {
    setSelectedItem(null);
    setFormState({ id: "", itemName: "", serialNumber: "", itemType: "Printer" });
    setModalError(null);
    setActiveModal("edit");
  }, []);

  const handleOpenEdit = useCallback((item: ItemModel) => {
    setSelectedItem(item);
    setFormState({ ...item });
    setModalError(null);
    setActiveModal("edit");
  }, []);

  const handleOpenDelete = useCallback((item: ItemModel) => {
    setSelectedItem(item);
    setModalError(null);
    setActiveModal("delete");
  }, []);

  const handleOpenView = useCallback((item: ItemModel) => {
    setSelectedItem(item);
    setActiveModal("view");
  }, []);

  const handlePrintItem = useCallback((item?: ItemModel | null) => {
    const target = item || checkedRow;
    if (!target) {
      toast(lang === "km" ? "សូមជ្រើសរើសទិន្នន័យ (Row) ក្នុងតារាងដើម្បីបោះពុម្ព (Print)" : "Please select a record to print", { icon: "ℹ️" });
      return;
    }
    window.print();
  }, [checkedRow, lang]);

  // AI Assistant ActionBus handlers
  const findItem = useCallback(
    (ref?: string): ItemModel | null => {
      if (!ref) return null;
      const needle = ref.trim().toLowerCase();
      return (
        items.find((i) => i.itemName?.toLowerCase() === needle) ??
        items.find((i) => i.serialNumber?.toLowerCase() === needle) ??
        items.find((i) => i.id?.toLowerCase() === needle) ??
        null
      );
    },
    [items]
  );

  const itemFormPatch = (values?: ActionValues): Partial<ItemModel> => {
    if (!values) return {};
    const patch: Partial<ItemModel> = {};
    if (values.itemName?.trim()) patch.itemName = values.itemName.trim();
    if (values.serialNumber?.trim()) patch.serialNumber = values.serialNumber.trim();
    if (values.itemType?.trim()) patch.itemType = values.itemType.trim();
    return patch;
  };

  useActionHandler("item.create", (_ref, values) => {
    setSelectedItem(null);
    setModalError(null);
    setFormState({
      id: "",
      itemName: "",
      serialNumber: "",
      itemType: "Printer",
      ...itemFormPatch(values),
    });
    setActiveModal("edit");
    return true;
  });

  useActionHandler(
    "item.edit",
    (ref, values) => {
      const found = findItem(ref);
      if (!found) return false;
      setSelectedItem(found);
      setModalError(null);
      setFormState({ ...found, ...itemFormPatch(values) });
      setActiveModal("edit");
      return true;
    },
    items.length
  );

  useActionHandler(
    "item.delete",
    (ref) => {
      const found = findItem(ref);
      if (!found) return false;
      setSelectedItem(found);
      setActiveModal("delete");
      return true;
    },
    items.length
  );

  useSearchAction(setSearchTerm);

  useActionHandler("ui.dialog.close", () => {
    setActiveModal(null);
    return true;
  });

  useActionHandler("ui.refresh", () => {
    invalidateCachePrefix("items");
    void loadData();
    return true;
  });

  useActionHandler("export.csv", () => {
    if (items.length === 0) return false;
    handleExportCSV();
    return true;
  }, items.length);

  return (
    <PageWrapper
      titleKey="nav.itemModelsInventory"
      subtitleKey="sub.receivedInventory"
    >
      <div className="flex-1 flex flex-col min-h-0 bg-surface rounded-2xl border border-subtle/80 shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        {crudStyle === "enterprise-ribbon" ? (
          <EnterpriseRibbonToolbar
            canCreate={true}
            canEdit={true}
            canDelete={true}
            canPrint={true}
            onCreate={handleOpenAdd}
            onEdit={() => {
              if (checkedRow) {
                handleOpenEdit(checkedRow);
              } else {
                toast(
                  lang === "km"
                    ? "សូមជ្រើសរើសទិន្នន័យ (Row) ក្នុងតារាងជាមុនសិន"
                    : "Please select a record in the table first",
                  { icon: "ℹ️" }
                );
              }
            }}
            onDelete={() => {
              if (checkedRow) {
                handleOpenDelete(checkedRow);
              } else {
                toast(
                  lang === "km"
                    ? "សូមជ្រើសរើសទិន្នន័យ (Row) ក្នុងតារាងដើម្បីលុប"
                    : "Please select a record to delete",
                  { icon: "ℹ️" }
                );
              }
            }}
            onPrint={() => handlePrintItem(checkedRow)}
            onExportCsv={handleExportCSV}
            onReload={() => {
              invalidateCachePrefix("items");
              void loadData();
            }}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onSearchSubmit={() => {
              invalidateCachePrefix("items");
              void loadData();
            }}
            onSearchClear={() => setSearchTerm("")}
            selectedCount={checkedRow ? 1 : 0}
            isLoading={isLoading}
            extraActions={
              <ColumnVisibilityDropdown
                columns={columnsState}
                onToggleColumn={handleToggleColumn}
                onResetColumns={handleResetColumns}
              />
            }
          />
        ) : (
          <div className="p-2.5 sm:p-3 lg:p-3 xl:p-4 border-b border-subtle bg-cushion/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  type="text"
                  placeholder={t("items.searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-1.5 text-xs border border-subtle rounded-xl bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent w-64 md:w-80"
                />
              </div>

              <button
                onClick={() => {
                  invalidateCachePrefix("items");
                  void loadData();
                }}
                className="p-1.5 rounded-xl transition-colors text-ink-secondary hover:bg-cushion"
                title={t("items.reload")}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <ColumnVisibilityDropdown
                columns={columnsState}
                onToggleColumn={handleToggleColumn}
                onResetColumns={handleResetColumns}
              />

              <button
                type="button"
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-accent rounded-xl hover:bg-accent-hover transition-colors shadow-soft-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t("items.addModel")}</span>
              </button>

              <button
                type="button"
                onClick={() => handlePrintItem(checkedRow)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors shadow-soft-sm text-ink bg-surface border border-subtle hover:bg-cushion cursor-pointer"
                title={t("action.printTechnicalReport")}
              >
                <Printer className="w-3.5 h-3.5 text-accent" />
                <span>{t("crud.print")}</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-ink bg-surface border border-subtle rounded-xl hover:bg-cushion transition-colors shadow-soft-sm cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t("action.export")}</span>
              </button>
            </div>
          </div>
        )}

        {/* Table Content */}
        <div ref={scrollRootRef} className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
          <table className="w-full text-left border-collapse min-w-full text-xs">
            <thead className="sticky top-0 z-20 shadow-2xs">
              <tr className="bg-cushion border-b border-subtle/80 text-[10.5px] lg:text-[10.5px] xl:text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">
                {isRibbonMode && (
                  <th className="sticky top-0 z-20 bg-cushion py-2.5 px-2 text-center w-10 min-w-[40px]">
                    <span className="sr-only">Select</span>
                  </th>
                )}
                {isColVisible("itemName") && (
                  <th className="py-2.5 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{t("field.itemName")}</span>
                      <ColumnHeaderFilter
                        label={t("field.itemName")}
                        field="itemName"
                        filterValue={columnFilters["itemName"]}
                        onFilterChange={(v) => handleColumnFilterChange("itemName", v)}
                        sortDirection={sortConfig?.field === "itemName" ? sortConfig.direction : null}
                        onSortChange={(d) => handleColumnSortChange("itemName", d)}
                      />
                    </div>
                  </th>
                )}
                {isColVisible("serialNumber") && (
                  <th className="py-2.5 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{t("field.serialNumber")}</span>
                      <ColumnHeaderFilter
                        label={t("field.serialNumber")}
                        field="serialNumber"
                        filterValue={columnFilters["serialNumber"]}
                        onFilterChange={(v) => handleColumnFilterChange("serialNumber", v)}
                        sortDirection={sortConfig?.field === "serialNumber" ? sortConfig.direction : null}
                        onSortChange={(d) => handleColumnSortChange("serialNumber", d)}
                      />
                    </div>
                  </th>
                )}
                {isColVisible("itemType") && (
                  <th className="py-2.5 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{t("field.itemType")}</span>
                      <ColumnHeaderFilter
                        label={t("field.itemType")}
                        field="itemType"
                        filterValue={columnFilters["itemType"]}
                        onFilterChange={(v) => handleColumnFilterChange("itemType", v)}
                        sortDirection={sortConfig?.field === "itemType" ? sortConfig.direction : null}
                        onSortChange={(d) => handleColumnSortChange("itemType", d)}
                      />
                    </div>
                  </th>
                )}
                {isColVisible("actions") && (
                  <th className="py-2.5 px-4 text-center whitespace-nowrap">{t("field.actions")}</th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-subtle text-ink">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td colSpan={columnsState.filter((c) => c.visible).length + (isRibbonMode ? 1 : 0)} className="py-3.5 px-4">
                      <div className="h-5 bg-sunken rounded w-full"></div>
                    </td>
                  </tr>
                ))
              ) : displayedItems.length > 0 ? (
                displayedItems.map((item, idx) => {
                  const isSelected = checkedRow?.id === item.id;
                  return (
                    <tr
                      key={item.id || idx}
                      onClick={() => setCheckedRow(isSelected ? null : item)}
                      className={cn(
                        "transition-colors cursor-pointer border-b border-subtle/60",
                        isSelected ? "bg-accent-soft/30 ring-1 ring-accent/30" : "hover:bg-cushion/80"
                      )}
                    >
                      {isRibbonMode && (
                        <td className="py-2.5 px-2 text-center w-10 min-w-[40px]" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => setCheckedRow(isSelected ? null : item)}
                            className="w-4 h-4 rounded text-accent focus:ring-accent border-subtle cursor-pointer accent-accent transition-transform hover:scale-105"
                            aria-label="Select row"
                          />
                        </td>
                      )}
                      {isColVisible("itemName") && (
                        <td className="py-2.5 px-4 font-medium text-ink">
                          <HighlightText text={item.itemName || "N/A"} query={searchTerm} />
                        </td>
                      )}
                      {isColVisible("serialNumber") && (
                        <td className="py-2.5 px-4 font-mono text-ink">
                          <HighlightText text={item.serialNumber || "N/A"} query={searchTerm} />
                        </td>
                      )}
                      {isColVisible("itemType") && (
                        <td className="py-2.5 px-4 text-ink-secondary">
                          <HighlightText text={item.itemType || "N/A"} query={searchTerm} />
                        </td>
                      )}
                      {isColVisible("actions") && (
                        <td className="py-2.5 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View details */}
                            <button
                              type="button"
                              onClick={() => handleOpenView(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-950/40 border border-sky-200/80 dark:border-sky-800/40 transition-colors shadow-2xs cursor-pointer"
                              title={t("action.viewDetails")}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{t("crud.viewDetails")}</span>
                            </button>
                            {!isRibbonMode && (
                              <>
                                {/* Edit */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(item)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-ink hover:text-accent hover:bg-accent-soft border border-subtle transition-colors shadow-2xs cursor-pointer"
                                  title={t("items.editModel")}
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>{t("crud.edit")}</span>
                                </button>
                                {/* Delete */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenDelete(item)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-danger hover:bg-danger-soft border border-danger/30 transition-colors shadow-2xs cursor-pointer"
                                  title={t("items.deleteModel")}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>{t("crud.delete")}</span>
                                </button>
                              </>
                            )}
                            {/* Print */}
                            <button
                              type="button"
                              onClick={() => handlePrintItem(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-accent hover:bg-accent-soft border border-accent/30 transition-colors shadow-2xs cursor-pointer"
                              title={t("crud.print")}
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>{t("crud.print")}</span>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={columnsState.filter((c) => c.visible).length + (isRibbonMode ? 1 : 0)} className="py-12 text-center text-ink-muted">
                    {t("items.empty")}
                  </td>
                </tr>
              )}

              {/* Infinite-scroll sentinel */}
              {!isLoading && displayedItems.length > 0 && (
                <tr ref={sentinelRef}>
                  <td colSpan={columnsState.filter((c) => c.visible).length + (isRibbonMode ? 1 : 0)} className="py-4 text-center">
                    <InfiniteScrollStatus
                      isLoadingMore={isLoadingMore}
                      reachedEnd={reachedEnd}
                      limitReached={limitReached}
                      count={displayedItems.length}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Status Bar */}
        <div className="p-3 sm:p-4 border-t border-subtle bg-cushion/50 flex items-center justify-between shrink-0">
          <span className="text-xs text-ink-secondary">
            {t("table.loaded")} <strong className="text-ink">{items.length}</strong>
            {totalCount > items.length && (
              <> {t("page.of")} <strong className="text-ink">{totalCount}</strong></>
            )}{" "}
            {items.length === 1 ? t("table.item") : t("table.items")}
            {term && <> {t("table.matching")} &ldquo;{term}&rdquo;</>}
          </span>
        </div>
      </div>

      {/* ── View Detail Modal ── */}
      <ModalWrapper
        open={activeModal === "view" && !!selectedItem}
        onClose={() => setActiveModal(null)}
        maxWidth="max-w-md"
      >
        <div className="px-6 py-4 border-b border-subtle flex items-center justify-between bg-cushion/50">
          <h3 className="font-bold text-sm text-ink">{t("items.detailsTitle")}</h3>
          <button
            type="button"
            onClick={() => setActiveModal(null)}
            className="text-ink-muted hover:text-ink transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-semibold text-ink-muted uppercase">{t("field.itemName")}</span>
              <p className="mt-1 text-ink font-medium">{selectedItem?.itemName || "N/A"}</p>
            </div>
            <div>
              <span className="font-semibold text-ink-muted uppercase">{t("field.serialNumber")}</span>
              <p className="mt-1 font-mono text-ink">{selectedItem?.serialNumber || "N/A"}</p>
            </div>
            <div>
              <span className="font-semibold text-ink-muted uppercase">{t("field.itemType")}</span>
              <p className="mt-1 text-ink">{selectedItem?.itemType || "N/A"}</p>
            </div>
            <div>
              <span className="font-semibold text-ink-muted uppercase">ID</span>
              <p className="mt-1 font-mono text-ink-muted truncate">{selectedItem?.id || "N/A"}</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-subtle">
            <button
              type="button"
              onClick={() => handlePrintItem(selectedItem)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-accent text-white hover:bg-accent-hover transition-colors shadow-soft-sm cursor-pointer inline-flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t("crud.print")}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-subtle hover:bg-cushion text-ink transition-colors cursor-pointer"
            >
              {t("action.close")}
            </button>
          </div>
        </div>
      </ModalWrapper>

      {/* ── Add / Edit Modal ── */}
      <ModalWrapper
        open={activeModal === "edit"}
        onClose={() => !isSaving && setActiveModal(null)}
        maxWidth="max-w-md"
      >
        <div className="px-6 py-4 border-b border-subtle flex items-center justify-between bg-cushion/50">
          <h3 className="font-bold text-sm text-ink">{formState.id ? t("items.editModel") : t("items.addModel")}</h3>
          <button
            type="button"
            onClick={() => !isSaving && setActiveModal(null)}
            className="text-ink-muted hover:text-ink transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleCreateOrUpdate} className="p-6 space-y-4">
          {modalError && (
            <div className="p-3 text-xs bg-danger-soft text-danger border border-danger/20 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              {t("field.itemName")} <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              required
              value={formState.itemName}
              onChange={(e) => setFormState({ ...formState, itemName: e.target.value })}
              className="w-full px-3.5 py-2 text-xs border border-subtle rounded-xl bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              placeholder={t("items.egItemName")}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              {t("field.serialNumber")} <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              required
              value={formState.serialNumber}
              onChange={(e) => setFormState({ ...formState, serialNumber: e.target.value })}
              className="w-full px-3.5 py-2 text-xs font-mono border border-subtle rounded-xl bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              placeholder={t("items.egSerial")}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              {t("field.itemType")}
            </label>
            <select
              value={formState.itemType || "Printer"}
              onChange={(e) => setFormState({ ...formState, itemType: e.target.value })}
              className="w-full px-3.5 py-2 text-xs border border-subtle rounded-xl bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            >
              <option value="Printer">{t("items.typePrinter")}</option>
              <option value="Bill Counter">{t("items.typeBillCounter")}</option>
              <option value="Scanner">{t("items.typeScanner")}</option>
              <option value="Generate">{t("items.typeGenerate")}</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-subtle">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setActiveModal(null)}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-subtle hover:bg-cushion text-ink transition-colors cursor-pointer"
            >
              {t("action.cancel")}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-accent text-white hover:bg-accent-hover transition-colors shadow-soft-sm disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? t("action.saving") : formState.id ? t("detail.saveChanges") : t("action.create")}
            </button>
          </div>
        </form>
      </ModalWrapper>

      {/* ── Delete Confirmation Modal ── */}
      <ModalWrapper
        open={activeModal === "delete" && !!selectedItem}
        onClose={() => !isSaving && setActiveModal(null)}
        maxWidth="max-w-md"
        isAlert
      >
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-full bg-danger-soft text-danger shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-ink leading-relaxed">
                {t("items.deleteBody", { name: selectedItem?.itemName ?? "" })}
              </p>
              <div className="mt-2.5 p-2 rounded-lg bg-cushion border border-subtle text-xs">
                <p className="font-semibold text-ink">{selectedItem?.itemName}</p>
                <p className="font-mono text-ink-secondary text-[11px] mt-0.5">{selectedItem?.serialNumber}</p>
              </div>
            </div>
          </div>

          {modalError && (
            <div className="p-3 text-xs bg-danger-soft text-danger border border-danger/20 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-subtle">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setActiveModal(null)}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-subtle hover:bg-cushion text-ink transition-colors cursor-pointer"
            >
              {t("action.cancel")}
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleDelete}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-danger text-white hover:bg-danger-hover transition-colors shadow-soft-sm disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? t("table.deleting") : t("action.delete")}
            </button>
          </div>
        </div>
      </ModalWrapper>
    </PageWrapper>
  );
}
