"use client";

/**
 * @file inspect-item/page.tsx
 * @description Inspect Items page — matches InspectItemList.razor.
 * Shows items with status "Inspecting". Technicians click "Accept"
 * (ទទួល) to open the InspectItemDialog and save diagnostic details.
 */

import React, { useState, useEffect, useCallback } from "react";
import PageWrapper from "@/components/PageWrapper";
import HighlightText from "@/components/HighlightText";
import InspectItemDialog, { type InspectPayload } from "@/components/InspectItemDialog";
import ServiceDetailModal from "@/components/ServiceDetailModal";
import PrintPreviewSidebar from "@/components/PrintPreviewSidebar";
import { getActionUserForStatus, formatTime24HourWithAmPm } from "@/services/types";
import { getCurrentUserGuid } from "@/services/userService";
import { useRealtimeTickets } from "@/hooks/useRealtimeTickets";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSearchQueryParam } from "@/hooks/useSearchQueryParam";
import {
  fetchRepairServices,
  updateServiceStatus,
  invalidateCachePrefix,
  type RepairServiceItem,
  type PaginatedResult,
} from "@/services/api";
import {
  Search,
  RefreshCw,
  Eye,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  ClipboardList,
  Printer,
} from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  Inspecting: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300",
};

function fmtDate(d?: string): string {
  if (!d) return "N/A";
  const dt = new Date(d);
  return `${dt.toLocaleDateString("en-GB")} ${formatTime24HourWithAmPm(dt)}`;
}

export default function InspectItemPage() {
  const [searchTerm,    setSearchTerm]    = useState("");
  const [currentPage,   setCurrentPage]   = useState(1);
  const pageSize                          = 10;
  const [isLoading,     setIsLoading]     = useState(true);
  const [data,          setData]          = useState<PaginatedResult<RepairServiceItem>>({
    items: [], totalCount: 0, pageNumber: 1, pageSize, totalPages: 0,
  });

  const [viewItem,    setViewItem]    = useState<RepairServiceItem | null>(null);
  const [inspectItem, setInspectItem] = useState<RepairServiceItem | null>(null);
  const [printItem,   setPrintItem]   = useState<RepairServiceItem | null>(null);
  const [toastMsg,    setToastMsg]    = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Seed from ?q= when arriving via the header's global search.
  useSearchQueryParam(setSearchTerm);

  const debouncedSearch = useDebouncedValue(searchTerm, 300);

  const loadData = useCallback(async () => {
    if (!data.items || data.items.length === 0) {
      setIsLoading(true);
    }
    const res = await fetchRepairServices(currentPage, pageSize, "Inspecting", debouncedSearch.trim());
    setData(res);
    setIsLoading(false);
  }, [currentPage, pageSize, debouncedSearch]);

  useEffect(() => { void loadData(); }, [loadData]);

  // ✅ Real-time auto-refresh
  const handleRealtimeUpdate = useCallback(() => {
    void loadData();
  }, [loadData]);
  useRealtimeTickets("Inspecting", handleRealtimeUpdate);

  const handleAcceptSave = async (payload: InspectPayload): Promise<boolean> => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("jwt_token") : null;
      const userGuid = getCurrentUserGuid();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const finalPayload = {
        ...payload,
        id: payload.serviceId,
        inspectBy: userGuid || undefined,
        spareParts: (payload.spareParts || []).map((sp) => ({
          ...sp,
          isHoldStatus: true,
        })),
      };

      // PUT (UpdateInspectItemCommandHandler) reconciles the sent spare-parts
      // list against what's already saved — removing lines missing from it,
      // updating matches, adding new ones. POST (CreateInspectItemCommandHandler)
      // just blindly appends every part in the payload with no such
      // reconciliation, which is why saving here used to leave removed spare
      // parts in place and duplicate the ones left untouched on every resave.
      const res = await fetch("/api/proxy/inspectitem", {
        method: "PUT",
        headers,
        body: JSON.stringify(finalPayload),
      });

      if (res.ok) {
        showToast("Inspection saved successfully!");
        invalidateCachePrefix("repairservices");
        void loadData();
        return true;
      }

      // Read error message returned by C# API / SQL Trigger
      const errBody = await res.text().catch(() => "");
      console.error("Inspect item save error:", res.status, errBody);
      showToast(errBody || "Failed to save inspection — check backend.");
      return false;
    } catch {
      return false;
    }
  };

  const handleExportCSV = () => {
    if (!data.items.length) return;
    const headers = ["Ref No", "Received Date", "Company", "Item", "Serial", "Status"];
    const rows = data.items.map((i) => [
      `"${i.reportNo}"`, `"${i.serviceDate}"`, `"${i.companyName}"`,
      `"${i.itemName}"`, `"${i.serialNumber}"`, `"${i.status}"`,
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = Object.assign(document.createElement("a"), { href: encodeURI(csv), download: `inspect_items_${Date.now()}.csv` });
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return (
    <PageWrapper title="Inspect Items" subtitle="ទទួលការងារ — Queue for technical diagnosis and initial inspection (InspectItemList.razor)">

      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="w-4 h-4" />
          {toastMsg}
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="p-4 shrink-0 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Ref No, Company, Serial..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-72 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              />
            </div>
            <button onClick={() => void loadData()} className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors dark:text-slate-400 dark:hover:bg-slate-800" title="Reload">
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <button onClick={handleExportCSV} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
          <table className="w-full text-left border-collapse min-w-full text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4 whitespace-nowrap">Ref No</th>
                <th className="py-3 px-4 whitespace-nowrap">Received Date</th>
                <th className="py-3 px-4 whitespace-nowrap">Company</th>
                <th className="py-3 px-4 whitespace-nowrap">Item / Model</th>
                <th className="py-3 px-4 whitespace-nowrap">Serial No</th>
                <th className="py-3 px-4 whitespace-nowrap">Location</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Status</th>
                <th className="py-3 px-4 whitespace-nowrap">Created By</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={9} className="py-3.5 px-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : data.items.length > 0 ? (
                data.items.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => { setViewItem(row); }}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-slate-200 whitespace-nowrap">
                      <HighlightText text={row.reportNo} query={searchTerm} />
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtDate(row.serviceDate)}</td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100 max-w-[200px] truncate" title={row.companyName}>
                      <HighlightText text={row.companyName} query={searchTerm} />
                    </td>
                    <td className="py-3 px-4 max-w-[220px] truncate" title={row.itemName}>
                      <HighlightText text={row.itemName} query={searchTerm} />
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <code className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                        <HighlightText text={row.serialNumber} query={searchTerm} />
                      </code>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400">{row.serviceLocation || "—"}</td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className={`inline-block px-3 py-1 rounded-full text-[10.5px] font-bold tracking-tight ${STATUS_BADGE[row.status] ?? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400">{getActionUserForStatus(row)}</td>
                    <td className="py-3 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {/* View detail */}
                        <button
                          onClick={() => setViewItem(row)}
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {/* Print Report */}
                        <button
                          onClick={() => setPrintItem(row)}
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                          title="Print Technical Report"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {/* Accept (Inspect) */}
                        <button
                          onClick={() => setInspectItem(row)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-500/20 transition-colors"
                          title="Accept & Start Inspection"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Accept
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No items currently in the Inspecting queue.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 shrink-0 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Showing <strong className="text-slate-700 dark:text-slate-200">{data.items.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> to <strong className="text-slate-700 dark:text-slate-200">{Math.min(currentPage * pageSize, data.totalCount)}</strong> of <strong className="text-slate-700 dark:text-slate-200">{data.totalCount}</strong> items
          </span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2.5 py-1 text-xs font-semibold rounded bg-blue-600 text-white">{currentPage}</span>
            <button onClick={() => setCurrentPage((p) => Math.min(p + 1, data.totalPages || 1))} disabled={currentPage >= (data.totalPages || 1)} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* View Dialog */}
      {viewItem && <ServiceDetailModal item={viewItem} mode="view" onClose={() => setViewItem(null)} />}

      {/* Accept / Inspect Dialog */}
      {inspectItem && (
        <InspectItemDialog
          item={inspectItem}
          onClose={() => setInspectItem(null)}
          onSave={handleAcceptSave}
        />
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
