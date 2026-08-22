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
    <Card className={cn("p-3.5 sm:p-4 lg:p-4 xl:p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 lg:gap-3.5 xl:gap-4">
        <div className="min-w-0">
          <h2 className="text-base lg:text-base xl:text-lg font-semibold tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs lg:text-xs xl:text-sm text-ink-secondary">{subtitle}</p>}
        </div>

        {/* Wraps, and is allowed to shrink. */}
        <div className="flex flex-wrap items-center justify-end gap-x-3 lg:gap-x-3.5 xl:gap-x-4 gap-y-1.5 min-w-0">
          {legend && legend.length > 0 && (
            <ul className="flex items-center gap-2.5 lg:gap-3">
              {legend.map((entry) => (
                <li key={entry.label} className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="w-2 h-2 lg:w-2 lg:h-2 xl:w-2.5 xl:h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-[11px] lg:text-[11px] xl:text-xs text-ink-secondary whitespace-nowrap">
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
        // The tinted sub-panel.
        <div className="mt-3 lg:mt-3.5 xl:mt-5 rounded-xl bg-sunken border border-subtle p-2 lg:p-2 xl:p-3 grid gap-2 lg:gap-2.5 xl:gap-3 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-2 lg:gap-2 xl:gap-2.5 min-w-0">
              {s.icon && (
                <span className="shrink-0 grid place-items-center w-7 h-7 lg:w-7 lg:h-7 xl:w-8 xl:h-8 rounded-full bg-surface text-accent shadow-soft-sm">
                  {s.icon}
                </span>
              )}
              <div className="min-w-0">
                <div className="text-[9.5px] lg:text-[9.5px] xl:text-[10px] font-medium uppercase tracking-wider text-ink-muted truncate">
                  {s.label}
                </div>
                <div className="text-xs lg:text-xs xl:text-sm font-bold text-ink tabular-nums truncate">
                  {s.value}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 lg:mt-3.5 xl:mt-5">{children}</div>
    </Card>
  );
});
