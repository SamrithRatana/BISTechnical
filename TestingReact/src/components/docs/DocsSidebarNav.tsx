"use client";

/**
 * @file components/docs/DocsSidebarNav.tsx
 * @description The left rail: all five chapters, all 27 pages, always visible.
 *
 * Numbered, because the order is the argument. A reader who starts at 01 and
 * presses "next" at the bottom of each page walks the manual front to back
 * without ever choosing where to go; the numbers are what tell them that is an
 * option. They are printed from the array index, never authored — see
 * `content/docsData.ts` on why nothing here states a position it does not
 * derive.
 *
 * The active row is marked with a border on the row itself rather than a
 * filled pill: at this density a solid violet block on a two-line Khmer title
 * dominates the whole rail, and the point of the rail is the list, not the
 * cursor.
 *
 * Search filters chapters AND rows. An empty result renders a message rather
 * than an empty box — the old version returned nothing at all, so a typo left
 * the reader looking at blank space with no way to tell whether the manual had
 * failed to load.
 */

import React from "react";
import { SearchX } from "lucide-react";
import { DOCS_NAVIGATION_SECTIONS } from "./content/docsData";
import { SEARCH_COPY } from "./content/heroCopy";
import { docsIcon } from "./docsIconMap";
import { useDocsText } from "./useDocsText";
import { useDocsTheme } from "./DocsThemeContext";

interface DocsSidebarNavProps {
  activeArticleId: string;
  onSelectArticle: (articleId: string) => void;
  searchQuery: string;
}

/** Chapter number: "01", "02", … Padded so the rail stays a straight column. */
function chapterNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}

export default function DocsSidebarNav({
  activeArticleId,
  onSelectArticle,
  searchQuery,
}: DocsSidebarNavProps) {
  const { text, isKhmer } = useDocsText();
  const { isDark } = useDocsTheme();
  const navRef = React.useRef<HTMLElement | null>(null);

  // Auto-scroll active item into visible view when activeArticleId changes
  React.useEffect(() => {
    if (!navRef.current) return;
    const activeEl = navRef.current.querySelector<HTMLElement>('[data-active-item="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeArticleId]);

  const filtered = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return DOCS_NAVIGATION_SECTIONS.map((section, index) => ({ section, index }));
    }

    return DOCS_NAVIGATION_SECTIONS.map((section, index) => ({
      index,
      section: {
        ...section,
        // Matched against everything the reader can see on the page, plus the
        // route and the status — someone searching "Awaiting Sparepart" has
        // read that string in the app, not in this manual.
        articles: section.articles.filter((article) =>
          [
            article.titleKm,
            article.titleEn,
            article.subtitleKm,
            article.subtitleEn,
            article.summaryKm,
            article.summaryEn,
            article.route ?? "",
            article.status ?? "",
          ].some((field) => field.toLowerCase().includes(query))
        ),
      },
    })).filter((entry) => entry.section.articles.length > 0);
  }, [searchQuery]);

  if (filtered.length === 0) {
    return (
      <div className={`rounded-xl border p-4 text-xs ${isDark ? "border-white/10 bg-white/[0.02]" : "border-slate-200 bg-white shadow-sm"}`}>
        <p className={`flex items-center gap-2 font-semibold ${isDark ? "text-slate-300" : "text-slate-800"}`}>
          <SearchX className={`h-4 w-4 shrink-0 ${isDark ? "text-slate-500" : "text-slate-600"}`} />
          {text(SEARCH_COPY.noResults)}
        </p>
        <p className={`mt-2 leading-relaxed ${isDark ? "text-slate-500" : "text-slate-600"}`}>
          {text(SEARCH_COPY.noResultsHint)}
        </p>
      </div>
    );
  }

  return (
    <nav
      ref={navRef}
      aria-label={isKhmer ? "មាតិកាឯកសារ" : "Documentation"}
      className="space-y-6 pt-1 pb-24 text-xs"
    >
      {filtered.map(({ section, index }) => {
        const SectionIcon = docsIcon(section.icon);

        return (
          <div key={section.id}>
            <p className={`flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-[0.12em] ${isDark ? "text-slate-300" : "text-slate-800"}`}>
              <span className={`font-mono ${isDark ? "text-violet-400/80" : "text-violet-700"}`}>{chapterNumber(index)}</span>
              <SectionIcon className={`h-3.5 w-3.5 shrink-0 ${isDark ? "text-violet-400" : "text-violet-700"}`} />
              <span className="min-w-0 flex-1 leading-tight">
                {isKhmer ? section.titleKm : section.titleEn}
              </span>
            </p>

            <ul className={`mt-2 border-l ${isDark ? "border-white/10" : "border-slate-300"}`}>
              {section.articles.map((article) => {
                const active = activeArticleId === article.id;
                const ArticleIcon = docsIcon(article.icon);

                return (
                  <li key={article.id}>
                    <button
                      type="button"
                      data-active-item={active ? "true" : undefined}
                      onClick={() => onSelectArticle(article.id)}
                      aria-current={active ? "page" : undefined}
                      className={`-ml-px flex w-full cursor-pointer items-center gap-2.5 border-l-2 py-1.5 pl-3 pr-2 text-left transition-colors ${
                        active
                          ? isDark
                            ? "border-violet-400 bg-violet-500/[0.07] font-semibold text-white"
                            : "border-violet-600 bg-violet-100/70 font-bold text-violet-950 shadow-sm"
                          : isDark
                          ? "border-transparent text-slate-400 hover:border-white/25 hover:text-slate-100"
                          : "border-transparent text-slate-600 hover:border-slate-400 hover:text-slate-950"
                      }`}
                    >
                      <ArticleIcon
                        className={`h-3.5 w-3.5 shrink-0 ${
                          active
                            ? isDark
                              ? "text-violet-300"
                              : "text-violet-700"
                            : "text-slate-600"
                        }`}
                      />
                      <span className="min-w-0 flex-1 text-[12px] leading-snug">
                        {isKhmer ? article.titleKm : article.titleEn}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
