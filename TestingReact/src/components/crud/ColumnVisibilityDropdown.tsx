"use client";

import React, { useState, useRef, useEffect } from "react";
import { SlidersHorizontal, Check, RotateCcw, ChevronDown } from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

export interface ColumnDefinition {
  key: string;
  label: string;
  visible: boolean;
  permanent?: boolean;
}

interface ColumnVisibilityDropdownProps {
  columns: ColumnDefinition[];
  onToggleColumn: (key: string) => void;
  onResetColumns?: () => void;
  className?: string;
}

/**
 * Column visibility selector menu matching the "Columns ▾" control seen in Image 4.
 * Allows users to toggle which columns are rendered in the DataGrid.
 */
export default function ColumnVisibilityDropdown({
  columns,
  onToggleColumn,
  onResetColumns,
  className,
}: ColumnVisibilityDropdownProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const visibleCount = columns.filter((c) => c.visible).length;

  return (
    <div ref={containerRef} className={cn("relative inline-block text-left", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg whitespace-nowrap",
          "border border-subtle bg-surface text-ink hover:bg-cushion transition-colors shadow-2xs cursor-pointer select-none",
          isOpen && "ring-2 ring-accent/30 border-accent"
        )}
        title={t("crud.columns")}
        aria-expanded={isOpen}
      >
        <SlidersHorizontal className="w-3.5 h-3.5 text-ink-muted" />
        <span className="font-sans text-[11px] font-bold tracking-tight">
          {t("crud.columns")}
        </span>
        <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-cushion text-ink-muted border border-subtle">
          {visibleCount}/{columns.length}
        </span>
        <ChevronDown className={cn("w-3 h-3 text-ink-muted transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute right-0 mt-1.5 w-56 rounded-xl bg-surface border border-subtle shadow-lg z-50 py-1.5 text-xs",
            "animate-in fade-in-0 zoom-in-95 duration-100"
          )}
        >
          <div className="px-3 py-1.5 border-b border-subtle flex items-center justify-between">
            <span className="font-semibold text-ink text-[11px] uppercase tracking-wider">
              {t("crud.columns")}
            </span>
            {onResetColumns && (
              <button
                type="button"
                onClick={() => {
                  onResetColumns();
                }}
                className="inline-flex items-center gap-1 text-[10px] text-ink-muted hover:text-accent font-medium transition-colors cursor-pointer"
                title={t("crud.resetColumns")}
              >
                <RotateCcw className="w-3 h-3" />
                <span>{t("crud.resetColumns")}</span>
              </button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto py-1 px-1 space-y-0.5">
            {columns.map((col) => {
              const disabled = col.permanent;
              return (
                <button
                  key={col.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => !disabled && onToggleColumn(col.key)}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer select-none",
                    col.visible
                      ? "text-ink hover:bg-cushion"
                      : "text-ink-muted hover:bg-cushion/60",
                    disabled && "opacity-60 cursor-not-allowed"
                  )}
                >
                  <span className="truncate pr-2 font-medium">{col.label}</span>
                  <div
                    className={cn(
                      "w-4 h-4 rounded flex items-center justify-center border transition-colors shrink-0",
                      col.visible
                        ? "bg-accent border-accent text-white"
                        : "border-subtle bg-cushion"
                    )}
                  >
                    {col.visible && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
