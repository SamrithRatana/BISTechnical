"use client";

/**
 * @file ModernSelect.tsx
 * @description Generic replacement for a native <select> — a form-field
 * shaped trigger (matches this app's standard input styling) that opens a
 * floating option list instead of the browser's own unstyled dropdown.
 * Used for every plain value-picker select in the app (priority, service
 * location, customer type, item type, service type, spare-part condition).
 * The spare-part search/pick control is a different, richer widget and is
 * not built on this — this is only for simple "pick one of a few values"
 * selects.
 *
 * Positioning is handled by useFloatingPanel — see that file for why a
 * portaled, fixed-position panel is used instead of `absolute`.
 */

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { useFloatingPanel } from "@/hooks/useFloatingPanel";

export interface ModernSelectOption {
  value: string;
  label: string;
}

interface ModernSelectProps {
  value: string;
  options: ModernSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Compact sizing for tight spaces like a table cell */
  dense?: boolean;
}

const ROW_HEIGHT = 34;

export default function ModernSelect({
  value,
  options,
  onChange,
  placeholder = "Select...",
  className = "",
  dense = false,
}: ModernSelectProps) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  const { anchorRef, panelRef, coords } = useFloatingPanel<HTMLButtonElement, HTMLDivElement>({
    open,
    onClose: () => setOpen(false),
    width: "match",
    estimatedHeight: Math.min(options.length * ROW_HEIGHT + 8, 280),
    align: "start",
  });

  const triggerCls = dense
    ? "px-2 py-1 text-[11px]"
    : "px-3 py-2 text-xs";

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
        className={`w-full flex items-center justify-between gap-1.5 ${triggerCls} border rounded-xl bg-elevated   outline-none transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] hover:border-prominent  ${
          open
            ? "ring-2 ring-accent/20 border-info"
            : "border-subtle "
        } ${className}`}
      >
        <span className={`truncate text-left ${current ? "text-ink " : "text-ink-muted"}`}>
          {current?.label ?? placeholder}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 text-ink-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && coords &&
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
            className={`z-[100] av-glass-panel rounded-xl overflow-hidden py-1 max-h-60 overflow-y-auto ${
              coords.placement === "top" ? "dropdown-panel-in-top" : "dropdown-panel-in"
            }`}
          >
            {options.map((opt) => {
              const selected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-left transition-colors ${
                    selected
                      ? "bg-accent-soft text-accent-soft-fg font-semibold"
                      : "text-ink hover:bg-cushion "
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
