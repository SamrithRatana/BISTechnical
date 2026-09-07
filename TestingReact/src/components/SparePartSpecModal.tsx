"use client";

/**
 * @file SparePartSpecModal.tsx
 * @description Modern Aura Soft UI Lightbox & Specification modal for spare parts.
 * Follows the Aura Velvet CreativeStudio / SoftModal design language (localhost:3001)
 * with a high-res image view, styled description prompt box, technical metadata tags,
 * and quick copy actions.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X, Package, Barcode, Wrench, DollarSign, Boxes, Copy, Check, Sparkles,
  ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw
} from "lucide-react";
import toast from "react-hot-toast";
import type { SparePartItem } from "@/services/api";
import { useI18n } from "@/i18n/LanguageProvider";
import { useSafeTimeout } from "@/hooks/useSafeTimeout";
import { ModalWrapper } from "@/components/av/ModalWrapper";

function getImageUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return url;
  return `/${url}`;
}

function stockBadge(qty: number): { bg: string; text: string; label: string } {
  if (qty <= 0) return { bg: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30", text: "text-rose-600 dark:text-rose-400", label: "Out of Stock" };
  if (qty <= 2) return { bg: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30", text: "text-amber-700 dark:text-amber-400", label: "Low Stock" };
  return { bg: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30", text: "text-emerald-700 dark:text-emerald-400", label: "In Stock" };
}

interface SparePartSpecModalProps {
  part: SparePartItem;
  onClose: () => void;
}

export default function SparePartSpecModal({ part, onClose }: SparePartSpecModalProps) {
  const { t } = useI18n();
  const later = useSafeTimeout();
  const [copied, setCopied] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fsZoom, setFsZoom] = useState(1);
  const [panPos, setPanPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

  const qty = part.quantity ?? 0;
  const imageUrl = getImageUrl(part.pictureUrl);
  const stock = stockBadge(qty);
  const partNo = part.serialNumber || part.partNumber || "";

  const handleCopyPartNo = () => {
    if (!partNo) return;
    navigator.clipboard.writeText(partNo);
    setCopied(true);
    toast.success(t("common.copiedValue", { value: partNo }));
    later(() => setCopied(false), 2000);
  };

  const handleZoomIn = () => setZoomScale((prev) => Math.min(+(prev + 0.25).toFixed(2), 2.5));
  const handleZoomOut = () => setZoomScale((prev) => Math.max(+(prev - 0.25).toFixed(2), 0.75));
  const handleResetZoom = () => setZoomScale(1);

  const handleFsZoomIn = () => setFsZoom((prev) => Math.min(+(prev + 0.5).toFixed(1), 4));
  const handleFsZoomOut = () => {
    setFsZoom((prev) => {
      const next = Math.max(+(prev - 0.5).toFixed(1), 1);
      if (next === 1) setPanPos({ x: 0, y: 0 });
      return next;
    });
  };
  const handleResetFsZoom = () => {
    setFsZoom(1);
    setPanPos({ x: 0, y: 0 });
  };

  // Keyboard handler for Escape in Fullscreen mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        e.stopPropagation();
        setIsFullscreen(false);
        handleResetFsZoom();
      }
    };
    if (isFullscreen) {
      window.addEventListener("keydown", handleKeyDown, true);
    }
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isFullscreen]);

  // Drag to pan in fullscreen mode
  const handleMouseDown = (e: React.MouseEvent) => {
    if (fsZoom <= 1) return;
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: panPos.x,
      initialY: panPos.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || fsZoom <= 1) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;
    setPanPos({
      x: dragStartRef.current.initialX + deltaX,
      y: dragStartRef.current.initialY + deltaY,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <>
      <ModalWrapper
        open={!isFullscreen}
        onClose={onClose}
        maxWidth="max-w-lg xl:max-w-xl"
        zIndex={300}
        labelledBy="spare-part-spec-title"
        placement="center"
        panelVariant="glass"
        backdropVariant="heavy"
      >
        {/* Pinned title row, pinned badge/action bar, scrolling middle — the
            same three-part column as `MediaLightbox`, and for the same reason:
            the panel cap keeps the dialog on screen, this keeps the title and
            the close button reachable once the middle has to scroll. */}
        <div className="flex flex-col max-h-[var(--av-modal-inner-maxh)] p-4 sm:p-5 lg:p-4.5 xl:p-6 gap-3.5">
          {/* Header — Title, Subtitle, and Frosted Glass Close */}
          <div className="flex items-start justify-between gap-3 shrink-0">
            <div className="min-w-0 flex-1">
              <h3 id="spare-part-spec-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                {part.itemName || t("spec.fallbackTitle")}
              </h3>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-0.5 flex items-center gap-1.5 truncate">
                <span className="font-mono text-slate-900 dark:text-slate-100 font-semibold">{partNo || "N/A"}</span>
                {part.useFor && (
                  <>
                    <span className="text-slate-400 dark:text-slate-500">•</span>
                    <span className="truncate">{part.useFor}</span>
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full bg-white/70 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 border border-black/[0.08] dark:border-white/[0.1] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center shadow-2xs transition-all cursor-pointer shrink-0 active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-3.5 -mx-1 px-1">
          {/* Frosted Glass Media Preview Showcase with Interactive Zoom & Fullscreen */}
          <div className="rounded-2xl overflow-hidden h-[min(185px,30dvh)] sm:h-[min(210px,30dvh)] lg:h-[min(200px,30dvh)] xl:h-[min(230px,30dvh)] relative bg-white/50 dark:bg-black/25 backdrop-blur-md border border-white/70 dark:border-white/[0.08] shadow-inner flex items-center justify-center p-3 group select-none">
            {imageUrl ? (
              <>
                <div
                  className="w-full h-full flex items-center justify-center overflow-hidden"
                  style={{
                    transform: `scale(${zoomScale})`,
                    transformOrigin: "center center",
                    transition: "transform 0.2s cubic-bezier(0.2, 0, 0, 1)",
                  }}
                >
                  <img
                    src={imageUrl}
                    alt={part.itemName || ""}
                    loading="lazy"
                    decoding="async"
                    className="max-h-full max-w-full object-contain rounded-xl drop-shadow-md cursor-zoom-in"
                    onClick={() => setZoomScale((prev) => (prev === 1 ? 1.5 : 1))}
                    title="Click to zoom / reset"
                  />
                </div>

                {/* Floating Frosted Glass Action Toolbar */}
                <div className="absolute bottom-2.5 right-2.5 flex items-center gap-0.5 p-1 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-black/[0.1] dark:border-white/[0.15] shadow-sm z-10">
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    disabled={zoomScale <= 0.75}
                    title={t("sp.zoomOut")}
                    className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 disabled:opacity-35 transition-colors cursor-pointer"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-200 px-1 min-w-[32px] text-center">
                    {Math.round(zoomScale * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    disabled={zoomScale >= 2.5}
                    title={t("sp.zoomIn")}
                    className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 disabled:opacity-35 transition-colors cursor-pointer"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  {zoomScale !== 1 && (
                    <button
                      type="button"
                      onClick={handleResetZoom}
                      title={t("sp.resetZoom")}
                      className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <div className="w-[1px] h-3 bg-black/10 dark:bg-white/15 mx-0.5" />
                  <button
                    type="button"
                    onClick={() => setIsFullscreen(true)}
                    title={t("sp.viewFullscreen")}
                    className="p-1 rounded-lg hover:bg-accent hover:text-white text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400 py-6">
                <Package className="w-10 h-10 opacity-50" />
                <span className="text-xs font-semibold">No Image Available</span>
              </div>
            )}
          </div>

          {/* Description & Compatibility Details Section (Full Text, Clean Card) */}
          {(part.description || part.useFor) && (
            <div className="p-4 sm:p-4.5 rounded-2xl bg-white/60 dark:bg-white/[0.04] backdrop-blur-md border border-black/[0.06] dark:border-white/[0.08] text-xs space-y-3 shadow-2xs">
              {/* Card Header with Price */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-accent tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  {t("field.description")} &amp; {t("field.useFor")}
                </span>
                {part.defaultPrice != null && part.defaultPrice > 0 && (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono px-2.5 py-0.5 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 shadow-2xs flex items-center gap-1">
                    <DollarSign className="w-3 h-3 -mr-0.5" />
                    {part.defaultPrice.toFixed(2)}
                  </span>
                )}
              </div>

              {/* Compatible Models / Use For (Full Text Tags) */}
              {part.useFor && (
                <div className="space-y-1.5">
                  <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Wrench className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                    {t("field.useFor")}:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {part.useFor.split(/[,;\n]+/).map((model, idx) => {
                      const trimmed = model.trim();
                      if (!trimmed) return null;
                      return (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white dark:bg-surface border border-subtle text-xs font-bold text-ink shadow-2xs"
                        >
                          {trimmed}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Description (Full Text, No Truncation) */}
              {part.description && (
                <div className="space-y-1">
                  {part.useFor && (
                    <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
                      {t("field.description")}:
                    </span>
                  )}
                  <p className="leading-relaxed font-sans text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line">
                    {part.description}
                  </p>
                </div>
              )}
            </div>
          )}

          </div>

          {/* Frosted Badges & Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-black/[0.06] dark:border-white/[0.08] shrink-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Part Number Tag */}
              {partNo && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/70 dark:bg-white/10 backdrop-blur-sm border border-black/[0.08] dark:border-white/[0.12] text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200 shadow-2xs">
                  <Barcode className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                  {partNo}
                </span>
              )}

              {/* Stock Quantity Badge (Solid, Clean, Bold Black Number) */}
              {qty <= 0 ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950 border border-rose-300 dark:border-rose-800 text-xs font-bold text-rose-900 dark:text-rose-200 shadow-2xs">
                  <Boxes className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400" />
                  <span className="font-mono font-extrabold text-slate-900 dark:text-slate-100">0</span>
                  <span>Out of Stock</span>
                </span>
              ) : qty <= 2 ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950 border border-amber-300 dark:border-amber-800 text-xs font-bold text-amber-950 dark:text-amber-200 shadow-2xs">
                  <Boxes className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                  <span className="font-mono font-extrabold text-slate-900 dark:text-slate-100">{qty}</span>
                  <span>Low Stock</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800 text-xs font-bold text-emerald-950 dark:text-emerald-200 shadow-2xs">
                  <Boxes className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                  <span className="font-mono font-extrabold text-slate-900 dark:text-slate-100">{qty}</span>
                  <span>In Stock</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {partNo && (
                <button
                  type="button"
                  onClick={handleCopyPartNo}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 bg-white/80 dark:bg-white/15 hover:bg-white dark:hover:bg-white/25 border border-black/[0.08] dark:border-white/[0.1] shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />}
                  <span>{copied ? "Copied" : t("field.partNumber")}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-1.5 rounded-xl text-xs font-bold text-white bg-accent hover:bg-accent-hover shadow-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                {t("action.close")}
              </button>
            </div>
          </div>
        </div>
      </ModalWrapper>

      {/* ── FULLSCREEN HIGH-RES INSPECTION LIGHTBOX (PORTALED TO BODY) ── */}
      {isFullscreen && imageUrl && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-2xl flex flex-col justify-between p-4 sm:p-6 text-white select-none animate-in fade-in duration-200"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* Top Fullscreen Header */}
          <div className="flex items-center justify-between gap-4 z-20">
            <div className="min-w-0 flex-1">
              <h4 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                {part.itemName || t("spec.fallbackTitle")}
              </h4>
              <p className="text-xs text-white/70 font-mono mt-0.5 truncate flex items-center gap-2">
                <span>{partNo || "N/A"}</span>
                {part.useFor && <span>• {part.useFor}</span>}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <kbd className="hidden sm:inline-block px-2.5 py-1 text-[11px] font-mono text-white/70 bg-white/10 rounded-lg border border-white/15">
                ESC
              </kbd>
              <button
                type="button"
                onClick={() => {
                  setIsFullscreen(false);
                  handleResetFsZoom();
                }}
                className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-white flex items-center justify-center shadow-lg transition-all cursor-pointer active:scale-95"
                title="Exit Full Screen (Return to Modal)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Center High-Res Zoomable Canvas */}
          <div
            className={`flex-1 flex items-center justify-center overflow-hidden relative my-3 ${
              fsZoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-default"
            }`}
            onMouseDown={handleMouseDown}
            onDoubleClick={() => (fsZoom === 1 ? setFsZoom(2) : handleResetFsZoom())}
          >
            <div
              className="transition-transform duration-100 ease-out"
              style={{
                transform: `translate(${panPos.x}px, ${panPos.y}px) scale(${fsZoom})`,
                transformOrigin: "center center",
              }}
            >
              <img
                src={imageUrl}
                alt={part.itemName || ""}
                className="max-h-[80vh] max-w-[92vw] object-contain drop-shadow-2xl rounded-2xl pointer-events-none"
                draggable={false}
              />
            </div>
          </div>

          {/* Bottom Floating Control Dock */}
          <div className="flex items-center justify-center z-20">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/15 backdrop-blur-xl border border-white/20 shadow-2xl">
              <button
                type="button"
                onClick={handleFsZoomOut}
                disabled={fsZoom <= 1}
                title={t("sp.zoomOut")}
                className="p-1.5 rounded-xl hover:bg-white/15 text-white disabled:opacity-30 transition-colors cursor-pointer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <span className="text-xs font-mono font-bold text-white px-2 min-w-[50px] text-center">
                {Math.round(fsZoom * 100)}%
              </span>

              <button
                type="button"
                onClick={handleFsZoomIn}
                disabled={fsZoom >= 4}
                title={t("sp.zoomIn")}
                className="p-1.5 rounded-xl hover:bg-white/15 text-white disabled:opacity-30 transition-colors cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              {fsZoom !== 1 && (
                <button
                  type="button"
                  onClick={handleResetFsZoom}
                  title={t("sp.resetZoom")}
                  className="p-1.5 rounded-xl hover:bg-white/15 text-white transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}

              <div className="w-[1px] h-4 bg-white/25 mx-1" />

              <button
                type="button"
                onClick={() => {
                  setIsFullscreen(false);
                  handleResetFsZoom();
                }}
                title="Exit Full Screen (Return to Modal)"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Minimize2 className="w-4 h-4" />
                <span className="text-xs font-sans">Exit Fullscreen</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
