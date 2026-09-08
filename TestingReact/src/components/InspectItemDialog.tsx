"use client";

/**
 * @file InspectItemDialog.tsx
 * @description Diagnostic inspection dialog — opened when a technician
 * clicks "Accept" on the Inspect Items page. Matches the DialogEdit form
 * in InspectItemList.razor exactly.
 *
 * Fields:
 *  - Inspection (multiline)
 *  - Solution (multiline)
 *  - Service Type (Free / Charge)
 *  - Spare Parts list (search, add, remove, quantity, condition)
 */

import React, { useState, useEffect, useCallback } from "react";
import type { ActionValues } from "./ActionBus";
import { createPortal } from "react-dom";
import {
  X,
  ClipboardList,
  Save,
  Trash2,
  Search,
  Package,
  CheckCircle2,
  Loader2,
  Eye,
  Smartphone,
} from "lucide-react";
import { useCompanionScanner } from "@/context/CompanionScannerContext";
import type { RepairServiceItem, SparePartItem } from "@/services/api";
import {
  fetchSparePartsInventory,
  fetchServiceById,
  fetchSparePartById,
  deleteInspectItemSparePart
} from "@/services/api";
import { useFloatingPanel } from "@/hooks/useFloatingPanel";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSafeTimeout } from "@/hooks/useSafeTimeout";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import HighlightText from "./HighlightText";
import { getImageUrl } from "@/lib/utils";
import SparePartSpecModal from "./SparePartSpecModal";
import ModernSelect from "./ModernSelect";
import InfiniteScrollStatus from "./InfiniteScrollStatus";
import { useI18n } from "@/i18n/LanguageProvider";
import { firstValidationMessage } from "@/i18n/validationMessage";
import { validateInspection } from "@/validation";
import type { TranslationKey } from "@/i18n/translations";
import { ModalWrapper } from "@/components/av/ModalWrapper";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SparePartLine {
  /** Client-side unique key */
  lineId:      string;
  /**
   * The SparepartItem row id on the backend — present only for lines already
   * saved on this ticket. Lines the user just added in this dialog session
   * have no id yet (they don't exist server-side until Save), so removing
   * them only needs to update local state.
   */
  id?:         string;
  sparePartId: string;
  itemName:    string;
  useFor:      string;
  pictureUrl:  string;
  stockQty:    number;
  quantity:    number;
  condition:   "Fix" | "Replace" | "Free";
  remarks?:    string;
  /**
   * The full record this line was added from, kept so the spec view stays
   * accurate: the search results list is replaced on every query, so a part
   * added earlier is usually no longer in it to look up.
   */
  part:        SparePartItem;
}

export interface InspectPayload {
  serviceId:     string;
  inspection:    string;
  solution:      string;
  serviceTypeId: number; // 1 = Free, 2 = Charge
  spareParts: Array<{
    sparePartId: string;
    itemName?:   string;
    description?: string;
    quantity:    number;
    condition:   string;
    remarks?:    string;
    isHoldStatus?: boolean;
  }>;
}

interface InspectItemDialogProps {
  item:    RepairServiceItem;
  onClose: () => void;
  onSave:  (payload: InspectPayload) => Promise<boolean>;
  /**
   * Findings, solution and service type to open with — the assistant writing up
   * what the technician dictated. Prefill only: the spare-parts list and the
   * Save click are still theirs, which matters here because saving an
   * inspection reserves stock against the job.
   */
  prefill?: ActionValues;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// The strings themselves are what the backend stores in `condition`, so they
// stay English regardless of UI language — only their labels are translated.
const CONDITIONS = ["Fix", "Replace", "Free"] as const;

const CONDITION_LABEL_KEYS: Record<(typeof CONDITIONS)[number], TranslationKey> = {
  Fix: "value.fix",
  Replace: "value.replace",
  Free: "value.free"
};

const SERVICE_TYPES: { id: number; labelKey: TranslationKey }[] = [
  { id: 1, labelKey: "value.free" },
  { id: 2, labelKey: "value.charge" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStockBadge(qty: number): { cls: string; label: string } {
  if (qty <= 0)  return { cls: "bg-danger-soft text-danger-fg border-danger",   label: "OUT" };
  if (qty <= 2)  return { cls: "bg-warning-soft text-warning-fg border-warning", label: `${qty} LOW` };
  return           { cls: "bg-success-soft text-success-fg border-success", label: `${qty}` };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InspectItemDialog({ item, onClose, onSave, prefill }: InspectItemDialogProps) {
  const { t } = useI18n();
  const later = useSafeTimeout();
  // Seeded from the prefill where there is one, so the dictated text is in the
  // box on first paint rather than appearing a frame later.
  const [inspection,    setInspection]    = useState(prefill?.inspection ?? item.inspection ?? "");
  const [solution,      setSolution]      = useState(prefill?.solution   ?? item.solution   ?? "");
  const [serviceTypeId, setServiceTypeId] = useState(
    prefill?.serviceType && /charge|paid|គិតលុយ/i.test(prefill.serviceType) ? 2 : 1
  );
  const [lines,         setLines]         = useState<SparePartLine[]>([]);
  const [isSaving,      setIsSaving]      = useState(false);
  const [saveSuccess,   setSaveSuccess]   = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { openPairingModal } = useCompanionScanner();

  // Spare part search state
  const [partSearch,    setPartSearch]    = useState("");
  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const [viewPart,      setViewPart]      = useState<SparePartItem | null>(null);

  // Listen to companion barcode scan events when inspection dialog is active
  useEffect(() => {
    if (!open) return;
    const handleCompanionScan = (e: Event) => {
      const customEvent = e as CustomEvent<{ barcode?: string }>;
      if (customEvent?.detail?.barcode) {
        setPartSearch(customEvent.detail.barcode);
        setDropdownOpen(true);
      }
    };
    window.addEventListener("companion-barcode-scanned", handleCompanionScan);
    return () => window.removeEventListener("companion-barcode-scanned", handleCompanionScan);
  }, [open]);

  // The search dropdown is portaled with fixed coordinates rather than
  // absolute-positioned in place, because this dialog's body scrolls
  // (overflow-y-auto) and would otherwise clip the panel — and cap it below
  // the dialog's own z-50 — the moment the search field isn't near the top.
  const {
    anchorRef: searchInputRef,
    panelRef: searchPanelRef,
    coords: searchCoords
  } = useFloatingPanel<HTMLInputElement, HTMLDivElement>({
    // Suppressed (not just `dropdownOpen`) while the spec modal is open:
    // that modal is its own top-level portal (see SparePartSpecModal's
    // z-index comment), so any click inside it — its Close button, the
    // backdrop — reads as an "outside click" to this panel's own listener
    // and would force-close the search dropdown a second time, on top of
    // losing the in-flight search the moment the eye icon was clicked.
    open: dropdownOpen && !viewPart,
    onClose: () => setDropdownOpen(false),
    width: "match",
    estimatedHeight: 220,
    align: "start"
  });

  // Spare parts are searched on the server, not filtered from a preloaded
  // page: the catalog is longer than any single fetch, so a locally filtered
  // first page silently hides every part past it. The backend matches
  // ItemName, SerialNumber, Description and UseFor. Results scroll-load via
  // useInfiniteList (same hook the full inventory pages use) instead of
  // stopping at a single fixed-size page, so a broad search stays reachable
  // past the first batch.
  const debouncedPartSearch = useDebouncedValue(partSearch, 300);
  const partSearchTerm = debouncedPartSearch.trim();

  const {
    items: filteredParts,
    isLoading: partsLoading,
    isLoadingMore: partsLoadingMore,
    reachedEnd: partsReachedEnd,
    limitReached: partsLimitReached,
    scrollRootRef: partsScrollRootRef,
    sentinelRef: partsSentinelRef
  } = useInfiniteList<SparePartItem, HTMLDivElement, HTMLDivElement>({
    fetchPage: async (pageNumber, size) => {
      const res = await fetchSparePartsInventory(pageNumber, size, partSearchTerm);
      return {
        ...res,
        items: (res.items || []).filter((p) => !p.isDraft),
      };
    },
    pageSize: 25,
    resetKey: partSearchTerm,
    getId: (p) => p.id
  });

  // `item` comes from the Inspecting page's paged search endpoint, which is
  // a different, narrower projection than the by-id endpoint — it carries
  // Inspection/Solution but omits ServiceType and the SpareParts sub-table
  // (see fetchServiceById's docstring / ServiceDetailModal, which hit the
  // same gap). Without this, reopening an already-inspected ticket always
  // shows Service Type reset to "Free" and an empty spare-parts list, even
  // though the ticket has saved values for both.
  const itemId = item.id;
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const full = await fetchServiceById(itemId);
      if (cancelled || !full) return;

      // A dictated service type outranks the stored one — the user just said
      // which they wanted, so restoring the saved value here would quietly
      // undo the instruction a moment after the dialog opened.
      if (!prefill?.serviceType) {
        if (full.serviceType === "Charge") setServiceTypeId(2);
        else if (full.serviceType === "Free") setServiceTypeId(1);
      }

      const rawParts = (full.sparePartItems ?? full.sparepartItems ?? []) as unknown as Array<
        Record<string, unknown>
      >;
      if (rawParts.length > 0) {
        // GetServiceAsync's SparepartItems only carries
        // SparepartId/Description/Quantity/Condition — ItemName, UseFor,
        // PictureUrl and stock Quantity live on the separate Spareparts
        // catalog table and must be looked up per id (mirrors the Blazor
        // dialog's LoadSelectedSparePartsOnly).
        const mapped = (
          await Promise.all(
            rawParts.map(async (p) => {
              const sparePartId = (p.sparePartId ?? p.sparepartId) as string | undefined;
              if (!sparePartId) return null;
              const rowId = p.id as string | undefined;
              const catalog = await fetchSparePartById(sparePartId, true);
              const itemName = catalog?.itemName || (p.description as string) || "Unknown";
              const useFor = catalog?.useFor ?? "";
              const pictureUrl = catalog?.pictureUrl ?? "";
              const stockQty = catalog?.quantity ?? 0;
              const condition = CONDITIONS.includes(p.condition as (typeof CONDITIONS)[number])
                ? (p.condition as SparePartLine["condition"])
                : "Replace";
              const part: SparePartItem = catalog ?? {
                id: sparePartId,
                itemName,
                useFor,
                pictureUrl,
                quantity: stockQty
              };
              const line: SparePartLine = {
                lineId: `line-${sparePartId}-${Math.random()}`,
                id: rowId,
                sparePartId,
                itemName,
                useFor,
                pictureUrl,
                stockQty,
                // `||`, not `??`: a stored 0 is not a meaningful quantity — the input
        // clamps to min 1 — and preserving it made the shared rule refuse the
        // whole save when someone merely reopened an existing inspection.
        quantity: (p.quantity as number) || 1,
                condition,
                part
              };
              return line;
            })
          )
        ).filter((l): l is SparePartLine => l !== null);

        if (cancelled) return;
        // Guard against clobbering lines the user already added by hand
        // while this fetch was still in flight.
        setLines((prev) => (prev.length > 0 ? prev : mapped));
      }
    })();
    return () => { cancelled = true; };
    // `prefill` is fixed for the life of the dialog — the caller sets it before
    // opening — so it is read for the guard above without re-running the fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const handleAddPart = useCallback((part: SparePartItem) => {
    setLines((prev) => {
      if (prev.some((l) => l.sparePartId === part.id)) {
        setValidationError(
          t("inspect.duplicatePart", { name: part.itemName ?? t("inspect.thisSparePart") })
        );
        return prev;
      }
      return [
        ...prev,
        {
          lineId:      `line-${Date.now()}-${Math.random()}`,
          sparePartId: part.id,
          itemName:    part.itemName   ?? "Unknown",
          useFor:      part.useFor     ?? "",
          pictureUrl:  part.pictureUrl ?? "",
          stockQty:    part.quantity   ?? 0,
          quantity:    1,
          condition:   "Replace",
          part
        },
      ];
    });
    setPartSearch("");
    setDropdownOpen(false);
  }, [t]);

  const updateLine = useCallback(
    (lineId: string, patch: Partial<SparePartLine>) =>
      setLines((prev) =>
        prev.map((l) => (l.lineId === lineId ? { ...l, ...patch } : l))
      ),
    []
  );

  const [removingLineId, setRemovingLineId] = useState<string | null>(null);

  const removeLine = useCallback(
    async (line: SparePartLine) => {
      // A line just added in this dialog session has no backend row yet —
      // nothing to delete server-side.
      if (!line.id) {
        setLines((prev) => prev.filter((l) => l.lineId !== line.lineId));
        return;
      }

      // Already saved on the ticket — delete it immediately, matching
      // InspectItemList.razor's RemoveSparePart, so the removal isn't lost
      // if the dialog is closed without saving the rest of the form.
      setRemovingLineId(line.lineId);
      const ok = await deleteInspectItemSparePart(item.id, line.id);
      setRemovingLineId(null);

      if (!ok) {
        setValidationError(t("inspect.removeFailed"));
        return;
      }
      setLines((prev) => prev.filter((l) => l.lineId !== line.lineId));
    },
    [item.id, t]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Inspection and Solution are what a technician is actually reporting, and
    // the backend column has a [Required] constraint on both. The HTML
    // `required` attribute on the textareas below still helps (keyboard-native,
    // no JS needed to trigger it), but it won't catch whitespace-only text and
    // shows a browser-native tooltip instead of this app's own error style, so
    // it's backed up here rather than relied on alone. Service Type always
    // carries a value (defaults to Free) and spare parts are genuinely optional
    // — not every inspection uses a part.
    //
    // The rule itself lives in `@/validation`, mirrored into the CamID app, so
    // the phone's inspection sheet refuses exactly what this refuses. It adds
    // one check this screen lacked: a line present with a zero or missing
    // quantity, which the number input clamps on change and therefore never
    // caught for a value arriving any other way.
    const check = validateInspection({
      inspection,
      solution,
      spareParts: lines.map((l) => ({ quantity: l.quantity })),
    });
    if (!check.isValid) {
      setValidationError(
        check.codes.inspection ? t("inspect.requiredFields") : firstValidationMessage(check, t)
      );
      return;
    }

    setIsSaving(true);
    const payload: InspectPayload = {
      serviceId:     item.id,
      inspection:    inspection.trim(),
      solution:      solution.trim(),
      serviceTypeId,
      spareParts:    lines.map((l) => ({
        sparePartId: l.sparePartId,
        itemName:    l.itemName || l.part?.itemName || "",
        description: l.itemName || l.part?.itemName || l.useFor || "",
        quantity:    l.quantity,
        condition:   l.condition,
        remarks:     l.remarks || "-",
        isHoldStatus: true
      }))
    };
    const ok = await onSave(payload);
    if (ok) {
      setSaveSuccess(true);
      // Held 800ms so the success tick is seen. Cancelled if the
      // dialog goes first (Escape, or the page navigating), which
      // would otherwise call the parent's onClose from a dead tree.
      later(onClose, 800);
    } else {
      setIsSaving(false);
    }
  };

  const inputCls =
    "w-full px-3 py-2 text-xs border border-subtle rounded-xl bg-surface focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none";

  return (
    <ModalWrapper
      open
      onClose={onClose}
      maxWidth="max-w-3xl"
      zIndex={50}
      placement="center"
      backdropVariant="heavy"
    >
      <div className="bg-surface border border-subtle w-full rounded-2xl flex flex-col max-h-[var(--av-modal-inner-maxh)] overflow-hidden">

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-subtle flex items-center justify-between bg-cushion/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink ">
                {t("inspect.title")}
              </h2>
              <p className="text-xs text-ink-secondary ">
                {item.reportNo} · {item.companyName} · {item.itemName}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-sunken transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          // Enter in a single-line input implicitly submits its form. The
          // spare-part box below is a search field inside this form, so
          // pressing Enter to "search" — the obvious thing to do — instead
          // saved the inspection and closed the dialog out from under the
          // technician, mid-search. It only happened once Inspection and
          // Solution were filled in, which is why it looked intermittent:
          // before that, validation caught the submit and the dialog stayed
          // open. Saving is deliberate here — the Save button below.
          // Textareas are unaffected (Enter is a newline there, not a
          // submit), and Enter on the focused Save button still fires its
          // click, so the keyboard path to saving survives.
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
              e.preventDefault();
            }
          }}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
            {saveSuccess && (
              <div className="p-3 bg-success-soft text-success-fg border border-success rounded-xl text-xs flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                {t("inspect.savedSuccess")}
              </div>
            )}
            {validationError && (
              <div className="p-3 bg-danger-soft text-danger-fg border border-danger rounded-xl text-xs flex items-center gap-2 font-medium">
                <X className="w-4 h-4 shrink-0" />
                {validationError}
              </div>
            )}

          {/* Section: Diagnostic */}
          <div>
            <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" /> {t("inspect.diagnosticReport")}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink ">{t("inspect.inspectionLabel")} *</label>
                <textarea
                  rows={4}
                  required
                  value={inspection}
                  onChange={(e) => { setInspection(e.target.value); setValidationError(null); }}
                  placeholder={t("inspect.inspectionPlaceholder")}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink ">{t("inspect.solutionLabel")} *</label>
                <textarea
                  rows={4}
                  required
                  value={solution}
                  onChange={(e) => { setSolution(e.target.value); setValidationError(null); }}
                  placeholder={t("inspect.solutionPlaceholder")}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Section: Spare Parts + Service Type — same row: what was used
              on the left, what it's billed as on the right. */}
          <div>
            <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> {t("inspect.sparePartsUsed")}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              {/* Search + Add */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink ">{t("inspect.searchSparePart")}</label>
                <div className="relative flex items-center">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder={t("placeholder.searchSparePart")}
                    value={partSearch}
                    onChange={(e) => { setPartSearch(e.target.value); setDropdownOpen(true); }}
                    onFocus={() => setDropdownOpen(true)}
                    className={`${inputCls} pl-9 pr-16`}
                  />
                  <button
                    type="button"
                    onClick={openPairingModal}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-[10.5px] font-semibold transition-colors cursor-pointer"
                    title="Scan Barcode with Phone"
                  >
                    <Smartphone className="w-3 h-3" />
                    <span>Scan</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink ">{t("field.serviceType")}</label>
                <ModernSelect
                  value={String(serviceTypeId)}
                  onChange={(v) => setServiceTypeId(Number(v))}
                  // `type`, not `t` — `t` is the translate function in this scope.
                  options={SERVICE_TYPES.map((type) => ({
                    value: String(type.id),
                    label: t(type.labelKey)
                  }))}
                />
              </div>

              {!viewPart && dropdownOpen && (partSearch.length > 0 || filteredParts.length > 0) && searchCoords &&
                createPortal(
                  <div
                    ref={searchPanelRef}
                    style={{
                      position: "fixed",
                      top: searchCoords.top,
                      left: searchCoords.left,
                      width: searchCoords.width,
                      transform: searchCoords.placement === "top" ? "translateY(-100%)" : undefined
                    }}
                    className={`z-[9999] bg-surface border border-subtle rounded-xl shadow-2xl overflow-hidden ${
                      searchCoords.placement === "top" ? "dropdown-panel-in-top" : "dropdown-panel-in"
                    }`}
                  >
                    {/* Separate scroll container from searchPanelRef above: useInfiniteList's
                        sentinel needs its actual scrolling ancestor as the IntersectionObserver
                        root, while useFloatingPanel's outside-click check still works on this
                        inner div via `.contains()` on the outer wrapper. */}
                    <div ref={partsScrollRootRef} className="max-h-52 overflow-y-auto">
                      {partsLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-5 h-5 animate-spin text-ink-muted" />
                        </div>
                      ) : filteredParts.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-ink-muted">No spare parts found.</p>
                      ) : (
                        <>
                          {filteredParts.map((part) => {
                            const stock = getStockBadge(part.quantity ?? 0);
                            return (
                              <div
                                key={part.id}
                                onClick={() => handleAddPart(part)}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-cushion transition-colors text-left cursor-pointer"
                              >
                                {part.pictureUrl ? (
                                  <img src={getImageUrl(part.pictureUrl)} alt="" width={32} height={32} loading="lazy" decoding="async" className="w-8 h-8 object-cover rounded-lg border border-subtle shrink-0 bg-white" />
                                ) : (
                                  <div className="w-8 h-8 bg-sunken rounded-lg border border-subtle flex items-center justify-center shrink-0">
                                    <Package className="w-4 h-4 text-ink-muted" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-ink truncate">
                                    <HighlightText text={part.itemName} query={partSearch} />
                                  </p>
                                  <p className="text-[10px] text-ink-secondary truncate">
                                    <HighlightText text={part.useFor} query={partSearch} />
                                  </p>
                                </div>
                                <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${stock.cls}`}>{stock.label}</span>
                                <button
                                  type="button"
                                  title="View specification"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDropdownOpen(false);
                                    setViewPart(part);
                                  }}
                                  className="shrink-0 p-1.5 rounded-lg text-ink-muted hover:text-accent hover:bg-accent-soft transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                          <div ref={partsSentinelRef} className="px-3 py-2 text-center border-t border-subtle ">
                            <InfiniteScrollStatus
                              isLoadingMore={partsLoadingMore}
                              reachedEnd={partsReachedEnd}
                              limitReached={partsLimitReached}
                              count={filteredParts.length}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>,
                  document.body
                )}
            </div>

            {/* Lines Table */}
            {lines.length > 0 ? (
              <div className="rounded-xl border border-subtle overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-accent text-white">
                      <th className="px-2 py-2 text-center w-10">{t("inspect.colImage")}</th>
                      <th className="px-3 py-2 text-left">{t("field.itemName")}</th>
                      <th className="px-2 py-2 text-center w-16">{t("inspect.colQty")}</th>
                      <th className="px-2 py-2 text-center w-28">{t("field.condition")}</th>
                      <th className="px-2 py-2 text-center w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-subtle ">
                    {lines.map((line) => (
                      <tr key={line.lineId} className="hover:bg-cushion ">
                        <td className="px-2 py-1.5 text-center">
                          {line.pictureUrl ? (
                            <img src={getImageUrl(line.pictureUrl)} alt="" width={32} height={32} loading="lazy" decoding="async" className="w-8 h-8 object-cover rounded border border-subtle mx-auto bg-white" />
                          ) : (
                            <div className="w-8 h-8 bg-sunken rounded border border-subtle flex items-center justify-center mx-auto">
                              <Package className="w-4 h-4 text-ink-muted" />
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-medium text-ink truncate max-w-[170px]">{line.itemName}</p>
                            {line.stockQty !== undefined && (
                              <span
                                className={`text-[9.5px] px-1.5 py-0.5 rounded font-bold ${
                                  line.stockQty >= line.quantity
                                    ? "bg-success-soft text-success-fg border border-success/20"
                                    : line.stockQty > 0
                                    ? "bg-warning-soft text-warning-fg border border-warning/20"
                                    : "bg-danger-soft text-danger-fg border border-danger/20"
                                }`}
                              >
                                {line.stockQty >= line.quantity
                                  ? `សល់ ${line.stockQty}`
                                  : line.stockQty > 0
                                  ? `ខ្វះស្តុក (សល់ ${line.stockQty})`
                                  : "អស់ស្តុក"}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-ink-secondary truncate max-w-[180px]">{line.useFor}</p>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <input
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={(e) => updateLine(line.lineId, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-14 text-center px-1 py-1 border border-subtle rounded-lg text-xs bg-surface focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <ModernSelect
                            dense
                            value={line.condition}
                            onChange={(v) => updateLine(line.lineId, { condition: v as SparePartLine["condition"] })}
                            options={CONDITIONS.map((c) => ({ value: c, label: c }))}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              title={t("action.viewSpec")}
                              onClick={() => setViewPart(line.part)}
                              className="p-1 rounded-lg text-ink-muted hover:bg-accent-soft hover:text-accent transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              title={t("action.remove")}
                              disabled={removingLineId === line.lineId || isSaving}
                              onClick={() => void removeLine(line)}
                              className="p-1 rounded-lg text-danger hover:bg-danger-soft hover:text-danger transition-colors disabled:opacity-50"
                            >
                              {removingLineId === line.lineId ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="border-2 border-dashed border-subtle rounded-xl py-6 text-center">
                <Package className="w-6 h-6 text-ink-muted mx-auto mb-1" />
                <p className="text-xs text-ink-muted">{t("inspect.noPartsAdded")}</p>
              </div>
            )}
          </div>
        </div>

          {/* Actions (Sticky footer) */}
          <div className="sticky bottom-0 z-20 px-5 py-3.5 bg-cushion/90 backdrop-blur border-t border-subtle flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-ink bg-surface border border-subtle rounded-xl hover:bg-sunken transition-colors shadow-sm"
            >
              {t("action.cancel")}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-accent rounded-xl hover:bg-accent shadow-md transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {isSaving ? t("action.saving") : t("inspect.acceptAndSave")}
            </button>
          </div>
        </form>
      </div>

      {viewPart && (
        <SparePartSpecModal part={viewPart} onClose={() => setViewPart(null)} />
      )}
    </ModalWrapper>
  );
}
