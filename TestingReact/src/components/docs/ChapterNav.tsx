"use client";

/**
 * @file components/docs/ChapterNav.tsx
 * @description The table of contents: a sticky rail on desktop, a horizontal
 * scroller of chips on phones.
 *
 * The active marker is one `layoutId` pill travelling between entries rather
 * than a class swap, so the highlight moves with the reader instead of
 * blinking from place to place — the same device the sidebar's active pill and
 * the language toggle already use.
 */

import React from "react";
import { motion } from "framer-motion";
import { ACCENT } from "./docsAccent";
import { DOCS_ICONS } from "./docsIcons";
import { SPY_SPRING } from "./motion";
import { useDocsText } from "./useDocsText";
import type { DocChapter } from "./docsTypes";

interface ChapterNavProps {
  chapters: readonly DocChapter[];
  activeId: string | null;
  onJump: (id: string) => void;
}

export default function ChapterNav({ chapters, activeId, onJump }: ChapterNavProps) {
  const { text } = useDocsText();

  return (
    <>
      {/* Desktop: sticky rail */}
      <nav
        aria-label="Documentation chapters"
        className="sticky top-24 hidden max-h-[calc(100vh-8rem)] overflow-y-auto lg:block"
      >
        <ul className="space-y-1 pr-2">
          {chapters.map((chapter) => {
            const skin = ACCENT[chapter.accent];
            const Icon = DOCS_ICONS[chapter.icon];
            const active = activeId === chapter.id;
            return (
              <li key={chapter.id}>
                <button
                  type="button"
                  onClick={() => onJump(chapter.id)}
                  aria-current={active ? "true" : undefined}
                  className={`relative flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] transition-colors ${
                    active ? "text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="docs-chapter-pill"
                      className="absolute inset-0 rounded-xl border border-white/10 bg-white/[0.05]"
                      transition={SPY_SPRING}
                    />
                  )}
                  <span className={`relative font-mono text-[10px] font-bold ${skin.text}`}>
                    {chapter.index}
                  </span>
                  <Icon className={`relative h-3.5 w-3.5 shrink-0 ${active ? skin.text : "text-slate-600"}`} />
                  <span className="relative min-w-0 flex-1 font-semibold leading-tight">
                    {text(chapter.title)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Phones: horizontal chip scroller */}
      <nav
        aria-label="Documentation chapters"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {chapters.map((chapter) => {
          const skin = ACCENT[chapter.accent];
          const active = activeId === chapter.id;
          return (
            <button
              key={chapter.id}
              type="button"
              onClick={() => onJump(chapter.id)}
              className={`shrink-0 cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                active ? skin.chip : "border-white/10 bg-white/[0.03] text-slate-400"
              }`}
            >
              <span className="font-mono text-[10px] opacity-70">{chapter.index}</span>{" "}
              {text(chapter.title)}
            </button>
          );
        })}
      </nav>
    </>
  );
}
