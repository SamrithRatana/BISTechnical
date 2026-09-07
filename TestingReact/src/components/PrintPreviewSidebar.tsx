"use client";

/**
 * @file PrintPreviewSidebar.tsx
 * @description Print preview for one technical service ticket.
 *
 * The sheet itself is `components/report/ReportSheet`, which renders
 * `src/report-layout/` — the same layout the CamID phone app prints. This
 * file only loads the ticket's data and owns the surrounding chrome.
 *
 * ── WHY THIS IS PORTALLED TO <body> ───────────────────────────────────────
 * The app shell (`.av-page-stage`) sets `transform: translateZ(0)`, which
 * makes it the containing block for every `fixed` and `absolute` descendant,
 * and `overflow: hidden`, which clips them. Rendered inside it, the printed
 * report was anchored to the content stage instead of the page — inset from
 * the top-left with a blank band down the right edge — and the signature
 * block was cropped off the bottom. A portal to <body> is what puts the sheet
 * back on the page box, and it is also what lets the print stylesheet hide
 * the rest of the app with `body > *:not(.rpt-print-root)`.
 *
 * ── AND WHY IT RESERVES THE HEADER INSTEAD OF COVERING IT ─────────────────
 * `Header` is `sticky top-0` and raises itself to `z-[2500]` whenever a modal
 * is open — deliberately ABOVE the modal layer. Portalling this drawer to
 * <body> made it a sibling of that header, so at `z-50` the header painted
 * straight over its toolbar and the Print and Close buttons were unreachable.
 * It now starts below the header band via `--av-header-h`, the height the
 * header publishes on <html>, which is the convention the rest of the app's
 * dialogs already follow.
 */

import React, { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Printer, X, ZoomIn, ZoomOut, Edit3, Loader2, Download } from "lucide-react";
import toast from "react-hot-toast";
import { MODAL_SPRING, backdropVariants, drawerVariants } from "@/lib/animations";
import type { RepairServiceItem } from "@/services/api";
import ReportSheet from "@/components/report/ReportSheet";
import { useReportTemplate, syncReportTemplateFromServer } from "@/services/reportTemplate";
import { useBrandLogo } from "@/services/brandLogoStore";
import {
  matchSparePartInventory,
  sparePartLineId,
  resolveSparePartRow,
  ticketSparePartLines,
  type ResolvedSparePartRow,
} from "@/report-layout";

/** A browser never gains a `document` part-way through a page's life. */
const subscribeNever = () => () => {};

interface PrintPreviewSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  item: RepairServiceItem | null;
}

/** Fetches a parent SparePart by id when the bulk inventory page missed it. */
async function fetchSparePartById(id: string): Promise<Record<string, unknown> | null> {
  if (!id || id === "undefined" || id === "null" || id.length < 10) return null;
  try {
    const res = await fetch(`/api/proxy/spareparts/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export default function PrintPreviewSidebar({ isOpen, onClose, item }: PrintPreviewSidebarProps) {
  const [prevItem, setPrevItem] = useState(item);
  const [enrichedItem, setEnrichedItem] = useState<RepairServiceItem | null>(item);
  if (prevItem !== item) {
    setPrevItem(item);
    setEnrichedItem(item);
  }

  const [sparePartRows, setSparePartRows] = useState<ResolvedSparePartRow[]>([]);
  const [zoom, setZoom] = useState<number>(0.95);
  const template = useReportTemplate();
  const brandLogoSrc = useBrandLogo() ?? undefined;

  const fitPage = useCallback(() => {
    if (typeof window === "undefined") return;
    const availableHeight = window.innerHeight - 80;
    const scale = Math.min(1.0, Math.max(0.4, Number((availableHeight / 1123).toFixed(2))));
    setZoom(scale);
  }, []);

  const fitWidth = useCallback(() => {
    setZoom(0.95);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fitWidth();
    }
  }, [isOpen, fitWidth]);

  // `createPortal` needs a real `document`, so the overlay must not be part of
  // the server render. Same shape `usePasskeySupport` uses: no setState in an
  // effect (which costs an extra render and trips `set-state-in-effect`), and
  // a `false` server snapshot so nothing portal-shaped reaches the SSR HTML.
  const isBrowser = useSyncExternalStore(subscribeNever, () => true, () => false);

  // The company template may have been republished since this tab loaded;
  // one tiny GET keeps every print on the latest design.
  useEffect(() => {
    if (isOpen) void syncReportTemplateFromServer();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !item) return;

    let isMounted = true;

    async function loadFullDetailsAndSpareParts() {
      try {
        if (!item) return;

        let ticketData = item;
        try {
          const res = await fetch(`/api/proxy/technicalservices/${item.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data && typeof data === "object") ticketData = { ...item, ...data };
          }
        } catch (e) {
          console.warn("Could not fetch full ticket details:", e);
        }

        if (!isMounted || !ticketData) return;
        setEnrichedItem(ticketData);

        const rawParts = ticketSparePartLines(ticketData as unknown as Record<string, unknown>);
        if (rawParts.length === 0) {
          if (isMounted) setSparePartRows([]);
          return;
        }

        const resolvedRows = await Promise.all(
          rawParts.map(async (raw, index) => {
            let match: any = undefined;
            const lineId = sparePartLineId(raw);
            if (lineId && lineId.length > 10) {
              match = (await fetchSparePartById(lineId)) ?? undefined;
            }
            return resolveSparePartRow(raw, match, index);
          }),
        );

        if (isMounted) setSparePartRows(resolvedRows);
      } catch (err) {
        console.error("Error enriching report spare parts:", err);
      }
    }

    void loadFullDetailsAndSpareParts();

    return () => {
      isMounted = false;
    };
  }, [isOpen, item]);

  // Escape closes, like every other dialog in the app.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const handlePrint = useCallback(() => window.print(), []);

  if (!isBrowser) return null;

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const currentItem = enrichedItem || item;

  const handleDownloadPdf = useCallback(async () => {
    if (!currentItem) return;
    setIsGeneratingPdf(true);
    try {
      const element = document.querySelector(".rpt-sheet") as HTMLElement;
      if (!element) {
        toast.error("Report sheet not found");
        return;
      }
      const html2pdf = (await import("html2pdf.js")).default;
      const opt = {
        margin: 0,
        filename: `Technical-Service-Report-${currentItem.reportNo || "export"}.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
      };
      await html2pdf().set(opt).from(element).save();
      toast.success("PDF downloaded successfully!");
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("PDF generation failed, opening system print...");
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [currentItem]);

  const overlay = (
    <AnimatePresence>
      {isOpen && currentItem && (
        <motion.div
          key="rpt-print-preview"
          className="rpt-print-root fixed inset-0 z-[2600] flex justify-end"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={backdropVariants}
          transition={MODAL_SPRING}
        >
          {/* Blurred & dimmed backdrop scrim covering entire screen including top header */}
          <div
            className="rpt-screen-only absolute inset-0 bg-slate-950/60 backdrop-blur-md cursor-pointer transition-opacity"
            onClick={onClose}
            aria-hidden
          />

          <motion.div
            className="rpt-print-passthrough relative w-full max-w-[780px] bg-ink h-full flex flex-col shadow-2xl overflow-hidden border-l border-subtle"
            variants={drawerVariants}
            transition={MODAL_SPRING}
            role="dialog"
            aria-modal="true"
            aria-label="Print preview"
          >
            {/* Top Action Bar (Screen Only - Clean non-wrapping header) */}
            <div className="rpt-screen-only px-5 py-3 bg-ink border-b border-subtle flex items-center justify-between shrink-0 text-white gap-3">
              <div className="flex items-center gap-2.5 shrink-0 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-info/20 text-info flex items-center justify-center font-bold shrink-0">
                  <Printer className="w-4 h-4" />
                </div>
                <div className="whitespace-nowrap min-w-0">
                  <h2 className="text-sm font-bold text-white flex items-center gap-1.5 whitespace-nowrap">
                    Print Preview — <span className="font-mono text-info">{currentItem.reportNo}</span>
                  </h2>
                  <p className="text-[11px] text-ink-muted whitespace-nowrap">A4 Technical Service Report</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Zoom Controls */}
                <div className="flex items-center gap-0.5 bg-white/10 p-0.5 rounded-lg border border-white/10">
                  <button
                    type="button"
                    title="Zoom Out"
                    onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.05).toFixed(2))))}
                    className="w-6 h-6 rounded flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer text-xs font-bold"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-mono font-bold text-white px-1.5 min-w-8 text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    title="Zoom In"
                    onClick={() => setZoom((z) => Math.min(1.4, Number((z + 0.05).toFixed(2))))}
                    className="w-6 h-6 rounded flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer text-xs font-bold"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Fit to Window Width"
                    onClick={fitWidth}
                    className="px-2 py-0.5 rounded text-[11px] font-semibold text-info hover:bg-info/20 transition cursor-pointer"
                  >
                    Fit Width
                  </button>
                </div>

                <a
                  href={`/service-tickets?reportNo=${encodeURIComponent(currentItem.reportNo || "")}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-accent hover:bg-accent/90 rounded-lg transition-all shadow-md shadow-accent/20 cursor-pointer"
                  title="Edit ticket information or delete report"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Edit</span>
                </a>

                <button
                  type="button"
                  disabled={isGeneratingPdf}
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-600/80 rounded-lg transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                  title="Download PDF directly without print dialog"
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-info hover:bg-info/90 rounded-lg transition-all shadow-md shadow-info/20 active:scale-95 cursor-pointer"
                  title="Open system printer dialog to print"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print</span>
                </button>

                <button
                  onClick={onClose}
                  className="p-1.5 text-ink-muted hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer ml-0.5"
                  title="Close Preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content Area: Sheet Viewport (Snug full-edge fit) */}
            <div className="flex-1 flex min-h-0 relative overflow-hidden">
              <div className="rpt-viewport rpt-print-passthrough flex-1 overflow-auto">
                <ReportSheet
                  item={currentItem}
                  sparePartRows={sparePartRows}
                  settings={template}
                  zoom={zoom}
                  isolateForPrint
                  brandLogoSrc={brandLogoSrc}
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(overlay, document.body);
}
