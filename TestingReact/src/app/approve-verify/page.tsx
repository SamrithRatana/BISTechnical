"use client";

/**
 * @file approve-verify/page.tsx
 * @description Final QA & Verification queue prior to customer handover.
 * Matches ApproveVerify.razor exactly:
 *  - Lists tickets with status "Finished"
 *  - Each row has a "Verify ✓" button that calls POST /api/proxy/finishedrepair
 *  - View details via ServiceDetailModal
 */

import React, { useState, useEffect, useCallback } from "react";
import PageWrapper from "@/components/PageWrapper";
import HighlightText from "@/components/HighlightText";
import ServiceDetailModal from "@/components/ServiceDetailModal";
import PrintPreviewSidebar from "@/components/PrintPreviewSidebar";
import { getActionUserForStatus } from "@/services/types";
import { getCurrentUserGuid } from "@/services/userService";
import { useRealtimeTickets } from "@/hooks/useRealtimeTickets";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  fetchRepairServices,
  updateServiceStatus,
  type RepairServiceItem,
  type PaginatedResult,
} from "@/services/api";
import {
  Search,
  RefreshCw,
  Eye,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  CheckCircle,
  Loader2,
  Printer,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d?: string): string {
  if (!d) return "N/A";
  const dt = new Date(d);
  return `${dt.toLocaleDateString("en-GB")} ${dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

const PRIORITY_BADGE: Record<string, string> = {
  HIGH:   "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300",
  LOW:    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300",
  NORMAL: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ApproveVerifyPage() {
  const [searchTerm,   setSearchTerm]   = useState("");
  const [currentPage,  setCurrentPage]  = useState(1);
  const pageSize                        = 10;
  const [isLoading,    setIsLoading]    = useState(true);
  const [data,         setData]         = useState<PaginatedResult<RepairServiceItem>>({
    items: [], totalCount: 0, pageNumber: 1, pageSize, totalPages: 0,
  });

  const [viewItem,    setViewItem]    = useState<RepairServiceItem | null>(null);
  const [printItem,   setPrintItem]   = useState<RepairServiceItem | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [toastMsg,    setToastMsg]    = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const debouncedSearch = useDebouncedValue(searchTerm, 300);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const loadData = useCallback(async () => {
    if (!data.items || data.items.length === 0) {
      setIsLoading(true);
    }
    const term = debouncedSearch.trim();
    const res = await fetchRepairServices(currentPage, pageSize, "Finished", term);
    setData(res);
    setIsLoading(false);
  }, [currentPage, pageSize, debouncedSearch]);

  useEffect(() => { void loadData(); }, [loadData]);

  // ✅ Real-time auto-refresh
  const handleRealtimeUpdate = useCallback(() => { void loadData(); }, [loadData]);
  useRealtimeTickets("Finished", handleRealtimeUpdate);

  /**
   * Verify action — calls POST /api/proxy/finishedrepair then updates
   * status to "Finished" (idempotent; just refreshes the row).
   */
  const handleVerify = async (row: RepairServiceItem) => {
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
          finishedDate: new Date().toISOString()
        }),
      });

      if (res.ok) {
        showToast(`✓ ${row.reportNo} verified successfully!`);
        // Also update inline status for immediate feedback
        await updateServiceStatus(row, "Finished");
        void loadData();
      } else {
        // Fallback: still mark as Finished even if API fails
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
    if (!data.items.length) return;
    const headers = ["Ref No", "Finished Date", "Company", "Item", "Serial", "Priority", "Verified By"];
    const rows = data.items.map((i) => [
      `"${i.reportNo}"`, `"${i.finishedDate ?? i.serviceDate}"`,
      `"${i.companyName}"`, `"${i.itemName}"`, `"${i.serialNumber}"`,
      `"${i.servicePriority}"`, `"${i.verifiedByName ?? i.repairByName}"`,
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = Object.assign(document.createElement("a"), { href: encodeURI(csv), download: `approve_verify_${Date.now()}.csv` });
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return (
    <PageWrapper title="Approve Verify" subtitle="Final QA & Verification queue prior to customer handover (ApproveVerify.razor)">

      {/* Toast notification */}
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
            <button
              onClick={() => void loadData()}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors dark:text-slate-400 dark:hover:bg-slate-800"
              title="Reload"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
          >
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
                <th className="py-3 px-4 whitespace-nowrap">Finished Date</th>
                <th className="py-3 px-4 whitespace-nowrap">Company</th>
                <th className="py-3 px-4 whitespace-nowrap">Item / Model</th>
                <th className="py-3 px-4 whitespace-nowrap">Serial No</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Priority</th>
                <th className="py-3 px-4 whitespace-nowrap">Technician</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={8} className="py-3.5 px-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : data.items.length > 0 ? (
                data.items.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setViewItem(row)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-slate-200 whitespace-nowrap">
                      <HighlightText text={row.reportNo} query={searchTerm} />
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtDate(row.finishedDate ?? row.serviceDate)}</td>
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
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${PRIORITY_BADGE[row.servicePriority?.toUpperCase() ?? "NORMAL"] ?? PRIORITY_BADGE.NORMAL}`}>
                        {row.servicePriority ?? "NORMAL"}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400">
                      <HighlightText text={getActionUserForStatus(row)} query={searchTerm} />
                    </td>
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

                        {/* Verify */}
                        <button
                          onClick={() => void handleVerify(row)}
                          disabled={verifyingId === row.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-500/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          title="Mark as Verified / Finished"
                        >
                          {verifyingId === row.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <ShieldCheck className="w-3.5 h-3.5" />}
                          Verify
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No records in the verification queue.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 shrink-0 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Showing <strong className="text-slate-700 dark:text-slate-200">{data.items.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> to{" "}
            <strong className="text-slate-700 dark:text-slate-200">{Math.min(currentPage * pageSize, data.totalCount)}</strong> of{" "}
            <strong className="text-slate-700 dark:text-slate-200">{data.totalCount}</strong> items
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2.5 py-1 text-xs font-semibold rounded bg-blue-600 text-white">{currentPage}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, data.totalPages || 1))}
              disabled={currentPage >= (data.totalPages || 1)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
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
