"use client";

import React, { useState, useCallback } from "react";
import { Download, Eye, Edit3, Search, RefreshCw, Plus, Printer, Trash2, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { fetchRepairServices, updateServiceStatus, deleteTechnicalService, RepairServiceItem, invalidateCachePrefix } from "@/services/api";
import { getActionUserForStatus } from "@/services/types";
import { useRealtimeTickets } from "@/hooks/useRealtimeTickets";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSearchQueryParam } from "@/hooks/useSearchQueryParam";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import InfiniteScrollStatus from "./InfiniteScrollStatus";
import ServiceDetailModal from "./ServiceDetailModal";
import ApproveRepairDialog from "./ApproveRepairDialog";
import HighlightText from "./HighlightText";
import StatusTabMenu, { TabItem } from "./StatusTabMenu";
import PrintPreviewSidebar from "./PrintPreviewSidebar";

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
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300";
  if (s.includes("AWAITING CUSTOMER"))
    return "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300";
  if (s.includes("AWAITING SPAREPART") || s.includes("SENT SPAREPARTS"))
    return "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300";
  if (s.includes("THIRD-PARTY") || s.includes("THIRD PARTY"))
    return "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300";
  if (s.includes("REJECTED"))
    return "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300";
  if (s.includes("UNREPAIRABLE"))
    return "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300";
  if (s.includes("REPAIRING"))
    return "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300";
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
};

const getPriorityBadge = (priority: string) => {
  switch (priority?.toUpperCase()) {
    case "HIGH":
      return "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300";
    case "LOW":
      return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300";
    default:
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300";
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
  const status = row.status || "RECEIVED";
  const normFilter = (effectiveFilter || "").toUpperCase();
  const selectCls =
    "px-3 py-1 text-[11px] font-semibold rounded-full border outline-none cursor-pointer text-center font-sans tracking-tight shadow-sm transition-all";

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
        className={`${selectCls} bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700`}
      >
        <option value={status} hidden>
          បានទទួលម៉ាស៊ីន
        </option>
        <option value="Inspecting" className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100">
          បញ្ជូនទៅវិនិច្ឆ័យ
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
        className={`${selectCls} bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-800`}
      >
        <option value="Inspecting" hidden>
          កំពុងវិនិច្ឆ័យ
        </option>
        <option value="Inspection" className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100">
          វិនិច្ឆ័យរួចរាល់
        </option>
        <option value="Awaiting Sparepart" className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100">
          បញ្ជូនទៅផ្នែកស្តុក
        </option>
        <option value="Awaiting Customer Confirm" className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100">
          បញ្ជូនទៅផ្នែកទីផ្សារ
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
        className={`${selectCls} bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800`}
      >
        <option value="Awaiting Sparepart" hidden>
          រង់ចាំគ្រឿងបន្លាស់
        </option>
        <option value="Awaiting Customer Confirm" className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100">
          បញ្ជូនទៅផ្នែកទីផ្សារ
        </option>
        <option value="Sent Spareparts" className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100">
          បញ្ជូនគ្រឿងបន្លាស់ទៅជាង(ជួសជុល Free)
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
        className={`${selectCls} bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800`}
      >
        <option value="Awaiting Customer Confirm" hidden>
          រង់ចាំយល់ព្រមពីភ្ញៀវ
        </option>
        <option value="Sale Confirmed" className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100">
          ជួសជុលបាន
        </option>
        <option value="Customer Rejected" className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100">
          អតិថិជនមិនជួសជុល
        </option>
        <option value="Unrepairable" className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100">
          ជួសជុលមិនបាន
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
        className={`${selectCls} bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-200 dark:border-cyan-800`}
      >
        <option value="Inspection" hidden>
          វិនិច្ឆ័យរួចរាល់
        </option>
        <option value="Inspecting" className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100">
          វិនិច្ឆ័យម្ដងទៀត
        </option>
        <option value="Awaiting Sparepart" className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100">
          បញ្ជូនទៅផ្នែកស្តុក
        </option>
        <option value="Awaiting Customer Confirm" className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100">
          បញ្ជូនទៅផ្នែកទីផ្សារ
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
        className={`${selectCls} bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800`}
      >
        <option value="Sale Confirmed" hidden>
          អាចជួសជុលបាន
        </option>
        <option value="Sent Spareparts" className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100">
          បញ្ជូនគ្រឿងបន្លាស់ទៅជាង
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
        className={`${selectCls} bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-800`}
      >
        <option value="Sent Spareparts" hidden>
          បានបញ្ជូនគ្រឿងបន្លាស់
        </option>
        <option value="Inspection" className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100">
          វិនិច្ឆ័យរួចរាល់
        </option>
        <option value="Sale Confirmed" className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100">
          ជួសជុលបាន
        </option>
        <option value="Inspecting" className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100">
          កែតម្រូវគ្រឿងបន្លាស់ម្ដងទៀត
        </option>
        <option value="Finished" className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100">
          ជួសជុលរួចរាល់
        </option>
        <option value="Unrepairable" className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100">
          ជួសជុលមិនបាន (Unrepairable)
        </option>
        <option value="Repair by Third-Party" className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100">
          បញ្ជូនទៅជាងខាងក្រៅ (Third-Party)
        </option>
      </select>
    );
  }

  // Static badge for other statuses
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-[10.5px] font-bold tracking-tight ${getStatusBadge(status)}`}>
      {status}
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
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState(25);

  const [selectedItem, setSelectedItem] = useState<RepairServiceItem | null>(null);
  const [printItem, setPrintItem] = useState<RepairServiceItem | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "edit">("view");

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
      toast.error('Cannot change status directly. Please process spare parts first.', { position: 'bottom-right' });
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
        `${row.reportNo}: Cannot approve — spare parts are already attached. Process spare parts through Stock first.`,
        { position: "bottom-right" }
      );
      return;
    }
    if (row.status === "Inspection" && row.serviceType === "Charge") {
      toast.error(
        `${row.reportNo}: Cannot approve — this is a Charge service and must be confirmed by Sales first.`,
        { position: "bottom-right" }
      );
      return;
    }
    setApproveItem(row);
  };

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

  const handleCreateTicket = () => {
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
    setSelectedItem(newItem);
  };

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

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800">
      {/* Sub-status Tab Menu Header */}
      {tabs && tabs.length > 0 && (
        <div className="px-4 pt-3 pb-2 shrink-0 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
          <StatusTabMenu
            tabs={tabs}
            activeKey={activeTabKey || activeFilter}
            onTabChange={(k: string) => onTabChange?.(k)}
            loading={isLoading}
          />
        </div>
      )}

      {/* Table Toolbar */}
      <div className="p-3 md:p-4 shrink-0 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Report No, Company, Serial..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64 md:w-80 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
            />
          </div>

          <button
            onClick={() => {
              invalidateCachePrefix("repairservices");
              void refreshLoaded();
            }}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors dark:text-slate-400 dark:hover:bg-slate-800"
            title="Reload API Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateTicket}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Ticket</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Table Content — auto-scrolls internally within fixed viewport height.
          This element is also the IntersectionObserver root for infinite scroll. */}
      <div ref={scrollRootRef} className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
        <table className="w-full text-left border-collapse min-w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:bg-slate-800/60 dark:border-slate-800 dark:text-slate-400">
              <th className="py-2.5 px-3 sm:px-3.5 whitespace-nowrap">Ref No</th>
              <th className="py-2.5 px-3 sm:px-3.5 whitespace-nowrap">Received Date</th>
              <th className="py-2.5 px-3 sm:px-3.5 whitespace-nowrap">Company Name</th>
              <th className="py-2.5 px-3 sm:px-3.5 whitespace-nowrap">Item Name / Model</th>
              <th className="py-2.5 px-3 sm:px-3.5 whitespace-nowrap">Serial Number</th>
              <th className="py-2.5 px-3 sm:px-3.5 whitespace-nowrap text-center">Priority</th>
              <th className="py-2.5 px-3 sm:px-3.5 whitespace-nowrap text-center">Status</th>
              <th className="py-2.5 px-3 sm:px-3.5 whitespace-nowrap">Receiver</th>
              <th className="py-2.5 px-3 sm:px-3.5 whitespace-nowrap text-center">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 text-xs dark:divide-slate-800 text-slate-700 dark:text-slate-300">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td colSpan={9} className="py-3 px-4">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                  </td>
                </tr>
              ))
            ) : items.length > 0 ? (
              items.map((row, idx) => (
                <tr
                  key={row.id || idx}
                  onClick={() => {
                    setModalMode("view");
                    setSelectedItem(row);
                  }}
                  className="hover:bg-slate-50/80 cursor-pointer transition-colors dark:hover:bg-slate-800/40"
                >
                  <td className="py-2 sm:py-2.5 px-3 sm:px-3.5 whitespace-nowrap font-mono font-semibold text-slate-900 dark:text-slate-200">
                    <HighlightText text={row.reportNo || "N/A"} query={searchTerm} />
                  </td>
                  <td className="py-2 sm:py-2.5 px-3 sm:px-3.5 whitespace-nowrap text-slate-500 dark:text-slate-400">
                    {row.serviceDate
                      ? `${new Date(row.serviceDate).toLocaleDateString("en-GB")} ${new Date(row.serviceDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : "N/A"}
                  </td>
                  <td
                    className="py-2 sm:py-2.5 px-3 sm:px-3.5 font-medium text-slate-900 dark:text-slate-100 max-w-[220px] truncate"
                    title={row.companyName || "N/A"}
                  >
                    <HighlightText text={row.companyName || "N/A"} query={searchTerm} />
                  </td>
                  <td
                    className="py-2 sm:py-2.5 px-3 sm:px-3.5 font-medium text-slate-800 dark:text-slate-200 max-w-[240px] truncate"
                    title={row.itemName || "N/A"}
                  >
                    <HighlightText text={row.itemName || "N/A"} query={searchTerm} />
                  </td>
                  <td className="py-2 sm:py-2.5 px-3 sm:px-3.5 whitespace-nowrap">
                    <code className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                      <HighlightText text={row.serialNumber || "N/A"} query={searchTerm} />
                    </code>
                  </td>
                  <td className="py-2 sm:py-2.5 px-3 sm:px-3.5 whitespace-nowrap text-center">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${getPriorityBadge(
                        row.servicePriority || "NORMAL"
                      )}`}
                    >
                      {row.servicePriority || "NORMAL"}
                    </span>
                  </td>
                  <td className="py-2 sm:py-2.5 px-3 sm:px-3.5 whitespace-nowrap text-center">
                    <RenderStatusSelect
                      row={row}
                      effectiveFilter={effectiveFilter}
                      onStatusChange={handleInlineStatusChange}
                    />
                  </td>
                  <td className="py-2 sm:py-2.5 px-3 sm:px-3.5 whitespace-nowrap text-slate-600 dark:text-slate-400">
                    <HighlightText text={getActionUserForStatus(row)} query={searchTerm} />
                  </td>
                  <td className="py-2 sm:py-2.5 px-3 sm:px-3.5 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      {requireApproval && (
                        <button
                          onClick={() => handleApproveClick(row)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-500/20 transition-colors"
                          title="Approve Repairing"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Approve
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setModalMode("view");
                          setSelectedItem(row);
                        }}
                        className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors dark:text-blue-400 dark:hover:bg-slate-800"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setModalMode("edit");
                          setSelectedItem(row);
                        }}
                        className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors dark:text-slate-400 dark:hover:bg-slate-800"
                        title="Edit Ticket"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setPrintItem(row)}
                        className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors dark:text-indigo-400 dark:hover:bg-slate-800"
                        title="Print Technical Report"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmItem(row)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-slate-800"
                        title="Delete Ticket"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  No records found matching your search.
                </td>
              </tr>
            )}

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
          </tbody>
        </table>
      </div>

      {/* Status Bar — infinite scroll replaces page controls, so this reports
          how much of the result set is currently loaded. */}
      <div className="p-3 md:p-4 shrink-0 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 dark:border-slate-800 dark:bg-slate-900/50">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Loaded <strong className="text-slate-700 dark:text-slate-200">{items.length}</strong>
          {totalCount > items.length && (
            <> of <strong className="text-slate-700 dark:text-slate-200">{totalCount}</strong></>
          )}{" "}
          {items.length === 1 ? "item" : "items"}
          {term && <> matching &ldquo;{term}&rdquo;</>}
        </span>

        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span>Load per scroll:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs cursor-pointer"
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
        onClose={() => setSelectedItem(null)}
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
      {deleteConfirmItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirmItem(null); }}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 my-auto">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Delete Service Ticket</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Are you sure you want to delete ticket <strong className="font-mono text-blue-600 dark:text-blue-400">{deleteConfirmItem.reportNo}</strong> ({deleteConfirmItem.companyName})? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 rounded-xl hover:bg-rose-700 shadow-md shadow-rose-500/20 transition-all disabled:opacity-60"
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
