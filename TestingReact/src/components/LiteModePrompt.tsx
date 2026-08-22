"use client";

import React from "react";
import { Gauge, Sparkles } from "lucide-react";
import { ModalWrapper } from "@/components/av/ModalWrapper";
import { useI18n } from "@/i18n/LanguageProvider";

/**
 * @file components/LiteModePrompt.tsx
 * @description Offers Lite Mode once, on a device that measured as low-tier.
 *
 * ── Wording ────────────────────────────────────────────────────────────────
 *
 * Nothing here names a benchmark, a frame time, a GPU or a core count. The
 * person reading it is a technician mid-shift, and "your device scored -4 on
 * the capability heuristic" is not information they can act on. It says what
 * will happen and what it costs, in one sentence each.
 *
 * It also does not say the device is *bad*. This is a shared workshop PC in
 * most cases and not the reader's own machine or their choice; a dialog that
 * opens by criticising their hardware is both rude and useless.
 *
 * ── Both buttons are real ──────────────────────────────────────────────────
 *
 * "Continue anyway" is not a dark pattern to be talked out of. Someone may
 * simply prefer the full design and be willing to accept the cost, and the
 * detection is a heuristic that can be wrong. Lite Mode is recommended, not
 * imposed, and either answer is remembered so this is asked exactly once.
 *
 * Not dismissible by scrim or Escape: an accidental click on the backdrop
 * would count as an answer and this is the only time it is asked.
 */
export default function LiteModePrompt({
  open,
  onChoice,
}: {
  open: boolean;
  /** `true` = enable Lite Mode, `false` = keep the full experience. */
  onChoice: (accepted: boolean) => void;
}) {
  const { t } = useI18n();

  return (
    <ModalWrapper
      open={open}
      // Choosing is the only way out; see the header.
      onClose={() => onChoice(false)}
      disableBackdropClose
      maxWidth="max-w-md"
      zIndex={200}
      isAlert
      labelledBy="lite-mode-prompt-title"
      describedBy="lite-mode-prompt-body"
    >
      <div className="p-6 sm:p-7">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-soft-fg">
            <Gauge className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2
              id="lite-mode-prompt-title"
              className="text-base font-semibold text-ink"
            >
              {t("perf.promptTitle")}
            </h2>
            <p
              id="lite-mode-prompt-body"
              className="mt-1.5 text-sm leading-relaxed text-ink-secondary"
            >
              {t("perf.promptBody")}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              {t("perf.promptReassure")}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            autoFocus
            onClick={() => onChoice(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
          >
            <Gauge className="h-4 w-4" />
            {t("perf.promptAccept")}
          </button>
          <button
            type="button"
            onClick={() => onChoice(false)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-subtle bg-surface px-4 py-2.5 text-sm font-medium text-ink-secondary transition-colors hover:bg-cushion"
          >
            <Sparkles className="h-4 w-4" />
            {t("perf.promptDecline")}
          </button>
        </div>

        <p className="mt-3 text-center text-xs text-ink-muted">
          {t("perf.promptChangeLater")}
        </p>
      </div>
    </ModalWrapper>
  );
}
