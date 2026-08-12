"use client";

import React from "react";

// ─────────────────────────────────────────────────────────────────────────────
// StatusTabMenu — matches old StatusTabMenu.razor exactly
// Renders a horizontal pill-tab strip with live count badges.
// Usage:
//   <StatusTabMenu
//     tabs={[{ key: "All", label: "All", count: 42 }, ...]}
//     activeKey="All"
//     onTabChange={(key) => setFilter(key)}
//   />
// ─────────────────────────────────────────────────────────────────────────────

export interface TabItem {
  key: string;
  label: string;
  count?: number;
  /** Optional colour accent override (default: blue) */
  color?: "blue" | "amber" | "emerald" | "rose" | "purple" | "cyan" | "slate";
}

interface StatusTabMenuProps {
  tabs: TabItem[];
  activeKey: string;
  onTabChange: (key: string) => void;
  /** Show a subtle loading pulse on counts while data is fetching */
  loading?: boolean;
}

const ACCENT_ACTIVE: Record<string, string> = {
  blue:    "bg-blue-600 text-white shadow-sm shadow-blue-500/30",
  amber:   "bg-amber-500 text-white shadow-sm shadow-amber-500/30",
  emerald: "bg-emerald-600 text-white shadow-sm shadow-emerald-500/30",
  rose:    "bg-rose-600 text-white shadow-sm shadow-rose-500/30",
  purple:  "bg-purple-600 text-white shadow-sm shadow-purple-500/30",
  cyan:    "bg-cyan-600 text-white shadow-sm shadow-cyan-500/30",
  slate:   "bg-slate-600 text-white shadow-sm",
};

export default function StatusTabMenu({
  tabs,
  activeKey,
  onTabChange,
  loading = false,
}: StatusTabMenuProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tabs.map((tab) => {
        const isActive = activeKey === tab.key;
        const color = tab.color ?? "blue";

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              if (!isActive) onTabChange(tab.key);
            }}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
              transition-all duration-150 whitespace-nowrap select-none
              ${
                isActive
                  ? ACCENT_ACTIVE[color]
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              }
            `}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`
                  inline-flex items-center justify-center min-w-[18px] h-[18px] px-1
                  rounded-full text-[10px] font-bold leading-none
                  ${loading ? "animate-pulse" : ""}
                  ${
                    isActive
                      ? "bg-white/25 text-white"
                      : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                  }
                `}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
