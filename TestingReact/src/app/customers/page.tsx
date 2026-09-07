"use client";

/**
 * @file customers/page.tsx
 * @description Customer Center page — matches CustomerList.razor.
 * Full CRUD Integration:
 *  - GET: fetchCustomerCenter()
 *  - POST: createCustomer()
 *  - PUT: updateCustomer()
 *  - DELETE: deleteCustomer()
 * Fully integrates the unified Enterprise Ribbon CRUD & DataLayout system.
 */

import React, { useState, useCallback, useMemo, useEffect } from "react";
import PageWrapper from "@/components/PageWrapper";
import { Search, Plus, RefreshCw, Edit3, Trash2, X, Save, Building2, User, Phone, MapPin, Printer, Download, Eye } from "lucide-react";
import { fetchCustomerCenter, fetchCustomerTypes, createCustomer, updateCustomer, deleteCustomer, invalidateCachePrefix, type CustomerItem, type CustomerTypeItem } from "@/services/api";
import { useRealtimeResource } from "@/hooks/useRealtimeTickets";
import HighlightText from "@/components/HighlightText";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSearchQueryParam } from "@/hooks/useSearchQueryParam";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { useSearchAction } from "@/hooks/useSearchAction";
import { useActionHandler, type ActionValues } from "@/components/ActionBus";
import toast from "react-hot-toast";
import { useI18n } from "@/i18n/LanguageProvider";
import { firstValidationMessage } from "@/i18n/validationMessage";
import { validatePortalCustomer } from "@/validation";
import InfiniteScrollStatus from "@/components/InfiniteScrollStatus";
import { ModalWrapper } from "@/components/av/ModalWrapper";
import { useTheme } from "@/theme/ThemeProvider";
import EnterpriseRibbonToolbar from "@/components/crud/EnterpriseRibbonToolbar";
import ColumnVisibilityDropdown, { type ColumnDefinition } from "@/components/crud/ColumnVisibilityDropdown";
import ColumnHeaderFilter from "@/components/crud/ColumnHeaderFilter";
import { cn } from "@/lib/utils";

export default function CustomerCenterPage() {
  const { t, lang } = useI18n();
  const { prefs } = useTheme();
  const crudStyle = prefs.crudStyle || "enterprise-ribbon";
  const isRibbonMode = crudStyle === "enterprise-ribbon";

  const [search, setSearch] = useState("");
  const pageSize = 25;
  const [isSaving, setIsSaving] = useState(false);
  const [checkedRow, setCheckedRow] = useState<CustomerItem | null>(null);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);

  const [customerTypes, setCustomerTypes] = useState<CustomerTypeItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchCustomerTypes().then((types) => {
      if (!cancelled) setCustomerTypes(types);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const [formData, setFormData] = useState<Partial<CustomerItem>>({
    companyName: "",
    contactName: "",
    phoneNumber: "",
    address: "",
    customerType: "",
    customerTypeListId: null,
  });

  // Column definitions for ColumnVisibilityDropdown
  const [columnsState, setColumnsState] = useState<ColumnDefinition[]>([
    { key: "companyName", label: t("field.companyName"), visible: true, permanent: true },
    { key: "contactName", label: t("cust.contactPerson"), visible: true },
    { key: "phoneNumber", label: t("field.phoneNumber"), visible: true },
    { key: "address", label: t("field.address"), visible: true },
    { key: "customerType", label: t("cust.customerType"), visible: true },
    { key: "actions", label: t("field.actions"), visible: true, permanent: true },
  ]);

  useEffect(() => {
    setColumnsState((prev) =>
      prev.map((c) => {
        if (c.key === "companyName") return { ...c, label: t("field.companyName") };
        if (c.key === "contactName") return { ...c, label: t("cust.contactPerson") };
        if (c.key === "phoneNumber") return { ...c, label: t("field.phoneNumber") };
        if (c.key === "address") return { ...c, label: t("field.address") };
        if (c.key === "customerType") return { ...c, label: t("cust.customerType") };
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
    setTotalCount,
  } = useInfiniteList<CustomerItem, HTMLDivElement, HTMLTableRowElement>({
    fetchPage: (pageNumber, size) => fetchCustomerCenter(pageNumber, size, term),
    pageSize,
    resetKey: `customers:${term}`,
    getId: (c) => c?.id,
  });

  // Client-side filtering and sorting for active displayed items
  const displayedItems = useMemo(() => {
    let list = items;

    // Apply column-level filters
    const filterKeys = Object.keys(columnFilters);
    if (filterKeys.length > 0) {
      list = list.filter((c) => {
        return filterKeys.every((key) => {
          const filterVal = columnFilters[key];
          if (!filterVal) return true;
          let cellVal = "";
          if (key === "companyName") cellVal = c.companyName || "";
          else if (key === "contactName") cellVal = c.contactName || "";
          else if (key === "phoneNumber") cellVal = c.phoneNumber || "";
          else if (key === "address") cellVal = c.address || "";
          else if (key === "customerType") cellVal = c.customerType || "";
          return cellVal.toLowerCase().includes(filterVal);
        });
      });
    }

    // Apply sorting
    if (sortConfig) {
      list = [...list].sort((a, b) => {
        let valA = "";
        let valB = "";
        if (sortConfig.field === "companyName") {
          valA = a.companyName || "";
          valB = b.companyName || "";
        } else if (sortConfig.field === "contactName") {
          valA = a.contactName || "";
          valB = b.contactName || "";
        } else if (sortConfig.field === "phoneNumber") {
          valA = a.phoneNumber || "";
          valB = b.phoneNumber || "";
        } else if (sortConfig.field === "address") {
          valA = a.address || "";
          valB = b.address || "";
        } else if (sortConfig.field === "customerType") {
          valA = a.customerType || "";
          valB = b.customerType || "";
        }
        const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: "base" });
        return sortConfig.direction === "asc" ? cmp : -cmp;
      });
    }

    return list;
  }, [items, columnFilters, sortConfig]);

  // Live updates so another user's add/edit/delete shows up here without a manual reload.
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
      customerType: "",
      customerTypeListId: null,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (customer: CustomerItem) => {
    setSelectedCustomer(customer);
    setFormData({
      ...customer,
      customerType: customer.customerType || "",
      customerTypeListId: customer.customerTypeListId ?? null,
    });
    setShowModal(true);
  };

  const handleOpenDelete = (customer: CustomerItem) => {
    setSelectedCustomer(customer);
    setShowDeleteConfirm(true);
  };

  const handlePrintCustomer = useCallback((customer?: CustomerItem | null) => {
    const target = customer || checkedRow;
    if (!target) {
      toast(
        lang === "km"
          ? "សូមជ្រើសរើសទិន្នន័យ (Row) ក្នុងតារាងដើម្បីបោះពុម្ព (Print)"
          : "Please select a customer record in the table first",
        { icon: "ℹ️" }
      );
      return;
    }
    window.print();
  }, [checkedRow, lang]);

  const handleExportCSV = useCallback(() => {
    if (items.length === 0) {
      toast.error(lang === "km" ? "មិនមានទិន្នន័យសម្រាប់ទាញយកទេ" : "No data to export");
      return;
    }
    const headers = ["Company Name", "Contact Person", "Phone Number", "Address", "Customer Type"];
    const rows = items.map((c) => [
      `"${(c.companyName || "").replace(/"/g, '""')}"`,
      `"${(c.contactName || "").replace(/"/g, '""')}"`,
      `"${(c.phoneNumber || "").replace(/"/g, '""')}"`,
      `"${(c.address || "").replace(/"/g, '""')}"`,
      `"${(c.customerType || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `customer-center-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(lang === "km" ? "បានទាញយក CSV ដោយជោគជ័យ" : "CSV exported successfully");
  }, [items, lang]);

  // Actions requested from elsewhere (the AI assistant)
  const findCustomer = useCallback(
    (ref?: string): CustomerItem | null => {
      if (!ref) return null;
      const needle = ref.trim().toLowerCase();
      const match = (value?: string | null) => value?.trim().toLowerCase() === needle;
      return (
        items.find((c) => match(c.companyName)) ??
        items.find((c) => match(c.contactName) || match(c.phoneNumber)) ??
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
      const typeStr = values.customerType.trim();
      const matched = customerTypes.find(
        (ct) =>
          ct.type.toLowerCase() === typeStr.toLowerCase() ||
          String(ct.listId) === typeStr
      );
      if (matched) {
        patch.customerType = matched.type;
        patch.customerTypeListId = matched.listId;
      } else {
        patch.customerType = typeStr;
      }
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

  useActionHandler("export.csv", () => {
    if (items.length === 0) return false;
    handleExportCSV();
    return true;
  }, items.length);

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = validatePortalCustomer({
      companyName: formData.companyName,
      contactName: formData.contactName,
      phoneNumber: formData.phoneNumber,
    });
    if (!check.isValid) {
      toast.error(firstValidationMessage(check, t), { position: "bottom-right" });
      return;
    }

    setIsSaving(true);
    let success = false;

    if (selectedCustomer?.id) {
      success = await updateCustomer(selectedCustomer.id, formData);
    } else {
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
          prev.map((c) => (c.id === selectedCustomer.id ? ({ ...c, ...formData } as CustomerItem) : c))
        );
      } else {
        const newTemp: CustomerItem = {
          id: "temp-" + Date.now(),
          companyName: formData.companyName || "",
          contactName: formData.contactName || "—",
          phoneNumber: formData.phoneNumber || "—",
          address: formData.address || "—",
          customerType: formData.customerType || "",
          customerTypeListId: formData.customerTypeListId ?? null,
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
      setCheckedRow(null);
      void loadData();
    } else {
      // Optimistic deletion fallback
      setItems((prev) => prev.filter((c) => c.id !== selectedCustomer.id));
      setTotalCount((prev) => Math.max(prev - 1, 0));
      setShowDeleteConfirm(false);
      setCheckedRow(null);
    }
  };

  return (
    <PageWrapper
      titleKey="nav.customerCenter"
      subtitleKey="sub.customers"
    >
      <div className="flex-1 flex flex-col min-h-0 bg-surface border border-subtle/80 rounded-2xl shadow-sm overflow-hidden">
        {/* Unified Table Toolbar */}
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
            onPrint={() => handlePrintCustomer(checkedRow)}
            onExportCsv={handleExportCSV}
            onReload={() => {
              invalidateCachePrefix("customers");
              void loadData();
            }}
            searchTerm={search}
            onSearchChange={setSearch}
            onSearchSubmit={() => {
              invalidateCachePrefix("customers");
              void loadData();
            }}
            onSearchClear={() => setSearch("")}
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
          <div className="p-4 border-b border-subtle flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  type="text"
                  placeholder={t("cust.searchPlaceholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 text-xs border border-subtle rounded-xl bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent w-64 md:w-80"
                />
              </div>

              <button
                onClick={() => {
                  invalidateCachePrefix("customers");
                  void loadData();
                }}
                className="p-2 text-ink-secondary hover:bg-sunken rounded-xl transition-colors"
                title={t("cust.reload")}
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
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-accent rounded-xl hover:bg-accent-hover transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t("cust.addNew")}</span>
              </button>

              <button
                type="button"
                onClick={() => handlePrintCustomer(checkedRow)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors shadow-sm text-ink bg-surface border border-subtle hover:bg-cushion cursor-pointer"
                title={t("crud.print")}
              >
                <Printer className="w-3.5 h-3.5 text-accent" />
                <span>{t("crud.print")}</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-ink bg-surface border border-subtle rounded-xl hover:bg-cushion transition-colors shadow-sm cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t("action.export")}</span>
              </button>
            </div>
          </div>
        )}

        {/* Table Content — also the IntersectionObserver root for infinite scroll */}
        <div ref={scrollRootRef} className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
          <table className="w-full text-left border-collapse min-w-full text-xs">
            <thead className="sticky top-0 z-20 shadow-2xs">
              <tr className="bg-cushion border-b border-subtle/80 text-[10.5px] lg:text-[10.5px] xl:text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">
                {isRibbonMode && (
                  <th className="sticky top-0 z-20 bg-cushion py-2.5 px-2 text-center w-10 min-w-[40px]">
                    <span className="sr-only">Select</span>
                  </th>
                )}
                {isColVisible("companyName") && (
                  <th className="py-2.5 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{t("field.companyName")}</span>
                      <ColumnHeaderFilter
                        label={t("field.companyName")}
                        field="companyName"
                        filterValue={columnFilters["companyName"]}
                        onFilterChange={(v) => handleColumnFilterChange("companyName", v)}
                        sortDirection={sortConfig?.field === "companyName" ? sortConfig.direction : null}
                        onSortChange={(d) => handleColumnSortChange("companyName", d)}
                      />
                    </div>
                  </th>
                )}
                {isColVisible("contactName") && (
                  <th className="py-2.5 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{t("cust.contactPerson")}</span>
                      <ColumnHeaderFilter
                        label={t("cust.contactPerson")}
                        field="contactName"
                        filterValue={columnFilters["contactName"]}
                        onFilterChange={(v) => handleColumnFilterChange("contactName", v)}
                        sortDirection={sortConfig?.field === "contactName" ? sortConfig.direction : null}
                        onSortChange={(d) => handleColumnSortChange("contactName", d)}
                      />
                    </div>
                  </th>
                )}
                {isColVisible("phoneNumber") && (
                  <th className="py-2.5 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{t("field.phoneNumber")}</span>
                      <ColumnHeaderFilter
                        label={t("field.phoneNumber")}
                        field="phoneNumber"
                        filterValue={columnFilters["phoneNumber"]}
                        onFilterChange={(v) => handleColumnFilterChange("phoneNumber", v)}
                        sortDirection={sortConfig?.field === "phoneNumber" ? sortConfig.direction : null}
                        onSortChange={(d) => handleColumnSortChange("phoneNumber", d)}
                      />
                    </div>
                  </th>
                )}
                {isColVisible("address") && (
                  <th className="py-2.5 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{t("field.address")}</span>
                      <ColumnHeaderFilter
                        label={t("field.address")}
                        field="address"
                        filterValue={columnFilters["address"]}
                        onFilterChange={(v) => handleColumnFilterChange("address", v)}
                        sortDirection={sortConfig?.field === "address" ? sortConfig.direction : null}
                        onSortChange={(d) => handleColumnSortChange("address", d)}
                      />
                    </div>
                  </th>
                )}
                {isColVisible("customerType") && (
                  <th className="py-2.5 px-4 text-center whitespace-nowrap min-w-[140px]">
                    <div className="flex items-center justify-center gap-1.5">
                      <span>{t("cust.customerType")}</span>
                      <ColumnHeaderFilter
                        label={t("cust.customerType")}
                        field="customerType"
                        filterValue={columnFilters["customerType"]}
                        onFilterChange={(v) => handleColumnFilterChange("customerType", v)}
                        sortDirection={sortConfig?.field === "customerType" ? sortConfig.direction : null}
                        onSortChange={(d) => handleColumnSortChange("customerType", d)}
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
                displayedItems.map((c, idx) => {
                  const isSelected = checkedRow?.id === c.id;
                  return (
                    <tr
                      key={c.id || idx}
                      onClick={() => setCheckedRow(isSelected ? null : c)}
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
                            onChange={() => setCheckedRow(isSelected ? null : c)}
                            className="w-4 h-4 rounded text-accent focus:ring-accent border-subtle cursor-pointer accent-accent transition-transform hover:scale-105"
                            aria-label="Select row"
                          />
                        </td>
                      )}
                      {isColVisible("companyName") && (
                        <td className="py-2.5 sm:py-3 px-4 font-bold text-ink">
                          <HighlightText text={c.companyName} query={search} />
                        </td>
                      )}
                      {isColVisible("contactName") && (
                        <td className="py-2.5 sm:py-3 px-4 font-medium text-ink">
                          <HighlightText text={c.contactName || "—"} query={search} />
                        </td>
                      )}
                      {isColVisible("phoneNumber") && (
                        <td className="py-2.5 sm:py-3 px-4 text-ink-secondary font-mono text-[11px]">
                          <HighlightText text={c.phoneNumber || "—"} query={search} />
                        </td>
                      )}
                      {isColVisible("address") && (
                        <td className="py-2.5 sm:py-3 px-4 text-ink-secondary">
                          <HighlightText text={c.address || "—"} query={search} />
                        </td>
                      )}
                      {isColVisible("customerType") && (
                        <td className="py-2.5 sm:py-3 px-4 text-center whitespace-nowrap min-w-[140px]">
                          {c.customerType ? (
                            <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-2xs whitespace-nowrap">
                              {c.customerType}
                            </span>
                          ) : (
                            <span className="text-xs text-ink-muted">—</span>
                          )}
                        </td>
                      )}
                      {isColVisible("actions") && (
                        <td className="py-2.5 sm:py-3 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            {isRibbonMode ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(c)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-950/40 border border-sky-200/80 dark:border-sky-800/40 transition-colors shadow-2xs cursor-pointer"
                                  title={t("crud.viewDetails")}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>{t("crud.viewDetails")}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePrintCustomer(c)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-accent hover:bg-accent-soft border border-accent/30 transition-colors shadow-2xs cursor-pointer"
                                  title={t("crud.print")}
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>{t("crud.print")}</span>
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(c)}
                                  className="p-1.5 text-ink-secondary hover:text-accent hover:bg-accent-soft rounded-lg transition-colors cursor-pointer"
                                  title={t("cust.edit")}
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenDelete(c)}
                                  className="p-1.5 text-ink-secondary hover:text-danger hover:bg-danger-soft rounded-lg transition-colors cursor-pointer"
                                  title={t("cust.delete")}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePrintCustomer(c)}
                                  className="p-1.5 text-ink-secondary hover:text-accent hover:bg-accent-soft rounded-lg transition-colors cursor-pointer"
                                  title={t("crud.print")}
                                >
                                  <Printer className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={columnsState.filter((c) => c.visible).length + (isRibbonMode ? 1 : 0)}
                    className="py-12 text-center text-ink-muted"
                  >
                    {t("cust.empty")}
                  </td>
                </tr>
              )}

              {/* Infinite-scroll sentinel — observing this row pulls the next batch. */}
              {!isLoading && items.length > 0 && (
                <tr ref={sentinelRef}>
                  <td colSpan={columnsState.filter((c) => c.visible).length + (isRibbonMode ? 1 : 0)} className="py-4 text-center">
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

        {/* Status Bar */}
        <div className="p-3 sm:p-3.5 border-t border-subtle bg-cushion/50 flex items-center justify-between shrink-0">
          <span className="text-xs text-ink-secondary">
            Loaded <strong className="text-ink">{items.length}</strong>
            {totalCount > items.length && (
              <> of <strong className="text-ink">{totalCount}</strong></>
            )}{" "}
            {items.length === 1 ? "customer" : "customers"}
            {term && <> matching &ldquo;{term}&rdquo;</>}
          </span>
          {checkedRow && (
            <span className="text-xs font-medium text-accent">
              1 {lang === "km" ? "បានជ្រើសរើស" : "selected"}: {checkedRow.companyName}
            </span>
          )}
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
                  value={
                    formData.customerTypeListId != null
                      ? String(formData.customerTypeListId)
                      : (formData.customerType || "")
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) {
                      setFormData({ ...formData, customerType: "", customerTypeListId: null });
                      return;
                    }
                    const matched = customerTypes.find(
                      (ct) => String(ct.listId) === val || ct.type === val
                    );
                    if (matched) {
                      setFormData({
                        ...formData,
                        customerType: matched.type,
                        customerTypeListId: matched.listId,
                      });
                    } else {
                      setFormData({ ...formData, customerType: val, customerTypeListId: null });
                    }
                  }}
                  className="w-full px-3 py-2 border border-subtle rounded-xl bg-surface focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none text-sm text-ink cursor-pointer"
                >
                  <option value="">{lang === "km" ? "— មិនបានកំណត់ (Unassigned) —" : "— None / Unassigned —"}</option>
                  {customerTypes.map((ct) => (
                    <option key={ct.listId} value={String(ct.listId)}>
                      {ct.type}
                    </option>
                  ))}
                  {formData.customerType &&
                    !customerTypes.some(
                      (ct) =>
                        ct.type === formData.customerType ||
                        (formData.customerTypeListId != null && ct.listId === formData.customerTypeListId)
                    ) && (
                      <option value={formData.customerType}>
                        {formData.customerType}
                      </option>
                    )}
                </select>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="sticky bottom-0 z-20 px-5 py-3.5 bg-cushion/90 backdrop-blur border-t border-subtle flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-semibold text-ink bg-surface border border-subtle rounded-xl hover:bg-sunken transition-colors shadow-sm cursor-pointer"
              >
                {t("action.cancel")}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-accent rounded-xl hover:bg-accent-hover shadow-md shadow-accent/20 transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] disabled:opacity-60 cursor-pointer"
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
              className="px-4 py-2 text-xs font-semibold text-ink bg-sunken rounded-xl hover:bg-sunken transition-colors cursor-pointer"
            >
              {t("action.cancel")}
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={isSaving}
              className="px-5 py-2 text-xs font-semibold text-white bg-danger rounded-xl hover:bg-danger shadow-md transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] disabled:opacity-60 cursor-pointer"
            >
              {isSaving ? t("table.deleting") : t("table.confirmDelete")}
            </button>
          </div>
        </div>
      </ModalWrapper>
    </PageWrapper>
  );
}
