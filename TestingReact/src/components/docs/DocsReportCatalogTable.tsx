"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  ExternalLink,
  FileSpreadsheet,
  Printer,
  Database,
  HelpCircle,
  Briefcase,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  TableProperties,
  BookmarkCheck,
} from "lucide-react";
import { ALL_REPORTS, REPORT_CATEGORIES } from "@/services/reportCatalog";
import { useDocsText } from "./useDocsText";
import { useDocsTheme } from "./DocsThemeContext";

interface DocsReportCatalogTableProps {
  filterCategory?: "operations" | "diagnostics" | "kpis" | "sales" | "stock" | "all";
}

export default function DocsReportCatalogTable({ filterCategory = "all" }: DocsReportCatalogTableProps) {
  const { isKhmer } = useDocsText();
  const { isDark } = useDocsTheme();
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>(filterCategory === "all" ? "all" : filterCategory);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(ALL_REPORTS.map((r) => r.id)));
  const [showAllDetails, setShowAllDetails] = useState(true);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllDetails = () => {
    if (showAllDetails) {
      setExpandedIds(new Set());
      setShowAllDetails(false);
    } else {
      setExpandedIds(new Set(ALL_REPORTS.map((r) => r.id)));
      setShowAllDetails(true);
    }
  };

  React.useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (!hash) return;
      const sub = hash.includes("--") ? hash.split("--")[1] : hash;
      const rep = ALL_REPORTS.find((r) => r.id === sub || `report-${r.id}` === sub);
      if (rep) {
        setExpandedIds((prev) => new Set([...prev, rep.id]));
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const filtered = useMemo(() => {
    return ALL_REPORTS.filter((r) => {
      const matchCat = selectedCat === "all" || r.category === selectedCat;
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.nameKm.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.descriptionKm.toLowerCase().includes(q) ||
        r.databaseSource.toLowerCase().includes(q) ||
        r.databaseSourceKm.toLowerCase().includes(q) ||
        r.businessPurpose.toLowerCase().includes(q) ||
        r.businessPurposeKm.toLowerCase().includes(q) ||
        (r.exampleKm && r.exampleKm.toLowerCase().includes(q)) ||
        (r.exampleEn && r.exampleEn.toLowerCase().includes(q)) ||
        (r.columnsExplanationKm && r.columnsExplanationKm.some((c) => c.toLowerCase().includes(q))) ||
        (r.columnsExplanationEn && r.columnsExplanationEn.some((c) => c.toLowerCase().includes(q))) ||
        (r.href && r.href.toLowerCase().includes(q));

      return matchCat && matchSearch;
    });
  }, [selectedCat, search]);

  return (
    <div className={`my-6 overflow-hidden rounded-2xl border p-4 backdrop-blur-sm sm:p-5 transition-colors ${isDark ? "border-white/10 bg-[#080a14] shadow-xl" : "border-slate-200 bg-white text-slate-800 shadow-lg"}`}>
      {/* Header & Controls */}
      <div className={`flex flex-col gap-4 border-b pb-5 md:flex-row md:items-center md:justify-between ${isDark ? "border-white/10" : "border-slate-200"}`}>
        <div>
          <div className="flex items-center gap-2">
            <span className={`flex h-7 w-7 items-center justify-center rounded-lg border ${isDark ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-emerald-600 bg-emerald-50 text-emerald-700"}`}>
              <FileSpreadsheet className="h-4 w-4" />
            </span>
            <h4 className={`text-base font-bold sm:text-lg ${isDark ? "text-white" : "text-slate-900"}`}>
              {isKhmer
                ? "តារាងពន្យល់អត្ថន័យ ជួរឈរ (Columns) & ឧទាហរណ៍ជាក់ស្តែងលើរបាយការណ៍ទាំង ២៩"
                : "Master 29 Enterprise Reports Table with Columns Breakdown & Real-World Examples"}
            </h4>
          </div>
          <p className={`mt-1 text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>
            {isKhmer
              ? `បង្ហាញ ${filtered.length} ក្នុងចំណោម ២៩ របាយការណ៍សរុប (❓ គោលបំណង + 📋 ពន្យល់ជួរឈរជាត្រេ + 💡 ឧទាហរណ៍សាមញ្ញៗ)`
              : `Showing ${filtered.length} of 29 reports with purpose question, column explanations, and practical scenarios`}
          </p>
        </div>

        {/* Search & Toggle Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={toggleAllDetails}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${isDark ? "border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20" : "border-violet-600 bg-violet-50 text-violet-700 hover:bg-violet-100"}`}
          >
            <TableProperties className={`h-3.5 w-3.5 ${isDark ? "text-violet-400" : "text-violet-700"}`} />
            <span>
              {showAllDetails
                ? isKhmer
                  ? "បង្រួមព័ត៌មានលម្អិត"
                  : "Collapse Details"
                : isKhmer
                ? "បង្ហាញគ្រប់ព័ត៌មាន & ជួរឈរ"
                : "Expand All Details"}
            </span>
          </button>

          <div className="relative w-full sm:w-72">
            <Search className={`absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? "text-slate-400" : "text-slate-600"}`} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isKhmer ? "ស្វែងរករបាយការណ៍, ជួរឈរ, ឧទាហរណ៍..." : "Search reports, columns, examples..."}
              className={`w-full rounded-xl border py-2 pl-9 pr-3 text-xs focus:outline-none ${isDark ? "border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500 focus:border-violet-400" : "border-slate-500 bg-slate-50 text-slate-900 placeholder:text-slate-600 focus:border-violet-600"}`}
            />
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="my-4 flex flex-wrap gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setSelectedCat("all")}
          className={`cursor-pointer rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
            selectedCat === "all"
              ? "bg-violet-600 text-white"
              : isDark ? "border border-white/10 bg-white/[0.02] text-slate-400 hover:text-white" : "border border-slate-200 bg-slate-100 text-slate-600 hover:text-slate-900"
          }`}
        >
          {isKhmer ? "ទាំងអស់ (២៩)" : "All (29)"}
        </button>

        {REPORT_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCat(cat.id)}
            className={`cursor-pointer rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
              selectedCat === cat.id
                ? "bg-violet-600 text-white"
                : isDark ? "border border-white/10 bg-white/[0.02] text-slate-400 hover:text-white" : "border border-slate-200 bg-slate-100 text-slate-600 hover:text-slate-900"
            }`}
          >
            {isKhmer ? `${cat.nameKm} (${cat.count})` : `${cat.name} (${cat.count})`}
          </button>
        ))}
      </div>

      {/* Full Detailed Table */}
      <div className={`overflow-x-auto rounded-xl border ${isDark ? "border-white/5" : "border-slate-200"}`}>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className={`border-b text-[11px] font-bold uppercase tracking-wider ${isDark ? "border-white/10 bg-white/[0.03] text-slate-400" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
              <th className="py-3 px-3 w-10 text-center">#</th>
              <th className="py-3 px-3 min-w-[150px]">{isKhmer ? "ឈ្មោះរបាយការណ៍ & Route" : "Report Name & Route"}</th>
              <th className="py-3 px-3 min-w-[160px]">
                <div className={`flex items-center gap-1.5 ${isDark ? "text-cyan-400" : "text-cyan-700"}`}>
                  <Database className="h-3.5 w-3.5" />
                  <span>{isKhmer ? "ទិន្នន័យទាញពី Database" : "Database Data Source"}</span>
                </div>
              </th>
              <th className="py-3 px-3 min-w-[180px]">
                <div className={`flex items-center gap-1.5 ${isDark ? "text-emerald-400" : "text-emerald-700"}`}>
                  <Briefcase className="h-3.5 w-3.5" />
                  <span>{isKhmer ? "គោលបំណងប្រើប្រាស់" : "Business Purpose"}</span>
                </div>
              </th>
              <th className="py-3 px-3 text-center w-24">{isKhmer ? "ទម្រង់" : "Format"}</th>
              <th className="py-3 px-3 text-center w-20">{isKhmer ? "បើក" : "Open"}</th>
            </tr>
          </thead>
          <tbody className={`divide-y font-sans ${isDark ? "divide-white/5" : "divide-slate-200"}`}>
            {filtered.map((rep, idx) => {
              const isExpanded = expandedIds.has(rep.id);
              const exampleText = isKhmer ? rep.exampleKm : rep.exampleEn;
              const columnExps = isKhmer ? rep.columnsExplanationKm : rep.columnsExplanationEn;
              const purposeText = isKhmer ? rep.businessPurposeKm : rep.businessPurpose;
              const noteText = isKhmer ? rep.noteKm : rep.noteEn;

              return (
                <React.Fragment key={rep.id}>
                  <tr
                    id={rep.id}
                    data-report-id={rep.id}
                    className={`transition-colors scroll-mt-28 ${isDark ? "hover:bg-white/[0.02]" : "hover:bg-slate-50"}`}
                  >
                    <td className={`py-3.5 px-3 text-center font-mono align-top pt-4 ${isDark ? "text-slate-500" : "text-slate-600"}`}>
                      <span id={`report-${rep.id}`} className="sr-only" />
                      {idx + 1}
                    </td>
                    <td className="py-3.5 px-4 align-top">
                      <div className={`font-bold text-[13px] ${isDark ? "text-white" : "text-slate-900"}`}>{isKhmer ? rep.nameKm : rep.name}</div>
                      <div className={`text-[11px] font-mono mt-0.5 ${isDark ? "text-violet-400" : "text-violet-700"}`}>{rep.href || "/templates-settings"}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={`inline-block rounded border px-1.5 py-0.2 text-[9px] font-semibold ${isDark ? "border-violet-500/30 bg-violet-500/10 text-violet-300" : "border-violet-600 bg-violet-50 text-violet-700"}`}>
                          {isKhmer ? rep.categoryNameKm : rep.categoryName}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleExpand(rep.id)}
                          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.2 text-[9px] font-semibold transition-colors ${isDark ? "border-white/10 bg-white/[0.05] text-slate-300 hover:border-violet-400 hover:text-white" : "border-slate-300 bg-slate-100 text-slate-700 hover:border-violet-600 hover:text-violet-700"}`}
                        >
                          <TableProperties className={`h-2.5 w-2.5 ${isDark ? "text-violet-400" : "text-violet-700"}`} />
                          <span>{isExpanded ? (isKhmer ? "បង្រួម" : "Hide") : (isKhmer ? "ពន្យល់ជួរឈរ & ឧទាហរណ៍" : "View Columns & Example")}</span>
                          {isExpanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                        </button>
                      </div>
                    </td>
                    <td className={`py-3.5 px-4 leading-relaxed text-[12px] align-top ${isDark ? "text-slate-300 bg-cyan-950/5" : "text-slate-700 bg-cyan-50/60"}`}>
                      {isKhmer ? rep.databaseSourceKm : rep.databaseSource}
                    </td>
                    <td className={`py-3.5 px-4 leading-relaxed text-[12px] align-top ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      {purposeText}
                    </td>
                    <td className="py-3.5 px-3 text-center align-top pt-4">
                      {rep.type === "form" ? (
                        <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold ${isDark ? "bg-amber-500/10 border-amber-500/30 text-amber-300" : "bg-amber-50 border-amber-600 text-amber-800"}`}>
                          <Printer className="h-3 w-3" /> A4 Form
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold ${isDark ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-emerald-50 border-emerald-600 text-emerald-700"}`}>
                          <FileSpreadsheet className="h-3 w-3" /> Excel Grid
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center align-top pt-4">
                      {rep.href ? (
                        <Link
                          href={rep.href}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${isDark ? "border-white/10 bg-white/[0.04] text-violet-300 hover:border-violet-400 hover:bg-violet-500/20 hover:text-white" : "border-slate-300 bg-white text-violet-700 hover:border-violet-600 hover:bg-violet-50 hover:text-violet-800"}`}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <span className={`text-xs ${isDark ? "text-slate-600" : "text-slate-500"}`}>—</span>
                      )}
                    </td>
                  </tr>

                  {/* Expandable Intelligence Card: ❓ Question + 📋 Columns + 💡 Example */}
                  {isExpanded && (
                    <tr className={`bg-gradient-to-r from-violet-500/[0.03] via-amber-500/[0.02] to-transparent border-b ${isDark ? "border-white/5" : "border-slate-200"}`}>
                      <td colSpan={6} className="py-3.5 px-4 pl-6 sm:pl-10">
                        <div className={`space-y-3 rounded-2xl border p-4 shadow-xl ${isDark ? "border-white/10 bg-[#090d1c]" : "border-slate-200 bg-slate-50/80"}`}>
                          {/* 1. ❓ របាយការណ៍នេះប្រើដើម្បីអ្វី? */}
                          <div className={`rounded-xl border p-3.5 ${isDark ? "border-cyan-500/30 bg-cyan-950/20" : "border-cyan-600 bg-cyan-50/90 text-cyan-950"}`}>
                            <div className={`flex items-center gap-1.5 text-xs font-bold mb-1.5 ${isDark ? "text-cyan-300" : "text-cyan-800"}`}>
                              <HelpCircle className={`h-4 w-4 shrink-0 ${isDark ? "text-cyan-400" : "text-cyan-700"}`} />
                              <span>{isKhmer ? "❓ របាយការណ៍នេះប្រើដើម្បីអ្វី?" : "❓ What is this report used for?"}</span>
                            </div>
                            <p className={`text-xs leading-relaxed pl-5 border-l-2 font-medium ${isDark ? "border-cyan-500/40 text-slate-200" : "border-cyan-600 text-slate-800"}`}>
                              {purposeText}
                            </p>
                          </div>

                          {/* 1.1 📌 ចំណាំសំខាន់អំពីការទាញទិន្នន័យ (ប្រសិនបើមាន) */}
                          {noteText && (
                            <div className={`rounded-xl border p-3.5 shadow-sm ${isDark ? "border-sky-500/35 bg-sky-950/25" : "border-sky-600 bg-sky-50/90 text-sky-950"}`}>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <BookmarkCheck className={`h-4 w-4 shrink-0 ${isDark ? "text-sky-400" : "text-sky-700"}`} />
                                <span className={`text-xs font-bold ${isDark ? "text-sky-300" : "text-sky-800"}`}>
                                  {isKhmer ? "📌 ចំណាំសំខាន់អំពីរបាយការណ៍នេះ ៖" : "📌 Important Note:"}
                                </span>
                              </div>
                              <div className={`text-xs leading-relaxed whitespace-pre-line break-words pl-3 border-l-2 font-medium ${isDark ? "border-sky-500/40 text-sky-100" : "border-sky-600 text-sky-950"}`}>
                                {noteText}
                              </div>
                            </div>
                          )}

                          {/* 2. 📋 ពន្យល់ជួរឈរ (Columns) ៖ */}
                          {columnExps && columnExps.length > 0 && (
                            <div className={`rounded-xl border p-3.5 ${isDark ? "border-violet-500/25 bg-violet-950/20" : "border-violet-600 bg-violet-50/90 text-violet-950"}`}>
                              <div className={`flex items-center gap-1.5 text-xs font-bold mb-2 ${isDark ? "text-violet-300" : "text-violet-800"}`}>
                                <TableProperties className={`h-4 w-4 shrink-0 ${isDark ? "text-violet-400" : "text-violet-700"}`} />
                                <span>{isKhmer ? "📋 ពន្យល់ជួរឈរ (Columns) ៖" : "📋 Columns Breakdown:"}</span>
                              </div>
                              <div className={`grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-1.5 text-xs leading-relaxed pl-2 ${isDark ? "text-slate-300" : "text-slate-800"}`}>
                                {columnExps.map((colExp, cIdx) => (
                                  <div key={cIdx} className="flex items-start gap-1.5 py-0.5">
                                    <span className={`font-bold shrink-0 mt-0.5 ${isDark ? "text-violet-400" : "text-violet-700"}`}>•</span>
                                    <span className="leading-relaxed">{colExp.replace(/^•\s*/, "")}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 3. 💡 ឧទាហរណ៍ ៖ */}
                          {exampleText && (
                            <div className={`rounded-xl border p-3.5 shadow-md ${isDark ? "border-amber-500/35 bg-[#0d1222]" : "border-amber-600 bg-amber-50/90"}`}>
                              <div className="flex items-center gap-1.5 mb-2">
                                <Lightbulb className={`h-4 w-4 shrink-0 ${isDark ? "text-amber-400" : "text-amber-700"}`} />
                                <span className={`text-xs font-bold ${isDark ? "text-amber-300" : "text-amber-800"}`}>
                                  {isKhmer ? "💡 ឧទាហរណ៍ ៖" : "💡 Example Scenario:"}
                                </span>
                              </div>
                              <div className={`text-[12.5px] leading-relaxed whitespace-pre-line break-words pl-3 border-l-2 ${isDark ? "border-amber-500/40 text-amber-100/95" : "border-amber-600 text-amber-950 font-medium"}`}>
                                {exampleText}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
