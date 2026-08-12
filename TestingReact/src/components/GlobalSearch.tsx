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

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, Loader2, FileText } from "lucide-react";
import { fetchRepairServices, type RepairServiceItem } from "@/services/api";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useFloatingPanel } from "@/hooks/useFloatingPanel";

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

const MAX_RESULTS = 8;

export default function GlobalSearch() {
  const router = useRouter();
  const [term, setTerm] = useState("");
  // Results are stored together with the query that produced them, so a stale
  // response that lands after the user has typed further can be recognised and
  // ignored rather than briefly shown against the wrong term.
  const [fetched, setFetched] = useState<{ query: string; items: RepairServiceItem[] }>({
    query: "",
    items: [],
  });
  const [open, setOpen] = useState(false);

  const debouncedTerm = useDebouncedValue(term, 300);

  const { anchorRef, panelRef, coords } = useFloatingPanel<HTMLDivElement, HTMLDivElement>({
    open,
    onClose: () => setOpen(false),
    width: "match",
    estimatedHeight: 320,
    align: "start",
  });

  const query = debouncedTerm.trim();

  useEffect(() => {
    if (query.length < 2 || fetched.query === query) return;

    let cancelled = false;
    void (async () => {
      // "All" searches every status — a global search that only covered one
      // queue would miss most of the system.
      const res = await fetchRepairServices(1, MAX_RESULTS, "All", query);
      if (cancelled) return;
      setFetched({ query, items: res.items ?? [] });
    })();
    return () => { cancelled = true; };
  }, [query, fetched.query]);

  // Derived rather than stored: whatever is on screen always corresponds to
  // the term currently typed, with no separate state to keep in sync.
  const results = fetched.query === query ? fetched.items : [];
  const loading = query.length >= 2 && fetched.query !== query;

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
          placeholder="Search tickets, serial numbers, customers..."
          className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-200"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />
        )}
      </div>

      {showPanel && coords &&
        createPortal(
          <div
            ref={panelRef}
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
                No tickets match &ldquo;{term.trim()}&rdquo;.
              </p>
            ) : (
              <>
                <div className="sticky top-0 bg-slate-50 dark:bg-slate-800 px-3 py-2 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {results.length} ticket{results.length !== 1 ? "s" : ""} found
                </div>
                {results.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => goToTicket(t)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold font-mono text-slate-900 dark:text-slate-100 truncate">
                        {t.reportNo || "—"}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {[t.companyName, t.itemName, t.serialNumber].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                        STATUS_BADGE[t.status] ?? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {t.status}
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
