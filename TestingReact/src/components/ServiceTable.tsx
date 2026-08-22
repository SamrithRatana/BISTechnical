"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Download, Eye, Edit3, Search, RefreshCw, Plus, Printer, Trash2, ShieldCheck, Inbox } from "lucide-react";
import toast from "react-hot-toast";
import { DUR, EASE_OUT } from "@/lib/animations";
import { fetchRepairServices, updateServiceStatus, deleteTechnicalService, RepairServiceItem, invalidateCachePrefix } from "@/services/api";
import { getActionUserForStatus } from "@/services/types";
import { useRealtimeTickets } from "@/hooks/useRealtimeTickets";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSearchQueryParam } from "@/hooks/useSearchQueryParam";
import { useSearchAction } from "@/hooks/useSearchAction";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import InfiniteScrollStatus from "./InfiniteScrollStatus";
import { EmptyState, SkeletonRows } from "@/components/av";
import ServiceDetailModal from "./ServiceDetailModal";
import ApproveRepairDialog from "./ApproveRepairDialog";
import HighlightText from "./HighlightText";
import StatusTabMenu, { TabItem } from "./StatusTabMenu";
import PrintPreviewSidebar from "./PrintPreviewSidebar";
import { useActionHandler, type ActionValues } from "./ActionBus";
import { useI18n } from "@/i18n/LanguageProvider";
import { translatePriority, translateStatus } from "@/i18n/statusLabel";
import { ModalWrapper } from "@/components/av/ModalWrapper";

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
}

const getStatusBadge = (status: string) => {
  const s = status?.toUpperCase() || "";
  if (s === "FINISHED")
    return "bg-success-soft text-success-fg ";
  if (s.includes("AWAITING CUSTOMER"))
    return "bg-warning-soft text-warning-fg ";
  if (s.includes("AWAITING SPAREPART") || s.includes("SENT SPAREPARTS"))
    return "bg-info-soft text-info-fg ";
  if (s.includes("THIRD-PARTY") || s.includes("THIRD PARTY"))
    return "bg-accent-soft text-accent ";
  if (s.includes("REJECTED"))
    return "bg-danger-soft text-danger-fg ";
  if (s.includes("UNREPAIRABLE"))
    return "bg-warning-soft text-warning-fg ";
  if (s.includes("REPAIRING"))
    return "bg-info-soft text-info-fg ";
  return "bg-sunken text-ink ";
};

const getPriorityBadge = (priority: string) => {
  switch (priority?.toUpperCase()) {
    case "HIGH":
      return "bg-danger-soft text-danger-fg border-danger ";
    case "LOW":
      return "bg-success-soft text-success-fg border-success ";
    default:
      return "bg-warning-soft text-warning-fg border-warning ";
  }
};

function RenderStatusSelect({
  row,
  effectiveFilter,
  onStatusChange,
}: {
  row: RepairServiceItem;
  effectiveFilter: string;
  onStatusChange: (item: RepairServiceItem, newStatus: string) => void;
}) {
  const { t } = useI18n();
  const status = row.status || "RECEIVED";
  const normFilter = (effectiveFilter || "").toUpperCase();
  const selectCls =
    "px-3 py-1 text-[11px] font-semibold rounded-full border outline-none cursor-pointer text-center font-sans tracking-tight shadow-sm transition-[color,background-color,border-color,box-shadow,opacity,transform,filter]";
  // The <option> palette is fixed regardless of which coloured <select> the
  // option sits in, so it's hoisted rather than repeated on all ~15 of them.
  const optionCls = "bg-surface text-ink ";

  // 1. Received / Item Recieved tab / page
  if (
    normFilter.includes("RECEIVED") ||
    normFilter.includes("RECIEVED") ||
    status === "Item Recieved" ||
    status === "Received"
  ) {
    return (
      <select
        value={status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onStatusChange(row, e.target.value)}
        className={`${selectCls} bg-sunken text-ink border-prominent `}
      >
        <option value={status} hidden>
          {t("transition.itemReceived")}
        </option>
        <option value="Inspecting" className={optionCls}>
          {t("transition.sendToInspect")}
        </option>
      </select>
    );
  }

  // 2. Inspecting tab / page
  if (normFilter === "INSPECTING" || status === "Inspecting") {
    return (
      <select
        value={status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onStatusChange(row, e.target.value)}
        /* `accent-soft-fg`, not `accent-fg`. The two are not interchangeable:
           `accent-fg` is the colour that sits on the SOLID accent (white in
           light, near-black in dark), so pairing it with the soft tint gave
           white-on-pale-green at 1.14:1 in light and 1.29:1 in dark — text
           that was there and could not be read, in both themes. */
        className={`${selectCls} bg-accent-soft text-accent-soft-fg border-accent `}
      >
        <option value="Inspecting" hidden>
          {t("transition.inspecting")}
        </option>
        <option value="Inspection" className={optionCls}>
          {t("transition.inspectionDone")}
        </option>
        <option value="Awaiting Sparepart" className={optionCls}>
          {t("transition.sendToStock")}
        </option>
        <option value="Awaiting Customer Confirm" className={optionCls}>
          {t("transition.sendToSales")}
        </option>
      </select>
    );
  }

  // 3. Awaiting Sparepart tab / page
  if (normFilter.includes("AWAITING SPAREPART") || status === "Awaiting Sparepart") {
    return (
      <select
        value={status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onStatusChange(row, e.target.value)}
        className={`${selectCls} bg-info-soft text-info-fg border-info `}
      >
        <option value="Awaiting Sparepart" hidden>
          {t("transition.awaitingSparePart")}
        </option>
        <option value="Awaiting Customer Confirm" className={optionCls}>
          {t("transition.sendToSales")}
        </option>
        <option value="Sent Spareparts" className={optionCls}>
          {t("transition.sendSparesToTechFree")}
        </option>
      </select>
    );
  }

  // 4. Awaiting Customer Confirm tab / page
  if (normFilter.includes("AWAITING CUSTOMER CONFIRM") || status === "Awaiting Customer Confirm") {
    return (
      <select
        value={status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onStatusChange(row, e.target.value)}
        className={`${selectCls} bg-warning-soft text-warning-fg border-warning `}
      >
        <option value="Awaiting Customer Confirm" hidden>
          {t("transition.awaitingCustomer")}
        </option>
        <option value="Sale Confirmed" className={optionCls}>
          {t("transition.repairable")}
        </option>
        <option value="Customer Rejected" className={optionCls}>
          {t("transition.customerRejected")}
        </option>
        <option value="Unrepairable" className={optionCls}>
          {t("transition.unrepairable")}
        </option>
      </select>
    );
  }

  // 5. Inspection tab / page
  if (normFilter.includes("INSPECTION") || status === "Inspection") {
    return (
      <select
        value={status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onStatusChange(row, e.target.value)}
        className={`${selectCls} bg-info-soft text-info-fg border-info `}
      >
        <option value="Inspection" hidden>
          {t("transition.inspectionDone")}
        </option>
        <option value="Inspecting" className={optionCls}>
          {t("transition.reInspect")}
        </option>
        <option value="Awaiting Sparepart" className={optionCls}>
          {t("transition.sendToStock")}
        </option>
        <option value="Awaiting Customer Confirm" className={optionCls}>
          {t("transition.sendToSales")}
        </option>
      </select>
    );
  }

  // 6. Sale Confirmed tab / page
  if (normFilter.includes("SALE CONFIRMED") || status === "Sale Confirmed") {
    return (
      <select
        value={status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onStatusChange(row, e.target.value)}
        className={`${selectCls} bg-success-soft text-success-fg border-success `}
      >
        <option value="Sale Confirmed" hidden>
          {t("transition.repairable")}
        </option>
        <option value="Sent Spareparts" className={optionCls}>
          {t("transition.sendSparesToTech")}
        </option>
      </select>
    );
  }

  // 7. Repairing / Sent Spareparts
  if (
    normFilter.includes("REPAIRING") ||
    normFilter.includes("SENT SPAREPARTS") ||
    status === "Sent Spareparts" ||
    status === "Repairing"
  ) {
    return (
      <select
        value={status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onStatusChange(row, e.target.value)}
        className={`${selectCls} bg-accent-soft text-accent border-accent `}
      >
        <option value="Sent Spareparts" hidden>
          {t("transition.sparesSent")}
        </option>
        <option value="Inspection" className={optionCls}>
          {t("transition.inspectionDone")}
        </option>
        <option value="Sale Confirmed" className={optionCls}>
          {t("transition.repairable")}
        </option>
        <option value="Inspecting" className={optionCls}>
          {t("transition.adjustSparesAgain")}
        </option>
        <option value="Finished" className={optionCls}>
          {t("transition.repairDone")}
        </option>
        <option value="Unrepairable" className={optionCls}>
          {t("transition.unrepairable")}
        </option>
        <option value="Repair by Third-Party" className={optionCls}>
          {t("transition.sendToThirdParty")}
        </option>
      </select>
    );
  }

  // Static badge for other statuses
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-[10.5px] font-bold tracking-tight ${getStatusBadge(status)}`}>
      {translateStatus(status, t)}
    </span>
  );
}

export default function ServiceTable({
  activeFilter,
  tabs,
  onTabChange,
  activeTabKey,
  requireApproval,
}: ServiceTableProps) {
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState(25);

  const [selectedItem, setSelectedItem] = useState<RepairServiceItem | null>(null);
  const [printItem, setPrintItem] = useState<RepairServiceItem | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "edit">("view");
  /**
   * Field values the detail form should open with, when the assistant was asked
   * to fill it in. Prefill only — the modal types them into its inputs and
   * stops, so the Save click stays with the user.
   */
  const [prefill, setPrefill] = useState<ActionValues | undefined>(undefined);

  const effectiveFilter = activeTabKey || activeFilter;

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
      fetchRepairServices(pageNumber, size, effectiveFilter, term),
    pageSize,
    // Filter/tab and search both restart the list from page 1.
    resetKey: `${effectiveFilter}|${term}`,
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
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  };

  const handleInlineStatusChange = async (item: RepairServiceItem, newStatus: string) => {
    // Business rule validation: if current status is 'Sale Confirmed' and ticket has spare parts attached, warn
    const parts = item.sparePartItems || item.sparepartItems || [];
    if (item.status === 'Sale Confirmed' && parts.length > 0) {
      toast.error(t("msg.cannotChangeStatusSpareParts"), { position: 'bottom-right' });
      return;
    }

    // Optimistic UI update
    const updated = { ...item, status: newStatus };
    setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));

    // Send update request to server
    await updateServiceStatus(item, newStatus);
    // Reload dataset to ensure fresh state
    void refreshLoaded();
  };

  const [deleteConfirmItem, setDeleteConfirmItem] = useState<RepairServiceItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [approveItem, setApproveItem] = useState<RepairServiceItem | null>(null);

  const handleApproveClick = (row: RepairServiceItem) => {
    // Same gate as ApproveRepairDialog's own submit-time check — checked
    // here too so a blocked ticket never even opens the dialog.
    const parts = row.sparePartItems || row.sparepartItems || [];
    if (row.status === "Sale Confirmed" && parts.length > 0) {
      toast.error(
        t("msg.cannotApproveSpareParts", { ref: row.reportNo ?? "" }),
        { position: "bottom-right" }
      );
      return;
    }
    if (row.status === "Inspection" && row.serviceType === "Charge") {
      toast.error(
        t("msg.cannotApproveCharge", { ref: row.reportNo ?? "" }),
        { position: "bottom-right" }
      );
      return;
    }
    setApproveItem(row);
  };

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
    setIsDeleting(true);
    const success = await deleteTechnicalService(deleteConfirmItem.id);
    setIsDeleting(false);
    setDeleteConfirmItem(null);
    if (success) {
      invalidateCachePrefix("repairservices");
      void refreshLoaded();
    } else {
      // Optimistic fallback
      setItems((prev) => prev.filter((i) => i.id !== deleteConfirmItem.id));
      setTotalCount((prev) => Math.max(prev - 1, 0));
    }
  };

  const handleCreateTicket = (values?: ActionValues) => {
    const newItem: RepairServiceItem = {
      id: "new-" + Date.now(),
      reportNo: `SVC-${Math.floor(1000 + Math.random() * 9000)}`,
      serviceDate: new Date().toISOString(),
      companyName: "",
      address: "",
      phoneNumber: "",
      itemId: "",
      itemName: "",
      serialNumber: "",
      serviceLocation: "Workshop",
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
    <div className={`flex-1 flex flex-col min-h-0 min-w-0 rounded-2xl overflow-hidden ${tableContainerClass}`}>
      {/* Sub-status Tab Menu Header */}
      {tabs && tabs.length > 0 && (
        <div className={"px-4 pt-3 pb-2 shrink-0 border-b border-subtle bg-cushion"}>
          <StatusTabMenu
            tabs={tabs}
            activeKey={activeTabKey || activeFilter}
            onTabChange={(k: string) => onTabChange?.(k)}
            loading={isLoading}
          />
        </div>
      )}

      {/* Table Toolbar */}
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
          <button
            onClick={() => handleCreateTicket()}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 lg:py-1.5 xl:py-2 text-xs font-semibold rounded-xl transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] ${createBtnClass}`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t("action.createTicket")}</span>
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

      {/* Table Content */}
      <div ref={scrollRootRef} className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
        <table className="w-full text-left border-collapse min-w-full">
          <thead>
            {/* Sticky header */}
            <tr
              className={`sticky top-0 z-10 text-[10.5px] lg:text-[10.5px] xl:text-[11px] font-semibold uppercase tracking-wider shadow-soft-sm ${headerRowClass}`}
            >
              <th className="py-2.5 lg:py-2.5 xl:py-3.5 px-2.5 sm:px-3 xl:px-3.5 whitespace-nowrap min-w-[110px]">{t("field.refNo")}</th>
              <th className="py-2.5 lg:py-2.5 xl:py-3.5 px-2.5 sm:px-3 xl:px-3.5 whitespace-nowrap min-w-[130px]">{t("field.receiveDate")}</th>
              <th className="py-2.5 lg:py-2.5 xl:py-3.5 px-2.5 sm:px-3 xl:px-3.5 whitespace-nowrap min-w-[160px]">{t("field.companyName")}</th>
              <th className="py-2.5 lg:py-2.5 xl:py-3.5 px-2.5 sm:px-3 xl:px-3.5 whitespace-nowrap min-w-[160px]">{t("table.itemNameModel")}</th>
              <th className="py-2.5 lg:py-2.5 xl:py-3.5 px-2.5 sm:px-3 xl:px-3.5 whitespace-nowrap min-w-[120px]">{t("field.serialNumber")}</th>
              <th className="py-2.5 lg:py-2.5 xl:py-3.5 px-2.5 sm:px-3 xl:px-3.5 whitespace-nowrap min-w-[90px] text-center">{t("field.priority")}</th>
              <th className="py-2.5 lg:py-2.5 xl:py-3.5 px-2.5 sm:px-3 xl:px-3.5 whitespace-nowrap min-w-[140px] text-center">{t("field.status")}</th>
              <th className="py-2.5 lg:py-2.5 xl:py-3.5 px-2.5 sm:px-3 xl:px-3.5 whitespace-nowrap min-w-[110px]">{t("field.receiver")}</th>
              <th className="py-2.5 lg:py-2.5 xl:py-3.5 px-2.5 sm:px-3 xl:px-3.5 whitespace-nowrap min-w-[100px] text-center">{t("field.actions")}</th>
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
              <SkeletonRows rows={8} columns={9} />
            ) : items.length > 0 ? (
              items.map((row, idx) => (
                <tr
                  key={row.id || idx}
                  onClick={() => {
                    setModalMode("view");
                    setSelectedItem(row);
                  }}
                  className="cursor-pointer transition-colors duration-150 ease-out hover:bg-cushion"
                >
                  <td className="py-2.5 lg:py-2.5 xl:py-3.5 px-2.5 sm:px-3 xl:px-3.5 whitespace-nowrap font-mono font-semibold text-ink ">
                    <HighlightText text={row.reportNo || "N/A"} query={searchTerm} />
                  </td>
                  <td className="py-2.5 lg:py-2.5 xl:py-3.5 px-2.5 sm:px-3 xl:px-3.5 whitespace-nowrap text-ink-secondary ">
                    {row.serviceDate
                      ? `${new Date(row.serviceDate).toLocaleDateString("en-GB")} ${new Date(row.serviceDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : "N/A"}
                  </td>
                  <td
                    className="py-2.5 lg:py-2.5 xl:py-3.5 px-2.5 sm:px-3 xl:px-3.5 font-medium text-ink max-w-[220px] truncate"
                    title={row.companyName || "N/A"}
                  >
                    <HighlightText text={row.companyName || "N/A"} query={searchTerm} />
                  </td>
                  <td
                    className="py-2.5 lg:py-2.5 xl:py-3.5 px-2.5 sm:px-3 xl:px-3.5 font-medium text-ink max-w-[240px] truncate"
                    title={row.itemName || "N/A"}
                  >
                    <HighlightText text={row.itemName || "N/A"} query={searchTerm} />
                  </td>
                  <td className="py-2.5 lg:py-2.5 xl:py-3.5 px-2.5 sm:px-3 xl:px-3.5 whitespace-nowrap">
                    <code className="px-2 py-0.5 rounded bg-sunken border border-subtle text-[11px] font-mono text-ink ">
                      <HighlightText text={row.serialNumber || "N/A"} query={searchTerm} />
                    </code>
                  </td>
                  <td className="py-2.5 lg:py-2.5 xl:py-3.5 px-2.5 sm:px-3 xl:px-3.5 whitespace-nowrap text-center">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${getPriorityBadge(
                        row.servicePriority || "NORMAL"
                      )}`}
                    >
                      {translatePriority(row.servicePriority || "NORMAL", t)}
                    </span>
                  </td>
                  <td className="py-2.5 lg:py-2.5 xl:py-3.5 px-2.5 sm:px-3 xl:px-3.5 whitespace-nowrap text-center">
                    <RenderStatusSelect
                      row={row}
                      effectiveFilter={effectiveFilter}
                      onStatusChange={handleInlineStatusChange}
                    />
                  </td>
                  <td className="py-2.5 lg:py-2.5 xl:py-3.5 px-2.5 sm:px-3 xl:px-3.5 whitespace-nowrap text-ink-secondary ">
                    <HighlightText text={getActionUserForStatus(row)} query={searchTerm} />
                  </td>
                  <td className="py-2.5 lg:py-2.5 xl:py-3.5 px-2.5 sm:px-3 xl:px-3.5 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      {requireApproval && (
                        <button
                          onClick={() => handleApproveClick(row)}
                          className="inline-flex min-h-6 items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white bg-success hover:bg-success shadow-sm transition-colors"
                          title={t("nav.approveRepairing")}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {t("action.approve")}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setModalMode("view");
                          setSelectedItem(row);
                        }}
                        className="p-1.5 rounded-lg text-info hover:bg-accent-soft transition-colors "
                        title={t("action.viewDetails")}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setModalMode("edit");
                          setSelectedItem(row);
                        }}
                        className="p-1.5 rounded-lg text-ink-secondary hover:bg-sunken transition-colors "
                        title={t("action.editTicket")}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setPrintItem(row)}
                        className="p-1.5 rounded-lg text-accent hover:bg-accent-soft transition-colors "
                        title={t("action.printTechnicalReport")}
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmItem(row)}
                        className="p-1.5 rounded-lg text-ink-secondary hover:text-danger hover:bg-danger-soft transition-colors "
                        title={t("action.deleteTicket")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="p-0">
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
            {isLoadingMore && <SkeletonRows rows={3} columns={9} />}

            {/* Infinite-scroll sentinel — observing this row triggers the next
                page fetch. Kept inside <tbody> so the markup stays valid. */}
            {!isLoading && items.length > 0 && (
              <tr ref={sentinelRef}>
                <td colSpan={9} className="py-4 text-center">
                  <InfiniteScrollStatus
                    isLoadingMore={isLoadingMore}
                    reachedEnd={reachedEnd}
                    limitReached={limitReached}
                    count={items.length}
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
    </div>
  );
}
