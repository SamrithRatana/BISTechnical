"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Plus,
  Edit3,
  Trash2,
  Printer,
  Download,
  Search,
  X,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";
import type { CrudStyleName } from "@/theme/themeConfig";

interface EnterpriseRibbonToolbarProps {
  // Action Handlers
  onCreate?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPrint?: () => void;
  onExportCsv?: () => void;
  onReload?: () => void;
  // Search state & handlers
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onSearchSubmit: () => void;
  onSearchClear: () => void;
  searchPlaceholder?: string;
  // Selection state
  selectedCount: number;
  // Permissions & capabilities
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canPrint?: boolean;
  canExport?: boolean;
  isLoading?: boolean;
  // View Switcher (optional / deprecated)
  currentStyle?: CrudStyleName;
  onStyleChange?: (style: CrudStyleName) => void;
  // Optional extras
  extraActions?: React.ReactNode;
}

/**
 * Enterprise 2-tier Ribbon Toolbar matching Image 4.
 * Row 1: Command Ribbon (Create, Edit, Delete, Print, Export, Refresh)
 * Row 2: Dedicated Search Bar with explicit [Search] and [Clear] buttons.
 */
export default function EnterpriseRibbonToolbar({
  onCreate,
  onEdit,
  onDelete,
  onPrint,
  onExportCsv,
  onReload,
  searchTerm,
  onSearchChange,
  onSearchSubmit,
  onSearchClear,
  searchPlaceholder,
  selectedCount,
  canCreate = true,
  canEdit = true,
  canDelete = true,
  canPrint = true,
  canExport = true,
  isLoading = false,
  extraActions,
}: EnterpriseRibbonToolbarProps) {
  const { t, lang } = useI18n();
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Close export dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasSelection = selectedCount > 0;
  const disabledDeleteTip = lang === "km" ? "មុខងារលុបត្រូវបានបិទ" : "Delete is disabled";
  const disabledCreateTip = lang === "km" ? "មុខងារបង្កើតត្រូវបានបិទ" : "Create is disabled";
  const disabledEditTip = lang === "km" ? "មុខងារកែប្រែត្រូវបានបិទ" : "Edit is disabled";

  return (
    <div className="flex flex-col bg-surface border-b border-subtle">
      {/* ── TIER 1: COMMAND ACTION RIBBON (MATCHING IMAGE 4) ── */}
      <div className="px-2.5 sm:px-3 py-1.5 flex items-center justify-between gap-2 border-b border-subtle/80 bg-surface overflow-x-auto no-scrollbar">
        {/* Left Action Buttons: Create, Edit, Delete, Print, Export, Check List */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 flex-nowrap">
          {/* Create Button */}
          <button
            type="button"
            onClick={canCreate && onCreate ? onCreate : undefined}
            disabled={!canCreate}
            className={cn(
              "inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors select-none whitespace-nowrap",
              canCreate
                ? "text-ink hover:text-accent hover:bg-accent-soft cursor-pointer"
                : "text-ink-muted/40 opacity-40 cursor-not-allowed"
            )}
            title={canCreate ? t("crud.create") : disabledCreateTip}
          >
            <Plus className={cn("w-3.5 h-3.5", canCreate ? "text-accent" : "text-ink-muted/40")} />
            <span>{t("crud.create")}</span>
          </button>

          {/* Edit Button */}
          <button
            type="button"
            onClick={canEdit && onEdit ? onEdit : undefined}
            disabled={!canEdit}
            className={cn(
              "inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors select-none whitespace-nowrap",
              canEdit
                ? "text-ink hover:text-accent hover:bg-accent-soft cursor-pointer"
                : "text-ink-muted/40 opacity-40 cursor-not-allowed"
            )}
            title={canEdit ? t("crud.edit") : disabledEditTip}
          >
            <Edit3 className={cn("w-3.5 h-3.5", canEdit ? "text-accent" : "text-ink-muted/40")} />
            <span>{t("crud.edit")}</span>
          </button>

          {/* Delete Button */}
          <button
            type="button"
            onClick={canDelete && onDelete ? onDelete : undefined}
            disabled={!canDelete}
            className={cn(
              "inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors select-none whitespace-nowrap",
              canDelete
                ? "text-danger hover:bg-danger-soft cursor-pointer"
                : "text-ink-muted/40 opacity-40 cursor-not-allowed"
            )}
            title={canDelete ? t("crud.delete") : disabledDeleteTip}
          >
            <Trash2 className={cn("w-3.5 h-3.5", canDelete ? "text-danger" : "text-ink-muted/40")} />
            <span>{t("crud.delete")}</span>
          </button>

          {/* Print Button */}
          <button
            type="button"
            onClick={canPrint && onPrint ? onPrint : undefined}
            disabled={!canPrint}
            className={cn(
              "inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors select-none whitespace-nowrap",
              canPrint
                ? "text-ink hover:text-accent hover:bg-accent-soft cursor-pointer"
                : "text-ink-muted/40 opacity-40 cursor-not-allowed"
            )}
            title={t("crud.print")}
          >
            <Printer className={cn("w-3.5 h-3.5", canPrint ? "text-accent" : "text-ink-muted/40")} />
            <span>{t("crud.print")}</span>
          </button>

          {/* Export Dropdown */}
          {canExport && onExportCsv && (
            <div ref={exportRef} className="relative inline-block text-left">
              <button
                type="button"
                onClick={() => setExportOpen(!exportOpen)}
                className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 text-xs font-semibold rounded-lg text-ink hover:text-accent hover:bg-accent-soft transition-colors cursor-pointer select-none whitespace-nowrap"
                title={t("crud.export")}
              >
                <Download className="w-3.5 h-3.5 text-ink-secondary" />
                <span>{t("crud.export")}</span>
                <ChevronDown className="w-3 h-3 text-ink-muted" />
              </button>

              {exportOpen && (
                <div className="absolute left-0 mt-1 w-44 rounded-xl bg-surface border border-subtle shadow-lg z-50 py-1 text-xs animate-in fade-in-0 zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={() => {
                      onExportCsv();
                      setExportOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-cushion text-ink font-medium transition-colors"
                  >
                    {t("crud.exportCsv")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Action Tools: extraActions (Columns, Phone Scan, etc.) + Refresh */}
        <div className="flex items-center gap-1.5 shrink-0 flex-nowrap ml-auto">
          {extraActions}
          {onReload && (
            <button
              type="button"
              onClick={onReload}
              className="p-1.5 rounded-lg border border-subtle text-ink-secondary hover:text-ink hover:bg-cushion transition-colors cursor-pointer shrink-0"
              title={t("action.reloadData")}
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
            </button>
          )}
        </div>
      </div>

      {/* ── TIER 2: SEARCH & FILTER BAR (MATCHING IMAGE 4) ── */}
      <div className="px-2.5 sm:px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 bg-surface-elevated/40">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearchSubmit();
          }}
          className="flex-1 min-w-[220px] max-w-xl flex items-center gap-1.5"
        >
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={searchPlaceholder || t("table.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-3 pr-8 py-1.5 text-xs rounded-lg border border-subtle bg-surface text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all shadow-2xs placeholder:text-ink-muted"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={onSearchClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink cursor-pointer"
                title={t("crud.clear")}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Explicit Search Button (Blue button matching Image 4) */}
          <button
            type="submit"
            className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-sky-500 hover:bg-sky-600 text-white transition-colors shadow-sm cursor-pointer shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{t("crud.search")}</span>
          </button>

          {/* Explicit Clear Button (Matching Image 4) */}
          {searchTerm && (
            <button
              type="button"
              onClick={onSearchClear}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-subtle bg-surface text-ink hover:bg-cushion transition-colors cursor-pointer shrink-0 shadow-2xs"
            >
              <X className="w-3.5 h-3.5 text-ink-muted" />
              <span>{t("crud.clear")}</span>
            </button>
          )}
        </form>

        {hasSelection && (
          <div className="text-xs text-accent font-semibold flex items-center gap-1.5 bg-accent-soft px-2.5 py-1 rounded-lg border border-accent/20 shrink-0">
            <span>{t("crud.selectedRows", { count: selectedCount })}</span>
          </div>
        )}
      </div>
    </div>
  );
}
