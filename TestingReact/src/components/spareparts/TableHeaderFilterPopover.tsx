"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Filter, ArrowUp, ArrowDown, ArrowUpDown, X } from "lucide-react";
import { useFloatingPanel } from "@/hooks/useFloatingPanel";
import { useI18n } from "@/i18n/LanguageProvider";

export interface TableHeaderFilterPopoverProps {
  label: string;
  title?: string;
  isActive?: boolean;
  activeCount?: number;
  align?: "center" | "start";
  width?: number;
  onClear?: () => void;
  onApply?: () => void;
  sortState?: "asc" | "desc" | null;
  sortType?: "alpha" | "numeric";
  onSortChange?: (sort: "asc" | "desc" | null) => void;
  children?: React.ReactNode;
  className?: string;
}

export function TableHeaderFilterPopover({
  label,
  title,
  isActive = false,
  activeCount = 0,
  align = "start",
  width = 260,
  onClear,
  onApply,
  sortState = null,
  sortType = "alpha",
  onSortChange,
  children,
  className = "",
}: TableHeaderFilterPopoverProps) {
  const { t, lang } = useI18n();
  const isKhmer = lang === "km";
  const [open, setOpen] = useState(false);

  const { anchorRef, panelRef, coords } = useFloatingPanel<HTMLButtonElement, HTMLDivElement>({
    open,
    onClose: () => setOpen(false),
    width,
    estimatedHeight: 300,
    align,
  });

  const hasSort = Boolean(onSortChange);
  const isSorted = Boolean(sortState);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        aria-expanded={open}
        aria-label={`${label} filter`}
        className={`group inline-flex items-center gap-1.5 py-1 px-1.5 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring ${
          isActive || isSorted
            ? "text-accent bg-accent/10"
            : "text-ink-secondary hover:text-ink hover:bg-surface/80"
        } ${className}`}
      >
        <span className="truncate">{label}</span>

        {/* Active Dot */}
        {isActive && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 animate-pulse"
            title={`${label} filtered`}
          />
        )}

        {/* Sort or Arrow Icon — always visible on header */}
        <span className="shrink-0 flex items-center">
          {sortState === "asc" ? (
            <ArrowUp className="w-3.5 h-3.5 text-accent animate-in fade-in zoom-in-75 duration-150" />
          ) : sortState === "desc" ? (
            <ArrowDown className="w-3.5 h-3.5 text-accent animate-in fade-in zoom-in-75 duration-150" />
          ) : (
            <ArrowUpDown
              className={`w-3 h-3 transition-colors ${
                isActive ? "text-accent" : "text-ink-muted/80 group-hover:text-ink"
              }`}
            />
          )}
        </span>
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={panelRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: coords.width,
              maxHeight: coords.maxHeight,
              transform: coords.placement === "top" ? "translateY(-100%)" : undefined,
            }}
            className="z-[9999] bg-surface border border-subtle shadow-soft-xl rounded-2xl p-3 text-xs text-ink flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150 overflow-hidden max-h-[85vh]"
          >
            {/* Popover Header (Funnel icon + Filter Title + Close button) */}
            <div className="flex items-center justify-between pb-2 border-b border-subtle shrink-0">
              <div className="flex items-center gap-1.5 font-bold text-xs text-ink">
                <Filter className="w-3.5 h-3.5 text-accent shrink-0" />
                <span>{title || t("sp.colFilter.title", { col: label })}</span>
                {activeCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-accent/15 text-accent text-[10px] font-bold">
                    {activeCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {(isActive || isSorted) && onClear && (
                  <button
                    type="button"
                    onClick={() => {
                      onClear();
                      if (onSortChange) onSortChange(null);
                    }}
                    className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-danger hover:underline cursor-pointer"
                  >
                    {t("sp.colFilter.clear")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-cushion transition-colors cursor-pointer"
                  aria-label="Close filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Form wrapping body and footer for instant Enter submission and Apply */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (onApply) onApply();
                setOpen(false);
              }}
              className="flex flex-col flex-1 min-h-0 overflow-hidden"
            >
              {/* Scrollable Body: Sorting controls + Custom Filter Controls */}
              <div className="space-y-2.5 flex-1 overflow-y-auto pr-0.5">
                {/* Sorting controls if supported */}
                {hasSort && onSortChange && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                      {isKhmer ? "តម្រៀប" : "SORT"}
                    </span>
                    <div className="grid grid-cols-2 gap-1 bg-cushion p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => onSortChange(sortState === "asc" ? null : "asc")}
                        className={`flex items-center justify-center gap-1 py-1 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                          sortState === "asc"
                            ? "bg-surface text-accent shadow-2xs font-bold"
                            : "text-ink-secondary hover:text-ink"
                        }`}
                      >
                        <ArrowUp className="w-3 h-3" />
                        {sortType === "numeric"
                          ? t("sp.colFilter.sortNumAsc")
                          : t("sp.colFilter.sortAsc")}
                      </button>
                      <button
                        type="button"
                        onClick={() => onSortChange(sortState === "desc" ? null : "desc")}
                        className={`flex items-center justify-center gap-1 py-1 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                          sortState === "desc"
                            ? "bg-surface text-accent shadow-2xs font-bold"
                            : "text-ink-secondary hover:text-ink"
                        }`}
                      >
                        <ArrowDown className="w-3 h-3" />
                        {sortType === "numeric"
                          ? t("sp.colFilter.sortNumDesc")
                          : t("sp.colFilter.sortDesc")}
                      </button>
                    </div>
                  </div>
                )}

                {/* Children (Input fields, selects, radios, etc.) */}
                {children && (
                  <div className="space-y-2">
                    {children}
                  </div>
                )}
              </div>

              {/* Footer / Apply Action */}
              <div className="pt-2 border-t border-subtle/60 flex items-center justify-end shrink-0">
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent/90 transition-all shadow-2xs cursor-pointer"
                >
                  {t("sp.colFilter.apply")}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}
    </>
  );
}
