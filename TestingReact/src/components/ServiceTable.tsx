"use client";

import React, { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Download,
  Search,
  RefreshCw,
  Plus,
  Trash2,
  Inbox,
  ClipboardList,
  ArrowUpRight,
  Printer,
} from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { DUR, EASE_OUT } from "@/lib/animations";
import { fetchRepairServices, updateServiceStatus, deleteTechnicalService, RepairServiceItem, invalidateCachePrefix } from "@/services/api";
import { useRealtimeTickets } from "@/hooks/useRealtimeTickets";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSearchQueryParam } from "@/hooks/useSearchQueryParam";
import { useSearchAction } from "@/hooks/useSearchAction";
import { useInfiniteList, clearListCache } from "@/hooks/useInfiniteList";
import InfiniteScrollStatus from "./InfiniteScrollStatus";
import { EmptyState, SkeletonRows } from "@/components/av";
import StatusTabMenu, { TabItem } from "./StatusTabMenu";
import TicketRow from "./ServiceTableRow";
import { useActionHandler, type ActionValues } from "./ActionBus";
import { useI18n } from "@/i18n/LanguageProvider";
import { useTheme } from "@/theme/ThemeProvider";
import type { CrudStyleName } from "@/theme/themeConfig";
import EnterpriseRibbonToolbar from "./crud/EnterpriseRibbonToolbar";
import ColumnVisibilityDropdown, { type ColumnDefinition } from "./crud/ColumnVisibilityDropdown";
import ColumnHeaderFilter from "./crud/ColumnHeaderFilter";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { ModalWrapper } from "@/components/av/ModalWrapper";
import StockShortageAlertModal, { parseStockErrorMessage, StockShortageDetails } from "./StockShortageAlertModal";
import { toBackendLocalDateTime, getActionUserForStatus } from "@/services/types";

import { transitionGuard, type TransitionCode } from "@/validation";
import type { TranslationKey } from "@/i18n/translations";

const REFUSAL_KEYS: Record<TransitionCode, TranslationKey> = {
  cannotApproveSpareParts: "msg.cannotApproveSpareParts",
  cannotApproveCharge: "msg.cannotApproveCharge",
  cannotSendSparePartsCharge: "msg.cannotSendSparePartsCharge",
  cannotApproveFreeWithSpareParts: "msg.cannotApproveFreeWithSpareParts",
};

// Lazy-load heavy dialog modals on demand so the initial table paint is instantaneous (0ms)
const ServiceDetailModal = dynamic(() => import("./ServiceDetailModal"), { ssr: false });
const ApproveRepairDialog = dynamic(() => import("./ApproveRepairDialog"), { ssr: false });
const PrintPreviewSidebar = dynamic(() => import("./PrintPreviewSidebar"), { ssr: false });
const ApproveValidationModal = dynamic(() => import("./ApproveValidationModal"), { ssr: false });

interface ServiceTableProps {
  activeFilter: string;
  tabs?: TabItem[];
  onTabChange?: (key: string) => void;
  activeTabKey?: string;
  /**
   * Renders a dedicated "Approve" action per row instead of relying on the
   * generic inline status dropdown — used by the Approve Repairing page,
   * whose namesake action (stamping repairDate/repairBy, deducting spare
   * part stock, moving the ticket to "Repairing") has no path through the
   * dropdown at all. Matches RepairItemList.razor's OnApplyButtonClick.
   */
  requireApproval?: boolean;
  /** Disables the inline status dropdown, rendering a static status badge. */
  disableStatusDropdown?: boolean;
  /** Optional container class name for bounding height on dashboards */
  containerClassName?: string;
  /** Enables the dedicated widget header when placed on the Dashboard */
  isDashboardWidget?: boolean;
  /** Custom widget title override */
  widgetTitle?: string;
  /** Custom widget subtitle override */
  widgetSubtitle?: string;
  /** Optional extra filters such as date range fromDate/toDate */
  searchExtras?: import("@/services/api").ServiceSearchExtras;
}

export default function ServiceTable({
  activeFilter,
  searchExtras,
  tabs,
  onTabChange,
  activeTabKey,
  requireApproval,
  disableStatusDropdown,
  containerClassName,
  isDashboardWidget,
  widgetTitle,
  widgetSubtitle,
}: ServiceTableProps) {
  const { t, lang } = useI18n();
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState(25);

  const [selectedItem, setSelectedItem] = useState<RepairServiceItem | null>(null);
  const [printItem, setPrintItem] = useState<RepairServiceItem | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "edit">("view");
  const [stockShortageDetails, setStockShortageDetails] = useState<StockShortageDetails | null>(null);
  const [stockShortageTargetItem, setStockShortageTargetItem] = useState<RepairServiceItem | null>(null);
  /**
   * Field values the detail form should open with, when the assistant was asked
   * to fill it in. Prefill only — the modal types them into its inputs and
   * stops, so the Save click stays with the user.
   */
  const [prefill, setPrefill] = useState<ActionValues | undefined>(undefined);

  const { prefs, update: updateThemePrefs } = useTheme();
  const crudStyle = prefs.crudStyle || "modern-inline";
  const { hasPermission } = useUserPermissions();

  // Selection state for Enterprise Ribbon mode
  const [checkedRowId, setCheckedRowId] = useState<string | number | null>(null);

  // Column Filters & Sort state
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [colSort, setColSort] = useState<{ field: string; direction: "asc" | "desc" | null }>({
    field: "",
    direction: null,
  });

  // Column Visibility definitions & persistence
  const [columnsState, setColumnsState] = useState<ColumnDefinition[]>(() => {
    const defaults: ColumnDefinition[] = [
      { key: "refNo", label: t("field.refNo"), visible: true, permanent: true },
      { key: "receiveDate", label: t("field.receiveDate"), visible: true },
      { key: "companyName", label: t("field.companyName"), visible: true },
      { key: "itemName", label: t("table.itemNameModel"), visible: true },
      { key: "serialNumber", label: t("field.serialNumber"), visible: true },
      { key: "priority", label: t("field.priority"), visible: true },
      { key: "status", label: t("field.status"), visible: true },
      { key: "receiver", label: t("field.receiver"), visible: true },
      { key: "actions", label: t("field.actions"), visible: true, permanent: true },
    ];
    if (typeof window === "undefined") return defaults;
    try {
      const saved = localStorage.getItem("service_table_columns");
      if (saved) {
        const map = JSON.parse(saved) as Record<string, boolean>;
        return defaults.map((c) => ({
          ...c,
          visible: c.permanent ? true : map[c.key] !== false,
        }));
      }
    } catch {}
    return defaults;
  });

  const handleToggleColumn = useCallback((key: string) => {
    setColumnsState((prev) => {
      const next = prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c));
      try {
        const map: Record<string, boolean> = {};
        next.forEach((c) => {
          map[c.key] = c.visible;
        });
        localStorage.setItem("service_table_columns", JSON.stringify(map));
      } catch {}
      return next;
    });
  }, []);

  const handleResetColumns = useCallback(() => {
    try {
      localStorage.removeItem("service_table_columns");
    } catch {}
    setColumnsState((prev) => prev.map((c) => ({ ...c, visible: true })));
  }, []);

  const visibleColumnsMap = React.useMemo(() => {
    const map: Record<string, boolean> = {};
    columnsState.forEach((c) => {
      map[c.key] = c.visible;
    });
    return map;
  }, [columnsState]);

  const effectiveFilter = activeTabKey || activeFilter;
  const isReceivedStage =
    (effectiveFilter || "").toLowerCase().includes("reciev") ||
    (effectiveFilter || "").toLowerCase().includes("receiv") ||
    (activeFilter || "").toLowerCase().includes("reciev") ||
    (activeFilter || "").toLowerCase().includes("receiv");

  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const term = debouncedSearch.trim();

  // Seeds the search box from `?q=` when arriving from the header's global
  // search. The hook was imported but never called, so that navigation used to
  // land on the page with the query silently dropped.
  useSearchQueryParam(setSearchTerm);

  /**
   * Note: the fetcher deliberately does NOT pre-warm `fetchUserMap()` —
   * `fetchRepairServices` already awaits it internally and enriches the rows
   * before returning, so doing it here too doubled every request this table made.
   */
  const {
    items,
    totalCount,
    isLoading,
    isLoadingMore,
    reachedEnd,
    limitReached,
    scrollRootRef,
    sentinelRef,
    refresh: refreshLoaded,
    setItems,
    setTotalCount,
  } = useInfiniteList<RepairServiceItem, HTMLDivElement, HTMLTableRowElement>({
    fetchPage: (pageNumber, size) =>
      fetchRepairServices(pageNumber, size, effectiveFilter, term, searchExtras),
    pageSize,
    // Filter/tab, search, and date range both restart the list from page 1.
    resetKey: `${effectiveFilter}|${term}|${searchExtras?.fromDate || ""}|${searchExtras?.toDate || ""}|${searchExtras?.dateFilter || ""}`,
    getId: (i) => i?.id,
  });

  // ✅ Real-time: auto-refresh when any user mutates a ticket relevant to this filter.
  // The hook returns a cleanup fn via useEffect internally — no leaks.
  const handleRealtimeUpdate = useCallback(() => {
    invalidateCachePrefix("repairservices");
    void refreshLoaded();
  }, [refreshLoaded]);

  useRealtimeTickets(effectiveFilter, handleRealtimeUpdate);

  const handleSaveItem = (updated: RepairServiceItem) => {
    invalidateCachePrefix("repairservices");
    invalidateCachePrefix("dashboard");
    clearListCache();
    // If updating existing item in state, update it immediately
    setItems((prev) => {
      const exists = prev.some((i) => i.id === updated.id);
      if (exists) {
        return prev.map((i) => (i.id === updated.id ? updated : i));
      }
      return [updated, ...prev];
    });
    // Force refetch page 1 from backend so DB generated reportNo and IDs are loaded
    void refreshLoaded();
  };

  /**
   * Every handler passed to a row is a stable `useCallback` and takes the row
   * as an ARGUMENT. `TicketRow` is memoised, and a fresh function identity per
   * render defeats `React.memo` silently — the rows would still re-render on
   * every keystroke and nothing would look broken. Same rule the spare-parts
   * `PartRow` documents.
   */
  const handleInlineStatusChange = useCallback(async (item: RepairServiceItem, newStatus: string) => {
    // Send update request to server (with pre-validation)
    const result = await updateServiceStatus(item, newStatus);
    if (!result.success) {
      const err = result.error || "";
      if (
        result.shortages?.length ||
        err.includes("ស្តុក") ||
        err.toLowerCase().includes("stock") ||
        err.includes("Available") ||
        err.includes("Required")
      ) {
        setStockShortageTargetItem(item);
        setStockShortageDetails(parseStockErrorMessage(err, result.shortages));
      } else {
        toast.error(err || "Failed to update status", { position: "top-right" });
      }
      // Revert / refresh loaded rows to ensure accurate state
      void refreshLoaded();
      return;
    }

    toast.success(
      lang === "km" ? "បានកែប្រែស្ថានភាពជោគជ័យ" : "Status updated successfully",
      { position: "bottom-right" }
    );
    // Reload dataset to ensure fresh state
    void refreshLoaded();
  }, [lang, refreshLoaded]);

  /**
   * Stable so `StatusTabMenu` (memoised) does not re-render on every keystroke
   * here. It re-measures its sliding thumb in a dependency-less
   * `useLayoutEffect`, so each re-render forced four synchronous offset reads —
   * a layout flush before paint — for a tab strip that had not moved.
   */
  const handleTabChange = useCallback(
    (k: string) => onTabChange?.(k),
    [onTabChange]
  );

  const handleViewRow = useCallback((row: RepairServiceItem) => {
    setModalMode("view");
    setSelectedItem(row);
  }, []);

  const handleEditRow = useCallback((row: RepairServiceItem) => {
    setModalMode("edit");
    setSelectedItem(row);
  }, []);

  const checkedRow = useMemo(() => {
    return items.find((it) => it.id === checkedRowId) || null;
  }, [items, checkedRowId]);

  const handleSelectRow = useCallback((row: RepairServiceItem) => {
    setCheckedRowId((prev) => (prev === row.id ? null : (row.id ?? null)));
  }, []);

  // Filter items by column filters if any are active, and apply column sorting
  const displayedItems = useMemo(() => {
    let list = items;
    const activeColKeys = Object.keys(colFilters).filter((k) => Boolean(colFilters[k]?.trim()));
    if (activeColKeys.length > 0) {
      list = list.filter((item) => {
        return activeColKeys.every((k) => {
          const q = colFilters[k].toLowerCase().trim();
          let target = "";
          if (k === "refNo") target = item.reportNo || "";
          else if (k === "receiveDate") target = item.serviceDate || "";
          else if (k === "companyName") target = item.companyName || "";
          else if (k === "itemName") target = item.itemName || "";
          else if (k === "serialNumber") target = item.serialNumber || "";
          else if (k === "priority") target = item.servicePriority || "";
          else if (k === "status") target = item.status || "";
          else if (k === "receiver") target = getActionUserForStatus(item) || "";
          return target.toLowerCase().includes(q);
        });
      });
    }

    if (colSort.direction && colSort.field) {
      list = [...list].sort((a, b) => {
        let valA = "";
        let valB = "";
        const f = colSort.field;
        if (f === "refNo") { valA = a.reportNo || ""; valB = b.reportNo || ""; }
        else if (f === "companyName") { valA = a.companyName || ""; valB = b.companyName || ""; }
        else if (f === "itemName") { valA = a.itemName || ""; valB = b.itemName || ""; }
        else if (f === "serialNumber") { valA = a.serialNumber || ""; valB = b.serialNumber || ""; }
        else if (f === "status") { valA = a.status || ""; valB = b.status || ""; }
        const cmp = valA.localeCompare(valB);
        return colSort.direction === "asc" ? cmp : -cmp;
      });
    }

    return list;
  }, [items, colFilters, colSort]);

  const handleColumnFilterChange = useCallback((field: string, value: string) => {
    setColFilters((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleColumnSort = useCallback((field: string, direction: "asc" | "desc" | null) => {
    setColSort({ field, direction });
  }, []);

  const handleStyleChange = useCallback((style: CrudStyleName) => {
    updateThemePrefs({ crudStyle: style });
  }, [updateThemePrefs]);

  const activeColCount = useMemo(() => {
    const visibleCount = columnsState.filter((c) => c.visible).length;
    return (crudStyle === "enterprise-ribbon" ? 1 : 0) + visibleCount;
  }, [columnsState, crudStyle]);

  const [deleteConfirmItem, setDeleteConfirmItem] = useState<RepairServiceItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [approveItem, setApproveItem] = useState<RepairServiceItem | null>(null);
  const [validationModal, setValidationModal] = useState<{
    open: boolean;
    ticket: RepairServiceItem | null;
    ruleCode?: TransitionCode | null;
    message?: string | null;
  }>({
    open: false,
    ticket: null,
    ruleCode: null,
    message: null,
  });

  const handleApproveClick = useCallback((row: RepairServiceItem) => {
    // Check authoritative 4 workflow rules via transitionGuard
    const parts = row.sparePartItems || row.sparepartItems || [];
    const refusal = transitionGuard(
      {
        status: row.status,
        serviceType: row.serviceType,
        serviceTypeId: row.serviceTypeId,
        sparePartCount: parts.length,
        reportNo: row.reportNo,
      },
      "Repairing"
    );
    if (refusal) {
      // Popup center modal on screen as requested by user
      setValidationModal({
        open: true,
        ticket: row,
        ruleCode: refusal.code,
        message: t(REFUSAL_KEYS[refusal.code], { ref: row.reportNo ?? "" }) || refusal.message,
      });
      return;
    }
    setApproveItem(row);
  }, [t]);

  // ── Actions requested from elsewhere (the AI assistant today) ────────────
  //
  // These open exactly what the row buttons open, deliberately: the approve
  // gate below lives in `handleApproveClick`, and delete is a confirmation the
  // user still has to accept. Nothing here writes on its own.
  //
  // A request usually lands before the rows do, so each handler reports whether
  // it found its ticket and the bus re-offers it as pages load — `items.length`
  // is what tells the bus to try again.
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

  const openTicketModal = useCallback(
    (mode: "view" | "edit") =>
      (ref?: string, values?: ActionValues): boolean => {
        const row = findRow(ref);
        if (!row) return false;
        setModalMode(mode);
        // Only the edit form has fields to fill; a view is read-only, so any
        // values sent with one are dropped rather than carried into the next
        // edit the user opens.
        setPrefill(mode === "edit" ? values : undefined);
        setSelectedItem(row);
        return true;
      },
    [findRow]
  );

  useActionHandler("ticket.view", openTicketModal("view"), items.length);
  useActionHandler("ticket.edit", openTicketModal("edit"), items.length);

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

  useActionHandler(
    "ticket.delete",
    (ref) => {
      const row = findRow(ref);
      if (!row) return false;
      if (row.statusId === 6 || row.status?.toLowerCase().includes("finish") || row.status?.includes("រួចរាល់")) {
        toast.error(lang === "km" ? "មិនអាចលុបរបាយការណ៍ដែលជួសជុលរួចរាល់ (Finished) បានទេ" : "Cannot delete finished service report.");
        return false;
      }
      setDeleteConfirmItem(row);
      return true;
    },
    items.length
  );

  useActionHandler(
    "ticket.approveRepair",
    (ref) => {
      const row = findRow(ref);
      if (!row) return false;
      // Counts as handled even when the gate rejects it — the user has been
      // told why, and retrying would just repeat the toast.
      handleApproveClick(row);
      return true;
    },
    items.length
  );

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmItem?.id) return;
    if (deleteConfirmItem.statusId === 6 || deleteConfirmItem.status?.toLowerCase().includes("finish") || deleteConfirmItem.status?.includes("រួចរាល់")) {
      toast.error(lang === "km" ? "មិនអាចលុបរបាយការណ៍ដែលជួសជុលរួចរាល់ (Finished) បានទេ" : "Cannot delete finished service report.");
      setDeleteConfirmItem(null);
      return;
    }
    const targetId = deleteConfirmItem.id;
    setIsDeleting(true);

    // Optimistically remove from state immediately
    setItems((prev) => prev.filter((i) => i.id !== targetId));
    setTotalCount((prev) => Math.max(prev - 1, 0));

    const success = await deleteTechnicalService(targetId);
    setIsDeleting(false);
    setDeleteConfirmItem(null);

    invalidateCachePrefix("repairservices");
    invalidateCachePrefix("dashboard");
    clearListCache();

    if (success) {
      toast.success(lang === "km" ? "🗑️ បានលុបទិន្នន័យជោគជ័យ!" : "🗑️ Ticket deleted successfully!", { position: "bottom-right" });
      void refreshLoaded();
    } else {
      toast.error(lang === "km" ? "❌ មិនអាចលុបទិន្នន័យបានទេ" : "❌ Failed to delete ticket on server", { position: "bottom-right" });
      void refreshLoaded();
    }
  };

  const handleCreateTicket = (values?: ActionValues) => {
    const newItem: RepairServiceItem = {
      id: "new-" + Date.now(),
      reportNo: "",
      serviceDate: toBackendLocalDateTime(),
      companyName: "",
      address: "",
      phoneNumber: "",
      itemId: "",
      itemName: "",
      serialNumber: "",
      serviceLocation: "CompanyService",
      servicePriority: "NORMAL",
      status: "Item Recieved",
      statusId: 1,
    };
    setModalMode("edit");
    setPrefill(values);
    setSelectedItem(newItem);
  };

  // Page-level, so there is nothing to wait for a row to load.
  useActionHandler("ticket.create", (_ref, values) => {
    handleCreateTicket(values);
    return true;
  });

  const handleExportCSV = () => {
    if (items.length === 0) return;
    const headers = ["Ref No", "Service Date", "Company Name", "Item Name", "Serial Number", "Priority", "Status", "Receiver"];
    const rows = items.map((i) => [
      `"${i.reportNo || ""}"`,
      `"${i.serviceDate || ""}"`,
      `"${i.companyName || ""}"`,
      `"${i.itemName || ""}"`,
      `"${i.serialNumber || ""}"`,
      `"${i.servicePriority || ""}"`,
      `"${i.status || ""}"`,
      `"${i.repairByName || ""}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `repair_services_${effectiveFilter}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Page-level actions ────────────────────────────────────────────────────
  //
  // Registered here rather than per page because every queue page renders this
  // table, and only one of them is mounted at a time — so these ids resolve to
  // whichever queue the user is actually looking at.
  useSearchAction(setSearchTerm);

  useActionHandler("ui.tab", (_ref, values) => {
    const wanted = values?.tab?.trim();
    if (!wanted || !tabs?.length || !onTabChange) return false;
    // Matched leniently: the model reads tab keys from the menu config, but a
    // user's phrasing ("awaiting spare parts") reaches it more often than the
    // exact stored spelling does.
    const needle = wanted.toLowerCase();
    const hit =
      tabs.find((tab) => tab.key.toLowerCase() === needle) ??
      tabs.find((tab) => tab.key.toLowerCase().includes(needle) || needle.includes(tab.key.toLowerCase()));
    if (!hit) return false;
    onTabChange(hit.key);
    return true;
  });

  useActionHandler("ui.pageSize", (_ref, values) => {
    const size = Number(values?.size);
    if (!Number.isFinite(size)) return false;
    // Clamped to the sizes the picker offers, so an arbitrary number can't ask
    // the backend for a page nothing else in the app would request.
    const allowed = [10, 25, 50, 100];
    setPageSize(allowed.reduce((a, b) => (Math.abs(b - size) < Math.abs(a - size) ? b : a)));
    return true;
  });

  // Closes whatever this page currently has open — the same thing Cancel or X
  // does, discarding anything typed. Always reports success: the request is
  // "leave nothing open", and that is true afterwards whether or not a dialog
  // happened to be showing.
  useActionHandler("ui.dialog.close", () => {
    setSelectedItem(null);
    setPrefill(undefined);
    setPrintItem(null);
    setDeleteConfirmItem(null);
    setApproveItem(null);
    return true;
  });

  useActionHandler("ui.refresh", () => {
    invalidateCachePrefix("repairservices");
    void refreshLoaded();
    return true;
  });

  useActionHandler("export.csv", () => {
    if (items.length === 0) return false;
    handleExportCSV();
    return true;
  }, items.length);

  /**
   * One set of surface classes. This block used to branch five ways on
   * `prefs.preset` and again on `isDark` — ~90 lines producing ten variants of
   * "what colour is a table". Aura Velvet has one answer, so these are plain
   * constants and the colour lives in tokens.
   */
  const tableContainerClass = "bg-surface border border-subtle shadow-soft-sm";
  const toolbarClass = "border-b border-subtle bg-cushion";
  const searchInputClass =
    "border-subtle bg-surface text-ink placeholder-ink-muted focus:ring-accent/20 focus:border-accent";
  const headerRowClass =
    "bg-cushion border-b border-subtle text-ink-muted font-semibold";
  const createBtnClass = "bg-accent text-accent-fg hover:bg-accent-hover shadow-soft-sm";

  return (
    // `min-w-0` below is load-bearing, not tidiness. This is a flex item, and a
    // flex item's default `min-width: auto` means it refuses to shrink below
    // its own content. The 9-column table inside is ~880px wide with
    // `whitespace-nowrap` headers, so on a phone this box stayed 880px, ignored
    // the `overflow-x-auto` on its inner scroller, and pushed the whole page
    // past the viewport — the document scrolled sideways instead of just the
    // table. `min-w-0` lets it shrink so the inner scroller can do its job.
    <div
      className={`flex-1 flex flex-col min-h-0 min-w-0 rounded-2xl overflow-hidden ${tableContainerClass} ${
        containerClassName || (isDashboardWidget ? "h-[580px] lg:h-[620px]" : "")
      }`}
    >
      {/* Optional Dashboard Widget Header */}
      {isDashboardWidget && (
        <div className="px-4 py-3 border-b border-subtle bg-surface flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-ink">
                  {widgetTitle ||
                    (lang === "km"
                      ? "បញ្ជីសំបុត្រជួសជុលទាំងអស់"
                      : "Service Tickets Directory")}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-cushion text-ink-secondary border border-subtle">
                  {totalCount || items.length}{" "}
                  {lang === "km" ? "សំបុត្រ" : "tickets"}
                </span>
                {effectiveFilter && (
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    {effectiveFilter}
                  </span>
                )}
                {searchExtras?.fromDate && (
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    📅 {searchExtras.fromDate} {searchExtras.toDate ? `→ ${searchExtras.toDate}` : ""}
                  </span>
                )}
                {searchExtras?.dateFilter && !searchExtras?.fromDate && (
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    📅 {searchExtras.dateFilter}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-ink-secondary">
                {widgetSubtitle ||
                  (lang === "km"
                    ? "តាមដាន និងគ្រប់គ្រងសំបុត្រជួសជុលម៉ាស៊ីនក្នុងប្រព័ន្ធ"
                    : "Live service queue and technical repair records")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/service-tickets"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline px-2.5 py-1 rounded-lg hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-colors"
            >
              <span>{lang === "km" ? "មើលពេញអេក្រង់" : "Open Full Page"}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Sub-status Tab Menu Header */}
      {tabs && tabs.length > 0 && (
        <div className={"px-4 pt-3 pb-2 shrink-0 border-b border-subtle bg-cushion"}>
          <StatusTabMenu
            tabs={tabs}
            activeKey={activeTabKey || activeFilter}
            onTabChange={handleTabChange}
            loading={isLoading}
          />
        </div>
      )}

      {/* Table Toolbar */}
      {crudStyle === "enterprise-ribbon" ? (
        <EnterpriseRibbonToolbar
          canCreate={isReceivedStage}
          canEdit={isReceivedStage}
          canDelete={isReceivedStage}
          canPrint={true}
          onCreate={isReceivedStage ? () => handleCreateTicket() : undefined}
          onEdit={
            isReceivedStage
              ? () => {
                  if (checkedRow) {
                    handleEditRow(checkedRow);
                  } else {
                    toast(
                      lang === "km"
                        ? "សូមជ្រើសរើសទិន្នន័យ (Row) ក្នុងតារាងជាមុនសិន"
                        : "Please select a record in the table first",
                      { icon: "ℹ️" }
                    );
                  }
                }
              : undefined
          }
          onDelete={
            isReceivedStage
              ? () => {
                  if (checkedRow) {
                    setDeleteConfirmItem(checkedRow);
                  } else {
                    toast(
                      lang === "km"
                        ? "សូមជ្រើសរើសទិន្នន័យ (Row) ក្នុងតារាងដើម្បីលុប"
                        : "Please select a record to delete",
                      { icon: "ℹ️" }
                    );
                  }
                }
              : undefined
          }
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
          onReload={() => {
            invalidateCachePrefix("repairservices");
            void refreshLoaded();
          }}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onSearchSubmit={() => {
            invalidateCachePrefix("repairservices");
            void refreshLoaded();
          }}
          onSearchClear={() => setSearchTerm("")}
          selectedCount={checkedRow ? 1 : 0}
          isLoading={isLoading}
          currentStyle={crudStyle}
          onStyleChange={handleStyleChange}
          extraActions={
            <ColumnVisibilityDropdown
              columns={columnsState}
              onToggleColumn={handleToggleColumn}
              onResetColumns={handleResetColumns}
            />
          }
        />
      ) : (
        <div className={`p-2.5 sm:p-3 lg:p-3 xl:p-4 shrink-0 flex flex-wrap items-center justify-between gap-3 lg:gap-3 xl:gap-4 ${toolbarClass}`}>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search className={"w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"} />
              <input
                type="text"
                placeholder={t("table.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-9 pr-4 py-1.5 lg:py-1.5 xl:py-2 text-xs border rounded-xl focus:outline-none focus:ring-2 w-52 sm:w-64 lg:w-64 xl:w-80 transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] ${searchInputClass}`}
              />
            </div>

            <button
              onClick={() => {
                invalidateCachePrefix("repairservices");
                void refreshLoaded();
              }}
              className={"p-1.5 lg:p-1.5 xl:p-2 rounded-xl transition-colors text-ink-secondary hover:bg-cushion"}
              title={t("action.reloadData")}
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

            {/* Create Ticket */}
            <button
              type="button"
              onClick={isReceivedStage ? () => handleCreateTicket() : undefined}
              disabled={!isReceivedStage}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 lg:py-1.5 xl:py-2 text-xs font-semibold rounded-xl transition-colors select-none",
                isReceivedStage
                  ? createBtnClass
                  : "text-ink-muted/40 border border-subtle/50 opacity-40 cursor-not-allowed"
              )}
              title={isReceivedStage ? t("action.createTicket") : (lang === "km" ? "មុខងារ CRUD មានតែលើទំព័រ Receive Items ប៉ុណ្ណោះ" : "CRUD is only available on Receive Items")}
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 lg:py-1.5 xl:py-2 text-xs font-semibold rounded-xl transition-colors shadow-soft-sm text-ink bg-surface border border-subtle hover:bg-cushion cursor-pointer"
              title={t("action.printTechnicalReport")}
            >
              <Printer className="w-3.5 h-3.5 text-accent" />
              <span>{t("crud.print")}</span>
            </button>

            <button
              onClick={handleExportCSV}
              className={"inline-flex items-center gap-1.5 px-3 py-1.5 lg:py-1.5 xl:py-2 text-xs font-semibold rounded-xl transition-colors shadow-soft-sm text-ink bg-surface border border-subtle hover:bg-cushion"}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t("action.exportCsv")}</span>
            </button>
          </div>
        </div>
      )}

      {/* Table Content */}
      <div ref={scrollRootRef} className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
        <table className="w-full text-left border-collapse min-w-full">
          <thead className="sticky top-0 z-20 shadow-xs">
            {/* Sticky header */}
            <tr
              className={`text-[10.5px] lg:text-[10.5px] xl:text-[11px] font-semibold uppercase tracking-wider ${headerRowClass}`}
            >
              {crudStyle === "enterprise-ribbon" && (
                <th className="sticky top-0 z-20 bg-cushion py-2.5 px-2 text-center w-10 min-w-[40px]">
                  <span className="sr-only">Select</span>
                </th>
              )}

              {/* Ref No */}
              {visibleColumnsMap.refNo !== false && (
                <th className="sticky top-0 z-20 bg-cushion py-2.5 lg:py-2.5 xl:py-3 px-2.5 sm:px-2.5 lg:px-3 whitespace-nowrap min-w-[105px]">
                  <div className="flex items-center justify-between gap-1">
                    <span>{t("field.refNo")}</span>
                    {crudStyle === "enterprise-ribbon" && (
                      <ColumnHeaderFilter
                        field="refNo"
                        label={t("field.refNo")}
                        filterValue={colFilters.refNo || ""}
                        onFilterChange={(v) => handleColumnFilterChange("refNo", v)}
                        onSortChange={(dir) => handleColumnSort("refNo", dir)}
                        sortDirection={colSort.field === "refNo" ? colSort.direction : null}
                      />
                    )}
                  </div>
                </th>
              )}

              {/* Receive Date */}
              {visibleColumnsMap.receiveDate !== false && (
                <th className="sticky top-0 z-20 bg-cushion py-2.5 lg:py-2.5 xl:py-3 px-2.5 sm:px-2.5 lg:px-3 whitespace-nowrap min-w-[115px]">
                  <div className="flex items-center justify-between gap-1">
                    <span>{t("field.receiveDate")}</span>
                    {crudStyle === "enterprise-ribbon" && (
                      <ColumnHeaderFilter
                        field="receiveDate"
                        label={t("field.receiveDate")}
                        filterValue={colFilters.receiveDate || ""}
                        onFilterChange={(v) => handleColumnFilterChange("receiveDate", v)}
                        onSortChange={(dir) => handleColumnSort("receiveDate", dir)}
                        sortDirection={colSort.field === "receiveDate" ? colSort.direction : null}
                      />
                    )}
                  </div>
                </th>
              )}

              {/* Company Name */}
              {visibleColumnsMap.companyName !== false && (
                <th className="sticky top-0 z-20 bg-cushion py-2.5 lg:py-2.5 xl:py-3 px-2.5 sm:px-2.5 lg:px-3 whitespace-nowrap min-w-[150px]">
                  <div className="flex items-center justify-between gap-1">
                    <span>{t("field.companyName")}</span>
                    {crudStyle === "enterprise-ribbon" && (
                      <ColumnHeaderFilter
                        field="companyName"
                        label={t("field.companyName")}
                        filterValue={colFilters.companyName || ""}
                        onFilterChange={(v) => handleColumnFilterChange("companyName", v)}
                        onSortChange={(dir) => handleColumnSort("companyName", dir)}
                        sortDirection={colSort.field === "companyName" ? colSort.direction : null}
                      />
                    )}
                  </div>
                </th>
              )}

              {/* Item Name / Model */}
              {visibleColumnsMap.itemName !== false && (
                <th className="sticky top-0 z-20 bg-cushion py-2.5 lg:py-2.5 xl:py-3 px-2.5 sm:px-2.5 lg:px-3 whitespace-nowrap min-w-[150px]">
                  <div className="flex items-center justify-between gap-1">
                    <span>{t("table.itemNameModel")}</span>
                    {crudStyle === "enterprise-ribbon" && (
                      <ColumnHeaderFilter
                        field="itemName"
                        label={t("table.itemNameModel")}
                        filterValue={colFilters.itemName || ""}
                        onFilterChange={(v) => handleColumnFilterChange("itemName", v)}
                        onSortChange={(dir) => handleColumnSort("itemName", dir)}
                        sortDirection={colSort.field === "itemName" ? colSort.direction : null}
                      />
                    )}
                  </div>
                </th>
              )}

              {/* Serial Number */}
              {visibleColumnsMap.serialNumber !== false && (
                <th className="sticky top-0 z-20 bg-cushion py-2.5 lg:py-2.5 xl:py-3 px-2.5 sm:px-2.5 lg:px-3 whitespace-nowrap min-w-[100px]">
                  <div className="flex items-center justify-between gap-1">
                    <span>{t("field.serialNumber")}</span>
                    {crudStyle === "enterprise-ribbon" && (
                      <ColumnHeaderFilter
                        field="serialNumber"
                        label={t("field.serialNumber")}
                        filterValue={colFilters.serialNumber || ""}
                        onFilterChange={(v) => handleColumnFilterChange("serialNumber", v)}
                        onSortChange={(dir) => handleColumnSort("serialNumber", dir)}
                        sortDirection={colSort.field === "serialNumber" ? colSort.direction : null}
                      />
                    )}
                  </div>
                </th>
              )}

              {/* Priority */}
              {visibleColumnsMap.priority !== false && (
                <th className="sticky top-0 z-20 bg-cushion py-2.5 lg:py-2.5 xl:py-3 px-2.5 sm:px-2.5 lg:px-3 whitespace-nowrap min-w-[85px] text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span>{t("field.priority")}</span>
                    {crudStyle === "enterprise-ribbon" && (
                      <ColumnHeaderFilter
                        field="priority"
                        label={t("field.priority")}
                        filterValue={colFilters.priority || ""}
                        onFilterChange={(v) => handleColumnFilterChange("priority", v)}
                        onSortChange={(dir) => handleColumnSort("priority", dir)}
                        sortDirection={colSort.field === "priority" ? colSort.direction : null}
                      />
                    )}
                  </div>
                </th>
              )}

              {/* Status */}
              {visibleColumnsMap.status !== false && (
                <th className="sticky top-0 z-20 bg-cushion py-2.5 lg:py-2.5 xl:py-3 px-2.5 sm:px-2.5 lg:px-3 whitespace-nowrap min-w-[130px] text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span>{t("field.status")}</span>
                    {crudStyle === "enterprise-ribbon" && (
                      <ColumnHeaderFilter
                        field="status"
                        label={t("field.status")}
                        filterValue={colFilters.status || ""}
                        onFilterChange={(v) => handleColumnFilterChange("status", v)}
                        onSortChange={(dir) => handleColumnSort("status", dir)}
                        sortDirection={colSort.field === "status" ? colSort.direction : null}
                      />
                    )}
                  </div>
                </th>
              )}

              {/* Receiver */}
              {visibleColumnsMap.receiver !== false && (
                <th className="sticky top-0 z-20 bg-cushion py-2.5 lg:py-2.5 xl:py-3 px-2.5 sm:px-2.5 lg:px-3 whitespace-nowrap min-w-[105px]">
                  <div className="flex items-center justify-between gap-1">
                    <span>{t("field.receiver")}</span>
                    {crudStyle === "enterprise-ribbon" && (
                      <ColumnHeaderFilter
                        field="receiver"
                        label={t("field.receiver")}
                        filterValue={colFilters.receiver || ""}
                        onFilterChange={(v) => handleColumnFilterChange("receiver", v)}
                        onSortChange={(dir) => handleColumnSort("receiver", dir)}
                        sortDirection={colSort.field === "receiver" ? colSort.direction : null}
                      />
                    )}
                  </div>
                </th>
              )}

              {/* Actions Header */}
              {visibleColumnsMap.actions !== false && (
                <th className="sticky top-0 z-20 bg-cushion py-2.5 lg:py-2.5 xl:py-3 px-2.5 sm:px-2.5 lg:px-3 whitespace-nowrap min-w-[115px] text-center">
                  <span>{t("field.actions")}</span>
                </th>
              )}
            </tr>
          </thead>

          <motion.tbody
            key={effectiveFilter}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.fast, ease: EASE_OUT }}
            className="av-rows-contained-sm divide-y divide-[var(--av-border-subtle)] text-xs text-ink"
          >
            {isLoading ? (
              <SkeletonRows rows={8} columns={activeColCount} />
            ) : displayedItems.length > 0 ? (
              displayedItems.map((row, idx) => (
                <TicketRow
                  key={row.id || idx}
                  row={row}
                  query={term}
                  effectiveFilter={effectiveFilter}
                  requireApproval={requireApproval}
                  disableStatusDropdown={disableStatusDropdown}
                  onView={handleViewRow}
                  onEdit={handleEditRow}
                  onPrint={setPrintItem}
                  onDelete={setDeleteConfirmItem}
                  onApprove={handleApproveClick}
                  onStatusChange={handleInlineStatusChange}
                  isSelected={checkedRowId === row.id}
                  onSelectRow={handleSelectRow}
                  visibleColumns={visibleColumnsMap}
                  isRibbonMode={crudStyle === "enterprise-ribbon"}
                />
              ))
            ) : (
              <tr>
                <td colSpan={activeColCount} className="p-0">
                  {/* An empty queue is usually the GOOD outcome here — every
                      ticket inspected, nothing awaiting parts — so this is
                      deliberately calm rather than warning-coloured. */}
                  <EmptyState
                    icon={Inbox}
                    title={t("msg.noRecordsSearch")}
                    action={
                      searchTerm ? (
                        <button
                          type="button"
                          onClick={() => setSearchTerm("")}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-ink bg-surface border border-prominent hover:bg-cushion transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
                        >
                          {t("state.clearSearch")}
                        </button>
                      ) : undefined
                    }
                  />
                </td>
              </tr>
            )}

            {/* Placeholder rows for the batch in flight, so the scroll has
                somewhere to land instead of stopping dead at the sentinel. */}
            {isLoadingMore && <SkeletonRows rows={3} columns={activeColCount} />}

            {/* Infinite-scroll sentinel — observing this row triggers the next
                page fetch. Kept inside <tbody> so the markup stays valid. */}
            {!isLoading && displayedItems.length > 0 && (
              <tr ref={sentinelRef}>
                <td colSpan={activeColCount} className="py-4 text-center">
                  <InfiniteScrollStatus
                    isLoadingMore={isLoadingMore}
                    reachedEnd={reachedEnd}
                    limitReached={limitReached}
                    count={displayedItems.length}
                  />
                </td>
              </tr>
            )}
          </motion.tbody>
        </table>
      </div>

      {/* Status Bar — infinite scroll replaces page controls, so this reports
          how much of the result set is currently loaded. */}
      <div className="p-3 md:p-4 shrink-0 border-t border-subtle bg-cushion/50 flex flex-wrap items-center justify-between gap-3 ">
        <span className="text-xs text-ink-secondary ">
          {t("table.loaded")} <strong className="text-ink ">{items.length}</strong>
          {totalCount > items.length && (
            <> {t("page.of")} <strong className="text-ink ">{totalCount}</strong></>
          )}{" "}
          {items.length === 1 ? t("table.item") : t("table.items")}
          {term && <> {t("table.matching")} &ldquo;{term}&rdquo;</>}
        </span>

        <div className="flex items-center gap-1.5 text-xs text-ink-secondary ">
          <span>{t("table.loadPerScroll")}</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="px-2 py-1 border border-subtle rounded-lg bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-accent text-xs cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      <ServiceDetailModal
        key={selectedItem?.id ?? "closed"}
        item={selectedItem}
        mode={modalMode}
        prefill={prefill}
        onClose={() => {
          setSelectedItem(null);
          // Dropped with the dialog, so a form the user opens by hand next
          // doesn't inherit values the assistant typed into the last one.
          setPrefill(undefined);
        }}
        onSave={handleSaveItem}
      />

      <PrintPreviewSidebar
        isOpen={Boolean(printItem)}
        onClose={() => setPrintItem(null)}
        item={printItem}
      />

      {approveItem && (
        <ApproveRepairDialog
          item={approveItem}
          onClose={() => setApproveItem(null)}
          onApproved={() => {
            invalidateCachePrefix("repairservices");
            void refreshLoaded();
          }}
        />
      )}

      {/* Delete Ticket Confirmation Modal */}
      <ModalWrapper
        open={!!deleteConfirmItem}
        onClose={() => setDeleteConfirmItem(null)}
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
            <h3 className="text-sm font-bold text-ink">{t("table.deleteTicketTitle")}</h3>
            <p className="text-xs text-ink-secondary">
              {t("table.deleteTicketBody", {
                ref: deleteConfirmItem?.reportNo ?? "",
                company: deleteConfirmItem?.companyName ?? "",
              })}
            </p>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-subtle">
            <button
              type="button"
              onClick={() => setDeleteConfirmItem(null)}
              className="px-4 py-2 text-xs font-semibold text-ink bg-sunken rounded-xl hover:bg-sunken transition-colors"
            >
              {t("action.cancel")}
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="px-5 py-2 text-xs font-semibold text-white bg-danger rounded-xl hover:bg-danger shadow-md transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] disabled:opacity-60"
            >
              {isDeleting ? t("table.deleting") : t("table.confirmDelete")}
            </button>
          </div>
        </div>
      </ModalWrapper>

      {/* Stock Shortage Alert Center Modal */}
      <StockShortageAlertModal
        open={Boolean(stockShortageDetails)}
        onClose={() => {
          setStockShortageDetails(null);
          setStockShortageTargetItem(null);
        }}
        details={stockShortageDetails}
        targetItem={stockShortageTargetItem}
        onConfirmSentSpareparts={async (target) => {
          await handleInlineStatusChange(target, "Sent Spareparts");
        }}
      />

      {/* Centered Workflow Validation Popup Modal */}
      <ApproveValidationModal
        open={validationModal.open}
        onClose={() => setValidationModal({ open: false, ticket: null })}
        ticket={validationModal.ticket}
        ruleCode={validationModal.ruleCode}
        message={validationModal.message}
      />
    </div>
  );
}
