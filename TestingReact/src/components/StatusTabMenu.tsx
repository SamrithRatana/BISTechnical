"use client";

import React from "react";
import { useI18n } from "@/i18n/LanguageProvider";
import type { TranslationKey } from "@/i18n/translations";

// ─────────────────────────────────────────────────────────────────────────────
// StatusTabMenu — matches old StatusTabMenu.razor exactly
// Renders a horizontal pill-tab strip with live count badges.
// Usage:
//   <StatusTabMenu
//     tabs={[{ key: "All", labelKey: "status.received", count: 42 }, ...]}
//     activeKey="All"
//     onTabChange={(key) => setFilter(key)}
//   />
// ─────────────────────────────────────────────────────────────────────────────

export interface TabItem {
  /** Backend status string — identity, never translated. */
  key: string;
  /**
   * Translated here rather than by the caller so every page can keep
   * declaring its tabs as a plain module-level const, with no hook or
   * useMemo of its own just to localise a label.
   */
  labelKey: TranslationKey;
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

/**
 * The `color` prop names a hue; Aura Velvet works in meanings. This maps one to
 * the other in a single place, so a tab keeps saying what it said before —
 * "rejected" stays a danger tone — without any caller having to be rewritten.
 */
const TAB_TONE: Record<string, string> = {
  blue: "bg-info text-white",
  cyan: "bg-info text-white",
  amber: "bg-warning text-white",
  emerald: "bg-success text-white",
  rose: "bg-danger text-white",
  purple: "bg-accent text-accent-fg",
  slate: "bg-neutral text-white",
};

export default function StatusTabMenu({
  tabs,
  activeKey,
  onTabChange,
  loading = false,
}: StatusTabMenuProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const isActive = activeKey === tab.key;
        const activeCls = TAB_TONE[tab.color ?? "blue"] ?? TAB_TONE.blue;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              if (!isActive) onTabChange(tab.key);
            }}
            className={`
              inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold
              transition-colors duration-150 ease-out whitespace-nowrap select-none
              ${
                isActive
                  ? `${activeCls} shadow-soft-sm`
                  : "bg-surface text-ink-secondary border border-subtle hover:bg-cushion hover:text-ink"
              }
            `}
          >
            {t(tab.labelKey)}
            {tab.count !== undefined && (
              <span
                className={`
                  inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5
                  rounded-full text-[10px] font-bold leading-none
                  ${loading ? "animate-pulse" : ""}
                  ${isActive ? "bg-white/25 text-white" : "bg-sunken text-ink-secondary"}
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
