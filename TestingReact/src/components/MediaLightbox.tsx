"use client";

/**
 * @file components/MediaLightbox.tsx
 * @description Aura Soft UI Lightbox Modal & Direct Fullscreen Viewer for full-size inspection
 * of thumbnails, profile covers, product photos, barcodes, and technical specifications.
 */

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X, Copy, Check, Barcode, Boxes, Wrench, Sparkles,
  ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw
} from "lucide-react";
import toast from "react-hot-toast";
import { ModalWrapper } from "@/components/av/ModalWrapper";
import { useI18n } from "@/i18n/LanguageProvider";
import { useSafeTimeout } from "@/hooks/useSafeTimeout";

function getImageUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return url;
  return `/${url}`;
}

export interface LightboxPart {
  id?: string;
  itemName?: string;
  serialNumber?: string;
  partNumber?: string;
  pictureUrl?: string;
  useFor?: string;
  quantity?: number;
  price?: number;
  defaultPrice?: number;
  unitPrice?: number;
  description?: string;
  condition?: string;
  stockQty?: number;
  warehouseLocation?: string;
  lastUpdated?: string;
  brand?: string;
  model?: string;
  category?: string;
}

export interface MediaLightboxProps {
  open: boolean;
  onClose: () => void;
  title: string;
  caption?: string;
  subtitle?: string;
  part?: LightboxPart;
  kind?: "image" | "barcode";
  children?: React.ReactNode;
  fullscreenOnly?: boolean;
  imageUrl?: string;
}

export default function MediaLightbox({
  open,
  onClose,
  title,
  caption,
  subtitle,
  part,
  kind,
  children,
  fullscreenOnly = false,
  imageUrl: directImageUrl,
}: MediaLightboxProps) {
  const { t } = useI18n();
  const later = useSafeTimeout();
  const [copied, setCopied] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fsZoom, setFsZoom] = useState(1);
  const [panPos, setPanPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

  const partNo = caption || part?.serialNumber || part?.partNumber || "";
  const subText = subtitle || (part ? `${partNo ? partNo + " • " : ""}${part.useFor || "Spare Part"}` : undefined);
  const qty = part?.quantity ?? 0;
  const imageUrl = directImageUrl
    ? getImageUrl(directImageUrl)
    : part?.pictureUrl
    ? getImageUrl(part.pictureUrl)
    : "";

  const isDirectFullscreen = fullscreenOnly || isFullscreen;

  const handleCopy = () => {
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

  const handleCloseFullscreen = () => {
    if (fullscreenOnly) {
      onClose();
    } else {
      setIsFullscreen(false);
    }
    handleResetFsZoom();
  };

  // Keyboard handler for Escape in Fullscreen mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (isFullscreen || (fullscreenOnly && open))) {
        e.stopPropagation();
        handleCloseFullscreen();
      }
    };
    if (isFullscreen || (fullscreenOnly && open)) {
      window.addEventListener("keydown", handleKeyDown, true);
    }
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isFullscreen, fullscreenOnly, open]);

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
      {/* ── DIALOG MODAL (SKIPPED WHEN fullscreenOnly=true) ── */}
      {!fullscreenOnly && (
        <ModalWrapper
          open={open && !isFullscreen}
          onClose={onClose}
          maxWidth="max-w-xl"
          zIndex={300}
          placement="center"
          panelVariant="glass"
          backdropVariant="heavy"
        >
          <div className="flex flex-col max-h-[var(--av-modal-inner-maxh)] p-5 sm:p-6 lg:p-5.5 xl:p-7 gap-3.5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 shrink-0">
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                  {title}
                </h3>
                {subText && (
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-0.5 truncate font-sans">
                    {subText}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("action.close")}
                className="w-8 h-8 rounded-full bg-slate-200/70 dark:bg-white/10 hover:bg-slate-300/80 dark:hover:bg-white/20 border border-slate-300/60 dark:border-white/15 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Media Box */}
            <div className="flex-1 overflow-y-auto min-h-0 space-y-3.5 pr-0.5">
              <div className="relative rounded-2xl border border-subtle bg-sunken/60 overflow-hidden group shadow-inner">
                <div
                  className="flex items-center justify-center p-4 min-h-[220px] max-h-[360px] overflow-hidden"
                  style={{
                    transform: `scale(${zoomScale})`,
                    transformOrigin: "center center",
                    transition: "transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                >
                  {children}
                </div>

                {kind !== "barcode" && (
                  <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 p-1 rounded-xl bg-surface/90 dark:bg-slate-900/90 backdrop-blur-md border border-subtle shadow-md">
                    <button
                      type="button"
                      onClick={handleZoomOut}
                      disabled={zoomScale <= 0.75}
                      title={t("sp.zoomOut")}
                      className="p-1 rounded-lg hover:bg-cushion text-ink disabled:opacity-30 transition-colors cursor-pointer"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleResetZoom}
                      title={t("sp.resetZoom")}
                      className="px-1.5 py-0.5 text-[10.5px] font-mono font-bold text-ink hover:bg-cushion rounded-md transition-colors cursor-pointer"
                    >
                      {Math.round(zoomScale * 100)}%
                    </button>
                    <button
                      type="button"
                      onClick={handleZoomIn}
                      disabled={zoomScale >= 2.5}
                      title={t("sp.zoomIn")}
                      className="p-1 rounded-lg hover:bg-cushion text-ink disabled:opacity-30 transition-colors cursor-pointer"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-[1px] h-3.5 bg-subtle mx-0.5" />
                    <button
                      type="button"
                      onClick={() => {
                        setIsFullscreen(true);
                        setFsZoom(1);
                        setPanPos({ x: 0, y: 0 });
                      }}
                      title="Inspect in Full Screen Mode"
                      className="p-1 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors shadow-xs cursor-pointer active:scale-95"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Technical Specifications Section */}
              {part && (
                <div className="p-3.5 rounded-2xl bg-surface/70 border border-subtle space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-accent">
                    <Wrench className="w-3.5 h-3.5 shrink-0" />
                    <span className="uppercase tracking-wider text-[10.5px]">Specifications &amp; Compatibility</span>
                  </div>

                  {part.useFor && (
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                        🔧 Compatible Models (Use For):
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {part.useFor.split(",").map((model, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-lg bg-white dark:bg-surface text-ink text-[11px] font-bold border border-subtle shadow-2xs"
                          >
                            {model.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {part.description && part.description !== part.useFor && (
                    <div className="text-[11.5px] text-slate-600 dark:text-slate-300">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">Description: </span>
                      <span>{part.description}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-subtle shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                {partNo && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cushion border border-subtle text-ink font-mono text-xs font-bold">
                    <Barcode className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span>{partNo}</span>
                  </div>
                )}
                {part && (
                  <>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-accent-soft text-accent text-xs font-bold">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{part.condition || "Good Condition"}</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold font-mono">
                      <span>{t("sp.stockLevel", { qty: String(qty) }) || `Stock: ${qty}`}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                {partNo && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-subtle bg-surface hover:bg-cushion text-xs font-bold text-ink transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-ink-muted" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  {t("action.close")}
                </button>
              </div>
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* ── FULLSCREEN HIGH-RES INSPECTION LIGHTBOX (PORTALED TO BODY) ── */}
      {open && isDirectFullscreen && imageUrl && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-2xl flex flex-col justify-between p-4 sm:p-6 text-white select-none animate-in fade-in duration-200"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* Top Fullscreen Header */}
          <div className="flex items-center justify-between gap-4 z-20">
            <div className="min-w-0 flex-1">
              <h4 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                {title}
              </h4>
              <p className="text-xs text-white/70 font-mono mt-0.5 truncate flex items-center gap-2">
                {caption && <span>{caption}</span>}
                {subText && (!caption || subText !== caption) && <span>• {subText}</span>}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <kbd className="hidden sm:inline-block px-2.5 py-1 text-[11px] font-mono text-white/70 bg-white/10 rounded-lg border border-white/15">
                ESC
              </kbd>
              <button
                type="button"
                onClick={handleCloseFullscreen}
                className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-white flex items-center justify-center shadow-lg transition-all cursor-pointer active:scale-95"
                title="Exit Full Screen"
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
                alt={title || ""}
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
                onClick={handleCloseFullscreen}
                title="Exit Full Screen"
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
