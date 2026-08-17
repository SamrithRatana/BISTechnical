"use client";

/**
 * @file inspect-item/page.tsx
 * @description Inspect Items page — matches InspectItemList.razor.
 * Shows items with status "Inspecting". Technicians click "Accept"
 * (ទទួល) to open the InspectItemDialog and save diagnostic details.
 */

import React, { useState, useCallback } from "react";
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
import { useSafeTimeout } from "@/hooks/useSafeTimeout";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { useSearchAction } from "@/hooks/useSearchAction";
import InfiniteScrollStatus from "@/components/InfiniteScrollStatus";
import { useActionHandler, type ActionValues } from "@/components/ActionBus";
import { useI18n } from "@/i18n/LanguageProvider";
import {
  fetchRepairServices,
  invalidateCachePrefix,
  type RepairServiceItem
} from "@/services/api";
import {
  Search,
  RefreshCw,
  Eye,
  CheckCircle,
  Download,
  Printer
} from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  // `accent-soft-fg` pairs with `accent-soft`. `accent-fg` is for the SOLID
  // accent — on the soft tint it rendered white-on-pale-green (1.14:1) in
  // light and near-black-on-dark-green (1.29:1) in dark. Unreadable in both.
  Inspecting: "bg-accent-soft text-accent-soft-fg "
};

function fmtDate(d?: string): string {
  if (!d) return "N/A";
  const dt = new Date(d);
  return `${dt.toLocaleDateString("en-GB")} ${formatTime24HourWithAmPm(dt)}`;
}

export default function InspectItemPage() {
  const { t } = useI18n();
  const [searchTerm,    setSearchTerm]    = useState("");
  const pageSize                          = 25;

  const [viewItem,    setViewItem]    = useState<RepairServiceItem | null>(null);
  const [inspectItem, setInspectItem] = useState<RepairServiceItem | null>(null);
  const [printItem,   setPrintItem]   = useState<RepairServiceItem | null>(null);
  const [toastMsg,    setToastMsg]    = useState<string | null>(null);

  // Cancelled on unmount — see approve-verify for the same pattern.
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
    refresh: loadData
  } = useInfiniteList<RepairServiceItem, HTMLDivElement, HTMLTableRowElement>({
    fetchPage: (pageNumber, size) => fetchRepairServices(pageNumber, size, "Inspecting", term),
    pageSize,
    resetKey: term,
    getId: (i) => i?.id
  });

  // ✅ Real-time auto-refresh
  const handleRealtimeUpdate = useCallback(() => {
    void loadData();
  }, [loadData]);
  useRealtimeTickets("Inspecting", handleRealtimeUpdate);

  // ── Actions requested from elsewhere (the AI assistant today) ────────────
  //
  // `ticket.inspect` opens the same dialog the row's Accept button opens, with
  // the findings and solution already typed in when the user dictated them.
  // The technician still reviews the spare-parts list and presses Save.
  const [inspectPrefill, setInspectPrefill] = useState<ActionValues | undefined>(undefined);

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
    "ticket.inspect",
    (ref, values) => {
      const row = findRow(ref);
      if (!row) return false;
      setInspectPrefill(values);
      setInspectItem(row);
      return true;
    },
    items.length
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

  // Closes whatever this page currently has open — the same thing Cancel or X
  // does, discarding anything typed. Always reports success: the request is
  // "leave nothing open", and that is true afterwards whether or not a dialog
  // happened to be showing.
  useActionHandler("ui.dialog.close", () => {
    setInspectItem(null);
    setInspectPrefill(undefined);
    setViewItem(null);
    setPrintItem(null);
    return true;
  });

  useActionHandler("ui.refresh", () => {
    invalidateCachePrefix("repairservices");
    void loadData();
    return true;
  });

  useActionHandler("export.csv", () => {
    if (items.length === 0) return false;
    handleExportCSV();
    return true;
  }, items.length);

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
          isHoldStatus: true
        }))
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
        body: JSON.stringify(finalPayload)
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
    if (!items.length) return;
    const headers = ["Ref No", "Received Date", "Company", "Item", "Serial", "Status"];
    const rows = items.map((i) => [
      `"${i.reportNo}"`, `"${i.serviceDate}"`, `"${i.companyName}"`,
      `"${i.itemName}"`, `"${i.serialNumber}"`, `"${i.status}"`,
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = Object.assign(document.createElement("a"), { href: encodeURI(csv), download: `inspect_items_${Date.now()}.csv` });
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return (
    <PageWrapper titleKey="nav.inspectItems" subtitleKey="sub.inspectItems">

      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-success text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 enter-pop">
          <CheckCircle className="w-4 h-4" />
          {toastMsg}
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0 bg-surface border border-subtle/80 rounded-2xl shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="p-4 shrink-0 border-b border-subtle bg-cushion/50 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                placeholder={t("table.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 text-xs border border-subtle rounded-xl bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent w-72 "
              />
            </div>
            <button onClick={() => void loadData()} className="p-2 text-ink-secondary hover:bg-sunken rounded-xl transition-colors " title={t("queue.reload")}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <button onClick={handleExportCSV} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-ink bg-surface border border-subtle rounded-xl hover:bg-cushion transition-colors ">
            <Download className="w-3.5 h-3.5" />
            {t("action.exportCsv")}
          </button>
        </div>

        {/* Table — also the IntersectionObserver root for infinite scroll */}
        <div ref={scrollRootRef} className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
          <table className="w-full text-left border-collapse min-w-full text-xs">
            <thead>
              <tr className="bg-cushion border-b border-subtle/80 text-[11px] font-bold text-ink-secondary uppercase tracking-wider">
                <th className="py-3 px-4 whitespace-nowrap">{t("field.refNo")}</th>
                <th className="py-3 px-4 whitespace-nowrap">{t("field.receiveDate")}</th>
                <th className="py-3 px-4 whitespace-nowrap">{t("field.companyName")}</th>
                <th className="py-3 px-4 whitespace-nowrap">{t("queue.itemModel")}</th>
                <th className="py-3 px-4 whitespace-nowrap">{t("queue.serialNo")}</th>
                <th className="py-3 px-4 whitespace-nowrap">{t("queue.location")}</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">{t("field.status")}</th>
                <th className="py-3 px-4 whitespace-nowrap">{t("queue.createdBy")}</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">{t("field.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle text-ink ">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={9} className="py-3.5 px-4">
                      <div className="h-4 bg-sunken rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : items.length > 0 ? (
                items.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => { setViewItem(row); }}
                    className="hover:bg-cushion/80 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-ink whitespace-nowrap">
                      <HighlightText text={row.reportNo} query={searchTerm} />
                    </td>
                    <td className="py-3 px-4 text-ink-secondary whitespace-nowrap">{fmtDate(row.serviceDate)}</td>
                    <td className="py-3 px-4 font-medium text-ink max-w-[200px] truncate" title={row.companyName}>
                      <HighlightText text={row.companyName} query={searchTerm} />
                    </td>
                    <td className="py-3 px-4 max-w-[220px] truncate" title={row.itemName}>
                      <HighlightText text={row.itemName} query={searchTerm} />
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <code className="px-2 py-0.5 rounded bg-sunken border border-subtle text-[11px] font-mono text-ink ">
                        <HighlightText text={row.serialNumber} query={searchTerm} />
                      </code>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-ink-secondary ">{row.serviceLocation || "—"}</td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className={`inline-block px-3 py-1 rounded-full text-[10.5px] font-bold tracking-tight ${STATUS_BADGE[row.status] ?? "bg-sunken text-ink-secondary "}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-ink-secondary ">{getActionUserForStatus(row)}</td>
                    <td className="py-3 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {/* View detail */}
                        <button
                          onClick={() => setViewItem(row)}
                          className="p-1.5 rounded-lg text-info hover:bg-accent-soft transition-colors"
                          title={t("action.viewDetails")}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {/* Print Report */}
                        <button
                          onClick={() => setPrintItem(row)}
                          className="p-1.5 rounded-lg text-ink-secondary hover:bg-sunken transition-colors"
                          title={t("action.printTechnicalReport")}
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {/* Accept (Inspect) */}
                        <button
                          onClick={() => setInspectItem(row)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white bg-accent hover:bg-accent shadow-sm transition-colors"
                          title={t("queue.acceptStartInspection")}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          {t("action.accept")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-ink-muted">
                    {t("queue.emptyInspecting")}
                  </td>
                </tr>
              )}

              {/* Infinite-scroll sentinel — observing this row pulls the next batch. */}
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

        {/* Status Bar — infinite scroll replaces the page controls */}
        <div className="p-4 shrink-0 border-t border-subtle bg-cushion/50 flex items-center justify-between">
          <span className="text-xs text-ink-secondary ">
            {t("table.loaded")} <strong className="text-ink ">{items.length}</strong>
            {totalCount > items.length && (
              <> {t("page.of")} <strong className="text-ink ">{totalCount}</strong></>
            )}{" "}
            {items.length === 1 ? t("table.item") : t("table.items")}
            {term && <> {t("table.matching")} &ldquo;{term}&rdquo;</>}
          </span>
        </div>
      </div>

      {/* View Dialog */}
      {viewItem && <ServiceDetailModal item={viewItem} mode="view" onClose={() => setViewItem(null)} />}

      {/* Accept / Inspect Dialog */}
      {inspectItem && (
        <InspectItemDialog
          item={inspectItem}
          prefill={inspectPrefill}
          onClose={() => {
            setInspectItem(null);
            // Dropped with the dialog, so the next inspection the technician
            // opens by hand starts from the ticket's own values.
            setInspectPrefill(undefined);
          }}
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
