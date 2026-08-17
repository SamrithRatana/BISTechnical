"use client";

import { memo, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * @file components/av/Badge.tsx
 * @description Pills — version badges, sidebar trailing labels, and the
 * status chips the ticket queues live on.
 *
 * The tone list is the semantic palette from `globals.css`, not a set of
 * colour names. A caller asks for `danger`, never for `red`: the queues use
 * these to encode ticket state, so the mapping from meaning to colour has to
 * live in one place or a redesign silently changes what a row is saying.
 */

export type BadgeTone =
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

const TONES: Record<BadgeTone, string> = {
  accent: "bg-accent-soft text-accent-soft-fg",
  success: "bg-success-soft text-success-fg",
  warning: "bg-warning-soft text-warning-fg",
  danger: "bg-danger-soft text-danger-fg",
  info: "bg-info-soft text-info-fg",
  neutral: "bg-neutral-soft text-neutral-fg",
};

const DOT_TONES: Record<BadgeTone, string> = {
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
  neutral: "text-neutral",
};

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  /** Renders a leading dot. `pulse` animates it — for live/streaming state. */
  dot?: boolean;
  pulse?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export const Badge = memo(function Badge({
  children,
  tone = "neutral",
  dot = false,
  pulse = false,
  size = "sm",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
        size === "sm" ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1",
        TONES[tone],
        className
      )}
    >
      {dot && (
        <span className={cn("relative grid place-items-center", DOT_TONES[tone])}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {/* The halo is a pseudo-element on a zero-size anchor, so the
              scale animation never affects the pill's own box. */}
          {pulse && <span className="absolute w-1.5 h-1.5 av-pulse-dot" />}
        </span>
      )}
      {children}
    </span>
  );
});
