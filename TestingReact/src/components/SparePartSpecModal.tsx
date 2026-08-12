"use client";

/**
 * @file SparePartSpecModal.tsx
 * @description Read-only spare-part specification view, opened via the eye
 * icon in InspectItemDialog's search results and added-parts table. Shows
 * the same fields the SparePart Inventory edit form captures — image,
 * description, part number, compatibility, stock, price — so a technician
 * can confirm they're picking the right part without leaving the dialog.
 *
 * Portaled to document.body rather than rendered in place: InspectItemDialog
 * opens this from inside its own `z-50` fixed overlay, and CSS only compares
 * z-index between siblings in the same stacking context — a `position: fixed`
 * ancestor with a z-index (that overlay) creates one, so this modal's z-index
 * would be capped at the overlay's, not compared against the search
 * dropdown's z-[100] portal directly under body. Rendering it as a true
 * root-level sibling is what lets its z-index actually apply.
 */

import React from "react";
import { createPortal } from "react-dom";
import { X, Package, Barcode, Wrench, DollarSign, Boxes } from "lucide-react";
import type { SparePartItem } from "@/services/api";

function getImageUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return url;
  return `/${url}`;
}

function stockBadge(qty: number): string {
  if (qty <= 0) return "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900";
  if (qty <= 2) return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900";
  return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900";
}

interface SparePartSpecModalProps {
  part: SparePartItem;
  onClose: () => void;
}

export default function SparePartSpecModal({ part, onClose }: SparePartSpecModalProps) {
  const qty = part.quantity ?? 0;
  const imageUrl = getImageUrl(part.pictureUrl);

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {part.itemName || "Spare Part"}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Specification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="w-full h-40 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
            {imageUrl ? (
              <img src={imageUrl} alt={part.itemName || ""} className="max-h-full max-w-full object-contain" />
            ) : (
              <Package className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            )}
          </div>

          <table className="w-full text-xs">
            <tbody>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-3 text-slate-500 dark:text-slate-400 font-semibold whitespace-nowrap w-32">
                  <span className="inline-flex items-center gap-1.5"><Barcode className="w-3.5 h-3.5" /> Part Number</span>
                </td>
                <td className="py-2 font-mono text-slate-800 dark:text-slate-200">
                  {part.serialNumber || part.partNumber || "—"}
                </td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-3 text-slate-500 dark:text-slate-400 font-semibold whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5"><Wrench className="w-3.5 h-3.5" /> Use For</span>
                </td>
                <td className="py-2 text-slate-800 dark:text-slate-200">{part.useFor || "—"}</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-3 text-slate-500 dark:text-slate-400 font-semibold whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5"><Boxes className="w-3.5 h-3.5" /> Stock</span>
                </td>
                <td className="py-2">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${stockBadge(qty)}`}>
                    {qty} in stock
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-3 text-slate-500 dark:text-slate-400 font-semibold whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Default Price</span>
                </td>
                <td className="py-2 font-semibold text-emerald-600 dark:text-emerald-400">
                  {part.defaultPrice != null ? `$${part.defaultPrice.toFixed(2)}` : "—"}
                </td>
              </tr>
            </tbody>
          </table>

          {part.description && (
            <div className="pt-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Description</p>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {part.description}
              </p>
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
