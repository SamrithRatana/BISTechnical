"use client";

import React, { useState, useEffect, useCallback } from "react";
import PageWrapper from "@/components/PageWrapper";
import HighlightText from "@/components/HighlightText";
import {
  Plus,
  Search,
  Download,
  RefreshCw,
  Box,
  MinusCircle,
  PackageCheck,
  Edit,
  Trash2,
  X,
  Save,
  Image as ImageIcon,
  AlertTriangle
} from "lucide-react";
import {
  fetchSparePartsInventory,
  createSparePart,
  updateSparePart,
  deleteSparePart,
  insertManualStockOut,
  SparePartItem,
  PaginatedResult
} from "@/services/api";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

// Simple SVG Code128 Barcode Graphic
function BarcodeSvg({ value }: { value: string }) {
  const str = value || "00000";
  const bars: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bars.push((code % 3) + 1, ((code * 3) % 2) + 1, ((code * 7) % 3) + 1, (code % 2) + 1);
  }

  let xPos = 10;
  return (
    <div className="flex flex-col items-center justify-center py-1">
      <svg width="180" height="42" viewBox="0 0 200 48" className="bg-white p-1 rounded border border-slate-200 shadow-2xs dark:bg-slate-900 dark:border-slate-700">
        <rect x="5" y="4" width="2" height="40" fill="currentColor" className="text-slate-900 dark:text-slate-100" />
        <rect x="9" y="4" width="1" height="40" fill="currentColor" className="text-slate-900 dark:text-slate-100" />
        {bars.map((w, idx) => {
          xPos += w + (idx % 2 === 0 ? 1 : 2);
          if (xPos > 185) return null;
          return (
            <rect
              key={idx}
              x={xPos}
              y="4"
              width={w}
              height="40"
              fill={idx % 2 === 0 ? "currentColor" : "transparent"}
              className="text-slate-900 dark:text-slate-100"
            />
          );
        })}
        <rect x="188" y="4" width="2" height="40" fill="currentColor" className="text-slate-900 dark:text-slate-100" />
      </svg>
      <span className="font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 mt-0.5 tracking-wider">
        {str}
      </span>
    </div>
  );
}

export default function SparePartsPage() {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<PaginatedResult<SparePartItem>>({
    items: [],
    totalCount: 0,
    pageNumber: 1,
    pageSize: 10,
    totalPages: 0,
  });

  // Modal states
  const [activeModal, setActiveModal] = useState<"stockIn" | "stockOut" | "edit" | "delete" | null>(null);
  const [selectedPart, setSelectedPart] = useState<SparePartItem | null>(null);
  const [quantityInput, setQuantityInput] = useState(1);
  const [reasonInput, setReasonInput] = useState("");

  // Edit / Add Form State
  const [formState, setFormState] = useState<Partial<SparePartItem>>({
    itemName: "",
    serialNumber: "",
    description: "",
    useFor: "",
    pictureUrl: "",
    quantity: 0,
    defaultPrice: 0,
  });

  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const loadData = useCallback(async () => {
    if (!data.items || data.items.length === 0) {
      setIsLoading(true);
    }
    const term = debouncedSearch.trim();
    const result = await fetchSparePartsInventory(currentPage, pageSize, term);
    setData(result);
    setIsLoading(false);
  }, [currentPage, pageSize, debouncedSearch]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    let success = false;

    const userId = "00000000-0000-0000-0000-000000000000";

    if (formState.id) {
      // Update Mode
      success = await updateSparePart(formState as SparePartItem, userId);
    } else {
      // Create Mode
      success = await createSparePart(formState as SparePartItem);
    }

    if (success) {
      void loadData();
      setActiveModal(null);
    } else {
      // Optimistic client update fallback
      const updatedList = formState.id
        ? (data.items || []).map((p) => (p.id === formState.id ? { ...p, ...formState } : p))
        : [...(data.items || []), { ...formState, id: "temp-" + Date.now() } as SparePartItem];
      setData((prev) => ({ ...prev, items: updatedList }));
      setIsLoading(false);
      setActiveModal(null);
    }
  };

  const handleDelete = async () => {
    if (!selectedPart?.id) return;
    setIsLoading(true);
    const success = await deleteSparePart(selectedPart.id);
    if (success) {
      void loadData();
    } else {
      // Optimistic delete
      setData((prev) => ({
        ...prev,
        items: (prev.items || []).filter((p) => p.id !== selectedPart.id),
      }));
    }
    setIsLoading(false);
    setActiveModal(null);
  };

  const handleStockInSubmit = async () => {
    if (!selectedPart) return;
    setIsLoading(true);
    const currentQty = selectedPart.quantity ?? 0;
    const updatedPart: SparePartItem = {
      ...selectedPart,
      quantity: currentQty + quantityInput,
    };

    const success = await updateSparePart(updatedPart);
    if (success) {
      loadData();
    } else {
      // Optimistic update
      setData((prev) => ({
        ...prev,
        items: (prev.items || []).map((p) => (p.id === selectedPart.id ? updatedPart : p)),
      }));
    }
    setIsLoading(false);
    setActiveModal(null);
  };

  const handleStockOutSubmit = async () => {
    if (!selectedPart) return;
    setIsLoading(true);
    const currentQty = selectedPart.quantity ?? 0;
    const success = await insertManualStockOut(selectedPart.id, quantityInput, reasonInput);
    if (success) {
      void loadData();
    } else {
      // Optimistic deduction fallback
      const updatedPart: SparePartItem = {
        ...selectedPart,
        quantity: Math.max(0, currentQty - quantityInput),
      };
      setData((prev) => ({
        ...prev,
        items: (prev.items || []).map((p) => (p.id === selectedPart.id ? updatedPart : p)),
      }));
    }
    setIsLoading(false);
    setActiveModal(null);
  };

  const filtered = (data.items || []).filter((p) => {
    if (!p) return false;
    const term    = (search || "").toLowerCase();
    const name    = (p.itemName ?? "").toLowerCase();
    const partNo  = (p.serialNumber ?? p.partNumber ?? "").toLowerCase();
    const useFor  = (p.useFor ?? p.description ?? "").toLowerCase();
    return name.includes(term) || partNo.includes(term) || useFor.includes(term);
  });

  const getImageUrl = (url?: string) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("/")) return url;
    return `/${url}`;
  };

  return (
    <PageWrapper
      title="SparePart Inventory"
      subtitle="Track available spare parts, stock quantities, barcodes, and replacement pricing (SparePartList.razor)"
    >
      <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Search Header */}
        <div className="p-4 shrink-0 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Item Name, Part Number, Use For..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64 md:w-96 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              />
            </div>

            <button
              onClick={loadData}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors dark:text-slate-400 dark:hover:bg-slate-800"
              title="Reload Spare Parts API"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setFormState({
                  itemName: "",
                  serialNumber: "",
                  description: "",
                  useFor: "",
                  pictureUrl: "",
                  quantity: 1,
                  defaultPrice: 0.0,
                });
                setActiveModal("edit");
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Spare Part</span>
            </button>
            <button className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
          <table className="w-full text-left border-collapse min-w-full text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-3.5 text-center whitespace-nowrap">Image</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Item Name</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Part Number</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Use For</th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap">Default Price</th>
                <th className="py-3 px-3.5 text-center whitespace-nowrap">Quantity</th>
                <th className="py-3 px-3.5 text-center whitespace-nowrap">Barcode</th>
                <th className="py-3 px-3.5 text-center whitespace-nowrap">Set Stock</th>
                <th className="py-3 px-3.5 text-center whitespace-nowrap">Stock Out</th>
                <th className="py-3 px-3.5 text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td colSpan={10} className="py-3.5 px-4">
                      <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                    </td>
                  </tr>
                ))
              ) : filtered.length > 0 ? (
                filtered.map((part, idx) => {
                  const image  = part.pictureUrl;
                  const name   = part.itemName ?? "N/A";
                  const partNo = part.serialNumber ?? part.partNumber ?? `SP-${idx + 100}`;
                  const useFor = part.useFor ?? part.description ?? "N/A";
                  const qty    = part.quantity ?? 0;
                  const price  = part.defaultPrice ?? 0;

                  let stockStatusText = "GOOD STOCK";
                  let stockBadgeClass = "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300";
                  let barColor = "bg-emerald-500";

                  if (qty <= 0) {
                    stockStatusText = "OUT OF STOCK";
                    stockBadgeClass = "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300";
                    barColor = "bg-rose-500";
                  } else if (qty <= 2) {
                    stockStatusText = "CRITICAL";
                    stockBadgeClass = "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300";
                    barColor = "bg-amber-500";
                  }

                  return (
                    <tr key={part.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Image Column */}
                      <td className="py-2.5 px-3.5 text-center">
                        <div className="w-14 h-14 mx-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden shadow-2xs">
                          {image ? (
                            <img src={getImageUrl(image)} alt={name} className="w-full h-full object-cover" />
                          ) : (
                            <Box className="w-6 h-6 text-slate-400" />
                          )}
                        </div>
                      </td>

                      {/* Item Name */}
                      <td className="py-3 px-3.5 font-semibold text-slate-900 dark:text-slate-100 max-w-[220px] truncate" title={name}>
                        <HighlightText text={name} query={search} />
                      </td>

                      {/* Part Number */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <code className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 font-semibold">
                          <HighlightText text={partNo} query={search} />
                        </code>
                      </td>

                      {/* Use For */}
                      <td className="py-3 px-3.5 text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title={useFor}>
                        <HighlightText text={useFor} query={search} />
                      </td>

                      {/* Default Price */}
                      <td className="py-3 px-3.5 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ${Number(price).toFixed(2)}
                      </td>

                      {/* Quantity & Stock Level Bar */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center justify-center gap-1 min-w-[100px]">
                          <span className="font-mono text-sm font-extrabold text-slate-900 dark:text-slate-100">
                            {qty}
                          </span>
                          <span className={`inline-block px-2 py-0.5 rounded text-[9.5px] font-bold border tracking-tight ${stockBadgeClass}`}>
                            {stockStatusText}
                          </span>
                          <div className="w-16 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-0.5">
                            <div
                              className={`h-full ${barColor} transition-all duration-300`}
                              style={{ width: `${Math.min(100, Math.max(10, qty * 20))}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Barcode Graphic */}
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                        <BarcodeSvg value={partNo} />
                      </td>

                      {/* Set Stock (Stock In) */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <button
                          onClick={() => {
                            setSelectedPart(part);
                            setQuantityInput(1);
                            setActiveModal("stockIn");
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-all shadow-2xs dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
                        >
                          <PackageCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Stock In</span>
                        </button>
                      </td>

                      {/* Stock Out */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <button
                          disabled={qty <= 0}
                          onClick={() => {
                            setSelectedPart(part);
                            setQuantityInput(1);
                            setActiveModal("stockOut");
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-rose-600 bg-white border border-rose-200 rounded-xl hover:bg-rose-50 hover:border-rose-300 transition-all shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                        >
                          <MinusCircle className="w-3.5 h-3.5" />
                          <span>Stock Out</span>
                        </button>
                      </td>

                      {/* Edit / Delete Actions */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedPart(part);
                               setFormState({
                                 ...part,
                                 itemName:     part.itemName,
                                 serialNumber: part.serialNumber ?? part.partNumber,
                                 useFor:       part.useFor,
                                 defaultPrice: part.defaultPrice,
                                 pictureUrl:   part.pictureUrl,
                               });
                              setActiveModal("edit");
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-800"
                            title="Edit Spare Part"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPart(part);
                              setActiveModal("delete");
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-slate-800"
                            title="Delete Spare Part"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No spare parts found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── CREATE / EDIT DIALOG ── */}
        {activeModal === "edit" && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-w-2xl w-full flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  {formState.id ? "Edit Spare Part" : "Add New Spare Part"}
                </h3>
                <button
                  onClick={() => setActiveModal(null)}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateOrUpdate} className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column: Image Box & Description */}
                  <div className="space-y-4">
                    <div className="w-full h-44 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center relative overflow-hidden p-2">
                      {formState.pictureUrl ? (
                        <>
                          <img
                            src={getImageUrl(formState.pictureUrl)}
                            alt="preview"
                            className="max-h-36 object-contain rounded"
                          />
                          <button
                            type="button"
                            onClick={() => setFormState({ ...formState, pictureUrl: "" })}
                            className="absolute top-2 right-2 p-1 rounded-full bg-slate-950/60 text-white hover:bg-slate-950 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <div className="text-center space-y-2">
                          <ImageIcon className="w-8 h-8 text-slate-400 mx-auto" />
                          <span className="text-xs text-slate-400">No Image Selected</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Picture Url / Path
                      </label>
                      <input
                        type="text"
                        placeholder="images/spareparts/part-name.jpg"
                        value={formState.pictureUrl || ""}
                        onChange={(e) => setFormState({ ...formState, pictureUrl: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Description
                      </label>
                      <textarea
                        rows={3}
                        value={formState.description || ""}
                        onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="Detailed part specification notes..."
                      />
                    </div>
                  </div>

                  {/* Right Column: Fields */}
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Item Name / Brand *
                      </label>
                      <input
                        type="text"
                        required
                        value={formState.itemName || ""}
                        onChange={(e) => setFormState({ ...formState, itemName: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Part Number (Serial) *
                      </label>
                      <input
                        type="text"
                        required
                        value={formState.serialNumber || ""}
                        onChange={(e) => setFormState({ ...formState, serialNumber: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 font-mono outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Use For (Compatibilities)
                      </label>
                      <input
                        type="text"
                        value={formState.useFor || ""}
                        onChange={(e) => setFormState({ ...formState, useFor: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Stock Quantity
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formState.quantity ?? 0}
                          onChange={(e) => setFormState({ ...formState, quantity: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Default Price ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formState.defaultPrice ?? 0.0}
                          onChange={(e) => setFormState({ ...formState, defaultPrice: Math.max(0.0, parseFloat(e.target.value) || 0.0) })}
                          className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm shadow-blue-500/20"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Spare Part</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── DELETE CONFIRM DIALOG ── */}
        {activeModal === "delete" && selectedPart && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 text-rose-600 mb-3">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Confirm Delete</h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                Are you sure you want to permanently delete spare part{" "}
                 <strong className="text-slate-900 dark:text-slate-200">
                   {selectedPart.itemName ?? ""}
                 </strong>
                ? This action cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-sm shadow-rose-500/20"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STOCK IN DIALOG ── */}
        {activeModal === "stockIn" && selectedPart && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl dark:bg-emerald-950 dark:text-emerald-300">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                    Stock In (Add Inventory)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                    {selectedPart.itemName}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Quantity to Add
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantityInput}
                    onChange={(e) => setQuantityInput(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStockInSubmit}
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm"
                  >
                    Confirm Stock In
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STOCK OUT DIALOG ── */}
        {activeModal === "stockOut" && selectedPart && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                <div className="p-2 bg-rose-100 text-rose-700 rounded-xl dark:bg-rose-950 dark:text-rose-300">
                  <MinusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                    Manual Stock Out
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                    {selectedPart.itemName}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Current Stock
                    </label>
                    <div className="px-3 py-2 text-sm border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 rounded-xl font-bold font-mono">
                       {selectedPart.quantity ?? 0}
                     </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Quantity to Deduct
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={selectedPart.quantity ?? (selectedPart as any).Quantity ?? 0}
                      value={quantityInput}
                      onChange={(e) => setQuantityInput(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Reason / Note *
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="e.g. Used for internal repair..."
                    value={reasonInput}
                    onChange={(e) => setReasonInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStockOutSubmit}
                    disabled={!reasonInput}
                    className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Confirm Stock Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
