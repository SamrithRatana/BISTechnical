"use client";

import React, { useId } from "react";
import { Save, X } from "lucide-react";
import { ModalWrapper } from "@/components/av/ModalWrapper";
import { useI18n } from "@/i18n/LanguageProvider";

interface TaxonomyFormModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  busy: boolean;
  onClose: () => void;
  onSubmit: () => void;
  /** The fields. */
  children: React.ReactNode;
}

/**
 * The add / edit dialog shell: pinned header, scrolling field area, pinned
 * action bar — the three-part column every dialog in this app uses so the
 * title and the Save button stay reachable when the middle has to scroll.
 * While a save is in flight the dialog cannot be dismissed, so the result
 * always lands in a dialog that is still there to show it.
 */
export function TaxonomyFormModal({
  open,
  title,
  subtitle,
  icon: Icon,
  busy,
  onClose,
  onSubmit,
  children,
}: TaxonomyFormModalProps) {
  const { t } = useI18n();
  const titleId = useId();
  const close = () => {
    if (!busy) onClose();
  };

  return (
    <ModalWrapper
      open={open}
      onClose={close}
      maxWidth="max-w-lg"
      zIndex={50}
      placement="center"
      backdropVariant="heavy"
      disableBackdropClose={busy}
      labelledBy={titleId}
    >
      <div className="bg-surface border border-subtle w-full rounded-2xl overflow-hidden flex flex-col max-h-[var(--av-modal-inner-maxh)]">
        <div className="px-5 py-3.5 border-b border-subtle flex items-center justify-between bg-cushion/50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent-soft-fg flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="text-sm font-bold text-ink truncate">
                {title}
              </h2>
              {subtitle && <p className="text-xs text-ink-secondary truncate">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            aria-label={t("action.cancel")}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink-secondary hover:bg-sunken transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">{children}</div>

          <div className="sticky bottom-0 z-20 px-5 py-3.5 bg-cushion/90 backdrop-blur border-t border-subtle flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="px-4 py-2 text-xs font-semibold text-ink bg-surface border border-subtle rounded-xl hover:bg-sunken transition-colors shadow-sm disabled:opacity-60"
            >
              {t("action.cancel")}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-accent rounded-xl hover:bg-accent-hover shadow-md shadow-accent/20 transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" />
              {busy ? t("action.saving") : t("action.save")}
            </button>
          </div>
        </form>
      </div>
    </ModalWrapper>
  );
}

/**
 * A labelled control in the dialog's house style. The child receives the
 * generated id so the `<label>` is bound to it (`htmlFor`), which is what
 * gives the control an accessible name.
 */
export function TaxonomyField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode | ((id: string) => React.ReactNode);
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="font-semibold text-ink">
        {label}
        {required && " *"}
      </label>
      {typeof children === "function" ? children(id) : children}
      {hint && <p className="text-[11px] text-ink-muted">{hint}</p>}
    </div>
  );
}

export const TAXONOMY_INPUT_CLASS =
  "w-full px-3 py-2 border border-subtle rounded-xl bg-surface focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none";
