"use client";

import React, { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { MODAL_SPRING, backdropVariants, modalVariants } from "@/lib/animations";

/**
 * @file components/MediaLightbox.tsx
 * @description Full-size view of a thumbnail — a product photo or a barcode.
 *
 * The parts table shows both at 56px, which is enough to recognise a part you
 * already know and not enough for anything else: a barcode at that size cannot
 * be read by eye or by a scanner, and a product photo cannot be checked against
 * the part in someone's hand. Clicking either opens it here at a size where it
 * is actually usable.
 *
 * ── Why the panel is always light ─────────────────────────────────────────
 *
 * `bg-elevated` would follow the theme, and for a photo that would be right.
 * For a barcode it would be wrong in a way that matters: a scanner reads
 * reflectance, so the quiet zone around the bars has to stay pale. Rendering a
 * barcode on a near-black dark-mode surface produces something that looks
 * correct and does not scan. The media well is therefore fixed white in both
 * themes — the chrome around it still follows the theme.
 *
 * This is the same reasoning that keeps `PrintPreviewSidebar` light: the output
 * is a physical artefact, and physical artefacts do not have a dark mode.
 */

export interface MediaLightboxProps {
  open: boolean;
  onClose: () => void;
  /** Already translated. Shown above the media and used as the a11y label. */
  title: string;
  /** Small print under the media — a part number, say. */
  caption?: string;
  children: React.ReactNode;
}

export default function MediaLightbox({
  open,
  onClose,
  title,
  caption,
  children,
}: MediaLightboxProps) {
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onKey]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[130] grid place-items-center p-4">
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={MODAL_SPRING}
            className="relative w-full max-w-lg rounded-2xl bg-elevated border border-subtle shadow-soft-xl overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-subtle">
              <h2 className="text-sm font-semibold text-ink truncate">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={title}
                className="grid place-items-center w-8 h-8 rounded-lg text-ink-secondary hover:text-ink hover:bg-cushion transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Fixed white well — see the file header. */}
            <div className="grid place-items-center p-6 bg-[#FFFFFF] min-h-[220px]">
              {children}
            </div>

            {caption && (
              <p className="px-4 py-2.5 text-center text-xs font-mono text-ink-secondary border-t border-subtle">
                {caption}
              </p>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
