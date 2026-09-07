"use client";

import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Search,
  Check,
  Plus,
  Layers,
} from "lucide-react";
import { useDashboard } from "./useDashboardStore";
import { WIDGET_REGISTRY, CATEGORIES_META } from "./widgetRegistry";
import { DashboardWidgetId, WidgetCategory } from "./types";
import { useI18n } from "@/i18n/LanguageProvider";

export default function AddWidgetModal() {
  const {
    isAddModalOpen,
    setIsAddModalOpen,
    activeView,
    allWidgetsForActiveView,
    toggleWidgetVisibility,
    resetCurrentView,
  } = useDashboard();
  const { lang } = useI18n();

  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<WidgetCategory | "all">("all");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!isAddModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isAddModalOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isAddModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsAddModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAddModalOpen, setIsAddModalOpen]);

  const visibilityMap = useMemo(() => {
    const map = new Map<DashboardWidgetId, boolean>();
    allWidgetsForActiveView.forEach((w) => {
      map.set(w.id, w.visible);
    });
    return map;
  }, [allWidgetsForActiveView]);

  const visibleCount = useMemo(() => {
    return allWidgetsForActiveView.filter((w) => w.visible).length;
  }, [allWidgetsForActiveView]);

  const allWidgets = useMemo(() => {
    return Object.values(WIDGET_REGISTRY).filter(
      (w) => activeView === "overview" || w.id !== "service_table"
    );
  }, [activeView]);

  const filteredWidgets = useMemo(() => {
    return allWidgets.filter((w) => {
      const matchesCat =
        selectedCategory === "all" || w.category === selectedCategory;
      if (!matchesCat) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        w.title.toLowerCase().includes(term) ||
        (w.titleKm && w.titleKm.toLowerCase().includes(term)) ||
        w.description.toLowerCase().includes(term) ||
        (w.descriptionKm && w.descriptionKm.toLowerCase().includes(term))
      );
    });
  }, [allWidgets, selectedCategory, searchTerm]);

  if (!isAddModalOpen || !mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        lang === "km"
          ? "បន្ថែម ឬលាក់ផ្ទាំងព័ត៌មាន (Widgets)"
          : "Customize & Add Dashboard Widgets"
      }
      className="fixed inset-0 z-[99999] overflow-y-auto overscroll-contain"
    >
      {/* High-contrast dark backdrop */}
      <div
        className="fixed inset-0 bg-zinc-950/70 backdrop-blur-md transition-opacity duration-200"
        onClick={() => setIsAddModalOpen(false)}
        aria-hidden="true"
      />

      {/* Centering wrapper: guarantees dead-center alignment on viewport without clipping top */}
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4 md:p-6 pointer-events-none">
        {/* Modal Container */}
        <div
          className="relative w-full max-w-3xl max-h-[86vh] flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden pointer-events-auto z-10 animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/50">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                  {lang === "km"
                    ? "បន្ថែម ឬលាក់ផ្ទាំងព័ត៌មាន (Widgets)"
                    : "Customize & Add Dashboard Widgets"}
                </h2>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {lang === "km"
                  ? "ជ្រើសរើស Widgets ណាដែលអ្នកចង់បង្ហាញ (Widget ថ្មីនឹងបន្ថែមនៅក្រោមគេ)"
                  : "Select which widgets appear on your dashboard (New widgets append to the bottom)"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

        {/* Filter bar: Search & Category Tabs */}
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 space-y-3 bg-zinc-50/30 dark:bg-zinc-900/30">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                lang === "km"
                  ? "ស្វែងរកផ្ទាំង widget..."
                  : "Search widgets by title or topic..."
              }
              className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-white placeholder:text-zinc-400"
            />
          </div>

          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedCategory === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              {lang === "km" ? "ទាំងអស់" : "All Categories"}
            </button>
            {(Object.keys(CATEGORIES_META) as WidgetCategory[]).map((cat) => {
              const catMeta = CATEGORIES_META[cat];
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                    isSelected
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  {lang === "km" ? catMeta.labelKm : catMeta.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Widgets Grid List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {filteredWidgets.length === 0 ? (
            <div className="text-center py-12 text-zinc-400 text-sm">
              {lang === "km"
                ? "រកមិនឃើញ Widget ដែលត្រូវគ្នានឹងការស្វែងរកឡើយ"
                : "No matching widgets found"}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredWidgets.map((widget) => {
                const isVisible = visibilityMap.get(widget.id) ?? false;
                const title =
                  lang === "km"
                    ? widget.titleKm || widget.title
                    : widget.title;
                const desc =
                  lang === "km"
                    ? widget.descriptionKm || widget.description
                    : widget.description;

                return (
                  <div
                    key={widget.id}
                    onClick={() => toggleWidgetVisibility(widget.id)}
                    className={`relative p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between select-none ${
                      isVisible
                        ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/60 shadow-xs"
                        : "bg-zinc-50/50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-xs transition-colors ${
                              isVisible
                                ? "bg-blue-600 text-white"
                                : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"
                            }`}
                          >
                            {isVisible ? (
                              <Check className="w-3 h-3 stroke-[3]" />
                            ) : (
                              <Plus className="w-3 h-3" />
                            )}
                          </span>
                          <h4 className="font-semibold text-sm text-zinc-900 dark:text-white">
                            {title}
                          </h4>
                        </div>
                        {widget.badge && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                            {lang === "km"
                              ? widget.badgeKm || widget.badge
                              : widget.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 pl-7">
                        {desc}
                      </p>
                    </div>

                    <div className="mt-3 pl-7 flex items-center justify-between text-[11px] text-zinc-400">
                      <span>
                        {widget.defaultColSpan === 4
                          ? "Full Width"
                          : `${widget.defaultColSpan}x Column`}
                      </span>
                      <span
                        className={`font-medium ${
                          isVisible
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-zinc-400"
                        }`}
                      >
                        {isVisible
                          ? lang === "km"
                            ? "កំពុងបង្ហាញ (ចុចដើម្បីលាក់)"
                            : "Active (Click to hide)"
                          : lang === "km"
                          ? "+ បន្ថែមនៅក្រោមគេ"
                          : "+ Add to bottom"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <button
            type="button"
            onClick={resetCurrentView}
            className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline font-medium"
          >
            {lang === "km"
              ? "កំណត់ទៅលំនាំដើមវិញ"
              : "Reset to view defaults"}
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(false)}
            className="px-5 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all"
          >
            {lang === "km"
              ? `រួចរាល់ (${visibleCount} កំពុងបង្ហាញ)`
              : `Done (${visibleCount} active)`}
          </button>
        </div>
      </div>
    </div>
  </div>,
  document.body
);
}
