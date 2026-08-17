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
   * Note the near-white `border-glass` rather than the dark `border-subtle`
   * hairline. Paired with the cushion shadow (which carries an inset white
   * highlight along the top edge), this is what makes the card read as a
   * raised, softly-lit object instead of a white rectangle with an outline.
   * Swapping either half back to a dark border or a flat shadow collapses the
   * effect — they only work together.
   */
  surface: "bg-surface border border-glass shadow-cushion",
  // The tinted well a stat row or sub-panel sits in. Deliberately keeps the
  // dark hairline: a sunken panel should read as cut into the card, and a
  // white edge would make it float instead.
  sunken: "bg-sunken border border-subtle",
  // Popovers, dialogs, anything that floats above a card.
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
