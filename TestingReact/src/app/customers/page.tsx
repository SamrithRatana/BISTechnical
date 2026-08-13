"use client";

/**
 * @file customers/page.tsx
 * @description Customer Center page — matches CustomerList.razor.
 * Full CRUD Integration:
 *  - GET: fetchCustomerCenter()
 *  - POST: createCustomer()
 *  - PUT: updateCustomer()
 *  - DELETE: deleteCustomer()
 */

import React, { useState, useCallback } from "react";
import PageWrapper from "@/components/PageWrapper";
import { Search, Plus, RefreshCw, Edit3, Trash2, X, Save, Building2, User, Phone, MapPin } from "lucide-react";
import { fetchCustomerCenter, createCustomer, updateCustomer, deleteCustomer, invalidateCachePrefix, type CustomerItem } from "@/services/api";
import { useRealtimeResource } from "@/hooks/useRealtimeTickets";
import HighlightText from "@/components/HighlightText";
import ModernSelect from "@/components/ModernSelect";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import InfiniteScrollStatus from "@/components/InfiniteScrollStatus";

export default function CustomerCenterPage() {
  const [search, setSearch] = useState("");
  const pageSize = 25;
  const [isSaving, setIsSaving] = useState(false);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);

  const [formData, setFormData] = useState<Partial<CustomerItem>>({
    companyName: "",
    contactName: "",
    phoneNumber: "",
    address: "",
    customerType: "Corporate",
  });

  const debouncedSearch = useDebouncedValue(search, 300);

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
    setItems,
    setTotalCount,
  } = useInfiniteList<CustomerItem, HTMLDivElement, HTMLTableRowElement>({
    fetchPage: (pageNumber, size) => fetchCustomerCenter(pageNumber, size, term),
    pageSize,
    resetKey: term,
    getId: (c) => c?.id,
  });

  // Live updates so another user's add/edit/delete shows up here without a
  // manual reload.
  const handleRealtimeUpdate = useCallback(() => {
    invalidateCachePrefix("customers");
    void loadData();
  }, [loadData]);

  useRealtimeResource("customer", handleRealtimeUpdate);

  const handleOpenAdd = () => {
    setSelectedCustomer(null);
    setFormData({
      companyName: "",
      contactName: "",
      phoneNumber: "",
      address: "",
      customerType: "Corporate",
    });
    setShowModal(true);
  };

  const handleOpenEdit = (customer: CustomerItem) => {
    setSelectedCustomer(customer);
    setFormData({ ...customer });
    setShowModal(true);
  };

  const handleOpenDelete = (customer: CustomerItem) => {
    setSelectedCustomer(customer);
    setShowDeleteConfirm(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName?.trim()) return;

    setIsSaving(true);
    let success = false;

    if (selectedCustomer?.id) {
      // Edit
      success = await updateCustomer(selectedCustomer.id, formData);
    } else {
      // Add
      success = await createCustomer(formData);
    }

    setIsSaving(false);

    if (success) {
      setShowModal(false);
      void loadData();
    } else {
      // Optimistic update fallback
      if (selectedCustomer?.id) {
        setItems((prev) =>
          prev.map((c) => (c.id === selectedCustomer.id ? { ...c, ...formData } as CustomerItem : c))
        );
      } else {
        const newTemp: CustomerItem = {
          id: "temp-" + Date.now(),
          companyName: formData.companyName || "",
          contactName: formData.contactName || "—",
          phoneNumber: formData.phoneNumber || "—",
          address: formData.address || "—",
          customerType: formData.customerType || "Corporate",
          isActive: true,
        };
        setItems((prev) => [newTemp, ...prev]);
        setTotalCount((prev) => prev + 1);
      }
      setShowModal(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedCustomer?.id) return;

    setIsSaving(true);
    const success = await deleteCustomer(selectedCustomer.id);
    setIsSaving(false);

    if (success) {
      setShowDeleteConfirm(false);
      void loadData();
    } else {
      // Optimistic deletion fallback
      setItems((prev) => prev.filter((c) => c.id !== selectedCustomer.id));
      setTotalCount((prev) => Math.max(prev - 1, 0));
      setShowDeleteConfirm(false);
    }
  };

  // No client-side re-filtering — `fetchCustomerCenter` already applies the
  // search server-side. Re-filtering the loaded rows (against the undebounced
  // term) hid rows mid-keystroke and capped results at one page.

  return (
    <PageWrapper
      title="Customer Center"
      subtitle="Directory of corporate clients, contact persons, and active maintenance service records (CustomerList.razor)"
    >
      <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search company, contact person, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64 md:w-80 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              />
            </div>

            <button
              onClick={() => void loadData()}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors dark:text-slate-400 dark:hover:bg-slate-800"
              title="Reload Customer API"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Customer</span>
          </button>
        </div>

        {/* Table Content — also the IntersectionObserver root for infinite scroll */}
        <div ref={scrollRootRef} className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 sm:py-3 px-4">Company Name</th>
                <th className="py-2.5 sm:py-3 px-4">Contact Person</th>
                <th className="py-2.5 sm:py-3 px-4">Phone Number</th>
                <th className="py-2.5 sm:py-3 px-4">Address</th>
                <th className="py-2.5 sm:py-3 px-4 text-center">Customer Type</th>
                <th className="py-2.5 sm:py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td colSpan={6} className="py-3 px-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                    </td>
                  </tr>
                ))
              ) : items.length > 0 ? (
                items.map((c, idx) => (
                  <tr key={c.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 sm:py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                      <HighlightText text={c.companyName} query={search} />
                    </td>
                    <td className="py-2.5 sm:py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                      <HighlightText text={c.contactName || "—"} query={search} />
                    </td>
                    <td className="py-2.5 sm:py-3 px-4 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                      <HighlightText text={c.phoneNumber || "—"} query={search} />
                    </td>
                    <td className="py-2.5 sm:py-3 px-4 text-slate-500 dark:text-slate-400">
                      <HighlightText text={c.address || "—"} query={search} />
                    </td>
                    <td className="py-2.5 sm:py-3 px-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900">
                        {c.customerType || "Corporate"}
                      </span>
                    </td>
                    <td className="py-2.5 sm:py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-slate-800"
                          title="Edit Customer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(c)}
                          className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-slate-800"
                          title="Delete Customer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No customer records found matching your search.
                  </td>
                </tr>
              )}

              {/* Infinite-scroll sentinel — observing this row pulls the next batch. */}
              {!isLoading && items.length > 0 && (
                <tr ref={sentinelRef}>
                  <td colSpan={6} className="py-4 text-center">
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
            {items.length === 1 ? "customer" : "customers"}
            {term && <> matching &ldquo;{term}&rdquo;</>}
          </span>
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {selectedCustomer ? "Edit Customer" : "Add New Customer"}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedCustomer ? selectedCustomer.companyName : "Enter client profile details"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitForm} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Company Name *</label>
                  <div className="relative">
                    <Building2 className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={formData.companyName || ""}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      placeholder="e.g. Canadia Bank Plc"
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Contact Person</label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={formData.contactName || ""}
                        onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                        placeholder="e.g. Mr. Sokha"
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Phone Number</label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={formData.phoneNumber || ""}
                        onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                        placeholder="e.g. 023 888 999"
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Address</label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                    <textarea
                      rows={2}
                      value={formData.address || ""}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="e.g. #315, Monivong Blvd, Phnom Penh"
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Customer Type</label>
                  <select
                    value={formData.customerType || "Corporate"}
                    onChange={(e) => setFormData({ ...formData, customerType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    <option value="Corporate">Corporate</option>
                    <option value="Individual">Individual</option>
                    <option value="Government">Government</option>
                    <option value="VIP">VIP</option>
                  </select>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="sticky bottom-0 z-20 px-5 py-3.5 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSaving ? "Saving..." : selectedCustomer ? "Save Changes" : "Create Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedCustomer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteConfirm(false); }}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 my-auto">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Delete Customer Record</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Are you sure you want to delete <strong className="text-slate-800 dark:text-slate-200">{selectedCustomer.companyName}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isSaving}
                className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 rounded-xl hover:bg-rose-700 shadow-md shadow-rose-500/20 transition-all disabled:opacity-60"
              >
                {isSaving ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
