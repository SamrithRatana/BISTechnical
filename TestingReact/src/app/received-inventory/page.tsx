"use client";

/**
 * @file received-inventory/page.tsx
 * @description Item Models Inventory page — matches ItemModelList.razor.
 * Shows all item models logged in the inventory with their serial number and item type.
 *
 * Columns:
 *  - ITEM NAME
 *  - SERIALNUMBER
 *  - ITEM TYPE
 *  - ACTIONS (View, Edit, Delete)
 */

import React, { useState, useCallback } from "react";
import ModernSelect from "@/components/ModernSelect";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useRealtimeResource } from "@/hooks/useRealtimeTickets";
import { useSearchQueryParam } from "@/hooks/useSearchQueryParam";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { useSearchAction } from "@/hooks/useSearchAction";
import { useActionHandler, type ActionValues } from "@/components/ActionBus";
import { useI18n } from "@/i18n/LanguageProvider";
import InfiniteScrollStatus from "@/components/InfiniteScrollStatus";
import PageWrapper from "@/components/PageWrapper";
import HighlightText from "@/components/HighlightText";
import { Download, Eye, Edit3, Trash2, Search, Plus, RefreshCw, AlertTriangle, X } from "lucide-react";
import { fetchItemsInventory, type ItemModel, invalidateCachePrefix } from "@/services/api";
import { ModalWrapper } from "@/components/av/ModalWrapper";

function getAuthHeaders() {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('jwt_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}
export default function ReceivedInventoryPage() {
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState("");
  const pageSize = 25;
  const [selectedItem, setSelectedItem] = useState<ItemModel | null>(null);
  const [activeModal, setActiveModal] = useState<"view" | "edit" | "delete" | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Edit / Add Form State
  const [formState, setFormState] = useState<ItemModel>({
    id: "",
    itemName: "",
    serialNumber: "",
    itemType: "Printer"
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
    refresh: loadData
  } = useInfiniteList<ItemModel, HTMLDivElement, HTMLTableRowElement>({
    fetchPage: (pageNumber, size) => fetchItemsInventory(pageNumber, size, term),
    pageSize,
    resetKey: term,
    getId: (i) => i?.id
  });

  // Live updates so another user's add/edit/delete shows up here without a
  // manual reload.
  const handleRealtimeUpdate = useCallback(() => {
    invalidateCachePrefix("items");
    void loadData();
  }, [loadData]);

  useRealtimeResource("item", handleRealtimeUpdate);

  // No client-side re-filtering — `fetchItemsInventory` already applies the
  // search server-side, and re-filtering the loaded rows (against the
  // undebounced term) hid rows mid-keystroke and capped results at one page.

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setModalError(null);
    try {
      if (formState.id) {
        // Update existing item model
        const response = await fetch('/api/proxy/items', {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(formState)
        });
        if (!response.ok) throw new Error(t("items.updateFailed"));
      } else {
        // Create new item model
        const { id, ...payload } = formState; // exclude empty id
        const response = await fetch('/api/proxy/items', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(t("items.createFailed"));
      }
      invalidateCachePrefix("items");
      await loadData();
      setActiveModal(null);
    } catch (err: any) {
      setModalError(err.message || t("items.genericError"));
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
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error(t("items.deleteFailed"));
      invalidateCachePrefix("items");
      await loadData();
      setActiveModal(null);
    } catch (err: any) {
      setModalError(err.message || t("items.genericError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportCSV = () => {
    if (items.length === 0) return;
    const headers = ["Item Name", "Serial Number", "Item Type"];
    const rows = items.map((i) => [
      `"${i.itemName || ""}"`,
      `"${i.serialNumber || ""}"`,
      `"${i.itemType || ""}"`,
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

  // ── Actions requested from elsewhere (the AI assistant today) ────────────
  //
  // The add/edit dialogs open with whatever the user dictated already typed in;
  // saving stays a click they make themselves. Record-targeted requests are
  // retried as rows load, keyed on `items.length`.
  const findItem = useCallback(
    (ref?: string): ItemModel | null => {
      if (!ref) return null;
      const needle = ref.trim().toLowerCase();
      const match = (value?: string | null) => value?.trim().toLowerCase() === needle;
      return (
        items.find((i) => match(i.serialNumber)) ??
        items.find((i) => match(i.itemName)) ??
        items.find((i) => i.itemName?.toLowerCase().includes(needle)) ??
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
      ...itemFormPatch(values)
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
      // Over the stored record, so untouched fields keep their values.
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

  // Closes whatever this page currently has open — the same thing Cancel or X
  // does, discarding anything typed. Always reports success: the request is
  // "leave nothing open", and that is true afterwards whether or not a dialog
  // happened to be showing.
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
      <div className="flex-1 flex flex-col min-h-0 bg-surface rounded-2xl border border-subtle/80 shadow-sm overflow-hidden ">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-subtle bg-cushion/50 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                placeholder={t("items.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 text-xs border border-subtle rounded-xl bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent w-64 md:w-80 "
              />
            </div>

            <button
              onClick={() => void loadData()}
              className="p-2 text-ink-secondary hover:bg-sunken rounded-xl transition-colors "
              title={t("items.reload")}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setFormState({ id: "", itemName: "", serialNumber: "", itemType: "Printer" });
                setModalError(null);
                setActiveModal("edit");
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-accent rounded-xl hover:bg-accent-hover transition-colors shadow-sm shadow-accent/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t("items.addModel")}</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-ink bg-surface border border-subtle rounded-xl hover:bg-cushion transition-colors shadow-sm "
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t("action.export")}</span>
            </button>
          </div>
        </div>

        {/* Table Content — matches ItemModelList.razor exact column layout.
            Also the IntersectionObserver root for infinite scroll. */}
        <div ref={scrollRootRef} className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
          <table className="w-full text-left border-collapse min-w-full text-xs">
            <thead>
              <tr className="bg-cushion border-b border-subtle/80 text-[11px] font-bold text-ink-secondary uppercase tracking-wider ">
                <th className="py-3.5 px-5 whitespace-nowrap">{t("field.itemName")}</th>
                <th className="py-3.5 px-5 whitespace-nowrap">{t("field.serialNumber")}</th>
                <th className="py-3.5 px-5 whitespace-nowrap">{t("field.itemType")}</th>
                <th className="py-3.5 px-5 text-right whitespace-nowrap">{t("field.actions")}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-subtle text-ink ">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td colSpan={4} className="py-3.5 px-5">
                      <div className="h-5 bg-sunken rounded w-full"></div>
                    </td>
                  </tr>
                ))
              ) : items.length > 0 ? (
                items.map((item, idx) => (
                  <tr
                    key={item.id || idx}
                    className="hover:bg-cushion/80 transition-colors "
                  >
                    <td className="py-3.5 px-5 font-medium text-ink ">
                      <HighlightText text={item.itemName || "N/A"} query={searchTerm} />
                    </td>
                    <td className="py-3.5 px-5 font-mono text-ink ">
                      <HighlightText text={item.serialNumber || "N/A"} query={searchTerm} />
                    </td>
                    <td className="py-3.5 px-5 text-ink-secondary ">
                      <HighlightText text={item.itemType || "N/A"} query={searchTerm} />
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* View details */}
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setActiveModal("view");
                          }}
                          className="p-1.5 rounded-lg text-info hover:bg-accent-soft transition-colors "
                          title={t("action.viewDetails")}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {/* Edit */}
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setFormState({ ...item });
                            setModalError(null);
                            setActiveModal("edit");
                          }}
                          className="p-1.5 rounded-lg text-ink-secondary hover:bg-sunken transition-colors "
                          title={t("items.editModel")}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setModalError(null);
                            setActiveModal("delete");
                          }}
                          className="p-1.5 rounded-lg text-danger hover:bg-danger-soft transition-colors "
                          title={t("items.deleteModel")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-ink-muted">
                    {t("items.empty")}
                  </td>
                </tr>
              )}

              {/* Infinite-scroll sentinel — observing this row pulls the next batch. */}
              {!isLoading && items.length > 0 && (
                <tr ref={sentinelRef}>
                  <td colSpan={4} className="py-4 text-center">
                    <InfiniteScrollStatus
                      isLoadingMore={isLoadingMore}
                      reachedEnd={reachedEnd}
                      limitReached={limitReached}
                      count={items.length}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Status Bar — infinite scroll replaces the page controls */}
        <div className="p-4 border-t border-subtle bg-cushion/50 flex items-center justify-between shrink-0">
          <span className="text-xs text-ink-secondary ">
            Loaded <strong className="text-ink ">{items.length}</strong>
            {totalCount > items.length && (
              <> of <strong className="text-ink ">{totalCount}</strong></>
            )}{" "}
            {items.length === 1 ? "item" : "items"}
            {term && <> matching &ldquo;{term}&rdquo;</>}
          </span>
        </div>
      </div>

      {/* ── VIEW MODAL ── */}
      <ModalWrapper
        open={activeModal === "view" && !!selectedItem}
        onClose={() => setActiveModal(null)}
        maxWidth="max-w-md"
        zIndex={50}
        placement="center"
        backdropVariant="heavy"
      >
        <div className="bg-surface border border-subtle rounded-2xl p-6">
          <div className="flex items-center justify-between border-b border-subtle pb-3 mb-4">
            <h3 className="font-bold text-ink text-base">{t("items.detailsTitle")}</h3>
            <button onClick={() => setActiveModal(null)} className="p-1 text-ink-muted hover:text-ink-secondary">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-ink-muted font-semibold block mb-0.5">{t("field.itemName")}</span>
              <span className="text-ink font-medium text-sm">{selectedItem?.itemName}</span>
            </div>
            <div>
              <span className="text-ink-muted font-semibold block mb-0.5">{t("field.serialNumber")}</span>
              <code className="px-2 py-1 rounded bg-sunken text-ink font-mono">{selectedItem?.serialNumber || "N/A"}</code>
            </div>
            <div>
              <span className="text-ink-muted font-semibold block mb-0.5">{t("field.itemType")}</span>
              <span className="text-ink font-medium">{selectedItem?.itemType || "N/A"}</span>
            </div>
          </div>
          <div className="mt-6 text-right">
            <button
              onClick={() => setActiveModal(null)}
              className="px-4 py-2 text-xs font-semibold bg-sunken text-ink rounded-xl hover:bg-sunken"
            >
              Close
            </button>
          </div>
        </div>
      </ModalWrapper>

      {/* ── EDIT / CREATE MODAL ── */}
      <ModalWrapper
        open={activeModal === "edit"}
        onClose={() => setActiveModal(null)}
        maxWidth="max-w-md"
        zIndex={50}
        placement="center"
        backdropVariant="heavy"
      >
        <div className="bg-surface border border-subtle rounded-2xl p-6">
          <div className="flex items-center justify-between border-b border-subtle pb-3 mb-4">
            <h3 className="font-bold text-ink text-base">
              {formState.id ? t("items.editModel") : t("items.addNewModel")}
            </h3>
            <button onClick={() => setActiveModal(null)} className="p-1 text-ink-muted hover:text-ink-secondary">
              <X className="w-4 h-4" />
            </button>
          </div>

          {modalError && (
            <div className="mb-4 p-3 rounded-xl bg-danger-soft text-danger text-xs border border-danger">
              {modalError}
            </div>
          )}

          <form onSubmit={handleCreateOrUpdate} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-ink mb-1">{t("field.itemName")} *</label>
              <input
                type="text"
                required
                value={formState.itemName}
                onChange={(e) => setFormState({ ...formState, itemName: e.target.value })}
                placeholder={t("items.egItemName")}
                className="w-full px-3 py-2 border border-subtle rounded-xl bg-surface outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <div>
              <label className="block font-semibold text-ink mb-1">{t("field.serialNumber")} *</label>
              <input
                type="text"
                required
                value={formState.serialNumber || ""}
                onChange={(e) => setFormState({ ...formState, serialNumber: e.target.value })}
                placeholder={t("items.egSerial")}
                className="w-full px-3 py-2 border border-subtle rounded-xl bg-surface font-mono outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <div>
              <label className="block font-semibold text-ink mb-1">{t("field.itemType")}</label>
              <select
                value={formState.itemType || "Printer"}
                onChange={(e) => setFormState({ ...formState, itemType: e.target.value })}
                className="w-full px-3 py-2 border border-subtle rounded-xl bg-surface outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="Printer">{t("items.typePrinter")}</option>
                <option value="Bill Counter">{t("items.typeBillCounter")}</option>
                <option value="Generate">{t("items.typeGenerate")}</option>
                <option value="Scanner">{t("items.typeScanner")}</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-subtle">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 font-semibold text-ink-secondary hover:bg-sunken rounded-xl"
              >
                {t("action.cancel")}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 font-semibold text-white bg-accent hover:bg-accent-hover rounded-xl shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
                {isSaving ? t("action.saving") : t("items.saveModel")}
              </button>
            </div>
          </form>
        </div>
      </ModalWrapper>

      {/* ── DELETE CONFIRMATION MODAL ── */}
      <ModalWrapper
        open={activeModal === "delete" && !!selectedItem}
        onClose={() => setActiveModal(null)}
        maxWidth="max-w-md"
        zIndex={50}
        placement="center"
        backdropVariant="heavy"
        isAlert
      >
        <div className="p-6">
          <div className="flex items-center gap-3 text-danger mb-3">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <h3 className="font-bold text-ink text-base">{t("dialog.confirmDelete")}</h3>
          </div>
          <p className="text-xs text-ink-secondary mb-4">
            {t("items.deleteBody", { name: selectedItem?.itemName ?? "" })}
          </p>
          {modalError && (
            <div className="mb-4 p-3 rounded-xl bg-danger-soft text-danger text-xs border border-danger">
              {modalError}
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setActiveModal(null)}
              className="px-4 py-2 text-xs font-semibold text-ink-secondary hover:bg-sunken rounded-xl"
            >
              {t("action.cancel")}
            </button>
            <button
              onClick={handleDelete}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-white bg-danger hover:bg-danger rounded-xl shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
              {isSaving ? t("table.deleting") : t("action.delete")}
            </button>
          </div>
        </div>
      </ModalWrapper>
    </PageWrapper>
  );
}

