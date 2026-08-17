"use client";

import { memo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "./Card";
import { Sparkline } from "./Sparkline";

/**
 * @file components/av/KpiCard.tsx
 * @description The dashboard KPI tile.
 *
 * Layout, top to bottom: an uppercase label with the value directly under it,
 * a soft rounded-square icon badge pinned right, then a hairline divider and a
 * footer row carrying the trend on the left and an inline sparkline on the
 * right.
 *
 * `trendIsGood` exists because the sign of a change and its desirability are
 * not the same thing. Rising throughput is good; a rising unrepairable count
 * is not. Without that separation every "bad" metric has to be negated at the
 * call site to colour it correctly, and then the arrow points the wrong way.
 *
 * The footer renders only when there is something real to put in it — see
 * `StatCards` for why that matters.
 */

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  /** Percentage change over the compared window. Sign chooses the arrow. */
  trend?: number;
  /**
   * Whether an *increase* in this metric is a good thing. Defaults to true.
   * Set false for metrics where up is bad (rejections, unrepairable, backlog).
   */
  trendIsGood?: boolean;
  /** Small muted line under the trend, naming what it is measured against. */
  trendCaption?: string;
  sparkline?: number[];
  onClick?: () => void;
  /**
   * Marks the card as the active choice when a KPI row doubles as a filter,
   * which is what the dashboard uses it for. Drawn as an accent ring rather
   * than a background change so the card's surface stays white and the value
   * keeps its contrast.
   */
  selected?: boolean;
  className?: string;
}

export const KpiCard = memo(function KpiCard({
  label,
  value,
  icon,
  trend,
  trendIsGood = true,
  trendCaption,
  sparkline,
  onClick,
  selected = false,
  className,
}: KpiCardProps) {
  const hasTrend = typeof trend === "number" && Number.isFinite(trend);
  const rising = hasTrend && trend! > 0;
  const flat = hasTrend && trend === 0;
  // "Good" when the direction matches what the caller wants for this metric.
  const good = hasTrend ? (flat ? true : rising ? trendIsGood : !trendIsGood) : true;

  const hasSpark = Boolean(sparkline && sparkline.length > 1);
  const hasFooter = hasTrend || hasSpark;

  return (
    <Card
      hover={Boolean(onClick)}
      onClick={onClick}
      className={cn(
        "p-5 flex flex-col justify-between transition-shadow duration-150 ease-out",
        // `ring` draws outside the border box, so selecting a card cannot
        // change its size and shift the ones beside it.
        selected && "ring-2 ring-accent/45 shadow-soft-md",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted truncate">
            {label}
          </span>
          <span className="mt-1 block text-2xl sm:text-[26px] font-bold tracking-tight text-ink tabular-nums">
            {value}
          </span>
        </div>
        {icon && (
          <span
            className={cn(
              "shrink-0 grid place-items-center p-2.5 rounded-2xl shadow-soft-sm",
              selected ? "bg-accent text-accent-fg" : "bg-accent-soft text-accent"
            )}
          >
            {icon}
          </span>
        )}
      </div>

      {hasFooter && (
        <div className="mt-3.5 pt-3 border-t border-subtle flex items-end justify-between gap-3">
          <div className="min-w-0">
            {hasTrend && (
              <span
                className={cn(
                  "flex items-center gap-0.5 text-[11px] font-bold tabular-nums",
                  flat ? "text-ink-muted" : good ? "text-success" : "text-danger"
                )}
              >
                <span aria-hidden>{flat ? "→" : rising ? "↗" : "↘"}</span>
                {rising && !flat ? "+" : ""}
                {trend!.toFixed(1)}%
              </span>
            )}
            {trendCaption && (
              <span className="block mt-0.5 text-[10px] text-ink-muted truncate">
                {trendCaption}
              </span>
            )}
          </div>
          {hasSpark && <Sparkline data={sparkline!} positive={good} />}
        </div>
      )}
    </Card>
  );
});
