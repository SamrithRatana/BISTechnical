"use client";

/**
 * @file components/av/ModalWrapper.tsx
 * @description Shared base wrapper for every modal and dialog in the app.
 *
 * ── placement prop ───────────────────────────────────────────────────────
 * "center" (default) — vertically centered, used for confirm dialogs,
 *   detail modals, form modals, spec cards.
 * "top" — positioned near the top of the screen (pt-20), matching the
 *   Aura Velvet Command Palette reference design (localhost:3001).
 *   The panel slides in from above (y: -20 → 0).
 *
 * ── backdrop ─────────────────────────────────────────────────────────────
 * Dark frosted glass blur overlay matching Aura Velvet (`bg-black/45 backdrop-blur-md`).
 */

import React, { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MODAL_SPRING } from "@/lib/animations";
import { cn } from "@/lib/utils";

export interface ModalWrapperProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  zIndex?: number;
  disableBackdropClose?: boolean;
  className?: string;
  labelledBy?: string;
  describedBy?: string;
  isAlert?: boolean;
  /**
   * "center" — vertically centered (default, for dialogs/forms/specs)
   * "top"    — positioned at pt-20 from the top (for command palette)
   */
  placement?: "center" | "top";
  /**
   * "default" / "heavy" — both use Aura Velvet standard dark blur backdrop
   */
  backdropVariant?: "default" | "heavy";
  /**
   * "solid" (default for center) | "glass" (frosted glassmorphic panel matching Command Palette)
   */
  panelVariant?: "solid" | "glass";
  /**
   * Set true if this modal is a Command Palette, which suppresses floating Header appearance.
   * Defaults to true if placement is "top".
   */
  isCommandPalette?: boolean;
}

/**
 * Panel entrance/exit, keyed by placement.
 *
 * Module scope rather than rebuilt in the render body: framer diffs `variants`
 * by identity, and a fresh object literal every render meant every parent
 * re-render while a dialog was open looked like a variant change. Two frozen
 * objects cost nothing and are stable for the life of the module.
 *
 * `transform` and `opacity` only — no `top`, no `height` — so an opening dialog
 * never forces layout on the page underneath it.
 */
const PANEL_VARIANTS = {
  top: {
    hidden: { opacity: 0, scale: 0.95, y: -20 },
    visible: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.96, y: -15 },
  },
  center: {
    hidden: { opacity: 0, scale: 0.95, y: 15 },
    visible: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.96, y: 10 },
  },
} as const;

/**
 * The backdrop's fade. Opacity only — the blur is a static class, because
 * animating `backdrop-filter` repaints everything beneath the overlay on every
 * frame.
 */
const BACKDROP_FADE = { duration: 0.2 } as const;

const MODAL_LAYER_BASE = 1000;

// Global modal count tracker for reactive Header appearance
declare global {
  interface Window {
    __av_active_modal_count__?: number;
    __av_active_cp_count__?: number;
  }
}

function updateModalCount(delta: number, isCommandPalette?: boolean) {
  if (typeof window === "undefined") return;
  const current = (window.__av_active_modal_count__ || 0) + delta;
  const next = Math.max(0, current);
  window.__av_active_modal_count__ = next;

  if (isCommandPalette) {
    const currentCp = (window.__av_active_cp_count__ || 0) + delta;
    window.__av_active_cp_count__ = Math.max(0, currentCp);
  }

  const cpCount = window.__av_active_cp_count__ || 0;

  window.dispatchEvent(
    new CustomEvent("av:modal-change", {
      detail: {
        count: next,
        isOpen: next > 0,
        cpCount,
        isCpOpen: cpCount > 0,
      },
    })
  );
}

export function ModalWrapper({
  open,
  onClose,
  children,
  maxWidth = "max-w-xl",
  zIndex = 120,
  disableBackdropClose = false,
  className,
  labelledBy,
  describedBy,
  isAlert = false,
  placement = "center",
  backdropVariant = "heavy",
  panelVariant,
  isCommandPalette,
}: ModalWrapperProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const isCP = isCommandPalette ?? (placement === "top");

  useEffect(() => {
    if (!open) return;
    updateModalCount(1, isCP);
    return () => {
      updateModalCount(-1, isCP);
    };
  }, [open, isCP]);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    return () => {
      restoreRef.current?.focus?.();
    };
  }, [open]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [open, onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onKeyDown]);

  if (typeof document === "undefined") return null;

  const panelVariants = PANEL_VARIANTS[placement];

  /*
    ── Why the scroll container and the centering are two separate elements ──

    They used to be one:

        fixed inset-0 flex items-center justify-center p-4 sm:p-6 overflow-y-auto

    which is the single most common modal bug in CSS. `items-center` on a
    scroll container centres the panel by distributing the free space — and
    when the panel is TALLER than the container there is negative free space,
    so it is distributed to both sides equally. The panel's top goes above
    scrollTop 0, and a scroll container cannot scroll to a negative offset.
    The overflowing top is not just off-screen, it is **unreachable**.

    Measured on `/spareparts` with the spare-part spec modal (a fixed 583px
    panel), forcing `scrollTop = -9999` at each height:

        viewport 600px   panel top   +8   ok
        viewport 560px   panel top  -12   scrollTop stays 0, canScrollUp false

    A 1366x768 laptop has roughly 600-660px of viewport after browser chrome
    and the Windows taskbar, so the app's larger dialogs lose their heading —
    and with it the close button and the record's title — on the single most
    common screen size in the workshop.

    The fix is the standard two-element form: the OUTER element scrolls and
    does no alignment, the INNER wrapper is `min-h-full` and does the
    centering. When the panel fits, `min-h-full` makes the wrapper exactly
    viewport-height and `items-center` centres it as before. When the panel is
    taller, the wrapper grows past the viewport, the panel starts at the top of
    it after the padding, and the outer element scrolls normally — every pixel
    reachable in both directions.

    `overscroll-contain` stops a scroll gesture that reaches the end of the
    dialog from chaining through to the page underneath it.
  */
  const scrollerCls = "fixed inset-0 overflow-y-auto overscroll-contain";
  const centeringCls = placement === "top"
    ? "av-modal-top flex min-h-full items-start justify-center"
    : "av-modal-center flex min-h-full items-center justify-center";

  // ── Panel border/glass style ──────────────────────────────────────────────
  const isGlass = panelVariant === "glass" || (panelVariant === undefined && placement === "top");

  /*
    `max-h-[var(--av-modal-maxh)]` is what stops a dialog outgrowing the
    screen. The var is set by `av-modal-center` / `av-modal-top`, so the cap
    already accounts for whichever gutter this placement uses.

    Paired with `overflow-y-auto`, not the `overflow-hidden` that used to be
    here: a cap with `hidden` would clip the excess and make it unreachable,
    which is worse than the scrolling overlay it replaces. A panel that
    manages its own scrolling (`flex flex-col` + a scrollable body capped at
    the same var) sits exactly at the cap and never scrolls this container, so
    there is no double scrollbar.

    `min-h-0` because the panel is a flex child of the centering wrapper, and
    a flex item that refuses to shrink below its content ignores max-height.
  */
  const panelFitCls =
    "max-h-[var(--av-modal-maxh)] min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain";
  const panelBaseCls = isGlass
    ? cn(
        "relative w-full rounded-3xl cmd-palette-glass z-10",
        panelFitCls,
        maxWidth,
        className
      )
    : cn(
        "relative w-full rounded-3xl bg-surface border border-subtle shadow-2xl z-10",
        panelFitCls,
        maxWidth,
        className
      );

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={scrollerCls} style={{ zIndex: MODAL_LAYER_BASE + zIndex }}>
          {/* ── Backdrop: Standard Aura Velvet dark blur backdrop ──
              Stays `fixed`, so it covers the viewport rather than only the
              scrolled region — a tall dialog scrolls against a backdrop that
              does not move with it. */}
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={BACKDROP_FADE}
            onClick={disableBackdropClose ? undefined : onClose}
            className="fixed inset-0 bg-black/45 backdrop-blur-md"
          />

          {/* Centering wrapper — see `centeringCls` above for why this is a
              separate element from the scroll container. */}
          <div className={centeringCls}>
            {/* ── Panel ───────────────────────────────────────────────────── */}
            <motion.div
              ref={panelRef}
              role={isAlert ? "alertdialog" : "dialog"}
              aria-modal="true"
              aria-labelledby={labelledBy}
              aria-describedby={describedBy}
              variants={panelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              /* `MODAL_SPRING`, the shared dialog spring. This file already
                 imported it and then animated on a private 450/30 copy instead,
                 so every dialog in the app moved on a spring nothing else knew
                 about — exactly the drift `lib/animations` exists to stop. */
              transition={MODAL_SPRING}
              className={panelBaseCls}
            >
              {children}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
