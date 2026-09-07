"use client";

/**
 * @file StatusUpdateDropdown.tsx
 * @description Custom status-change control for ServiceTable's Status column.
 * Replaces a native <select> — which renders its open list via the OS/browser
 * and cannot be restyled — with a button + floating panel so it matches the
 * rest of the app's design (rounded cards, colored dots, hover states, dark
 * mode). Purely presentational: callers still supply the exact same
 * value/label options and get the same onSelect(value) callback a <select>
 * onChange would have given them.
 *
 * Positioning is handled by useFloatingPanel — see that file for why this
 * can't just be `absolute` inside the table.
 */

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useFloatingPanel } from "@/hooks/useFloatingPanel";

export type StatusDropdownColor =
  | "slate" | "blue" | "amber" | "cyan" | "emerald" | "purple";

interface StatusOption {
  value: string;
  label: string;
}

interface StatusUpdateDropdownProps {
  /** Text shown on the closed trigger — the ticket's current status label */
  currentLabel: string;
  /** Statuses this ticket can move to next (excludes the current status) */
  options: StatusOption[];
  color: StatusDropdownColor;
  onSelect: (value: string) => void;
}

const COLOR_STYLES: Record<StatusDropdownColor, {
  trigger: string;
  dot: string;
  optionHover: string;
}> = {
  slate: {
    trigger: "bg-sunken text-ink border-prominent ",
    dot: "bg-neutral",
    optionHover: "hover:bg-cushion ",
  },
  blue: {
    trigger: "bg-info-soft text-info-fg border-info ",
    dot: "bg-info",
    optionHover: "hover:bg-accent-soft ",
  },
  amber: {
    trigger: "bg-warning-soft text-warning-fg border-warning ",
    dot: "bg-warning",
    optionHover: "hover:bg-warning-soft ",
  },
  cyan: {
    trigger: "bg-info-soft text-info-fg border-info ",
    dot: "bg-info",
    optionHover: "hover:bg-info-soft ",
  },
  emerald: {
    trigger: "bg-success-soft text-success-fg border-success ",
    dot: "bg-success",
    optionHover: "hover:bg-success-soft ",
  },
  purple: {
    trigger: "bg-accent-soft text-accent border-accent ",
    dot: "bg-accent",
    optionHover: "hover:bg-accent-soft ",
  },
};

const PANEL_WIDTH = 208;
const ROW_HEIGHT = 34;

export default function StatusUpdateDropdown({
  currentLabel,
  options,
  color,
  onSelect,
}: StatusUpdateDropdownProps) {
  const [open, setOpen] = useState(false);
  const styles = COLOR_STYLES[color];

  const { anchorRef, panelRef, coords } = useFloatingPanel<HTMLButtonElement, HTMLDivElement>({
    open,
    onClose: () => setOpen(false),
    width: PANEL_WIDTH,
    estimatedHeight: Math.min(options.length * ROW_HEIGHT + 8, 280),
    align: "center",
  });

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 pl-3 pr-2 py-1 text-[11px] font-semibold rounded-full border cursor-pointer font-sans tracking-tight shadow-sm transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] hover:shadow-md hover:brightness-[1.03] active:scale-[0.98] ${styles.trigger}`}
      >
        <span className="truncate max-w-[150px]">{currentLabel}</span>
        <ChevronDown
          className={`w-3 h-3 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && options.length > 0 && coords &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: coords.width,
              transform: coords.placement === "top" ? "translateY(-100%)" : undefined,
            }}
            className={`z-[9999] av-glass-panel rounded-xl overflow-hidden py-1 ${
              coords.placement === "top" ? "dropdown-panel-in-top" : "dropdown-panel-in"
            }`}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                // Required by the listbox pattern: a screen reader announcing
                // an option with no selected state gives the user no way to
                // tell which status the ticket is currently on.
                aria-selected={opt.label === currentLabel}
                onClick={() => {
                  onSelect(opt.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-ink transition-colors ${styles.optionHover}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`} />
                <span className="truncate flex-1">{opt.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
