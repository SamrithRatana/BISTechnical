"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { MODAL_SPRING, backdropVariants, modalVariants } from "@/lib/animations";
import { cn } from "@/lib/utils";

/**
 * @file components/av/ConfirmDialog.tsx
 * @description One confirmation dialog, for every destructive action.
 *
 * Five places used to roll their own delete confirmation — `ServiceTable`,
 * `ServiceDetailModal`, `customers`, `received-inventory` and `spareparts` —
 * each with its own markup, its own button order and its own idea of how
 * emphatic to be. Consolidating matters more here than it would for a
 * decorative component: the moment before deleting something is exactly when
 * an inconsistent interface causes a mistake.
 *
 * ── Deliberate behaviours ─────────────────────────────────────────────────
 *
 * - **Portaled to `document.body`.** Rendered in place it would inherit the
 *   z-index ceiling of whatever opened it, and several callers are themselves
 *   inside a modal.
 * - **Escape closes; the backdrop closes.** Both are cancel paths, never
 *   confirm — a stray key or click must not delete a record.
 * - **Focus moves to the CANCEL button on open**, not to confirm. If someone
 *   opens this and hits Enter reflexively, the safe outcome is the one that
 *   happens. Focus is restored to the trigger on close.
 * - **Focus is trapped** while open, so Tab cannot wander into the page behind
 *   the dim and act on something the user cannot see.
 * - **`busy` disables both buttons** rather than only confirm, so a pending
 *   delete cannot be double-submitted or cancelled halfway.
 *
 * All strings are props: this component does no i18n, so callers pass values
 * already through `t()`.
 */

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Say what will happen and to what. Name the record if you can. */
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** `danger` for deletions — the default. `accent` for benign confirmations. */
  tone?: "danger" | "accent";
  /** In-flight: both controls disable and confirm shows the busy label. */
  busy?: boolean;
  busyLabel?: string;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  tone = "danger",
  busy = false,
  busyLabel,
}: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // Remember what had focus, so closing returns the user where they were
  // rather than dumping focus at the top of the document.
  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const id = window.setTimeout(() => cancelRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(id);
      restoreRef.current?.focus?.();
    };
  }, [open]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === "Escape" && !busy) {
        e.preventDefault();
        onCancel();
        return;
      }

      if (e.key !== "Tab") return;

      // Trap: wrap focus at the ends of the panel's own tabbable set.
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
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
    [open, busy, onCancel]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onKeyDown]);

  // `document` does not exist during SSR, and the portal target has to.
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120] grid place-items-center p-4">
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.15 }}
            onClick={busy ? undefined : onCancel}
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
          />

          <motion.div
            ref={panelRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="av-confirm-title"
            aria-describedby={description ? "av-confirm-desc" : undefined}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={MODAL_SPRING}
            className={cn(
              "relative w-full max-w-sm rounded-2xl bg-elevated",
              "border border-subtle shadow-soft-xl p-5 flex flex-col gap-4"
            )}
          >
            <div className="flex gap-3.5">
              <span
                aria-hidden
                className={cn(
                  "grid place-items-center w-10 h-10 rounded-xl shrink-0",
                  tone === "danger"
                    ? "bg-danger-soft text-danger"
                    : "bg-accent-soft text-accent"
                )}
              >
                <AlertTriangle className="w-5 h-5" />
              </span>

              <div className="min-w-0 flex flex-col gap-1">
                <h2 id="av-confirm-title" className="text-sm font-semibold text-ink">
                  {title}
                </h2>
                {description && (
                  <p
                    id="av-confirm-desc"
                    className="text-xs text-ink-secondary leading-relaxed"
                  >
                    {description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                ref={cancelRef}
                type="button"
                onClick={onCancel}
                disabled={busy}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-semibold",
                  "text-ink bg-surface border border-prominent",
                  "hover:bg-cushion transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {cancelLabel}
              </button>

              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-semibold text-white",
                  "transition-colors shadow-soft-sm",
                  tone === "danger"
                    ? "bg-danger hover:bg-danger-fg"
                    : "bg-accent hover:bg-accent-hover",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {busy && busyLabel ? busyLabel : confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
