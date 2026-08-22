"use client";

import { memo, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * @file components/av/Card.tsx
 * @description The Aura Velvet surface primitive — white card, soft shadow,
 * 16–20px radius, no harsh border.
 *
 * `hover` is opt-in rather than the default. A card the cursor can act on
 * should lift; a card that is only a container should not, because a surface
 * that reacts to the mouse but does nothing when clicked reads as a broken
 * button. Callers say which one they are.
 */

export type CardVariant = "surface" | "sunken" | "elevated";

export interface CardProps {
  children: ReactNode;
  className?: string;
  /** Adds the compositor-only hover lift. Use on interactive cards only. */
  hover?: boolean;
  variant?: CardVariant;
  onClick?: () => void;
}

const VARIANTS: Record<CardVariant, string> = {
  /**
   * A card resting on the app background — the default, and the one the
   * dashboard uses.
   *
   * Border, background, blur and shadow all read from the `--av-card-*`
   * tokens rather than the fixed `border-glass`/`shadow-cushion` utilities
   * this used to hardcode — Settings → Theme & Branding switches those
   * tokens via `[data-surface-style]` (see `globals.css`). The shipped
   * default (`cushion`) aliases them back to the exact values this had
   * before, so nothing looks different until a user picks a different style.
   *
   * The border and shadow are still paired on purpose: a near-white border
   * only reads as an edge WITH a soft shadow under it, which is why `flat`
   * swaps `--av-card-border` to a real hairline rather than leaving the
   * glass border in place over no shadow — see the `flat` rule in
   * `globals.css` for why that pairing would otherwise collapse.
   */
  surface:
    "bg-[var(--av-card-bg)] border border-[var(--av-card-border)] shadow-[var(--av-card-shadow)] backdrop-blur-[var(--av-card-blur)]",
  // The tinted well a stat row or sub-panel sits in. Deliberately fixed, not
  // surface-style-aware: a sunken panel should always read as cut into the
  // card, and a white edge or a blur would make it float instead.
  sunken: "bg-sunken border border-subtle",
  // Popovers, dialogs, anything that floats above a card. Also deliberately
  // fixed rather than surface-style-aware: this is transient overlay chrome,
  // not a resting branding surface, and a heavy blur here would sit on top
  // of whatever the surface style already blurred underneath it.
  elevated: "bg-elevated border border-glass shadow-soft-xl",
};

export const Card = memo(function Card({
  children,
  className,
  hover = false,
  variant = "surface",
  onClick,
}: CardProps) {
  const interactive = Boolean(onClick);

  return (
    <div
      className={cn(
        "rounded-2xl",
        VARIANTS[variant],
        hover && "av-hover-lift",
        interactive && "cursor-pointer text-left w-full",
        className
      )}
      // Only becomes a button in the accessibility tree when it actually does
      // something. A div with role="button" and no handler is a trap for
      // keyboard users: focusable, announced as actionable, inert on Enter.
      {...(interactive
        ? {
            role: "button",
            tabIndex: 0,
            onClick,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            },
          }
        : {})}
    >
      {children}
    </div>
  );
});

/** Card header: title on the left, optional actions pinned right. */
export const CardHeader = memo(function CardHeader({
  title,
  subtitle,
  icon,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <span className="shrink-0 grid place-items-center w-9 h-9 rounded-full bg-accent-soft text-accent">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-ink truncate">{title}</h3>
          {subtitle && (
            <p className="text-sm text-ink-secondary mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
});
