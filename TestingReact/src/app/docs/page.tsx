"use client";

/**
 * @file app/docs/page.tsx
 * @description The public documentation hub — "Codex Atlas".
 *
 * A standalone dark page (no app shell): a 3D exploded-stack hero, the repair
 * lifecycle drawn once end to end, then the chapters — every screen in the
 * portal with what it is for and how to work it, filterable from one search
 * box.
 *
 * This file only orchestrates. Every section, hook and string lives in
 * `src/components/docs/`; the catalogue itself is plain data under
 * `components/docs/content/`.
 *
 * Like `/login` and `/download`, this public zone is deliberately NOT on the
 * `--av-*` token system — it keeps its own dark marketing look, and its copy
 * carries both languages inline instead of going through the shared dictionary
 * (see `docsTypes.ts` for why). Motion collapses to a static composition under
 * reduced-motion / Lite Mode via `useDocsMotionMode`.
 */

import React, { useCallback, useMemo, useState } from "react";
import ChapterNav from "@/components/docs/ChapterNav";
import ChapterSection from "@/components/docs/ChapterSection";
import DocsFooter from "@/components/docs/DocsFooter";
import DocsHeader from "@/components/docs/DocsHeader";
import DocsHero from "@/components/docs/DocsHero";
import DocsSearch from "@/components/docs/DocsSearch";
import LifecycleRail from "@/components/docs/LifecycleRail";
import { DOCS_CHAPTERS, LIFECYCLE_STAGES, DOCS_TOPIC_COUNT } from "@/components/docs/content";
import { HERO_STAT_LABELS, SEARCH_COPY } from "@/components/docs/content/heroCopy";
import { setDocsHash, useDocsHash } from "@/components/docs/useDocsHash";
import { useDocsMotionMode } from "@/components/docs/useDocsMotionMode";
import { useDocsSearch } from "@/components/docs/useDocsSearch";
import { useDocsText } from "@/components/docs/useDocsText";
import { useScrollSpy } from "@/components/docs/useScrollSpy";

export default function DocsPage() {
  const mode = useDocsMotionMode();
  const { text } = useDocsText();
  const [query, setQuery] = useState("");
  // The open topic lives in the URL rather than in state, so a shared link
  // like /docs#stock-health lands on an OPEN card instead of a collapsed
  // header. Writes replace rather than push (see useDocsHash), so browsing
  // topics does not bury the Back button.
  const spotlightId = useDocsHash();

  const { matchedTopicIds, matchCount } = useDocsSearch(DOCS_CHAPTERS, query);
  const searching = matchedTopicIds !== null;

  /**
   * Only the chapters actually on screen. A search removes the sections that
   * match nothing (`ChapterSection` returns null), and clearing it mounts
   * brand-new elements under the same ids — so the spy has to be told, or it
   * keeps observing the detached nodes: the nav pill would stick forever and
   * the old card trees would stay reachable through the observer (§14).
   */
  const visibleChapterIds = useMemo(
    () =>
      DOCS_CHAPTERS.filter(
        (chapter) =>
          !matchedTopicIds || chapter.topics.some((topic) => matchedTopicIds.has(topic.id))
      ).map((chapter) => chapter.id),
    [matchedTopicIds]
  );
  const activeChapterId = useScrollSpy(visibleChapterIds);

  /** Smooth only when the reader has not asked for stillness. */
  const scrollTo = useCallback(
    (elementId: string) => {
      document.getElementById(elementId)?.scrollIntoView({
        behavior: mode === "full" ? "smooth" : "auto",
        block: "start",
      });
    },
    [mode]
  );

  const openTopic = useCallback(
    (topicId: string) => {
      setDocsHash(topicId);
      scrollTo(topicId);
    },
    [scrollTo]
  );

  const stats = useMemo(
    () => [
      { value: String(DOCS_CHAPTERS.length), label: text(HERO_STAT_LABELS.chapters) },
      { value: String(DOCS_TOPIC_COUNT), label: text(HERO_STAT_LABELS.topics) },
      { value: String(LIFECYCLE_STAGES.length), label: text(HERO_STAT_LABELS.stages) },
    ],
    [text]
  );

  const searchField = (
    <DocsSearch
      value={query}
      onChange={setQuery}
      matchCount={matchCount}
      searching={searching}
    />
  );

  return (
    /* `clip` not `hidden`: an overflow-hidden ancestor flattens the atlas rig's
       3D subtree (the download page root uses overflow-x-clip for the same
       reason). */
    <div
      className="relative min-h-screen overflow-x-clip font-sans text-slate-100 selection:bg-violet-500/30"
      style={{ background: "linear-gradient(180deg, #04050d, #0a0c18 45%, #04050d)" }}
    >
      <DocsHeader mode={mode} search={searchField} />

      <DocsHero
        mode={mode}
        onStart={() => scrollTo(DOCS_CHAPTERS[0].id)}
        onLifecycle={() => scrollTo("lifecycle")}
        stats={stats}
      />

      <LifecycleRail stages={LIFECYCLE_STAGES} mode={mode} onOpenTopic={openTopic} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* The header's search slot is desktop-only, so phones get the field
            here. These are TWO mounted instances sharing one `query`, so they
            cannot disagree; CSS decides which is visible. Each registers the
            "/" shortcut, and each ignores it unless it is the visible one —
            see the note in DocsSearch. */}
        <div className="pt-10 lg:hidden">{searchField}</div>

        <div className="grid grid-cols-1 gap-8 pt-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
          <div className="lg:pt-16">
            <ChapterNav
              chapters={DOCS_CHAPTERS}
              activeId={searching ? null : activeChapterId}
              onJump={scrollTo}
            />
          </div>

          {/* `min-w-0`: without it this grid item refuses to shrink and the
              lifecycle rail's inner scroller is ignored, scrolling the page
              sideways instead. */}
          <div className="min-w-0">
            {searching && matchCount === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
                <p className="text-base font-bold text-white">{text(SEARCH_COPY.noResults)}</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                  {text(SEARCH_COPY.noResultsHint)}
                </p>
              </div>
            ) : (
              DOCS_CHAPTERS.map((chapter) => (
                <ChapterSection
                  key={chapter.id}
                  chapter={chapter}
                  mode={mode}
                  matchedTopicIds={matchedTopicIds}
                  spotlightId={spotlightId}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <DocsFooter mode={mode} />
    </div>
  );
}
