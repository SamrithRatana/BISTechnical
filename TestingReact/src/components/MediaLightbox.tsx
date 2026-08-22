"use client";

/**
 * @file components/MediaLightbox.tsx
 * @description Aura Soft UI Lightbox Modal for full-size inspection of thumbnails,
 * product photos, barcodes, and technical specifications.
 * Styled matching Aura Velvet CreativeStudio (localhost:3001).
 */

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X, Copy, Check, Barcode, Boxes, Wrench, Sparkles, DollarSign,
  ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw
} from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { ModalWrapper } from "@/components/av/ModalWrapper";
import { useI18n } from "@/i18n/LanguageProvider";
import { useSafeTimeout } from "@/hooks/useSafeTimeout";
import type { SparePartItem, SparePartItemDetail } from "@/services/api";

function getImageUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return url;
  return `/${url}`;
}

export interface MediaLightboxProps {
  open: boolean;
  onClose: () => void;
  title: string;
  caption?: string;
  subtitle?: string;
  part?: SparePartItem | SparePartItemDetail | any;
  kind?: "image" | "barcode";
  children: React.ReactNode;
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
  const imageUrl = part?.pictureUrl ? getImageUrl(part.pictureUrl) : "";

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
        open={open && !isFullscreen}
        onClose={onClose}
        maxWidth="max-w-xl"
        zIndex={100}
        placement="center"
        panelVariant="glass"
        backdropVariant="heavy"
      >
        {/*
          Header and action bar are pinned; only the middle scrolls.

          `ModalWrapper` now caps every panel at `--av-modal-maxh`, so this
          dialog can no longer run off a 1366x768 screen. Left as one plain
          block it would still have scrolled as a unit inside that cap, taking
          the title, the close button and the Copy Code action out of reach at
          the bottom of the scroll — which is the state the screenshots caught.
          A three-part column keeps both ends in place at any height.
        */}
        <div className="flex flex-col max-h-[var(--av-modal-inner-maxh)] p-5 sm:p-6 lg:p-5.5 xl:p-7 gap-3.5">
          {/* Header — Title, Subtitle, and Frosted Glass Close */}
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
              aria-label="Close"
              className="w-8 h-8 rounded-full bg-white/70 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 border border-black/[0.08] dark:border-white/[0.1] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center shadow-2xs transition-all cursor-pointer shrink-0 active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrolling middle — negative margin + matching padding so the
              scrollbar sits over the panel padding rather than pinching the
              content in from the edge. */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-3.5 -mx-1 px-1">
          {/* Frosted Glass Media Preview Showcase Box */}
          <div className="rounded-2xl overflow-hidden min-h-[160px] max-h-[min(380px,34dvh)] relative bg-white/50 dark:bg-black/25 backdrop-blur-md border border-white/70 dark:border-white/[0.08] shadow-inner flex items-center justify-center p-4 group select-none">
            <div
              className="w-full h-full flex items-center justify-center overflow-hidden"
              style={{
                transform: `scale(${zoomScale})`,
                transformOrigin: "center center",
                transition: "transform 0.2s cubic-bezier(0.2, 0, 0, 1)",
              }}
            >
              {children}
            </div>

            {/* Floating Frosted Glass Action Toolbar for Images */}
            {kind !== "barcode" && (
              <div className="absolute bottom-2.5 right-2.5 flex items-center gap-0.5 p-1 rounded-xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-black/[0.1] dark:border-white/[0.15] shadow-sm z-10">
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
                {imageUrl && (
                  <>
                    <div className="w-[1px] h-3 bg-black/10 dark:bg-white/15 mx-0.5" />
                    <button
                      type="button"
                      onClick={() => setIsFullscreen(true)}
                      title={t("sp.viewFullscreen")}
                      className="p-1 rounded-lg hover:bg-accent hover:text-white text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Description & Compatibility Details Section (Full Text, Clean Card) */}
          {(part?.description || part?.useFor || caption) && (
            <div className="p-4 sm:p-4.5 rounded-2xl bg-white/60 dark:bg-white/[0.04] backdrop-blur-md border border-black/[0.06] dark:border-white/[0.08] text-xs space-y-3 shadow-2xs">
              {/* Card Header with Price */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-accent tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  {kind === "barcode" ? "BARCODE DETAILS" : "SPECIFICATIONS & COMPATIBILITY"}
                </span>
                {part?.defaultPrice != null && part.defaultPrice > 0 && (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono px-2.5 py-0.5 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 shadow-2xs flex items-center gap-1">
                    <DollarSign className="w-3 h-3 -mr-0.5" />
                    {part.defaultPrice.toFixed(2)}
                  </span>
                )}
              </div>

              {/* Compatible Models / Use For (Full Text Tags) */}
              {part?.useFor && (
                <div className="space-y-1.5">
                  <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Wrench className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                    Compatible Models (Use For):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {String(part.useFor).split(/[,;\n]+/).map((model: string, idx: number) => {
                      const trimmed = model.trim();
                      if (!trimmed) return null;
                      return (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white/80 dark:bg-white/10 backdrop-blur-xs border border-black/[0.08] dark:border-white/[0.12] text-xs font-medium text-slate-800 dark:text-slate-200 shadow-2xs"
                        >
                          {trimmed}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Description (Full Text, No Truncation) */}
              {part?.description ? (
                <div className="space-y-1">
                  {part?.useFor && (
                    <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
                      Description:
                    </span>
                  )}
                  <p className="leading-relaxed font-sans text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line">
                    {part.description}
                  </p>
                </div>
              ) : !part?.useFor && caption ? (
                <p className="leading-relaxed font-sans text-xs text-slate-800 dark:text-slate-200">
                  Item Serial Number: {caption}
                </p>
              ) : null}
            </div>
          )}

          </div>

          {/* Badges & Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-black/[0.08] dark:border-white/[0.1] shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              {partNo && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 shadow-2xs">
                  <Barcode className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  {partNo}
                </span>
              )}

              {/* Stock Quantity, Status & Condition Badges */}
              {part && (
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Condition Badge (Free / Replace / Fix) */}
                  {part.condition && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 shadow-2xs">
                      <span className="text-sm leading-none">
                        {part.condition.toLowerCase() === "replace" ? "🔄" : part.condition.toLowerCase() === "fix" ? "🛠️" : "✨"}
                      </span>
                      <span>{part.condition}</span>
                    </span>
                  )}

                  {/* Stock Quantity & Status Badge */}
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-2xs">
                    <Boxes className="w-4 h-4 text-accent" />
                    <span>ស្តុកនៅសល់៖ <strong className="font-mono font-bold text-slate-900 dark:text-white">{qty}</strong> គ្រឿង</span>
                    {qty <= 0 ? (
                      <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10.5px] font-bold">
                        អស់ស្តុក
                      </span>
                    ) : qty <= 2 ? (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-[10.5px] font-bold">
                        ស្តុកជិតអស់
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[10.5px] font-bold">
                        មានស្តុក
                      </span>
                    )}
                  </div>

                  {/* Ticket Order Qty */}
                  {part.quantity != null && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs">
                      <span>ចំនួនប្រើ៖</span>
                      <strong className="text-accent font-mono font-bold text-sm">× {part.quantity}</strong>
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {partNo && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />}
                  <span>{copied ? "Copied" : "Copy Code"}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-accent hover:bg-accent-hover shadow-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                Close
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
                {title}
              </h4>
              <p className="text-xs text-white/70 font-mono mt-0.5 truncate flex items-center gap-2">
                <span>{partNo || "N/A"}</span>
                {part?.useFor && <span>• {part.useFor}</span>}
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
