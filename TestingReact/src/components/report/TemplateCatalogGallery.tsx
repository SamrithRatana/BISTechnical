"use client";

/**
 * @file report/TemplateCatalogGallery.tsx
 * @description The Visual Report Templates Hub / Gallery landing page.
 *
 * Organizes all 29 enterprise reports into 5 clean categories:
 * - 🔧 Repair Operations (10)
 * - ⚠️ Quality & Diagnostics (2)
 * - 🎖️ Technician KPIs (2)
 * - 📈 Sales & CRM (7)
 * - 📦 Spare Parts & Stock (8)
 */

import React, { useState, useMemo } from "react";
import {
  Wrench,
  AlertCircle,
  Award,
  TrendingUp,
  Package,
  Search,
  SlidersHorizontal,
  FileSpreadsheet,
  FileText,
  ChevronRight,
  Sparkles,
  Layers,
  CheckCircle2,
  Sliders,
  Eye,
  RotateCcw,
} from "lucide-react";
import {
  ALL_REPORTS,
  REPORT_CATEGORIES,
  type ReportCategory,
  type ReportDefinition,
} from "@/services/reportCatalog";
import { useI18n } from "@/i18n/LanguageProvider";

interface TemplateCatalogGalleryProps {
  onSelectReport: (report: ReportDefinition) => void;
}

const CATEGORY_ICON_MAP: Record<ReportCategory, React.ElementType> = {
  operations: Wrench,
  diagnostics: AlertCircle,
  kpis: Award,
  sales: TrendingUp,
  stock: Package,
};

const CATEGORY_COLOR_MAP: Record<ReportCategory, { bg: string; text: string; border: string; badgeBg: string }> = {
  operations: {
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/30",
    badgeBg: "bg-blue-100 dark:bg-blue-900/40",
  },
  diagnostics: {
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/30",
    badgeBg: "bg-amber-100 dark:bg-amber-900/40",
  },
  kpis: {
    bg: "bg-purple-500/10",
    text: "text-purple-600 dark:text-purple-400",
    border: "border-purple-500/30",
    badgeBg: "bg-purple-100 dark:bg-purple-900/40",
  },
  sales: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/30",
    badgeBg: "bg-emerald-100 dark:bg-emerald-900/40",
  },
  stock: {
    bg: "bg-cyan-500/10",
    text: "text-cyan-600 dark:text-cyan-400",
    border: "border-cyan-500/30",
    badgeBg: "bg-cyan-100 dark:bg-cyan-900/40",
  },
};

export default function TemplateCatalogGallery({ onSelectReport }: TemplateCatalogGalleryProps) {
  const { t, lang } = useI18n();
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFormat, setSelectedFormat] = useState<"all" | "form" | "excel">("all");

  const filteredReports = useMemo(() => {
    return ALL_REPORTS.filter((rep) => {
      // 1. Category Filter
      if (selectedCategory !== "all" && rep.category !== selectedCategory) {
        return false;
      }
      // 2. Format Filter
      if (selectedFormat !== "all" && rep.type !== selectedFormat) {
        return false;
      }
      // 3. Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = rep.name.toLowerCase().includes(q) || rep.nameKm.toLowerCase().includes(q);
        const matchDesc = rep.description.toLowerCase().includes(q) || rep.descriptionKm.toLowerCase().includes(q);
        const matchCategory = rep.categoryName.toLowerCase().includes(q) || rep.categoryNameKm.toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchCategory) return false;
      }
      return true;
    });
  }, [selectedCategory, selectedFormat, searchQuery]);

  return (
    <div className="space-y-6 pb-12">
      {/* ── 1. HERO HEADER ── */}
      <div className="rounded-3xl border border-subtle bg-surface/90 backdrop-blur-xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-accent/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/25 text-accent text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>29 Enterprise Report Templates Catalog</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
            {lang === "km" ? "មជ្ឈមណ្ឌលគ្រប់គ្រងគំរូរបាយការណ៍ (Report Templates)" : "Report Templates Studio & Catalog"}
          </h1>
          <p className="text-sm text-ink-muted leading-relaxed">
            {lang === "km"
              ? "ជ្រើសរើសរបាយការណ៍ណាមួយខាងក្រោម ដើម្បីចូលទៅកែតម្រូវទម្រង់ (A4 Form Canvas ឬ Excel Spreadsheet Grid), ប្តូរកូឡោន, ភ្ជាប់ Field ពី Database, និងប្តូរ Logo តាមចិត្ត។"
              : "Select any report below to customize its template layout (Printable A4 Form or Excel Data Grid), map database fields, modify column formats, and publish company-wide."}
          </p>
        </div>

        {/* Quick Search & Filters Bar */}
        <div className="mt-6 pt-6 border-t border-subtle/80 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === "km" ? "ស្វែងរករបាយការណ៍ (ឈ្មោះ, ប្រភេទ, ពាក្យគន្លឹះ)..." : "Search 29 reports by name, type, or fields..."}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-sunken border border-subtle text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-muted hover:text-ink"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-sunken rounded-xl border border-subtle">
            {([
              { id: "all", label: lang === "km" ? "ទាំងអស់" : "All Formats" },
              { id: "form", label: "📄 A4 Forms (1)" },
              { id: "excel", label: "📊 Excel Grids (28)" },
            ] as const).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedFormat(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  selectedFormat === f.id
                    ? "bg-surface text-ink shadow-xs"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 2. CATEGORY TABS (5 Core Groups Matching Sidebar) ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedCategory("all")}
          className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 border ${
            selectedCategory === "all"
              ? "bg-accent text-white border-accent shadow-xs"
              : "bg-surface border-subtle text-ink-secondary hover:text-ink hover:bg-cushion"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{lang === "km" ? "គ្រប់ប្រភេទទាំងអស់" : "All Categories"}</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
            selectedCategory === "all" ? "bg-white/20 text-white" : "bg-sunken text-ink-muted"
          }`}>
            29
          </span>
        </button>

        {REPORT_CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICON_MAP[cat.id];
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 border ${
                isSelected
                  ? "bg-accent text-white border-accent shadow-xs"
                  : "bg-surface border-subtle text-ink-secondary hover:text-ink hover:bg-cushion"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{lang === "km" ? cat.nameKm : cat.name}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                isSelected ? "bg-white/20 text-white" : "bg-sunken text-ink-muted"
              }`}>
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── 3. REPORT CARDS GRID ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
        {filteredReports.map((rep) => {
          const Icon = CATEGORY_ICON_MAP[rep.category];
          const colors = CATEGORY_COLOR_MAP[rep.category];

          return (
            <div
              key={rep.id}
              onClick={() => onSelectReport(rep)}
              className="group rounded-3xl border border-subtle bg-surface p-5 hover:border-accent/50 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden"
            >
              {/* Top Accent Stripe on Hover */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent to-accent/40 opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="space-y-3">
                {/* Header: Category Tag & Format Badge */}
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10.5px] font-bold px-2.5 py-1 rounded-xl flex items-center gap-1.5 ${colors.bg} ${colors.text} ${colors.border} border`}>
                    <Icon className="w-3 h-3" />
                    <span>{lang === "km" ? rep.categoryNameKm : rep.categoryName}</span>
                  </span>

                  {rep.type === "form" ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      <span>A4 Document</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <FileSpreadsheet className="w-3 h-3" />
                      <span>Excel View</span>
                    </span>
                  )}
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="text-sm font-bold text-ink group-hover:text-accent transition-colors line-clamp-1">
                    {rep.name}
                  </h3>
                  <p className="text-[11px] font-medium text-ink-muted mt-0.5 line-clamp-1">
                    {rep.nameKm}
                  </p>
                </div>

                <p className="text-xs text-ink-secondary line-clamp-2 leading-relaxed">
                  {lang === "km" ? rep.descriptionKm : rep.description}
                </p>
              </div>

              {/* Card Footer: Metadata & Action CTA */}
              <div className="mt-5 pt-3 border-t border-subtle/80 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] text-ink-muted font-medium">
                  {rep.type === "form" ? (
                    <span>A4 Canvas Layout</span>
                  ) : (
                    <span>{rep.columns.length} Configured Columns</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectReport(rep);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-sunken group-hover:bg-accent group-hover:text-white border border-subtle group-hover:border-accent text-xs font-bold text-ink transition-all flex items-center gap-1 shadow-2xs"
                >
                  <Sliders className="w-3 h-3" />
                  <span>{lang === "km" ? "កែតម្រូវ" : "Design"}</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredReports.length === 0 && (
        <div className="text-center py-16 rounded-3xl border border-dashed border-subtle bg-surface/50 space-y-3">
          <Search className="w-8 h-8 text-ink-muted mx-auto" />
          <h3 className="text-base font-bold text-ink">
            {lang === "km" ? "រកមិនឃើញរបាយការណ៍ណាត្រូវនឹងការស្វែងរកឡើយ" : "No reports match your filters"}
          </h3>
          <p className="text-xs text-ink-muted max-w-sm mx-auto">
            {lang === "km" ? "សូមសាកល្បងសម្អាតពាក្យគន្លឹះ ឬប្តូរប្រភេទរបាយការណ៍ផ្សេងទៀត។" : "Try clearing your search query or selecting a different category."}
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory("all");
              setSelectedFormat("all");
              setSearchQuery("");
            }}
            className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold cursor-pointer hover:opacity-90 transition shadow-xs"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
}
