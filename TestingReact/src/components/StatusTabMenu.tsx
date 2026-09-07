"use client";

import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
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
 *
 * Split into `bg`/`fg` (rather than one combined class) because the
 * background now lives on the travelling thumb and the foreground on the
 * button's text — `purple` pairs `bg-accent` with `text-accent-fg`, which is
 * NOT always white (it's near-black against the dark-mode accent), so a
 * blanket `text-white` on every active tab would break that one tone.
 */
const TAB_TONE: Record<string, { bg: string; fg: string }> = {
  blue: { bg: "bg-info", fg: "text-white" },
  cyan: { bg: "bg-info", fg: "text-white" },
  amber: { bg: "bg-warning", fg: "text-white" },
  emerald: { bg: "bg-success", fg: "text-white" },
  rose: { bg: "bg-danger", fg: "text-white" },
  purple: { bg: "bg-accent", fg: "text-accent-fg" },
  slate: { bg: "bg-neutral", fg: "text-white" },
};

function StatusTabMenu({
  tabs,
  activeKey,
  onTabChange,
  loading = false,
}: StatusTabMenuProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [thumb, setThumb] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const activeIndex = tabs.findIndex((tab) => tab.key === activeKey);
  const tone = TAB_TONE[tabs[activeIndex]?.color ?? "blue"] ?? TAB_TONE.blue;

  const measure = useCallback(() => {
    const btn = buttonRefs.current[activeIndex];
    if (!btn) {
      setThumb(null);
      return;
    }
    const next = {
      left: btn.offsetLeft,
      top: btn.offsetTop,
      width: btn.offsetWidth,
      height: btn.offsetHeight,
    };
    setThumb((prev) =>
      prev &&
      prev.left === next.left &&
      prev.top === next.top &&
      prev.width === next.width &&
      prev.height === next.height
        ? prev
        : next
    );
  }, [activeIndex]);

  /**
   * Re-measures after every render, guarded against redundant writes above —
   * unlike `av/ToggleGroup`'s uniform-width pills (positioned as a fraction of
   * the track, no DOM read needed), these tabs vary in width with their label
   * and count badge, so the thumb has to be measured rather than computed.
   * Running on every render (not a dependency array) is what catches a
   * language toggle resizing the label text without changing `activeIndex`.
   */
  useLayoutEffect(() => {
    measure();
  });

  /** Viewport resize reflows `flex-wrap` without triggering a React render. */
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div ref={containerRef} className="relative flex flex-wrap items-center gap-1.5">
      {thumb && (
        <span
          aria-hidden
          className={`absolute rounded-full shadow-soft-sm pointer-events-none ${tone.bg}`}
          style={{
            left: thumb.left,
            top: thumb.top,
            width: thumb.width,
            height: thumb.height,
            transition:
              "left var(--av-dur-base) var(--av-ease), top var(--av-dur-base) var(--av-ease), width var(--av-dur-base) var(--av-ease), height var(--av-dur-base) var(--av-ease), background-color var(--av-dur-base) var(--av-ease)",
          }}
        />
      )}
      {tabs.map((tab, i) => {
        const isActive = activeKey === tab.key;

        return (
          <button
            key={tab.key}
            ref={(el) => {
              buttonRefs.current[i] = el;
            }}
            type="button"
            onClick={() => {
              if (!isActive) onTabChange(tab.key);
            }}
            className={`
              relative z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
              transition-colors duration-150 ease-out whitespace-nowrap select-none cursor-pointer
              ${
                isActive
                  ? tone.fg
                  : "bg-surface text-ink-secondary border border-subtle hover:bg-cushion hover:text-ink"
              }
            `}
          >
            {t(tab.labelKey)}
            {tab.count !== undefined && (
              <span
                className={`
                  inline-flex items-center justify-center min-w-[18px] h-[18px] px-1
                  rounded-full text-[9.5px] font-bold leading-none
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

/**
 * Memoised because the thumb is measured, not computed.
 *
 * `measure()` runs in a dependency-less `useLayoutEffect` — deliberately, so a
 * language toggle that resizes a label is caught even though `activeIndex` did
 * not change — and it reads `offsetLeft/Top/Width/Height`. Those are four
 * synchronous layout flushes before paint, and without `memo` they happened on
 * every render of the parent table, including every keystroke in its search
 * box, to re-measure a strip that had not moved.
 *
 * Callers must pass a stable `onTabChange`; an inline arrow re-renders this on
 * every parent render and puts the reads straight back.
 */
export default React.memo(StatusTabMenu);
