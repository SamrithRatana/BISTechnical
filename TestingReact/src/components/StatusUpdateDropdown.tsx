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
    trigger: "bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
    dot: "bg-slate-500",
    optionHover: "hover:bg-slate-50 dark:hover:bg-slate-800",
  },
  blue: {
    trigger: "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800",
    dot: "bg-blue-500",
    optionHover: "hover:bg-blue-50 dark:hover:bg-slate-800",
  },
  amber: {
    trigger: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800",
    dot: "bg-amber-500",
    optionHover: "hover:bg-amber-50 dark:hover:bg-slate-800",
  },
  cyan: {
    trigger: "bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-200 dark:border-cyan-800",
    dot: "bg-cyan-500",
    optionHover: "hover:bg-cyan-50 dark:hover:bg-slate-800",
  },
  emerald: {
    trigger: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800",
    dot: "bg-emerald-500",
    optionHover: "hover:bg-emerald-50 dark:hover:bg-slate-800",
  },
  purple: {
    trigger: "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-800",
    dot: "bg-purple-500",
    optionHover: "hover:bg-purple-50 dark:hover:bg-slate-800",
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
        className={`inline-flex items-center gap-1.5 pl-3 pr-2 py-1 text-[11px] font-semibold rounded-full border cursor-pointer font-sans tracking-tight shadow-sm transition-all hover:shadow-md hover:brightness-[1.03] active:scale-[0.98] ${styles.trigger}`}
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
            className={`z-[100] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl shadow-slate-900/10 dark:shadow-black/40 overflow-hidden py-1 ${
              coords.placement === "top" ? "dropdown-panel-in-top" : "dropdown-panel-in"
            }`}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                onClick={() => {
                  onSelect(opt.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-slate-700 dark:text-slate-200 transition-colors ${styles.optionHover}`}
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
