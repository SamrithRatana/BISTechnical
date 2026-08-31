"use client";

/**
 * @file components/docs/useDocsSearch.ts
 * @description Filters the manual to the topics that match what was typed.
 *
 * Purely client-side: the whole catalogue is already in this route's chunk, so
 * there is nothing to fetch and no request to race. The debounce is still
 * worth keeping — it stops a re-filter and a re-render of every chapter on
 * each keystroke — but at 150ms rather than the 300ms the server-backed search
 * boxes use, because there is no round trip to hide behind.
 *
 * The haystack is built ONCE per catalogue (`useMemo`), and deliberately
 * includes **both** languages plus the route: a Khmer reader who knows the
 * screen as `/spare-request` finds it by typing that, and an English reader
 * searching "ស្តុក" finds the stock chapter. Matching is
 * whitespace-tokenised AND — every word must appear somewhere in the topic —
 * so "stock hold" narrows instead of widening.
 */

import { useMemo } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { DocChapter } from "./docsTypes";

export interface DocsSearchResult {
  /** Matching topic ids, or `null` when the box is empty (show everything). */
  matchedTopicIds: Set<string> | null;
  /** How many topics matched. Only meaningful while searching. */
  matchCount: number;
}

function buildHaystack(chapters: readonly DocChapter[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const chapter of chapters) {
    for (const topic of chapter.topics) {
      const parts = [
        chapter.title.en,
        chapter.title.km,
        topic.title.en,
        topic.title.km,
        topic.blurb.en,
        topic.blurb.km,
        topic.route ?? "",
        ...(topic.roles ?? []),
        ...topic.steps.flatMap((s) => [s.en, s.km]),
        ...(topic.facts ?? []).flatMap((f) => [f.en, f.km]),
      ];
      index.set(topic.id, parts.join(" ").toLowerCase());
    }
  }
  return index;
}

export function useDocsSearch(
  chapters: readonly DocChapter[],
  query: string
): DocsSearchResult {
  const debounced = useDebouncedValue(query, 150);
  const haystack = useMemo(() => buildHaystack(chapters), [chapters]);

  return useMemo(() => {
    const terms = debounced.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return { matchedTopicIds: null, matchCount: 0 };

    const matched = new Set<string>();
    for (const [id, text] of haystack) {
      if (terms.every((term) => text.includes(term))) matched.add(id);
    }
    return { matchedTopicIds: matched, matchCount: matched.size };
  }, [debounced, haystack]);
}
