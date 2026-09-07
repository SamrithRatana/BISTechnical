"use client";

/**
 * @file components/docs/DocsPathway.tsx
 * @description The reading path: five chapters as one numbered run, between
 * the lifecycle rail and the reader.
 *
 * The rail above it answers "how does a ticket move"; this answers the
 * question a first-time reader actually opens the page with — "where do I
 * start, and what comes after". The sidebar holds the same five chapters, but
 * a 27-row list read at 12px is a directory, not a path: it shows what exists
 * and says nothing about order.
 *
 * Each card jumps to the FIRST article of its chapter, because that is where
 * the chapter's own flow begins. The counts are read from the catalogue, so a
 * chapter that grows says so without anyone editing this file.
 *
 * The connector runs behind the cards only at `lg`, where all five sit on one
 * row. Below that they wrap, and a connector drawn across wrapped cards joins
 * two that are not adjacent — it stops reading as a sequence and starts
 * reading as a mistake.
 */

import React from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { DOCS_NAVIGATION_SECTIONS } from "./content/docsData";
import { PATHWAY_COPY, READER_COPY, fillCopy } from "./content/heroCopy";
import { docsIcon } from "./docsIconMap";
import { DUR, REVEAL_EASE, VIEWPORT_ONCE } from "./motion";
import { useDocsText } from "./useDocsText";
import { useDocsTheme } from "./DocsThemeContext";
import type { DocsMotionMode } from "./useDocsMotionMode";

interface DocsPathwayProps {
  mode: DocsMotionMode;
  activeArticleId: string;
  /** Opens the first article of the chosen chapter. */
  onOpenArticle: (articleId: string) => void;
}

export default function DocsPathway({ mode, activeArticleId, onOpenArticle }: DocsPathwayProps) {
  const { text, isKhmer } = useDocsText();
  const { isDark } = useDocsTheme();
  const full = mode === "full";

  // Which chapter the reader is currently inside, so the map agrees with the
  // sidebar instead of quietly contradicting it.
  const activeSectionId = React.useMemo(
    () =>
      DOCS_NAVIGATION_SECTIONS.find((section) =>
        section.articles.some((article) => article.id === activeArticleId)
      )?.id,
    [activeArticleId]
  );

  return (
    <section className={`border-b py-16 ${isDark ? "border-white/5" : "border-slate-200"}`}>
      <div className="mx-auto max-w-7xl 2xl:max-w-[1536px] px-4 sm:px-6 lg:px-8">
        <motion.div
          className="mb-9 max-w-3xl"
          initial={full ? { opacity: 0, y: 16 } : false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT_ONCE}
          transition={{ duration: DUR.reveal, ease: REVEAL_EASE }}
        >
          <p className={`mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.2em] ${isDark ? "text-slate-500" : "text-slate-600"}`}>
            {text(PATHWAY_COPY.eyebrow)}
          </p>
          <h2
            className={`text-2xl font-black sm:text-3xl ${isDark ? "text-white" : "text-slate-900"} ${
              isKhmer ? "leading-snug" : "tracking-tight"
            }`}
          >
            {text(PATHWAY_COPY.title)}
          </h2>
          <p className={`mt-3 text-sm ${isDark ? "text-slate-400" : "text-slate-600"} ${isKhmer ? "leading-loose" : "leading-relaxed"}`}>
            {text(PATHWAY_COPY.body)}
          </p>
        </motion.div>

        <ol className="relative grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {/* The run, drawn once behind the row. Hidden wherever the cards
              wrap, so it never connects two things that are not adjacent. */}
          <span
            aria-hidden
            className="absolute inset-x-8 top-8 hidden h-px lg:block"
            style={{
              background: isDark
                ? "linear-gradient(90deg, transparent, rgb(148 163 184 / 0.25) 12%, rgb(148 163 184 / 0.25) 88%, transparent)"
                : "linear-gradient(90deg, transparent, rgb(100 116 139 / 0.5) 12%, rgb(100 116 139 / 0.5) 88%, transparent)",
            }}
          />

          {DOCS_NAVIGATION_SECTIONS.map((section, index) => {
            const Icon = docsIcon(section.icon);
            const firstArticle = section.articles[0];
            const active = activeSectionId === section.id;

            return (
              <motion.li
                key={section.id}
                className="relative"
                initial={full ? { opacity: 0, y: 18 } : false}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={VIEWPORT_ONCE}
                transition={{ duration: DUR.reveal, delay: index * 0.06, ease: REVEAL_EASE }}
              >
                <button
                  type="button"
                  onClick={() => firstArticle && onOpenArticle(firstArticle.id)}
                  className={`flex h-full w-full cursor-pointer flex-col rounded-2xl border p-4 text-left transition-[transform,border-color] duration-150 hover:-translate-y-0.5 ${
                    isDark
                      ? `bg-[#080a14] hover:border-violet-400/60 ${
                          active ? "border-violet-400/70" : "border-white/10"
                        }`
                      : `bg-white shadow-sm hover:border-violet-600 ${
                          active ? "border-violet-600" : "border-slate-200"
                        }`
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border font-mono text-[11px] font-bold ${
                        isDark
                          ? active
                            ? "border-violet-400/60 bg-violet-500/15 text-violet-200"
                            : "border-white/10 bg-white/[0.04] text-slate-400"
                          : active
                            ? "border-violet-700 bg-violet-100 text-violet-800"
                            : "border-slate-300 bg-slate-100 text-slate-700"
                      }`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <Icon className={`h-4 w-4 shrink-0 ${isDark ? "text-violet-400/80" : "text-violet-600"}`} />
                    {index === 0 && (
                      <span className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-bold ${isDark ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-emerald-500/40 bg-emerald-100 text-emerald-800"}`}>

                        {text(PATHWAY_COPY.start)}
                      </span>
                    )}
                  </span>

                  <span className={`mt-3 block text-[13px] font-bold leading-snug ${isDark ? "text-white" : "text-slate-900"}`}>

                    {isKhmer ? section.titleKm : section.titleEn}
                  </span>

                  <span className={`mt-auto flex items-center gap-1.5 pt-3 font-mono text-[11px] ${isDark ? "text-slate-500" : "text-slate-600 font-medium"}`}>

                    {fillCopy(text(READER_COPY.articlesIn), { n: section.articles.length }, isKhmer)}
                    <ArrowRight aria-hidden className="h-3 w-3" />
                  </span>
                </button>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
