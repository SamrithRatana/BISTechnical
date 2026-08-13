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
import { useInfiniteList } from "@/hooks/useInfiniteList";
import InfiniteScrollStatus from "@/components/InfiniteScrollStatus";
import PageWrapper from "@/components/PageWrapper";
import HighlightText from "@/components/HighlightText";
import { Download, Eye, Edit3, Trash2, Search, Plus, RefreshCw, AlertTriangle, X } from "lucide-react";
import { fetchItemsInventory, type ItemModel, invalidateCachePrefix } from "@/services/api";

function getAuthHeaders() {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('jwt_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}
export default function ReceivedInventoryPage() {
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
    itemType: "Printer",
  });

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
    resetKey: term,
    getId: (i) => i?.id,
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
          body: JSON.stringify(formState),
        });
        if (!response.ok) throw new Error("Failed to update item.");
      } else {
        // Create new item model
        const { id, ...payload } = formState; // exclude empty id
        const response = await fetch('/api/proxy/items', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Failed to create item.");
      }
      invalidateCachePrefix("items");
      await loadData();
      setActiveModal(null);
    } catch (err: any) {
      setModalError(err.message || "An error occurred.");
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
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to delete item.");
      invalidateCachePrefix("items");
      await loadData();
      setActiveModal(null);
    } catch (err: any) {
      setModalError(err.message || "An error occurred.");
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

  return (
    <PageWrapper
      title="Item Models Inventory"
      subtitle="View and manage all item models currently registered in technical inventory (ItemModelList.razor)"
    >
      <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4 dark:border-slate-800 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Item Name, Serial Number, Type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64 md:w-80 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              />
            </div>

            <button
              onClick={() => void loadData()}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors dark:text-slate-400 dark:hover:bg-slate-800"
              title="Reload Item Inventory Data"
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
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Item Model</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Table Content — matches ItemModelList.razor exact column layout.
            Also the IntersectionObserver root for infinite scroll. */}
        <div ref={scrollRootRef} className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
          <table className="w-full text-left border-collapse min-w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:bg-slate-800/60 dark:border-slate-800 dark:text-slate-400">
                <th className="py-3.5 px-5 whitespace-nowrap">Item Name</th>
                <th className="py-3.5 px-5 whitespace-nowrap">SerialNumber</th>
                <th className="py-3.5 px-5 whitespace-nowrap">Item Type</th>
                <th className="py-3.5 px-5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td colSpan={4} className="py-3.5 px-5">
                      <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                    </td>
                  </tr>
                ))
              ) : items.length > 0 ? (
                items.map((item, idx) => (
                  <tr
                    key={item.id || idx}
                    className="hover:bg-slate-50/80 transition-colors dark:hover:bg-slate-800/40"
                  >
                    <td className="py-3.5 px-5 font-medium text-slate-900 dark:text-slate-100">
                      <HighlightText text={item.itemName || "N/A"} query={searchTerm} />
                    </td>
                    <td className="py-3.5 px-5 font-mono text-slate-800 dark:text-slate-300">
                      <HighlightText text={item.serialNumber || "N/A"} query={searchTerm} />
                    </td>
                    <td className="py-3.5 px-5 text-slate-600 dark:text-slate-400">
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
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors dark:text-blue-400 dark:hover:bg-slate-800"
                          title="View Details"
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
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors dark:text-slate-400 dark:hover:bg-slate-800"
                          title="Edit Item Model"
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
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors dark:hover:bg-slate-800"
                          title="Delete Item Model"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    No item models found matching your search.
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
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between dark:border-slate-800 dark:bg-slate-900/50 shrink-0">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Loaded <strong className="text-slate-700 dark:text-slate-200">{items.length}</strong>
            {totalCount > items.length && (
              <> of <strong className="text-slate-700 dark:text-slate-200">{totalCount}</strong></>
            )}{" "}
            {items.length === 1 ? "item" : "items"}
            {term && <> matching &ldquo;{term}&rdquo;</>}
          </span>
        </div>
      </div>

      {/* ── VIEW MODAL ── */}
      {activeModal === "view" && selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Item Model Details</h3>
              <button onClick={() => setActiveModal(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 font-semibold block mb-0.5">Item Name:</span>
                <span className="text-slate-800 dark:text-slate-200 font-medium text-sm">{selectedItem.itemName}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block mb-0.5">Serial Number:</span>
                <code className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono">{selectedItem.serialNumber || "N/A"}</code>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block mb-0.5">Item Type:</span>
                <span className="text-slate-800 dark:text-slate-200 font-medium">{selectedItem.itemType || "N/A"}</span>
              </div>
            </div>
            <div className="mt-6 text-right">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT / CREATE MODAL ── */}
      {activeModal === "edit" && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                {formState.id ? "Edit Item Model" : "Add New Item Model"}
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 text-rose-600 text-xs border border-rose-100 dark:bg-rose-950/50 dark:border-rose-900/50">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateOrUpdate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  value={formState.itemName}
                  onChange={(e) => setFormState({ ...formState, itemName: e.target.value })}
                  placeholder="e.g. 1643I (Verify Brand/Model)"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">SerialNumber *</label>
                <input
                  type="text"
                  required
                  value={formState.serialNumber || ""}
                  onChange={(e) => setFormState({ ...formState, serialNumber: e.target.value })}
                  placeholder="e.g. 2TW04761"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 font-mono outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Item Type</label>
                <select
                  value={formState.itemType || "Printer"}
                  onChange={(e) => setFormState({ ...formState, itemType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="Printer">Printer</option>
                  <option value="Bill Counter">Bill Counter</option>
                  <option value="Generate">Generate</option>
                  <option value="Scanner">Scanner</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {isSaving ? "Saving..." : "Save Model"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {activeModal === "delete" && selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Confirm Delete</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
              Are you sure you want to delete item model{" "}
              <strong className="text-slate-900 dark:text-slate-200">{selectedItem.itemName}</strong>?
            </p>
            {modalError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 text-rose-600 text-xs border border-rose-100 dark:bg-rose-950/50 dark:border-rose-900/50">
                {modalError}
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
                {isSaving ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
