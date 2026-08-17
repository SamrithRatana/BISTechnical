"use client";

import React, { memo } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * @file components/av/ErrorState.tsx
 * @description Shown when a fetch failed and there is something to retry.
 *
 * ── The thing to understand before using this ──────────────────────────────
 *
 * Most reads in `services/api.ts` never reach this component, and that is by
 * design rather than an oversight: each one catches its own error and returns
 * a dataset from `mockData.ts`, so a backend that is down produces a full,
 * plausible-looking table instead of a failure. This state is therefore for
 * the calls that genuinely surface an error to the caller — not a blanket
 * "wrap every table in it and assume errors will appear".
 *
 * That fallback behaviour is worth its own note during verification: a table
 * full of rows is not proof the backend is up.
 *
 * ── Wording ───────────────────────────────────────────────────────────────
 *
 * `message` should be something a technician on the shop floor can act on.
 * Never pass an exception string or an HTTP status through it — those tell the
 * person nothing they can use and make a recoverable hiccup look like a broken
 * system. Log the technical detail; show the plain sentence.
 */

export interface ErrorStateProps {
  /** Already translated, and written in plain language. */
  title: string;
  description?: string;
  /** Omit to render an error with no retry affordance. */
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  compact?: boolean;
}

export const ErrorState = memo(function ErrorState({
  title,
  description,
  onRetry,
  retryLabel,
  className,
  compact = false,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4 gap-2" : "py-16 px-6 gap-3",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid place-items-center rounded-2xl bg-danger-soft text-danger",
          compact ? "w-10 h-10" : "w-14 h-14"
        )}
      >
        <AlertTriangle className={compact ? "w-5 h-5" : "w-7 h-7"} />
      </span>

      <p className={cn("font-semibold text-ink", compact ? "text-sm" : "text-base")}>
        {title}
      </p>

      {description && (
        <p className="text-xs text-ink-secondary max-w-sm leading-relaxed">
          {description}
        </p>
      )}

      {onRetry && retryLabel && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            "mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl",
            "text-xs font-semibold text-ink bg-surface border border-prominent",
            "hover:bg-cushion transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
          )}
        >
          <RotateCw className="w-3.5 h-3.5" />
          {retryLabel}
        </button>
      )}
    </div>
  );
});

/** The same thing, centred across a table body. */
export const ErrorStateRow = memo(function ErrorStateRow({
  colSpan,
  ...props
}: ErrorStateProps & { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <ErrorState {...props} />
      </td>
    </tr>
  );
});
