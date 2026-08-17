"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

/**
 * @file components/av/ProgressBar.tsx
 * @description Track + fill, used by the sidebar's pinned health widget.
 *
 * The fill animates with `transform: scaleX()` rather than `width`. Both look
 * identical; only one is free. Animating `width` forces layout on every frame
 * of every bar on screen, which is exactly the "smooth on lower-end machines"
 * requirement failing quietly. `transform-origin: left` makes the scale grow
 * from the correct edge.
 */

export type ProgressTone = "accent" | "success" | "warning" | "danger";

const FILL_TONES: Record<ProgressTone, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export interface ProgressBarProps {
  /** 0–100. Clamped, so a bad computation cannot overflow the track. */
  value: number;
  tone?: ProgressTone;
  className?: string;
  label?: string;
  showValue?: boolean;
}

export const ProgressBar = memo(function ProgressBar({
  value,
  tone = "accent",
  className,
  label,
  showValue = false,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

  return (
    <div className={cn("w-full", className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && (
            <span className="text-[11px] font-medium text-ink-secondary">{label}</span>
          )}
          {showValue && (
            <span className="text-[11px] font-semibold text-ink tabular-nums">
              {Math.round(pct)}%
            </span>
          )}
        </div>
      )}
      <div
        className="h-1.5 w-full rounded-full bg-sunken overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn("h-full w-full rounded-full origin-left", FILL_TONES[tone])}
          style={{
            transform: `scaleX(${pct / 100})`,
            transition: "transform var(--av-dur-slow) var(--av-ease)",
          }}
        />
      </div>
    </div>
  );
});
