"use client";

import React, { memo, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * @file components/av/EmptyState.tsx
 * @description What a table or list shows when it has nothing to show.
 *
 * The tables here previously rendered an empty `<tbody>` and a single line of
 * grey text, which reads identically to "still loading" and to "the request
 * failed". Three different situations, one appearance. This component is the
 * "there is genuinely nothing here" case, `ErrorState` is the failure case,
 * and `Skeleton` is the loading case — kept visually distinct on purpose so a
 * user can tell which one they are looking at without waiting to find out.
 *
 * Deliberately quiet: a muted icon, one sentence, and an optional action. An
 * empty queue is the *good* outcome in most of this app — every ticket
 * inspected, nothing awaiting parts — so it should not look like a warning.
 */

export interface EmptyStateProps {
  /** A lucide icon component. Rendered muted and oversized. */
  icon?: React.ElementType;
  /** Already translated — this component does no i18n itself. */
  title: string;
  description?: string;
  /** Usually a "Clear search" or "Add the first one" button. */
  action?: ReactNode;
  className?: string;
  /** Tightens the padding, for use inside a small panel rather than a page. */
  compact?: boolean;
}

export const EmptyState = memo(function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4 gap-2" : "py-16 px-6 gap-3",
        className
      )}
    >
      {Icon && (
        <span
          aria-hidden
          className={cn(
            "grid place-items-center rounded-2xl bg-sunken text-ink-muted",
            compact ? "w-10 h-10" : "w-14 h-14"
          )}
        >
          <Icon className={compact ? "w-5 h-5" : "w-7 h-7"} />
        </span>
      )}

      <p className={cn("font-semibold text-ink", compact ? "text-sm" : "text-base")}>
        {title}
      </p>

      {description && (
        <p className="text-xs text-ink-secondary max-w-sm leading-relaxed">
          {description}
        </p>
      )}

      {action && <div className="mt-1">{action}</div>}
    </div>
  );
});

/**
 * The same thing, positioned inside a table body.
 *
 * `colSpan` is required: without it the cell sits in column one and the empty
 * message appears under the first header rather than centred across the table.
 */
export const EmptyStateRow = memo(function EmptyStateRow({
  colSpan,
  ...props
}: EmptyStateProps & { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <EmptyState {...props} />
      </td>
    </tr>
  );
});
