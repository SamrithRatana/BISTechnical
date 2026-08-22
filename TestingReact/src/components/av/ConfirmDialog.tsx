"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { ModalWrapper } from "./ModalWrapper";
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
 * - **`busy` disables both buttons** rather than only confirm, so a pending
 *   delete cannot be double-submitted or cancelled halfway.
 *
 * The blur-backdrop + animation is now delegated to `ModalWrapper` — the
 * single source of truth for that pattern across the whole app.
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
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Move focus to the cancel button when opened — pressing Enter by reflex
  // should cancel, not confirm, which is the safer default.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => cancelRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  // Busy state blocks backdrop-close so the user cannot cancel a delete that
  // is already in flight. The Tab trap and Esc handler live in ModalWrapper.
  const handleClose = useCallback(() => {
    if (!busy) onCancel();
  }, [busy, onCancel]);

  return (
    <ModalWrapper
      open={open}
      onClose={handleClose}
      maxWidth="max-w-sm"
      zIndex={120}
      disableBackdropClose={busy}
      isAlert
      labelledBy="av-confirm-title"
      describedBy={description ? "av-confirm-desc" : undefined}
    >
      <div className="p-5 flex flex-col gap-4">
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
      </div>
    </ModalWrapper>
  );
}
