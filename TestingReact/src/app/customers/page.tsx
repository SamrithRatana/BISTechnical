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
import { useSearchQueryParam } from "@/hooks/useSearchQueryParam";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { useSearchAction } from "@/hooks/useSearchAction";
import { useActionHandler, type ActionValues } from "@/components/ActionBus";
import { useI18n } from "@/i18n/LanguageProvider";
import InfiniteScrollStatus from "@/components/InfiniteScrollStatus";
import { ModalWrapper } from "@/components/av/ModalWrapper";

export default function CustomerCenterPage() {
  const { t } = useI18n();
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
    customerType: "Corporate"
  });

  // Seed from ?q= when arriving via the header's global search.
  useSearchQueryParam(setSearch);

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
    setTotalCount
  } = useInfiniteList<CustomerItem, HTMLDivElement, HTMLTableRowElement>({
    fetchPage: (pageNumber, size) => fetchCustomerCenter(pageNumber, size, term),
    pageSize,
    resetKey: term,
    getId: (c) => c?.id
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
      customerType: "Corporate"
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

  // ── Actions requested from elsewhere (the AI assistant today) ────────────
  //
  // Each one opens the dialog its row button opens, with whatever fields the
  // user dictated already typed in. The Save and Delete clicks stay theirs —
  // nothing here submits.
  const findCustomer = useCallback(
    (ref?: string): CustomerItem | null => {
      if (!ref) return null;
      const needle = ref.trim().toLowerCase();
      const match = (value?: string | null) => value?.trim().toLowerCase() === needle;
      return (
        items.find((c) => match(c.companyName)) ??
        items.find((c) => match(c.contactName) || match(c.phoneNumber)) ??
        // Last resort: a partial company name, since people rarely type one in full.
        items.find((c) => c.companyName?.toLowerCase().includes(needle)) ??
        null
      );
    },
    [items]
  );

  const customerFormPatch = (values?: ActionValues): Partial<CustomerItem> => {
    if (!values) return {};
    const patch: Partial<CustomerItem> = {};
    if (values.companyName?.trim()) patch.companyName = values.companyName.trim();
    if (values.contactName?.trim()) patch.contactName = values.contactName.trim();
    if (values.phoneNumber?.trim()) patch.phoneNumber = values.phoneNumber.trim();
    if (values.address?.trim()) patch.address = values.address.trim();
    if (values.customerType?.trim()) {
      patch.customerType = /individual|person|ឯកជន/i.test(values.customerType)
        ? "Individual"
        : "Corporate";
    }
    return patch;
  };

  useActionHandler("customer.create", (_ref, values) => {
    handleOpenAdd();
    setFormData((prev) => ({ ...prev, ...customerFormPatch(values) }));
    return true;
  });

  useActionHandler(
    "customer.edit",
    (ref, values) => {
      const customer = findCustomer(ref);
      if (!customer) return false;
      handleOpenEdit(customer);
      // Applied over the stored record, so fields the user didn't mention keep
      // their current values.
      setFormData((prev) => ({ ...prev, ...customerFormPatch(values) }));
      return true;
    },
    items.length
  );

  useActionHandler(
    "customer.delete",
    (ref) => {
      const customer = findCustomer(ref);
      if (!customer) return false;
      handleOpenDelete(customer);
      return true;
    },
    items.length
  );

  useSearchAction(setSearch);

  // Closes whatever this page currently has open — the same thing Cancel or X
  // does, discarding anything typed. Always reports success: the request is
  // "leave nothing open", and that is true afterwards whether or not a dialog
  // happened to be showing.
  useActionHandler("ui.dialog.close", () => {
    setShowModal(false);
    setShowDeleteConfirm(false);
    return true;
  });

  useActionHandler("ui.refresh", () => {
    invalidateCachePrefix("customers");
    void loadData();
    return true;
  });

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
          isActive: true
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
      titleKey="nav.customerCenter"
      subtitleKey="sub.customers"
    >
      <div className="flex-1 flex flex-col min-h-0 bg-surface border border-subtle/80 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-subtle flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                placeholder={t("cust.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-xs border border-subtle rounded-xl bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent w-64 md:w-80 "
              />
            </div>

            <button
              onClick={() => void loadData()}
              className="p-2 text-ink-secondary hover:bg-sunken rounded-xl transition-colors "
              title={t("cust.reload")}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-accent rounded-xl hover:bg-accent-hover transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t("cust.addNew")}</span>
          </button>
        </div>

        {/* Table Content — also the IntersectionObserver root for infinite scroll */}
        <div ref={scrollRootRef} className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-cushion border-b border-subtle/80 text-[11px] font-bold text-ink-secondary uppercase tracking-wider">
                <th className="py-2.5 sm:py-3 px-4">{t("field.companyName")}</th>
                <th className="py-2.5 sm:py-3 px-4">{t("cust.contactPerson")}</th>
                <th className="py-2.5 sm:py-3 px-4">{t("field.phoneNumber")}</th>
                <th className="py-2.5 sm:py-3 px-4">{t("field.address")}</th>
                <th className="py-2.5 sm:py-3 px-4 text-center">{t("cust.customerType")}</th>
                <th className="py-2.5 sm:py-3 px-4 text-center">{t("field.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle text-ink ">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td colSpan={6} className="py-3 px-4">
                      <div className="h-4 bg-sunken rounded w-full"></div>
                    </td>
                  </tr>
                ))
              ) : items.length > 0 ? (
                items.map((c, idx) => (
                  <tr key={c.id || idx} className="hover:bg-cushion transition-colors">
                    <td className="py-2.5 sm:py-3 px-4 font-bold text-ink ">
                      <HighlightText text={c.companyName} query={search} />
                    </td>
                    <td className="py-2.5 sm:py-3 px-4 font-medium text-ink ">
                      <HighlightText text={c.contactName || "—"} query={search} />
                    </td>
                    <td className="py-2.5 sm:py-3 px-4 text-ink-secondary font-mono text-[11px]">
                      <HighlightText text={c.phoneNumber || "—"} query={search} />
                    </td>
                    <td className="py-2.5 sm:py-3 px-4 text-ink-secondary ">
                      <HighlightText text={c.address || "—"} query={search} />
                    </td>
                    <td className="py-2.5 sm:py-3 px-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-info-soft text-info-fg border border-info ">
                        {c.customerType || "Corporate"}
                      </span>
                    </td>
                    <td className="py-2.5 sm:py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="p-1.5 text-ink-secondary hover:text-accent hover:bg-accent-soft rounded-lg transition-colors "
                          title={t("cust.edit")}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(c)}
                          className="p-1.5 text-ink-secondary hover:text-danger hover:bg-danger-soft rounded-lg transition-colors "
                          title={t("cust.delete")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-ink-muted">
                    {t("cust.empty")}
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
        <div className="p-4 border-t border-subtle bg-cushion/50 flex items-center justify-between shrink-0">
          <span className="text-xs text-ink-secondary ">
            Loaded <strong className="text-ink ">{items.length}</strong>
            {totalCount > items.length && (
              <> of <strong className="text-ink ">{totalCount}</strong></>
            )}{" "}
            {items.length === 1 ? "customer" : "customers"}
            {term && <> matching &ldquo;{term}&rdquo;</>}
          </span>
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      <ModalWrapper
        open={showModal}
        onClose={() => setShowModal(false)}
        maxWidth="max-w-lg"
        zIndex={50}
        placement="center"
        backdropVariant="heavy"
      >
        <div className="bg-surface border border-subtle w-full rounded-2xl overflow-hidden flex flex-col max-h-[var(--av-modal-inner-maxh)]">
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-subtle flex items-center justify-between bg-cushion/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-info-soft text-info flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-ink">
                    {selectedCustomer ? t("cust.edit") : t("cust.addNew")}
                  </h2>
                  <p className="text-xs text-ink-secondary">
                    {selectedCustomer ? selectedCustomer.companyName : t("cust.enterProfile")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-sunken transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitForm} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-ink">{t("field.companyName")} *</label>
                  <div className="relative">
                    <Building2 className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                    <input
                      type="text"
                      required
                      value={formData.companyName || ""}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      placeholder={t("cust.egCompany")}
                      className="w-full pl-9 pr-3 py-2 border border-subtle rounded-xl bg-surface focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-ink">{t("cust.contactPerson")}</label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                      <input
                        type="text"
                        value={formData.contactName || ""}
                        onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                        placeholder={t("cust.egContact")}
                        className="w-full pl-9 pr-3 py-2 border border-subtle rounded-xl bg-surface focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-ink">{t("field.phoneNumber")}</label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                      <input
                        type="text"
                        value={formData.phoneNumber || ""}
                        onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                        placeholder={t("cust.egPhone")}
                        className="w-full pl-9 pr-3 py-2 border border-subtle rounded-xl bg-surface focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-ink">{t("field.address")}</label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 absolute left-3 top-3 text-ink-muted" />
                    <textarea
                      rows={2}
                      value={formData.address || ""}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder={t("cust.egAddress")}
                      className="w-full pl-9 pr-3 py-2 border border-subtle rounded-xl bg-surface focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-ink">{t("cust.customerType")}</label>
                  <select
                    value={formData.customerType || "Corporate"}
                    onChange={(e) => setFormData({ ...formData, customerType: e.target.value })}
                    className="w-full px-3 py-2 border border-subtle rounded-xl bg-surface focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none"
                  >
                    <option value="Corporate">{t("cust.typeCorporate")}</option>
                    <option value="Individual">{t("cust.typeIndividual")}</option>
                    <option value="Government">{t("cust.typeGovernment")}</option>
                    <option value="VIP">{t("cust.typeVip")}</option>
                  </select>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="sticky bottom-0 z-20 px-5 py-3.5 bg-cushion/90 backdrop-blur border-t border-subtle flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-ink bg-surface border border-subtle rounded-xl hover:bg-sunken transition-colors shadow-sm"
                >
                  {t("action.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-accent rounded-xl hover:bg-accent-hover shadow-md shadow-accent/20 transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSaving ? t("action.saving") : selectedCustomer ? t("detail.saveChanges") : t("cust.create")}
                </button>
              </div>
            </form>
          </div>
      </ModalWrapper>

      {/* Delete Confirmation Modal */}
      <ModalWrapper
        open={showDeleteConfirm && !!selectedCustomer}
        onClose={() => setShowDeleteConfirm(false)}
        maxWidth="max-w-md"
        zIndex={50}
        placement="center"
        backdropVariant="heavy"
        isAlert
      >
        <div className="p-6 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-danger-soft text-danger flex items-center justify-center mx-auto">
            <Trash2 className="w-6 h-6" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-sm font-bold text-ink">{t("cust.deleteTitle")}</h3>
            <p className="text-xs text-ink-secondary">
              {t("cust.deleteBody", { name: selectedCustomer?.companyName ?? "" })}
            </p>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-subtle">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 text-xs font-semibold text-ink bg-sunken rounded-xl hover:bg-sunken transition-colors"
            >
              {t("action.cancel")}
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={isSaving}
              className="px-5 py-2 text-xs font-semibold text-white bg-danger rounded-xl hover:bg-danger shadow-md transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] disabled:opacity-60"
            >
              {isSaving ? t("table.deleting") : t("table.confirmDelete")}
            </button>
          </div>
        </div>
      </ModalWrapper>
    </PageWrapper>
  );
}
