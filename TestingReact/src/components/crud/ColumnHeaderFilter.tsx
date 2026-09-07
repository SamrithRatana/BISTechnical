"use client";

import React, { useState, useRef, useEffect } from "react";
import { Filter, ArrowDownAZ, ArrowUpAZ, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ColumnHeaderFilterProps {
  label: string;
  field: string;
  filterValue?: string;
  onFilterChange: (val: string) => void;
  sortDirection?: "asc" | "desc" | null;
  onSortChange?: (direction: "asc" | "desc" | null) => void;
  className?: string;
}

/**
 * Filter funnel icon and popover on column headers matching Image 4.
 */
export default function ColumnHeaderFilter({
  label,
  field,
  filterValue = "",
  onFilterChange,
  sortDirection,
  onSortChange,
  className,
}: ColumnHeaderFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempVal, setTempVal] = useState(filterValue);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTempVal(filterValue);
  }, [filterValue]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const isFiltered = Boolean(filterValue && filterValue.trim() !== "");

  const handleApply = () => {
    onFilterChange(tempVal);
    setIsOpen(false);
  };

  const handleClear = () => {
    setTempVal("");
    onFilterChange("");
    setIsOpen(false);
  };

  return (
    <div className={cn("inline-flex items-center select-none relative", className)}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={cn(
          "p-1 rounded-md transition-colors cursor-pointer inline-flex items-center justify-center",
          isFiltered
            ? "bg-accent/20 text-accent font-bold ring-1 ring-accent"
            : "text-ink-muted hover:text-ink hover:bg-cushion",
          isOpen && "ring-2 ring-accent/40"
        )}
        title={`Filter by ${label}`}
        aria-label={`Filter by ${label}`}
      >
        <Filter className={cn("w-3 h-3", isFiltered && "fill-accent text-accent")} />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute left-0 top-full mt-1.5 w-60 rounded-xl bg-surface border border-subtle shadow-xl p-3 z-50 text-xs",
            "animate-in fade-in-0 zoom-in-95 duration-100 normal-case"
          )}
        >
          <div className="flex items-center justify-between pb-2 border-b border-subtle mb-2.5">
            <span className="font-semibold text-ink text-[11px] truncate">
              Filter: {label}
            </span>
            {isFiltered && (
              <button
                type="button"
                onClick={handleClear}
                className="text-[10px] text-danger hover:underline cursor-pointer flex items-center gap-0.5 font-medium"
              >
                <X className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Quick Sort Options */}
          {onSortChange && (
            <div className="flex items-center gap-1.5 mb-2.5">
              <button
                type="button"
                onClick={() => onSortChange(sortDirection === "asc" ? null : "asc")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-lg border text-[10px] font-medium transition-colors cursor-pointer",
                  sortDirection === "asc"
                    ? "bg-accent text-white border-accent"
                    : "border-subtle hover:bg-cushion text-ink-secondary"
                )}
              >
                <ArrowDownAZ className="w-3 h-3" />
                <span>A to Z</span>
              </button>
              <button
                type="button"
                onClick={() => onSortChange(sortDirection === "desc" ? null : "desc")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-lg border text-[10px] font-medium transition-colors cursor-pointer",
                  sortDirection === "desc"
                    ? "bg-accent text-white border-accent"
                    : "border-subtle hover:bg-cushion text-ink-secondary"
                )}
              >
                <ArrowUpAZ className="w-3 h-3" />
                <span>Z to A</span>
              </button>
            </div>
          )}

          {/* Value Search Filter */}
          <div className="space-y-1.5">
            <input
              type="text"
              autoFocus
              placeholder={`Filter by ${label}...`}
              value={tempVal}
              onChange={(e) => setTempVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleApply();
                if (e.key === "Escape") setIsOpen(false);
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-cushion border border-subtle text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-subtle">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2.5 py-1 rounded-lg text-ink-secondary hover:bg-cushion text-[11px] font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-3 py-1 rounded-lg bg-accent text-white text-[11px] font-semibold hover:bg-accent-hover shadow-xs cursor-pointer inline-flex items-center gap-1"
            >
              <Check className="w-3 h-3" />
              <span>Apply</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
