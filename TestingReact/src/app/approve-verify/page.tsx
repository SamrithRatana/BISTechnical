"use client";

/**
 * @file approve-verify/page.tsx
 * @description Final QA & Verification queue prior to customer handover.
 * Fully integrates the unified Enterprise Ribbon CRUD & DataLayout system.
 *
 *  - Lists tickets with status "Repairing" — the work still waiting on a
 *    verifier. "Finished" tickets are excluded from the default view because
 *    they need no action; leaving them in meant the queue only grew, and the
 *    rows that needed someone were buried under everything ever verified.
 *  - Searching merges "Finished" back in, so a specific job can still be found
 *    by ref no, company or serial whichever side of verification it is on.
 *    Both rules live in `fetchApproveVerifyServices`.
 *  - "Verify" moves Repairing -> Finished via POST /api/proxy/finishedrepair.
 *    It is disabled on a Finished row: that ticket is complete, and verifying
 *    twice would overwrite the real finishedDate.
 *  - View details via ServiceDetailModal.
 */

import React, { useState, useCallback, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import PageWrapper from "@/components/PageWrapper";
import HighlightText from "@/components/HighlightText";
import { getActionUserForStatus, toBackendLocalDateTime } from "@/services/types";

const ServiceDetailModal = dynamic(() => import("@/components/ServiceDetailModal"), { ssr: false });
const PrintPreviewSidebar = dynamic(() => import("@/components/PrintPreviewSidebar"), { ssr: false });
import { getCurrentUserGuid } from "@/services/userService";
import { useRealtimeTickets } from "@/hooks/useRealtimeTickets";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSearchQueryParam } from "@/hooks/useSearchQueryParam";
import { useSafeTimeout } from "@/hooks/useSafeTimeout";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { useSearchAction } from "@/hooks/useSearchAction";
import InfiniteScrollStatus from "@/components/InfiniteScrollStatus";
import { useActionHandler } from "@/components/ActionBus";
import { useI18n } from "@/i18n/LanguageProvider";
import { translatePriority } from "@/i18n/statusLabel";
import { useTheme } from "@/theme/ThemeProvider";
import EnterpriseRibbonToolbar from "@/components/crud/EnterpriseRibbonToolbar";
import ColumnVisibilityDropdown, { type ColumnDefinition } from "@/components/crud/ColumnVisibilityDropdown";
import ColumnHeaderFilter from "@/components/crud/ColumnHeaderFilter";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import {
  fetchApproveVerifyServices,
  updateServiceStatus,
  type RepairServiceItem,
} from "@/services/api";
import {
  Search,
  RefreshCw,
  Eye,
  ShieldCheck,
  Download,
  CheckCircle,
  Loader2,
  Printer,
  Plus,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d?: string): string {
  if (!d) return "N/A";
  const dt = new Date(d);
  return `${dt.toLocaleDateString("en-GB")} ${dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

const PRIORITY_BADGE: Record<string, string> = {
  HIGH:   "bg-danger-soft text-danger-fg border-danger ",
  LOW:    "bg-success-soft text-success-fg border-success ",
  NORMAL: "bg-warning-soft text-warning-fg border-warning ",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ApproveVerifyPage() {
  const { t, lang } = useI18n();
  const { prefs } = useTheme();
  const crudStyle = prefs.crudStyle || "enterprise-ribbon";
  const isRibbonMode = crudStyle === "enterprise-ribbon";

  const [searchTerm, setSearchTerm] = useState("");
  const pageSize = 25;

  const [viewItem, setViewItem] = useState<RepairServiceItem | null>(null);
  const [printItem, setPrintItem] = useState<RepairServiceItem | null>(null);
  const [checkedRow, setCheckedRow] = useState<RepairServiceItem | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Column definitions for ColumnVisibilityDropdown
  const [columnsState, setColumnsState] = useState<ColumnDefinition[]>([
    { key: "refNo", label: t("field.refNo"), visible: true, permanent: true },
    { key: "finishedDate", label: t("queue.finishedDate"), visible: true },
    { key: "companyName", label: t("field.companyName"), visible: true },
    { key: "itemName", label: t("queue.itemModel"), visible: true },
    { key: "serialNumber", label: t("queue.serialNo"), visible: true },
    { key: "servicePriority", label: t("field.priority"), visible: true },
    { key: "technician", label: t("queue.technician"), visible: true },
    { key: "actions", label: t("field.actions"), visible: true, permanent: true },
  ]);

  // Keep column labels reactive to language switches
  useEffect(() => {
    setColumnsState((prev) =>
      prev.map((c) => {
        if (c.key === "refNo") return { ...c, label: t("field.refNo") };
        if (c.key === "finishedDate") return { ...c, label: t("queue.finishedDate") };
        if (c.key === "companyName") return { ...c, label: t("field.companyName") };
        if (c.key === "itemName") return { ...c, label: t("queue.itemModel") };
        if (c.key === "serialNumber") return { ...c, label: t("queue.serialNo") };
        if (c.key === "servicePriority") return { ...c, label: t("field.priority") };
        if (c.key === "technician") return { ...c, label: t("queue.technician") };
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

  // Cancelled on unmount
  const later = useSafeTimeout();
  const showToast = (msg: string) => {
    setToastMsg(msg);
    later(() => setToastMsg(null), 3000);
  };

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
  } = useInfiniteList<RepairServiceItem, HTMLDivElement, HTMLTableRowElement>({
    fetchPage: (pageNumber, size) => fetchApproveVerifyServices(pageNumber, size, term),
    pageSize,
    resetKey: `ApproveVerify|${term}`,
    getId: (i) => i?.id,
  });

  // Real-time auto-refresh
  const handleRealtimeUpdate = useCallback(() => { void loadData(); }, [loadData]);
  useRealtimeTickets("Repairing", handleRealtimeUpdate);

  /**
   * Verify action — calls POST /api/proxy/finishedrepair then updates
   * status to "Finished" (idempotent; just refreshes the row).
   */
  const handleVerify = async (row: RepairServiceItem) => {
    if (row.status !== "Repairing") return;
    setVerifyingId(row.id);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("jwt_token") : null;
      const userGuid = getCurrentUserGuid();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/proxy/finishedrepair", {
        method: "POST",
        headers,
        body: JSON.stringify({
          serviceId: row.id,
          id: row.id,
          verifiedBy: userGuid || undefined,
          finishedDate: toBackendLocalDateTime()
        }),
      });

      if (res.ok) {
        showToast(`✓ ${row.reportNo} verified successfully!`);
        await updateServiceStatus(row, "Finished");
        void loadData();
      } else {
        await updateServiceStatus(row, "Finished");
        showToast(`Status updated (API returned ${res.status}).`);
        void loadData();
      }
    } catch {
      showToast("Network error — please try again.");
    } finally {
      setVerifyingId(null);
    }
  };

  const handleExportCSV = () => {
    if (!items.length) return;
    const headers = ["Ref No", "Finished Date", "Company", "Item", "Serial", "Priority", "Verified By"];
    const rows = items.map((i) => [
      `"${i.reportNo}"`, `"${i.finishedDate ?? i.serviceDate}"`,
      `"${i.companyName}"`, `"${i.itemName}"`, `"${i.serialNumber}"`,
      `"${i.servicePriority}"`, `"${i.verifiedByName ?? i.repairByName}"`,
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = Object.assign(document.createElement("a"), { href: encodeURI(csv), download: `approve_verify_${Date.now()}.csv` });
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  // Filtered & sorted items
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
          if (key === "refNo") cellVal = item.reportNo || "";
          else if (key === "finishedDate") cellVal = fmtDate(item.finishedDate ?? item.serviceDate);
          else if (key === "companyName") cellVal = item.companyName || "";
          else if (key === "itemName") cellVal = item.itemName || "";
          else if (key === "serialNumber") cellVal = item.serialNumber || "";
          else if (key === "servicePriority") cellVal = item.servicePriority || "";
          else if (key === "technician") cellVal = getActionUserForStatus(item) || "";
          return cellVal.toLowerCase().includes(filterVal);
        });
      });
    }

    // Apply sorting
    if (sortConfig) {
      list = [...list].sort((a, b) => {
        let valA = "";
        let valB = "";
        if (sortConfig.field === "refNo") {
          valA = a.reportNo || "";
          valB = b.reportNo || "";
        } else if (sortConfig.field === "finishedDate") {
          valA = a.finishedDate ?? a.serviceDate ?? "";
          valB = b.finishedDate ?? b.serviceDate ?? "";
        } else if (sortConfig.field === "companyName") {
          valA = a.companyName || "";
          valB = b.companyName || "";
        } else if (sortConfig.field === "itemName") {
          valA = a.itemName || "";
          valB = b.itemName || "";
        } else if (sortConfig.field === "serialNumber") {
          valA = a.serialNumber || "";
          valB = b.serialNumber || "";
        } else if (sortConfig.field === "servicePriority") {
          valA = a.servicePriority || "";
          valB = b.servicePriority || "";
        } else if (sortConfig.field === "technician") {
          valA = getActionUserForStatus(a) || "";
          valB = getActionUserForStatus(b) || "";
        }
        const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: "base" });
        return sortConfig.direction === "asc" ? cmp : -cmp;
      });
    }

    return list;
  }, [items, columnFilters, sortConfig]);

  // AI Assistant ActionBus handlers
  const findRow = useCallback(
    (ref?: string): RepairServiceItem | null => {
      if (!ref) return null;
      const needle = ref.trim().toLowerCase();
      return (
        items.find((i) => i.reportNo?.toLowerCase() === needle) ??
        items.find((i) => i.serialNumber?.toLowerCase() === needle) ??
        null
      );
    },
    [items]
  );

  useActionHandler(
    "ticket.view",
    (ref) => {
      const row = findRow(ref);
      if (!row) return false;
      setViewItem(row);
      return true;
    },
    items.length
  );

  useActionHandler(
    "ticket.print",
    (ref) => {
      const row = findRow(ref);
      if (!row) return false;
      setPrintItem(row);
      return true;
    },
    items.length
  );

  useSearchAction(setSearchTerm);

  useActionHandler("ui.dialog.close", () => {
    setViewItem(null);
    setPrintItem(null);
    return true;
  });

  useActionHandler("ui.refresh", () => {
    void loadData();
    return true;
  });

  useActionHandler("export.csv", () => {
    if (items.length === 0) return false;
    handleExportCSV();
    return true;
  }, items.length);

  return (
    <PageWrapper titleKey="nav.approveVerify" subtitleKey="sub.approveVerify">

      {/* Toast notification */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-success text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 enter-pop">
          <CheckCircle className="w-4 h-4" />
          {toastMsg}
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0 bg-surface border border-subtle/80 rounded-2xl shadow-sm overflow-hidden">

        {/* Toolbar: Enterprise Ribbon vs Modern Inline */}
        {crudStyle === "enterprise-ribbon" ? (
          <EnterpriseRibbonToolbar
            canCreate={false}
            canEdit={false}
            canDelete={false}
            canPrint={true}
            onPrint={() => {
              if (checkedRow) {
                setPrintItem(checkedRow);
              } else {
                toast(
                  lang === "km"
                    ? "សូមជ្រើសរើសទិន្នន័យ (Row) ក្នុងតារាងដើម្បីបោះពុម្ព (Print)"
                    : "Please select a record in the table to print",
                  { icon: "ℹ️" }
                );
              }
            }}
            onExportCsv={handleExportCSV}
            onReload={() => void loadData()}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onSearchSubmit={() => void loadData()}
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
          <div className="p-2.5 sm:p-3 lg:p-3 xl:p-4 shrink-0 border-b border-subtle bg-cushion/50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  type="text"
                  placeholder={t("table.searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-1.5 text-xs border border-subtle rounded-xl bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent w-64"
                />
              </div>
              <button
                onClick={() => void loadData()}
                className="p-1.5 rounded-xl transition-colors text-ink-secondary hover:bg-cushion"
                title={t("queue.reload")}
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

              {/* Disabled Create Ticket */}
              <button
                type="button"
                disabled={true}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-ink-muted/40 border border-subtle/50 opacity-40 cursor-not-allowed select-none"
                title={lang === "km" ? "មុខងារ CRUD មានតែលើទំព័រ Receive Items ប៉ុណ្ណោះ" : "CRUD is only available on Receive Items"}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t("action.createTicket")}</span>
              </button>

              {/* Print Button */}
              <button
                type="button"
                onClick={() => {
                  if (checkedRow) {
                    setPrintItem(checkedRow);
                  } else {
                    toast(
                      lang === "km"
                        ? "សូមជ្រើសរើសទិន្នន័យ (Row) ក្នុងតារាងដើម្បីបោះពុម្ព (Print)"
                        : "Please select a record in the table to print",
                      { icon: "ℹ️" }
                    );
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors shadow-soft-sm text-ink bg-surface border border-subtle hover:bg-cushion cursor-pointer"
                title={t("action.printTechnicalReport")}
              >
                <Printer className="w-3.5 h-3.5 text-accent" />
                <span>{t("crud.print")}</span>
              </button>

              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors shadow-soft-sm text-ink bg-surface border border-subtle hover:bg-cushion"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t("action.exportCsv")}</span>
              </button>
            </div>
          </div>
        )}

        {/* Table — also the IntersectionObserver root for infinite scroll */}
        <div ref={scrollRootRef} className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
          <table className="w-full text-left border-collapse min-w-full text-xs">
            <thead className="sticky top-0 z-20 shadow-2xs">
              <tr className="bg-cushion border-b border-subtle/80 text-[10.5px] lg:text-[10.5px] xl:text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">
                {isRibbonMode && (
                  <th className="sticky top-0 z-20 bg-cushion py-2.5 px-2 text-center w-10 min-w-[40px]">
                    <span className="sr-only">Select</span>
                  </th>
                )}
                {isColVisible("refNo") && (
                  <th className="py-2.5 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{t("field.refNo")}</span>
                      <ColumnHeaderFilter
                        label={t("field.refNo")}
                        field="refNo"
                        filterValue={columnFilters["refNo"]}
                        onFilterChange={(v) => handleColumnFilterChange("refNo", v)}
                        sortDirection={sortConfig?.field === "refNo" ? sortConfig.direction : null}
                        onSortChange={(d) => handleColumnSortChange("refNo", d)}
                      />
                    </div>
                  </th>
                )}
                {isColVisible("finishedDate") && (
                  <th className="py-2.5 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{t("queue.finishedDate")}</span>
                      <ColumnHeaderFilter
                        label={t("queue.finishedDate")}
                        field="finishedDate"
                        filterValue={columnFilters["finishedDate"]}
                        onFilterChange={(v) => handleColumnFilterChange("finishedDate", v)}
                        sortDirection={sortConfig?.field === "finishedDate" ? sortConfig.direction : null}
                        onSortChange={(d) => handleColumnSortChange("finishedDate", d)}
                      />
                    </div>
                  </th>
                )}
                {isColVisible("companyName") && (
                  <th className="py-2.5 px-3 whitespace-nowrap">
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
                {isColVisible("itemName") && (
                  <th className="py-2.5 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{t("queue.itemModel")}</span>
                      <ColumnHeaderFilter
                        label={t("queue.itemModel")}
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
                  <th className="py-2.5 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{t("queue.serialNo")}</span>
                      <ColumnHeaderFilter
                        label={t("queue.serialNo")}
                        field="serialNumber"
                        filterValue={columnFilters["serialNumber"]}
                        onFilterChange={(v) => handleColumnFilterChange("serialNumber", v)}
                        sortDirection={sortConfig?.field === "serialNumber" ? sortConfig.direction : null}
                        onSortChange={(d) => handleColumnSortChange("serialNumber", d)}
                      />
                    </div>
                  </th>
                )}
                {isColVisible("servicePriority") && (
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      <span>{t("field.priority")}</span>
                      <ColumnHeaderFilter
                        label={t("field.priority")}
                        field="servicePriority"
                        filterValue={columnFilters["servicePriority"]}
                        onFilterChange={(v) => handleColumnFilterChange("servicePriority", v)}
                        sortDirection={sortConfig?.field === "servicePriority" ? sortConfig.direction : null}
                        onSortChange={(d) => handleColumnSortChange("servicePriority", d)}
                      />
                    </div>
                  </th>
                )}
                {isColVisible("technician") && (
                  <th className="py-2.5 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{t("queue.technician")}</span>
                      <ColumnHeaderFilter
                        label={t("queue.technician")}
                        field="technician"
                        filterValue={columnFilters["technician"]}
                        onFilterChange={(v) => handleColumnFilterChange("technician", v)}
                        sortDirection={sortConfig?.field === "technician" ? sortConfig.direction : null}
                        onSortChange={(d) => handleColumnSortChange("technician", d)}
                      />
                    </div>
                  </th>
                )}
                {isColVisible("actions") && (
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">{t("field.actions")}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle text-ink">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={columnsState.filter((c) => c.visible).length + (isRibbonMode ? 1 : 0)} className="py-3.5 px-4">
                      <div className="h-4 bg-sunken rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : displayedItems.length > 0 ? (
                displayedItems.map((row) => {
                  const isSelected = checkedRow?.id === row.id;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setCheckedRow(isSelected ? null : row)}
                      className={cn(
                        "transition-colors cursor-pointer border-b border-subtle/60",
                        isSelected
                          ? "bg-accent-soft/30 ring-1 ring-accent/30"
                          : "hover:bg-cushion/80"
                      )}
                    >
                      {isRibbonMode && (
                        <td className="py-2.5 px-2 text-center w-10 min-w-[40px]" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => setCheckedRow(isSelected ? null : row)}
                            className="w-4 h-4 rounded text-accent focus:ring-accent border-subtle cursor-pointer accent-accent transition-transform hover:scale-105"
                            aria-label="Select row"
                          />
                        </td>
                      )}
                      {isColVisible("refNo") && (
                        <td className="py-2.5 px-3 font-mono font-semibold text-ink whitespace-nowrap">
                          <HighlightText text={row.reportNo} query={searchTerm} />
                        </td>
                      )}
                      {isColVisible("finishedDate") && (
                        <td className="py-2.5 px-3 text-ink-secondary whitespace-nowrap">
                          {fmtDate(row.finishedDate ?? row.serviceDate)}
                        </td>
                      )}
                      {isColVisible("companyName") && (
                        <td className="py-2.5 px-3 font-medium text-ink max-w-[200px] truncate" title={row.companyName}>
                          <HighlightText text={row.companyName} query={searchTerm} />
                        </td>
                      )}
                      {isColVisible("itemName") && (
                        <td className="py-2.5 px-3 max-w-[220px] truncate" title={row.itemName}>
                          <HighlightText text={row.itemName} query={searchTerm} />
                        </td>
                      )}
                      {isColVisible("serialNumber") && (
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <code className="px-2 py-0.5 rounded bg-sunken border border-subtle text-[11px] font-mono text-ink">
                            <HighlightText text={row.serialNumber} query={searchTerm} />
                          </code>
                        </td>
                      )}
                      {isColVisible("servicePriority") && (
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className={cn(
                            "inline-block px-2.5 py-0.5 rounded-full border text-[10px] font-bold",
                            PRIORITY_BADGE[row.servicePriority?.toUpperCase() ?? "NORMAL"] ?? PRIORITY_BADGE.NORMAL
                          )}>
                            {translatePriority(row.servicePriority ?? "NORMAL", t)}
                          </span>
                        </td>
                      )}
                      {isColVisible("technician") && (
                        <td className="py-2.5 px-3 whitespace-nowrap text-ink-secondary">
                          <HighlightText text={getActionUserForStatus(row)} query={searchTerm} />
                        </td>
                      )}
                      {isColVisible("actions") && (
                        <td className="py-2.5 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Verify Button */}
                            {(() => {
                              const verifiable = row.status === "Repairing";
                              const busy = verifyingId === row.id;
                              return (
                                <button
                                  type="button"
                                  onClick={() => void handleVerify(row)}
                                  disabled={busy || !verifiable}
                                  aria-disabled={busy || !verifiable}
                                  className={cn(
                                    "inline-flex min-h-6 items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs",
                                    verifiable
                                      ? "text-white bg-success hover:bg-success/90 disabled:opacity-60"
                                      : "text-ink-secondary bg-sunken border border-subtle cursor-not-allowed opacity-60"
                                  )}
                                  title={t(verifiable ? "queue.markVerified" : "queue.alreadyVerified")}
                                >
                                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                                  <span>{t("action.verify")}</span>
                                </button>
                              );
                            })()}

                            {/* View detail */}
                            <button
                              type="button"
                              onClick={() => setViewItem(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-950/40 border border-sky-200/80 dark:border-sky-800/40 transition-colors shadow-2xs cursor-pointer"
                              title={t("action.viewDetails")}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{t("crud.viewDetails")}</span>
                            </button>

                            {/* Print Report */}
                            <button
                              type="button"
                              onClick={() => setPrintItem(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-accent hover:bg-accent-soft border border-accent/30 transition-colors shadow-2xs cursor-pointer"
                              title={t("action.printTechnicalReport")}
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
                    {t("queue.emptyVerification")}
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
        <div className="p-3 sm:p-4 shrink-0 border-t border-subtle bg-cushion/50 flex items-center justify-between">
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

      {/* View Dialog */}
      {viewItem && (
        <ServiceDetailModal item={viewItem} mode="view" onClose={() => setViewItem(null)} />
      )}

      {/* Print Preview Sidebar */}
      <PrintPreviewSidebar
        isOpen={Boolean(printItem)}
        onClose={() => setPrintItem(null)}
        item={printItem}
      />
    </PageWrapper>
  );
}
