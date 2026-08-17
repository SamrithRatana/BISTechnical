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
import { useI18n } from "@/i18n/LanguageProvider";

function getImageUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return url;
  return `/${url}`;
}

function stockBadge(qty: number): string {
  if (qty <= 0) return "bg-danger-soft text-danger-fg border-danger ";
  if (qty <= 2) return "bg-warning-soft text-warning-fg border-warning ";
  return "bg-success-soft text-success-fg border-success ";
}

interface SparePartSpecModalProps {
  part: SparePartItem;
  onClose: () => void;
}

export default function SparePartSpecModal({ part, onClose }: SparePartSpecModalProps) {
  const { t } = useI18n();
  const qty = part.quantity ?? 0;
  const imageUrl = getImageUrl(part.pictureUrl);

  return createPortal(
    <div
      className="enter-fade fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-ink/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="enter-pop bg-elevated border border-subtle w-full max-w-md rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-subtle flex items-center justify-between bg-cushion/50 ">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-info-soft text-info flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-ink truncate">
                {part.itemName || t("spec.fallbackTitle")}
              </h2>
              <p className="text-[11px] text-ink-secondary ">{t("dialog.sparePartSpec")}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-sunken transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="w-full h-40 rounded-xl border border-subtle bg-cushion flex items-center justify-center overflow-hidden">
            {imageUrl ? (
              <img src={imageUrl} alt={part.itemName || ""} loading="lazy" decoding="async" className="max-h-full max-w-full object-contain" />
            ) : (
              <Package className="w-10 h-10 text-ink-muted " />
            )}
          </div>

          <table className="w-full text-xs">
            <tbody>
              <tr className="border-b border-subtle ">
                <td className="py-2 pr-3 text-ink-secondary font-semibold whitespace-nowrap w-32">
                  <span className="inline-flex items-center gap-1.5"><Barcode className="w-3.5 h-3.5" /> {t("field.partNumber")}</span>
                </td>
                <td className="py-2 font-mono text-ink ">
                  {part.serialNumber || part.partNumber || "—"}
                </td>
              </tr>
              <tr className="border-b border-subtle ">
                <td className="py-2 pr-3 text-ink-secondary font-semibold whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5"><Wrench className="w-3.5 h-3.5" /> {t("field.useFor")}</span>
                </td>
                <td className="py-2 text-ink ">{part.useFor || "—"}</td>
              </tr>
              <tr className="border-b border-subtle ">
                <td className="py-2 pr-3 text-ink-secondary font-semibold whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5"><Boxes className="w-3.5 h-3.5" /> {t("field.stock")}</span>
                </td>
                <td className="py-2">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${stockBadge(qty)}`}>
                    {t("spec.inStock", { qty })}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-3 text-ink-secondary font-semibold whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> {t("field.defaultPrice")}</span>
                </td>
                <td className="py-2 font-semibold text-success ">
                  {part.defaultPrice != null ? `$${part.defaultPrice.toFixed(2)}` : "—"}
                </td>
              </tr>
            </tbody>
          </table>

          {part.description && (
            <div className="pt-1">
              <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1.5">{t("field.description")}</p>
              <p className="text-xs text-ink leading-relaxed whitespace-pre-wrap">
                {part.description}
              </p>
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-subtle bg-cushion/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-ink bg-elevated border border-subtle rounded-xl hover:bg-sunken transition-colors"
          >
            {t("action.close")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
