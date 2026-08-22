"use client";

/**
 * @file approve-verify/page.tsx
 * @description Final QA & Verification queue prior to customer handover.
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

import React, { useState, useCallback } from "react";
import PageWrapper from "@/components/PageWrapper";
import HighlightText from "@/components/HighlightText";
import ServiceDetailModal from "@/components/ServiceDetailModal";
import PrintPreviewSidebar from "@/components/PrintPreviewSidebar";
import { getActionUserForStatus } from "@/services/types";
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
  const { t } = useI18n();
  const [searchTerm,   setSearchTerm]   = useState("");
  const pageSize                        = 25;

  const [viewItem,    setViewItem]    = useState<RepairServiceItem | null>(null);
  const [printItem,   setPrintItem]   = useState<RepairServiceItem | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [toastMsg,    setToastMsg]    = useState<string | null>(null);

  // Cancelled on unmount: 3s is long enough to leave this page,
  // and the timer would otherwise write state into a dead tree.
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
    // This queue is work *awaiting* verification, so it lists "Repairing".
    // Already-Finished tickets are deliberately excluded from the default view —
    // they need no action, and letting them accumulate would bury the handful of
    // rows that actually need someone. Searching merges them back in, so a
    // specific job is still findable by ref no, company or serial whether or not
    // it has been verified yet. That rule lives in fetchApproveVerifyServices.
    fetchPage: (pageNumber, size) => fetchApproveVerifyServices(pageNumber, size, term),
    pageSize,
    resetKey: term,
    getId: (i) => i?.id,
  });

  // ✅ Real-time auto-refresh. Keyed on "Repairing" because that is what this
  // queue now shows — listening on "Finished" would refresh on the tickets that
  // just left the list and miss the ones arriving into it.
  const handleRealtimeUpdate = useCallback(() => { void loadData(); }, [loadData]);
  useRealtimeTickets("Repairing", handleRealtimeUpdate);

  /**
   * Verify action — calls POST /api/proxy/finishedrepair then updates
   * status to "Finished" (idempotent; just refreshes the row).
   */
  const handleVerify = async (row: RepairServiceItem) => {
    // Only a ticket still under repair can be verified. The button is disabled
    // for anything else, but this guard stands on its own — a Finished row can
    // reach here from a stale render or a keyboard activation, and verifying it
    // twice would stamp a second finishedDate over the real one.
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

  // ── Actions requested from elsewhere (the AI assistant today) ────────────
  //
  // Verifying is deliberately absent: it writes immediately with no
  // confirmation step, so it stays a button only a person presses. What is
  // here opens or filters, and changes nothing.
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

  // Closes whatever this page currently has open — the same thing Cancel or X
  // does, discarding anything typed. Always reports success: the request is
  // "leave nothing open", and that is true afterwards whether or not a dialog
  // happened to be showing.
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
            <button
              onClick={() => void loadData()}
              className="p-2 text-ink-secondary hover:bg-sunken rounded-xl transition-colors "
              title={t("queue.reload")}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-ink bg-surface border border-subtle rounded-xl hover:bg-cushion transition-colors "
          >
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
                <th className="py-3 px-4 whitespace-nowrap">{t("queue.finishedDate")}</th>
                <th className="py-3 px-4 whitespace-nowrap">{t("field.companyName")}</th>
                <th className="py-3 px-4 whitespace-nowrap">{t("queue.itemModel")}</th>
                <th className="py-3 px-4 whitespace-nowrap">{t("queue.serialNo")}</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">{t("field.priority")}</th>
                <th className="py-3 px-4 whitespace-nowrap">{t("queue.technician")}</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">{t("field.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle text-ink ">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={8} className="py-3.5 px-4">
                      <div className="h-4 bg-sunken rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : items.length > 0 ? (
                items.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setViewItem(row)}
                    className="hover:bg-cushion/80 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-ink whitespace-nowrap">
                      <HighlightText text={row.reportNo} query={searchTerm} />
                    </td>
                    <td className="py-3 px-4 text-ink-secondary whitespace-nowrap">{fmtDate(row.finishedDate ?? row.serviceDate)}</td>
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
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${PRIORITY_BADGE[row.servicePriority?.toUpperCase() ?? "NORMAL"] ?? PRIORITY_BADGE.NORMAL}`}>
                        {translatePriority(row.servicePriority ?? "NORMAL", t)}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-ink-secondary ">
                      <HighlightText text={getActionUserForStatus(row)} query={searchTerm} />
                    </td>
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

                        {/* Verify — live only while the job is still Repairing.
                            A Finished ticket is done, so the control is disabled
                            rather than hidden: the row still shows what happened
                            to it, and the button explains why it can't be used
                            instead of silently disappearing. */}
                        {(() => {
                          const verifiable = row.status === "Repairing";
                          const busy = verifyingId === row.id;
                          return (
                            <button
                              onClick={() => void handleVerify(row)}
                              disabled={busy || !verifiable}
                              aria-disabled={busy || !verifiable}
                              className={`inline-flex min-h-6 items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold shadow-sm transition-colors disabled:cursor-not-allowed ${
                                verifiable
                                  ? "text-white bg-success hover:bg-success disabled:opacity-60"
                                  : "text-ink-secondary bg-sunken border border-subtle "
                              }`}
                              title={t(verifiable ? "queue.markVerified" : "queue.alreadyVerified")}
                            >
                              {busy
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <ShieldCheck className="w-3.5 h-3.5" />}
                              {t("action.verify")}
                            </button>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-ink-muted">
                    {t("queue.emptyVerification")}
                  </td>
                </tr>
              )}

              {/* Infinite-scroll sentinel — observing this row pulls the next batch. */}
              {!isLoading && items.length > 0 && (
                <tr ref={sentinelRef}>
                  <td colSpan={8} className="py-4 text-center">
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
