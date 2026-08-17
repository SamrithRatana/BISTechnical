"use client";

import { memo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "./Card";

/**
 * @file components/av/ChartPanel.tsx
 * @description The large chart card: title, subtitle, legend, a tinted row of
 * mini-stat sub-cards, then the chart itself.
 *
 * The panel owns the chrome and takes the plot as `children`, so the same
 * frame can hold an area chart, a bar chart, or an empty state without this
 * file knowing which. Keeping the chart out of here is also what lets the plot
 * be lazily loaded by the page while the frame renders immediately.
 */

export interface MiniStat {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}

export interface LegendEntry {
  label: string;
  /** Any CSS colour; usually a token like `var(--av-accent-base)`. */
  color: string;
}

export interface ChartPanelProps {
  title: string;
  subtitle?: string;
  legend?: LegendEntry[];
  stats?: MiniStat[];
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const ChartPanel = memo(function ChartPanel({
  title,
  subtitle,
  legend,
  stats,
  actions,
  children,
  className,
}: ChartPanelProps) {
  return (
    <Card className={cn("p-5 sm:p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-ink-secondary">{subtitle}</p>}
        </div>

        {/* Wraps, and is allowed to shrink.

            Without `flex-wrap`, the legend + range toggle + live pill sit on
            one 366px line. In a ~350px content column on a phone that is the
            single thing that made the whole document scroll sideways — the
            table was already contained by its own scroller, so this row was
            the real culprit. */}
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 min-w-0">
          {legend && legend.length > 0 && (
            <ul className="flex items-center gap-3">
              {legend.map((entry) => (
                <li key={entry.label} className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-xs text-ink-secondary whitespace-nowrap">
                    {entry.label}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {actions}
        </div>
      </div>

      {stats && stats.length > 0 && (
        // The tinted sub-panel. `auto-fit` rather than fixed columns so four
        // stats sit in a row on desktop and reflow to two — then one — without
        // a breakpoint per count.
        <div className="mt-5 rounded-xl bg-sunken border border-subtle p-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-2.5 min-w-0">
              {s.icon && (
                <span className="shrink-0 grid place-items-center w-8 h-8 rounded-full bg-surface text-accent shadow-soft-sm">
                  {s.icon}
                </span>
              )}
              <div className="min-w-0">
                <div className="text-[10px] font-medium uppercase tracking-wider text-ink-muted truncate">
                  {s.label}
                </div>
                <div className="text-sm font-bold text-ink tabular-nums truncate">
                  {s.value}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5">{children}</div>
    </Card>
  );
});
