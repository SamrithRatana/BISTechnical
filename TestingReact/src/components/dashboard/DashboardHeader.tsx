"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  SlidersHorizontal,
  Plus,
  RotateCcw,
  Eye,
  EyeOff,
  Check,
  LayoutDashboard,
  Wrench,
  Package,
  Kanban,
  Tv,
  ChevronRight,
  Briefcase,
  Receipt,
  TrendingUp,
  Users,
  Clock,
  FileSpreadsheet,
  X,
} from "lucide-react";
import { useDashboard } from "./useDashboardStore";
import { DashboardViewMode } from "./types";
import { VIEW_MODES_CONFIG } from "./widgetRegistry";
import { useI18n } from "@/i18n/LanguageProvider";
import { getCurrentUserFullName } from "@/services/userService";

interface CategoryPill {
  id: string;
  labelEn: string;
  labelKm: string;
  icon: React.ElementType;
  bgCircle: string;
  viewTarget?: DashboardViewMode;
  href?: string;
}

const CATEGORY_PILLS: CategoryPill[] = [
  {
    id: "overview",
    labelEn: "General & Accounts",
    labelKm: "ទូទៅ & គណនី",
    icon: Briefcase,
    bgCircle: "bg-emerald-600 text-white",
    viewTarget: "overview",
  },
  {
    id: "technician",
    labelEn: "Technician Work",
    labelKm: "ការងារជាង",
    icon: Wrench,
    bgCircle: "bg-teal-700 text-white",
    viewTarget: "technician",
  },
  {
    id: "inventory",
    labelEn: "Stock & Inventory",
    labelKm: "ការងារស្តុក",
    icon: Package,
    bgCircle: "bg-blue-600 text-white",
    viewTarget: "inventory",
  },
  {
    id: "sales",
    labelEn: "Sales & CRM",
    labelKm: "ការងារផ្នែកលក់",
    icon: TrendingUp,
    bgCircle: "bg-amber-600 text-white",
    viewTarget: "sales",
  },
  {
    id: "kanban",
    labelEn: "Kanban Board",
    labelKm: "ក្ដា kanban",
    icon: Kanban,
    bgCircle: "bg-indigo-600 text-white",
    viewTarget: "kanban",
  },
  {
    id: "customer",
    labelEn: "Customer Hub",
    labelKm: "មជ្ឍមណ្ឌលអតិថិជន",
    icon: Users,
    bgCircle: "bg-cyan-700 text-white",
    href: "/customers",
  },
];

export default function DashboardHeader() {
  const {
    activeView,
    setActiveView,
    isCustomizing,
    setIsCustomizing,
    isPrivacyMode,
    togglePrivacyMode,
    setIsAddModalOpen,
    resetCurrentView,
    saveLayout,
    showCreateActions,
    toggleCreateActions,
  } = useDashboard();
  const { t, lang } = useI18n();

  // Dynamic time greeting like QuickBooks
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return lang === "km" ? "អរុណសួស្តី!" : "Good morning!";
    } else if (hour < 18) {
      return lang === "km" ? "ទិវាសួស្តី!" : "Good afternoon!";
    } else {
      return lang === "km" ? "សាយ័ណ្ហសួស្តី!" : "Good evening!";
    }
  }, [lang]);

  return (
    <div className="space-y-3.5">
      {/* ── 1. QuickBooks Greeting Bar & Privacy Toggle ────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        {/* Left: Greeting Title */}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
            {greeting}
          </h1>
          {isCustomizing && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse">
              {lang === "km" ? "កំពុងកែសម្រួល Dashboard" : "Customizing Layout"}
            </span>
          )}
        </div>

        {/* Right: QuickBooks-style Privacy & Customize controls */}
        <div className="flex items-center gap-2 select-none">
          {/* QuickBooks-style Privacy button */}
          <button
            type="button"
            onClick={togglePrivacyMode}
            title={isPrivacyMode ? "Privacy Mode ON (Masked)" : "Enable Privacy Mode"}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isPrivacyMode
                ? "text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/40 border border-purple-200 dark:border-purple-800 shadow-2xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            {isPrivacyMode ? (
              <EyeOff className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            ) : (
              <Eye className="w-4 h-4 text-zinc-500" />
            )}
            <span className="hidden sm:inline">
              {isPrivacyMode
                ? lang === "km"
                  ? "លាក់ព័ត៌មានសម្ងាត់ (Privacy ON)"
                  : "Privacy ON"
                : lang === "km"
                ? "ភាពឯកជន (Privacy)"
                : "Privacy"}
            </span>
          </button>

          {/* Customize Mode Toggle / Save Controls */}
          {isCustomizing ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 flex items-center gap-1.5 shadow-2xs transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="hidden sm:inline">
                  {lang === "km" ? "បន្ថែម Widgets" : "Add Widgets"}
                </span>
              </button>

              <button
                type="button"
                onClick={toggleCreateActions}
                title={
                  showCreateActions
                    ? "Hide Action Shortcuts Bar"
                    : "Show Action Shortcuts Bar"
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all shadow-2xs ${
                  showCreateActions
                    ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                    : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                }`}
              >
                <span>
                  {lang === "km"
                    ? showCreateActions
                      ? "✓ របារសកម្មភាព (បើក)"
                      : "+ របារសកម្មភាព"
                    : showCreateActions
                    ? "✓ Action Bar (ON)"
                    : "+ Action Bar"}
                </span>
              </button>

              <button
                type="button"
                onClick={resetCurrentView}
                title="Reset layout for this view"
                className="p-1.5 rounded-lg bg-white dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={saveLayout}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs flex items-center gap-1.5 transition-all"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>{lang === "km" ? "រក្សាទុក" : "Done"}</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsCustomizing(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 flex items-center gap-1.5 transition-all"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {lang === "km" ? "រៀបចំផ្ទាំង (Customize)" : "Customize"}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ── 2. QuickBooks Category Pills Navigation ───────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {CATEGORY_PILLS.map((pill) => {
          const Icon = pill.icon;
          const isSelected = pill.viewTarget && activeView === pill.viewTarget;
          const label = lang === "km" ? pill.labelKm : pill.labelEn;

          if (pill.href) {
            return (
              <Link
                key={pill.id}
                href={pill.href}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-all whitespace-nowrap shrink-0 shadow-2xs"
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${pill.bgCircle}`}
                >
                  <Icon className="w-3 h-3 stroke-[2.5]" />
                </div>
                <span>{label}</span>
              </Link>
            );
          }

          return (
            <button
              key={pill.id}
              type="button"
              onClick={() => pill.viewTarget && setActiveView(pill.viewTarget)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
                isSelected
                  ? "border-zinc-900 dark:border-white bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs"
                  : "border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 shadow-2xs"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  isSelected ? "bg-white/20 text-current" : pill.bgCircle
                }`}
              >
                <Icon className="w-3 h-3 stroke-[2.5]" />
              </div>
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── 3. QuickBooks "Create Actions" Shortcuts Row (Hidden by default) ── */}
      {showCreateActions && (
        <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar text-xs border-b border-zinc-200/60 dark:border-zinc-800/80 pb-3 animate-in fade-in duration-150">
          <span className="font-bold text-zinc-900 dark:text-white whitespace-nowrap pr-1">
            {lang === "km" ? "បង្កើតសកម្មភាព" : "Create actions"}
          </span>

          <Link
            href="/receive-item"
            className="px-3 py-1 rounded-full border border-zinc-300/80 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 whitespace-nowrap transition-colors"
          >
            {lang === "km" ? "+ ទទួលម៉ាស៊ីន (Receive)" : "+ Receive item"}
          </Link>

          <Link
            href="/service-tickets"
            className="px-3 py-1 rounded-full border border-zinc-300/80 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 whitespace-nowrap transition-colors"
          >
            {lang === "km" ? "+ បង្កើតសំបុត្រ (New Ticket)" : "+ Create ticket"}
          </Link>

          <Link
            href="/spareparts"
            className="px-3 py-1 rounded-full border border-zinc-300/80 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 whitespace-nowrap transition-colors"
          >
            {lang === "km" ? "+ ស្តុកគ្រឿងបន្លាស់ (Spare Part)" : "+ Spare parts"}
          </Link>

          <Link
            href="/approve-repair"
            className="px-3 py-1 rounded-full border border-zinc-300/80 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 whitespace-nowrap transition-colors"
          >
            {lang === "km" ? "+ អនុម័តជួសជុល (Approve)" : "+ Approve repair"}
          </Link>

          <Link
            href="/monthly-technical-matrix"
            className="px-3 py-1 rounded-full border border-zinc-300/80 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 whitespace-nowrap transition-colors"
          >
            {lang === "km" ? "+ ម៉ាទ្រីសសេវាកម្ម (Matrix)" : "+ Services matrix"}
          </Link>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="text-blue-600 dark:text-blue-400 font-semibold hover:underline whitespace-nowrap ml-1.5"
          >
            {lang === "km" ? "បង្ហាញទាំងអស់ (Show all)" : "Show all"}
          </button>

          <button
            type="button"
            onClick={toggleCreateActions}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 ml-auto transition-colors"
            title={lang === "km" ? "លាក់របារនេះ" : "Hide this bar"}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── 4. QuickBooks "Business at a glance" Sub-Heading ───────────────── */}
      <div className="flex items-center justify-between pt-0.5">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
            {lang === "km" ? "ទិដ្ឋភាពអាជីវកម្ម (Business at a glance)" : "Business at a glance"}
          </h2>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {lang === "km"
              ? VIEW_MODES_CONFIG[activeView]?.descriptionKm || t("dash.ticketVolumeHint")
              : VIEW_MODES_CONFIG[activeView]?.description || t("dash.ticketVolumeHint")}
          </p>
        </div>
      </div>
    </div>
  );
}
