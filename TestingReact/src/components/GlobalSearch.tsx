"use client";

/**
 * @file GlobalSearch.tsx
 * @description System-wide ticket search in the header. Queries the same
 * server-side endpoint the ticket tables use (/technicalservices/search),
 * which matches ReportNo, CompanyName, ContactName, item name, serial number
 * and CustomerRequest across every ticket regardless of status or page.
 *
 * Selecting a result navigates to the page that owns that ticket's status and
 * seeds that page's own search box with the ticket's Ref No (via `?q=`), so
 * the ticket is the row in front of you when the page opens.
 */

import React, { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, Loader2, FileText } from "lucide-react";
import { fetchRepairServices, type RepairServiceItem } from "@/services/api";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useFloatingPanel } from "@/hooks/useFloatingPanel";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import InfiniteScrollStatus from "./InfiniteScrollStatus";
import { useI18n } from "@/i18n/LanguageProvider";
import { translateStatus } from "@/i18n/statusLabel";

/**
 * Where a ticket lives in the UI, by status. Mirrors the workflow pages:
 * a ticket only ever appears on the page matching its current status.
 */
const STATUS_ROUTES: Record<string, string> = {
  "Item Recieved":             "/receive-item",
  "Received":                  "/receive-item",
  "Inspecting":                "/inspect-item",
  "Inspection":                "/inspection",
  "Awaiting Sparepart":        "/spare-request",
  "Awaiting Customer Confirm": "/waiting-confirm",
  "Sale Confirmed":            "/confirmed-sale",
  "Sent Spareparts":           "/approve-repair",
  "Repairing":                 "/approve-repair",
  "Finished":                  "/approve-verify",
  "Customer Rejected":         "/rejected",
  "Unrepairable":              "/unrepairable",
  "Repair by Third-Party":     "/approve-repair",
};

const STATUS_BADGE: Record<string, string> = {
  "Finished":                  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  "Awaiting Customer Confirm": "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  "Awaiting Sparepart":        "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  "Customer Rejected":         "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  "Unrepairable":              "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
  "Repair by Third-Party":     "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300",
};

const PAGE_SIZE = 25;

/**
 * Merges a `useRef` object and a callback ref onto the same DOM node — needed
 * here because the panel is both the click-outside/escape boundary
 * (`useFloatingPanel`'s `panelRef`) and the IntersectionObserver root
 * (`useInfiniteList`'s `scrollRootRef`).
 */
function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>): React.RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") ref(node);
      else (ref as React.MutableRefObject<T | null>).current = node;
    }
  };
}

export default function GlobalSearch() {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  const debouncedTerm = useDebouncedValue(term, 300);

  const { anchorRef, panelRef, coords } = useFloatingPanel<HTMLDivElement, HTMLDivElement>({
    open,
    onClose: () => setOpen(false),
    width: "match",
    estimatedHeight: 320,
    align: "start",
  });

  const query = debouncedTerm.trim();

  // "All" searches every status — a global search that only covered one
  // queue would miss most of the system.
  const {
    items: results,
    isLoading,
    isLoadingMore,
    reachedEnd,
    limitReached,
    scrollRootRef,
    sentinelRef,
  } = useInfiniteList<RepairServiceItem, HTMLDivElement, HTMLDivElement>({
    fetchPage: (pageNumber, size) => fetchRepairServices(pageNumber, size, "All", query),
    pageSize: PAGE_SIZE,
    resetKey: query,
    getId: (i) => i?.id,
    disabled: query.length < 2,
  });

  const loading = query.length >= 2 && isLoading;

  // panelRef/scrollRootRef are both referentially stable across renders
  // (useRef object / an empty-deps useCallback) — memoized so the merged ref
  // doesn't get a new identity every render, which would otherwise detach and
  // reattach the IntersectionObserver on every keystroke.
  const setPanelNode = useMemo(() => mergeRefs(panelRef, scrollRootRef), [panelRef, scrollRootRef]);

  const goToTicket = useCallback((ticket: RepairServiceItem) => {
    const route = STATUS_ROUTES[ticket.status] ?? "/";
    const q = ticket.reportNo || ticket.serialNumber || "";
    router.push(`${route}?q=${encodeURIComponent(q)}`);
    setOpen(false);
    setTerm("");
  }, [router]);

  const showPanel = open && term.trim().length >= 2;

  return (
    <>
      <div ref={anchorRef} className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={term}
          onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={t("header.searchPlaceholder")}
          className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-200"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />
        )}
      </div>

      {showPanel && coords &&
        createPortal(
          <div
            ref={setPanelNode}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: coords.width,
              transform: coords.placement === "top" ? "translateY(-100%)" : undefined,
            }}
            className={`z-[100] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl shadow-slate-900/10 dark:shadow-black/40 overflow-hidden max-h-80 overflow-y-auto ${
              coords.placement === "top" ? "dropdown-panel-in-top" : "dropdown-panel-in"
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : results.length === 0 ? (
              <p className="px-4 py-4 text-xs text-slate-400 text-center">
                {t("header.searchNoMatch", { term: term.trim() })}
              </p>
            ) : (
              <>
                <div className="sticky top-0 bg-slate-50 dark:bg-slate-800 px-3 py-2 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {results.length === 1
                    ? t("header.searchOneFound")
                    : t("header.searchManyFound", { count: results.length })}
                </div>
                {/* `ticket`, not `t` — `t` is the translate function in this scope. */}
                {results.map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => goToTicket(ticket)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold font-mono text-slate-900 dark:text-slate-100 truncate">
                        {ticket.reportNo || "—"}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {[ticket.companyName, ticket.itemName, ticket.serialNumber].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                        STATUS_BADGE[ticket.status] ?? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {translateStatus(ticket.status, t)}
                    </span>
                  </button>
                ))}
                <div ref={sentinelRef} className="px-3 py-2 text-center">
                  <InfiniteScrollStatus
                    isLoadingMore={isLoadingMore}
                    reachedEnd={reachedEnd}
                    limitReached={limitReached}
                    count={results.length}
                  />
                </div>
              </>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
