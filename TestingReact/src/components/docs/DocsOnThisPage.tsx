"use client";

/**
 * @file components/docs/DocsOnThisPage.tsx
 * @description The right-hand rail: where you are inside the article you are
 * reading, and what else is in it.
 *
 * The third column of the documentation layout, and the one this page did not
 * have. Without it a long article is a scroll with no map — the sidebar tells
 * you which of 27 pages you are on, and nothing tells you that the page you
 * are on has a flowchart two screens further down.
 *
 * Position comes from `useScrollSpy`, an IntersectionObserver rather than a
 * scroll handler, so nothing runs on the main thread per frame.
 *
 * The entries are real anchors, not buttons: middle-click, "copy link address"
 * and keyboard focus order all come free, and `page.tsx` recovers the article
 * from an `<id>--<section>` hash on load so a pasted section link opens the
 * right page at the right place.
 */

import React from "react";
import { List } from "lucide-react";
import type { DocsArticle } from "./content/docsData";
import { docsOutline } from "./docsOutline";
import { useDocsText } from "./useDocsText";
import { useDocsTheme } from "./DocsThemeContext";
import { useScrollSpy } from "./useScrollSpy";

interface DocsOnThisPageProps {
  article: DocsArticle;
}

export default function DocsOnThisPage({ article }: DocsOnThisPageProps) {
  const { text, isKhmer } = useDocsText();
  const { isDark } = useDocsTheme();

  const outline = React.useMemo(() => docsOutline(article), [article]);
  const anchors = React.useMemo(() => outline.map((entry) => entry.anchor), [outline]);
  const activeAnchor = useScrollSpy(anchors);

  // One entry is a heading with nothing to compare it against — a rail of one
  // link tells the reader nothing they cannot already see.
  if (outline.length < 2) return null;

  return (
    <nav aria-label={isKhmer ? "មាតិកាក្នុងទំព័រនេះ" : "On this page"} className="text-xs">
      <p className={`mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] ${isDark ? "text-slate-400" : "text-slate-800"}`}>
        <List className={`h-3.5 w-3.5 ${isDark ? "text-violet-400" : "text-violet-700"}`} />
        {isKhmer ? "នៅក្នុងទំព័រនេះ" : "On this page"}
      </p>

      <ul className={`space-y-0.5 border-l ${isDark ? "border-white/10" : "border-slate-300"}`}>
        {outline.map((entry) => {
          const active = activeAnchor === entry.anchor;
          return (
            <li key={entry.anchor}>
              <a
                href={`#${entry.anchor}`}
                aria-current={active ? "location" : undefined}
                className={`-ml-px block border-l-2 py-1.5 pl-3 leading-snug transition-colors ${
                  active
                    ? isDark
                      ? "border-violet-400 font-semibold text-violet-300"
                      : "border-violet-600 font-semibold text-violet-700"
                    : isDark
                    ? "border-transparent text-slate-500 hover:border-white/25 hover:text-slate-200"
                    : "border-transparent text-slate-600 hover:border-slate-400 hover:text-slate-900"
                }`}
              >
                {text(entry.label)}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
