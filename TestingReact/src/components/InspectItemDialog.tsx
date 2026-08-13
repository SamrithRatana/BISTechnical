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
import { createPortal } from "react-dom";
import {
  X,
  ClipboardList,
  Save,
  Plus,
  Trash2,
  Search,
  Package,
  CheckCircle2,
  Loader2,
  Eye,
} from "lucide-react";
import type { RepairServiceItem, SparePartItem } from "@/services/api";
import {
  fetchSparePartsInventory,
  fetchServiceById,
  fetchSparePartById,
  deleteInspectItemSparePart,
} from "@/services/api";
import { useFloatingPanel } from "@/hooks/useFloatingPanel";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import HighlightText from "./HighlightText";
import SparePartSpecModal from "./SparePartSpecModal";
import ModernSelect from "./ModernSelect";
import InfiniteScrollStatus from "./InfiniteScrollStatus";

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
    quantity:    number;
    condition:   string;
    isHoldStatus?: boolean;
  }>;
}

interface InspectItemDialogProps {
  item:    RepairServiceItem;
  onClose: () => void;
  onSave:  (payload: InspectPayload) => Promise<boolean>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONDITIONS = ["Fix", "Replace", "Free"] as const;

const SERVICE_TYPES = [
  { id: 1, label: "Free  (ការជួសជុលឥតគិតថ្លៃ)" },
  { id: 2, label: "Charge (ការជួសជុលគិតថ្លៃ)" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStockBadge(qty: number): { cls: string; label: string } {
  if (qty <= 0)  return { cls: "bg-rose-100 text-rose-700 border-rose-200",   label: "OUT" };
  if (qty <= 2)  return { cls: "bg-amber-100 text-amber-700 border-amber-200", label: `${qty} LOW` };
  return           { cls: "bg-emerald-100 text-emerald-700 border-emerald-200", label: `${qty}` };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InspectItemDialog({ item, onClose, onSave }: InspectItemDialogProps) {
  const [inspection,    setInspection]    = useState(item.inspection   ?? "");
  const [solution,      setSolution]      = useState(item.solution      ?? "");
  const [serviceTypeId, setServiceTypeId] = useState(1);
  const [lines,         setLines]         = useState<SparePartLine[]>([]);
  const [isSaving,      setIsSaving]      = useState(false);
  const [saveSuccess,   setSaveSuccess]   = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Spare part search state
  const [partSearch,    setPartSearch]    = useState("");
  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const [viewPart,      setViewPart]      = useState<SparePartItem | null>(null);

  // The search dropdown is portaled with fixed coordinates rather than
  // absolute-positioned in place, because this dialog's body scrolls
  // (overflow-y-auto) and would otherwise clip the panel — and cap it below
  // the dialog's own z-50 — the moment the search field isn't near the top.
  const {
    anchorRef: searchInputRef,
    panelRef: searchPanelRef,
    coords: searchCoords,
  } = useFloatingPanel<HTMLInputElement, HTMLDivElement>({
    open: dropdownOpen,
    onClose: () => setDropdownOpen(false),
    width: "match",
    estimatedHeight: 220,
    align: "start",
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
    sentinelRef: partsSentinelRef,
  } = useInfiniteList<SparePartItem, HTMLDivElement, HTMLDivElement>({
    fetchPage: (pageNumber, size) => fetchSparePartsInventory(pageNumber, size, partSearchTerm),
    pageSize: 25,
    resetKey: partSearchTerm,
    getId: (p) => p.id,
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

      if (full.serviceType === "Charge") setServiceTypeId(2);
      else if (full.serviceType === "Free") setServiceTypeId(1);

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
              const catalog = await fetchSparePartById(sparePartId);
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
                quantity: stockQty,
              };
              const line: SparePartLine = {
                lineId: `line-${sparePartId}-${Math.random()}`,
                id: rowId,
                sparePartId,
                itemName,
                useFor,
                pictureUrl,
                stockQty,
                quantity: (p.quantity as number) ?? 1,
                condition,
                part,
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
  }, [itemId]);

  const handleAddPart = useCallback((part: SparePartItem) => {
    setLines((prev) => {
      if (prev.some((l) => l.sparePartId === part.id)) {
        setValidationError(`"${part.itemName ?? "This spare part"}" is already in the list — adjust its quantity instead of adding it again.`);
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
          part,
        },
      ];
    });
    setPartSearch("");
    setDropdownOpen(false);
  }, []);

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
        setValidationError("Failed to remove spare part — please try again.");
        return;
      }
      setLines((prev) => prev.filter((l) => l.lineId !== line.lineId));
    },
    [item.id]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Inspection and Solution are the only required fields on this form —
    // they're what a technician is actually reporting, and the backend
    // column has a [Required] constraint on both. The HTML `required`
    // attribute on the textareas below still helps (keyboard-native, no JS
    // needed to trigger it), but it won't catch whitespace-only text and
    // shows a browser-native tooltip instead of this app's own error style,
    // so it's backed up here rather than relied on alone. Service Type
    // always carries a value (defaults to Free) and spare parts are
    // genuinely optional — not every inspection uses a part — so neither is
    // validated here.
    if (!inspection.trim() || !solution.trim()) {
      setValidationError("Inspection and Solution are both required before saving.");
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
        quantity:    l.quantity,
        condition:   l.condition,
        isHoldStatus: true,
      })),
    };
    const ok = await onSave(payload);
    if (ok) {
      setSaveSuccess(true);
      setTimeout(onClose, 800);
    } else {
      setIsSaving(false);
    }
  };

  const inputCls =
    "w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[96vh] sm:max-h-[90vh] my-auto overflow-hidden">

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                ទទួលការងារ (Accept Inspection)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {item.reportNo} · {item.companyName} · {item.itemName}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
            {saveSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Inspection saved — ticket moved to Inspection queue!
              </div>
            )}
            {validationError && (
              <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900 rounded-xl text-xs flex items-center gap-2 font-medium">
                <X className="w-4 h-4 shrink-0" />
                {validationError}
              </div>
            )}

          {/* Section: Diagnostic */}
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" /> Diagnostic Report
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Inspection (ការវិនិច្ឆ័យ) *</label>
                <textarea
                  rows={4}
                  required
                  value={inspection}
                  onChange={(e) => { setInspection(e.target.value); setValidationError(null); }}
                  placeholder="Describe what was found during inspection..."
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Solution (ដំណោះស្រាយ) *</label>
                <textarea
                  rows={4}
                  required
                  value={solution}
                  onChange={(e) => { setSolution(e.target.value); setValidationError(null); }}
                  placeholder="Proposed fix or solution..."
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Section: Spare Parts + Service Type — same row: what was used
              on the left, what it's billed as on the right. */}
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> Spare Parts Used (គ្រឿងបន្លាស់)
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              {/* Search + Add */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Search Spare Part</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search by name, serial, use-for..."
                    value={partSearch}
                    onChange={(e) => { setPartSearch(e.target.value); setDropdownOpen(true); }}
                    onFocus={() => setDropdownOpen(true)}
                    className={`${inputCls} pl-9`}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Service Type (ប្រភេទសេវាកម្ម)</label>
                <ModernSelect
                  value={String(serviceTypeId)}
                  onChange={(v) => setServiceTypeId(Number(v))}
                  options={SERVICE_TYPES.map((t) => ({ value: String(t.id), label: t.label }))}
                />
              </div>

              {dropdownOpen && (partSearch.length > 0 || filteredParts.length > 0) && searchCoords &&
                createPortal(
                  <div
                    ref={searchPanelRef}
                    style={{
                      position: "fixed",
                      top: searchCoords.top,
                      left: searchCoords.left,
                      width: searchCoords.width,
                      transform: searchCoords.placement === "top" ? "translateY(-100%)" : undefined,
                    }}
                    className={`z-[100] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden ${
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
                          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                        </div>
                      ) : filteredParts.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-slate-400">No spare parts found.</p>
                      ) : (
                        <>
                          {filteredParts.map((part) => {
                            const stock = getStockBadge(part.quantity ?? 0);
                            return (
                              <div
                                key={part.id}
                                onClick={() => handleAddPart(part)}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                              >
                                {part.pictureUrl ? (
                                  <img src={part.pictureUrl} alt="" className="w-8 h-8 object-cover rounded-lg border border-slate-200 shrink-0" />
                                ) : (
                                  <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                                    <Package className="w-4 h-4 text-slate-400" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                                    <HighlightText text={part.itemName} query={partSearch} />
                                  </p>
                                  <p className="text-[10px] text-slate-500 truncate">
                                    <HighlightText text={part.useFor} query={partSearch} />
                                  </p>
                                </div>
                                <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${stock.cls}`}>{stock.label}</span>
                                <button
                                  type="button"
                                  title="View specification"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewPart(part);
                                    setDropdownOpen(false);
                                  }}
                                  className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 dark:hover:text-blue-400 transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                          <div ref={partsSentinelRef} className="px-3 py-2 text-center border-t border-slate-100 dark:border-slate-800">
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
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-blue-600 text-white">
                      <th className="px-2 py-2 text-center w-10">Img</th>
                      <th className="px-3 py-2 text-left">Item Name</th>
                      <th className="px-2 py-2 text-center w-16">Qty</th>
                      <th className="px-2 py-2 text-center w-28">Condition</th>
                      <th className="px-2 py-2 text-center w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {lines.map((line) => (
                      <tr key={line.lineId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-2 py-1.5 text-center">
                          {line.pictureUrl ? (
                            <img src={line.pictureUrl} alt="" className="w-8 h-8 object-cover rounded border border-slate-200 mx-auto" />
                          ) : (
                            <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto">
                              <Package className="w-4 h-4 text-slate-400" />
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          <p className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[180px]">{line.itemName}</p>
                          <p className="text-[10px] text-slate-500 truncate max-w-[180px]">{line.useFor}</p>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <input
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={(e) => updateLine(line.lineId, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-14 text-center px-1 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
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
                              title="View specification"
                              onClick={() => setViewPart(line.part)}
                              className="p-1 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-800 dark:hover:text-blue-400 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Remove"
                              disabled={removingLineId === line.lineId || isSaving}
                              onClick={() => void removeLine(line)}
                              className="p-1 rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-50"
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
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl py-6 text-center">
                <Package className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                <p className="text-xs text-slate-400">No spare parts added yet. Search above to add.</p>
              </div>
            )}
          </div>
        </div>

          {/* Actions (Sticky footer) */}
          <div className="sticky bottom-0 z-20 px-5 py-3.5 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-500/20 transition-all disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {isSaving ? "Saving..." : "ទទួលការងារ (Accept & Save)"}
            </button>
          </div>
        </form>
      </div>

      {viewPart && (
        <SparePartSpecModal part={viewPart} onClose={() => setViewPart(null)} />
      )}
    </div>
  );
}
