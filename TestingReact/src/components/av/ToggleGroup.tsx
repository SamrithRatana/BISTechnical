"use client";

import { memo, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * @file components/av/ToggleGroup.tsx
 * @description Segmented control — the 1H / 24H / 7D / 30D time range picker,
 * and any other small mutually-exclusive choice.
 *
 * The selected pill is ONE absolutely-positioned element that slides, not a
 * background toggled on each option. That is what makes the transition read as
 * a single object moving rather than one chip blinking off while another
 * blinks on, and it keeps the animation to a single `transform` regardless of
 * how many options there are.
 *
 * Keyboard support follows the WAI-ARIA radiogroup pattern: arrows move and
 * select, because for a filter like this "focus without selecting" is a
 * distinction users do not want to make.
 */

export interface ToggleOption<T extends string> {
  value: T;
  label: string;
}

export interface ToggleGroupProps<T extends string> {
  options: readonly ToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
}

function ToggleGroupInner<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: ToggleGroupProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const last = options.length - 1;
      let next: number | null = null;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") next = activeIndex >= last ? 0 : activeIndex + 1;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = activeIndex <= 0 ? last : activeIndex - 1;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = last;

      if (next !== null) {
        e.preventDefault();
        onChange(options[next].value);
        refs.current[next]?.focus();
      }
    },
    [activeIndex, onChange, options]
  );

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(
        "relative inline-flex items-center gap-0.5 p-1 rounded-full bg-sunken border border-subtle",
        className
      )}
    >
      {/* The travelling pill. Width is a fraction of the track and position is
          a percentage of its own width, so it stays correct at any option
          count without measuring the DOM. */}
      <span
        aria-hidden
        className="absolute top-1 bottom-1 left-1 rounded-full bg-surface shadow-soft-sm pointer-events-none"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${activeIndex * 100}%)`,
          transition: "transform var(--av-dur-base) var(--av-ease)",
        }}
      />
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative z-10 px-3 py-1 rounded-full text-xs font-medium",
              "transition-colors duration-150 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
              selected ? "text-ink" : "text-ink-secondary hover:text-ink"
            )}
            style={{ flex: `1 1 ${100 / options.length}%` }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// `memo` loses the generic parameter, so the cast restores the call signature.
export const ToggleGroup = memo(ToggleGroupInner) as typeof ToggleGroupInner;
