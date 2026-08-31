"use client";

/**
 * @file components/docs/ChapterSection.tsx
 * @description One chapter: a numbered heading block over its topic cards.
 *
 * The heading's rule line "draws" by sliding a cover away — a transform, never
 * a width animation — the same trick `download/ProofStrip.tsx` uses for its
 * connector.
 */

import React from "react";
import { motion } from "framer-motion";
import { ACCENT } from "./docsAccent";
import { DOCS_ICONS } from "./docsIcons";
import TopicCard from "./TopicCard";
import { DUR, REVEAL_EASE, VIEWPORT_ONCE } from "./motion";
import { useDocsText } from "./useDocsText";
import type { DocChapter } from "./docsTypes";
import type { DocsMotionMode } from "./useDocsMotionMode";

interface ChapterSectionProps {
  chapter: DocChapter;
  mode: DocsMotionMode;
  /** Ids that the current search matched; `null` means "not searching". */
  matchedTopicIds: Set<string> | null;
  /** The topic a deep link or the lifecycle rail asked to open, if any. */
  spotlightId: string | null;
}

export default function ChapterSection({
  chapter,
  mode,
  matchedTopicIds,
  spotlightId,
}: ChapterSectionProps) {
  const { text, isKhmer } = useDocsText();
  const full = mode === "full";
  const skin = ACCENT[chapter.accent];
  const Icon = DOCS_ICONS[chapter.icon];

  const topics = matchedTopicIds
    ? chapter.topics.filter((topic) => matchedTopicIds.has(topic.id))
    : chapter.topics;

  if (topics.length === 0) return null;

  return (
    <section id={chapter.id} className="scroll-mt-24 py-14 sm:py-16">
      <motion.header
        className="mb-8"
        initial={full ? { opacity: 0, y: 18 } : false}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={VIEWPORT_ONCE}
        transition={{ duration: DUR.reveal, ease: REVEAL_EASE }}
      >
        <div className="flex items-center gap-3">
          <span className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${skin.tile}`}>
            <Icon className="h-5 w-5" />
          </span>
          <span>
            <span className={`font-mono text-[11px] font-bold tracking-[0.2em] ${skin.text}`}>
              {chapter.index}
            </span>
            <h2
              className={`text-2xl font-black text-white sm:text-3xl ${
                isKhmer ? "leading-snug tracking-normal" : "tracking-tight"
              }`}
            >
              {text(chapter.title)}
            </h2>
          </span>
        </div>

        <p
          className={`mt-3 max-w-3xl text-sm leading-relaxed text-slate-400 ${
            isKhmer ? "leading-loose" : ""
          }`}
        >
          {text(chapter.tagline)}
        </p>

        {/* Rule line — a cover slides away to draw it */}
        <div aria-hidden className="relative mt-6 h-px overflow-hidden">
          <div className="absolute inset-0" style={{ background: skin.hairline }} />
          {full && (
            <motion.div
              className="absolute inset-0 bg-[#05060f]"
              initial={{ x: "0%" }}
              whileInView={{ x: "100%" }}
              viewport={VIEWPORT_ONCE}
              transition={{ duration: 0.6, ease: "easeInOut" }}
            />
          )}
        </div>
      </motion.header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {topics.map((topic, i) => (
          <TopicCard
            key={topic.id}
            topic={topic}
            accent={chapter.accent}
            mode={mode}
            entranceDelay={Math.min(i, 5) * 0.06}
            forceOpen={matchedTopicIds !== null}
            spotlight={spotlightId === topic.id}
          />
        ))}
      </div>
    </section>
  );
}
