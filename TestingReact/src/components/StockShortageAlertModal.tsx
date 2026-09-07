"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2, PackageX, PackageCheck, ArrowRight, X, ExternalLink, RefreshCw, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { ModalWrapper } from "@/components/av/ModalWrapper";
import { useI18n } from "@/i18n/LanguageProvider";
import { fetchSparePartById, RepairServiceItem } from "@/services/api";
import { shortageItemsOf, type ShortageItem, type StockShortageDetails } from "@/validation";

/**
 * The shortage types and the parser moved to `src/validation/`, which is
 * mirrored into the CamID app by `npm run sync:shared`. The phone was showing
 * the raw SQL trigger text where this modal shows the part, the quantity on
 * hand and the quantity required — one rule, parsed two different ways. They
 * are re-exported here so existing importers keep working unchanged.
 */
export type { ShortageItem, StockShortageDetails } from "@/validation";
export { parseStockErrorMessage, isStockShortageError } from "@/validation";

interface StockShortageAlertModalProps {
  open: boolean;
  onClose: () => void;
  details: StockShortageDetails | null;
  targetItem?: RepairServiceItem | null;
  onConfirmSentSpareparts?: (target: RepairServiceItem) => Promise<void>;
}

export default function StockShortageAlertModal({
  open,
  onClose,
  details,
  targetItem,
  onConfirmSentSpareparts
}: StockShortageAlertModalProps) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const isKhmer = lang === "km";

  const [liveItems, setLiveItems] = useState<ShortageItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live stock polling & realtime tab focus refresh
  useEffect(() => {
    if (!open || !details) return;

    // Shared with the phone, so both platforms fall back to the same row when
    // only part of the trigger message could be parsed.
    const initial = shortageItemsOf(details);

    setLiveItems(initial);

    const checkLiveStock = async () => {
      const updated = await Promise.all(
        initial.map(async (it) => {
          if (!it.sparePartId) return it;
          try {
            const fresh = await fetchSparePartById(it.sparePartId, true);
            if (fresh) {
              return {
                ...it,
                available: fresh.quantity ?? 0,
                itemName: fresh.itemName || it.itemName
              };
            }
          } catch {
            // Keep existing on network error
          }
          return it;
        })
      );
      setLiveItems(updated);
    };

    void checkLiveStock();

    // Poll every 2 seconds while modal is open
    const interval = setInterval(() => {
      void checkLiveStock();
    }, 2000);

    // Instant check when user focuses back on this browser window
    const onWindowFocus = () => {
      void checkLiveStock();
    };
    window.addEventListener("focus", onWindowFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onWindowFocus);
    };
  }, [open, details]);

  if (!open || !details) return null;

  const items = liveItems.length > 0 ? liveItems : (details.items || []);
  const allStockReady =
    items.length > 0 &&
    items.every((it) => Number(it.available) >= Number(it.required));

  const handleOpenInventoryInNewTab = (itemNameToSearch?: string) => {
    const url = itemNameToSearch
      ? `/spareparts?q=${encodeURIComponent(itemNameToSearch)}`
      : "/spareparts";
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleSendSpareparts = async () => {
    if (!targetItem || !onConfirmSentSpareparts) return;
    setIsSubmitting(true);
    try {
      await onConfirmSentSpareparts(targetItem);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalWrapper
      open={open}
      onClose={onClose}
      maxWidth="max-w-lg"
      zIndex={150}
      placement="center"
      backdropVariant="heavy"
      isAlert
    >
      <div className="bg-surface border border-subtle w-full rounded-2xl flex flex-col max-h-[85vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 font-sans">
        {/* Header */}
        <div
          className={`px-5 py-4 border-b border-subtle flex items-center justify-between transition-colors duration-300 shrink-0 ${
            allStockReady
              ? "bg-emerald-500/10 dark:bg-emerald-950/30"
              : "bg-rose-500/10 dark:bg-rose-950/30"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner shrink-0 transition-colors duration-300 ${
                allStockReady
                  ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400"
              }`}
            >
              {allStockReady ? (
                <CheckCircle2 className="w-5 h-5 animate-in zoom-in-75 duration-200" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2
                className={`text-sm font-bold transition-colors duration-300 ${
                  allStockReady
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-rose-700 dark:text-rose-400"
                }`}
              >
                {allStockReady
                  ? isKhmer
                    ? "ស្តុកគ្រឿងបន្លាស់គ្រប់គ្រាន់ហើយ!"
                    : "Spare Parts Ready in Stock!"
                  : isKhmer
                  ? "មិនអាចធ្វើប្រតិបត្តិការបាន"
                  : "Operation Cannot Proceed"}
              </h2>
              <p
                className={`text-xs font-medium transition-colors duration-300 ${
                  allStockReady
                    ? "text-emerald-600/90 dark:text-emerald-300/90"
                    : "text-rose-600/90 dark:text-rose-300/90"
                }`}
              >
                {allStockReady
                  ? isKhmer
                    ? "រួចរាល់សម្រាប់ចុចបញ្ជូនគ្រឿងបន្លាស់ទៅជាង"
                    : "Ready to dispatch parts to technician"
                  : isKhmer
                  ? `ស្តុកគ្រឿងបន្លាស់មិនគ្រប់គ្រាន់ (${items.length} មុខ)`
                  : `Insufficient Spare Part Stock (${items.length} item${items.length > 1 ? "s" : ""})`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-sunken transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 space-y-3.5 overflow-y-auto flex-1">
          <div className="flex items-center justify-between text-xs text-ink-secondary">
            <span>
              {allStockReady
                ? isKhmer
                  ? "គ្រឿងបន្លាស់ទាំងអស់មានស្តុកគ្រប់ចំនួនហើយ៖"
                  : "All spare parts now have sufficient stock:"
                : isKhmer
                ? "ខាងក្រោមនេះជាបញ្ជីគ្រឿងបន្លាស់ដែលខ្វះស្តុក មិនទាន់អាចកាត់ស្តុកបញ្ជូនទៅជាងបានឡើយ៖"
                : "The following spare parts have insufficient inventory:"}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-ink-muted">
              <RefreshCw className="w-3 h-3 animate-spin text-accent" />
              <span>Realtime</span>
            </span>
          </div>

          {/* List of Shortage Items */}
          <div className="space-y-2.5">
            {items.map((it, idx) => {
              const isItemReady = Number(it.available) >= Number(it.required);

              return (
                <div
                  key={it.sparePartId || `${it.itemName}-${idx}`}
                  className={`p-3.5 rounded-xl border flex flex-col gap-2.5 transition-all duration-300 ${
                    isItemReady
                      ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60"
                      : "bg-sunken/80 border-subtle/80 hover:border-subtle"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isItemReady ? (
                        <PackageCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <PackageX className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      )}
                      <span className="text-xs font-bold text-ink truncate">
                        {it.itemName}
                      </span>
                    </div>

                    {!isItemReady ? (
                      <button
                        type="button"
                        onClick={() => handleOpenInventoryInNewTab(it.itemName)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-accent hover:underline shrink-0 bg-accent-soft px-2.5 py-1 rounded-lg transition-colors hover:bg-accent-soft/80"
                        title={isKhmer ? "បើក Tab ថ្មីដើម្បីបញ្ចូលស្តុក" : "Open in new tab to stock in"}
                      >
                        <span>{isKhmer ? "បញ្ចូលស្តុក" : "Stock In"}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-0.5 rounded-full shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{isKhmer ? "គ្រប់ចំនួន" : "Ready"}</span>
                      </span>
                    )}
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-2">
                    <div
                      className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between transition-colors ${
                        isItemReady
                          ? "bg-emerald-100/70 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-800"
                          : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50"
                      }`}
                    >
                      <span
                        className={`text-[10.5px] font-semibold ${
                          isItemReady
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {isKhmer ? "មានក្នុងស្តុក" : "In Stock"}:
                      </span>
                      <span
                        className={`text-xs font-extrabold ${
                          isItemReady
                            ? "text-emerald-800 dark:text-emerald-200"
                            : "text-rose-700 dark:text-rose-300"
                        }`}
                      >
                        {it.available} <span className="text-[10px] font-medium font-khmer">{isKhmer ? "គ្រឿង" : "pcs"}</span>
                      </span>
                    </div>

                    <div className="px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 flex items-center justify-between">
                      <span className="text-[10.5px] font-semibold text-blue-600 dark:text-blue-400">
                        {isKhmer ? "ត្រូវការប្រើ" : "Required"}:
                      </span>
                      <span className="text-xs font-extrabold text-blue-700 dark:text-blue-300">
                        {it.required} <span className="text-[10px] font-medium font-khmer">{isKhmer ? "គ្រឿង" : "pcs"}</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {allStockReady ? (
            <div className="text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 rounded-xl p-3 flex items-start gap-2.5 mt-2 animate-in fade-in duration-300">
              <span className="text-sm shrink-0">🎉</span>
              <span>
                {isKhmer
                  ? "គ្រឿងបន្លាស់ទាំងអស់មានក្នុងស្តុកគ្រប់គ្រាន់ហើយ! លោកអ្នកអាចចុចប៊ូតុងខាងក្រោមដើម្បីបញ្ជូនទៅកាន់ជាងបានភ្លាមៗ។"
                  : "All spare parts are now in stock! You can click below to dispatch to technician."}
              </span>
            </div>
          ) : (
            <div className="text-xs text-ink-secondary leading-relaxed bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2.5 mt-2">
              <span className="text-sm shrink-0">💡</span>
              <span>
                {isKhmer
                  ? "សូមមេត្តាបញ្ចូលស្តុក (Stock In) សម្រាប់គ្រឿងបន្លាស់ខាងលើទាំងអស់ជាមុនសិន។ ពេលបញ្ចូលរួច ផ្ទាំងនេះនឹង Update ស្វ័យប្រវត្តិ។"
                  : "Please record Stock In for all the items above. This modal updates automatically once stock is added."}
              </span>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="px-5 py-3.5 bg-cushion/60 border-t border-subtle flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-ink-secondary hover:bg-sunken rounded-xl transition-colors"
          >
            {isKhmer ? "បិទ" : "Close"}
          </button>

          {allStockReady ? (
            <button
              type="button"
              onClick={handleSendSpareparts}
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 rounded-xl transition-all flex items-center gap-1.5 shadow-md disabled:opacity-60 cursor-pointer animate-in zoom-in-95 duration-200"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{isKhmer ? "កំពុងបញ្ជូន..." : "Sending..."}</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>{isKhmer ? "បានបញ្ជូនគ្រឿងបន្លាស់ (Sent Spareparts)" : "Dispatch (Sent Spareparts)"}</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleOpenInventoryInNewTab()}
              className="px-4 py-2 text-xs font-bold text-white bg-accent hover:bg-accent/90 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <span>{isKhmer ? "ទៅកាន់ Inventory" : "Go to Inventory"}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
}
