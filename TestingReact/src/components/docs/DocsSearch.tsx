"use client";

/**
 * @file components/docs/DocsSearch.tsx
 * @description The manual's search field, plus the "/" shortcut that focuses
 * it from anywhere on the page.
 *
 * The shortcut listener ignores the key while the reader is typing in a field
 * — otherwise a "/" in the box itself would re-focus and swallow the
 * character — and is removed on unmount (§14: every subscription cleans up).
 *
 * Two of these are mounted at once (the header slot and the in-page slot,
 * shown at different widths), so both register the shortcut. Each one checks
 * that IT is the visible instance before taking focus, rather than relying on
 * `focus()` being a no-op on a `display:none` input — that happened to work,
 * but it made which field won depend on mount order.
 */

import React, { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { useDocsText } from "./useDocsText";
import { SEARCH_COPY } from "./content/heroCopy";

interface DocsSearchProps {
  value: string;
  onChange: (value: string) => void;
  /** Result count, shown while searching. */
  matchCount: number;
  searching: boolean;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

export default function DocsSearch({ value, onChange, matchCount, searching }: DocsSearchProps) {
  const { text } = useDocsText();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !isTypingTarget(e.target)) {
        // `offsetParent` is null for a `display:none` subtree — the cheap way
        // to ask "am I the field currently on screen?".
        if (!inputRef.current?.offsetParent) return;
        e.preventDefault();
        inputRef.current.focus();
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="relative w-full max-w-lg">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={text(SEARCH_COPY.placeholder)}
        aria-label={text(SEARCH_COPY.placeholder)}
        className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] pl-10 pr-24 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-violet-400/50 [&::-webkit-search-cancel-button]:hidden"
      />

      <div className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
        {searching ? (
          <>
            <span className="font-mono text-[11px] text-slate-400 [font-variant-numeric:tabular-nums]">
              {matchCount}
            </span>
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label={text(SEARCH_COPY.clear)}
              className="pointer-events-auto cursor-pointer rounded-md p-1 text-slate-500 transition-colors hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <kbd className="hidden rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-slate-500 sm:block">
            /
          </kbd>
        )}
      </div>
    </div>
  );
}
