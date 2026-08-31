"use client";

/**
 * @file components/docs/useScrollSpy.ts
 * @description Which chapter is the reader currently in?
 *
 * An `IntersectionObserver` rather than a scroll listener: the browser does
 * the hit-testing off the main thread and only calls back when a section
 * actually crosses the band, where a scroll handler would run
 * `getBoundingClientRect()` for every chapter on every frame.
 *
 * The band is the top third of the viewport (`-12% 0px -70% 0px`), so the
 * highlighted entry is the section you are *reading*, not the one merely
 * touching the bottom edge.
 *
 * The observer is disconnected on unmount and re-created when the id list
 * changes (§14: every subscription returns its cleanup). `ids` is joined into
 * a string for the dependency so a caller passing a fresh array literal every
 * render does not tear the observer down and build it again each time.
 */

import { useEffect, useState } from "react";

export function useScrollSpy(ids: readonly string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(ids[0] ?? null);
  const key = ids.join("|");

  useEffect(() => {
    const sectionIds = key ? key.split("|") : [];
    if (sectionIds.length === 0) return;

    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    // Kept outside the callback: an entry that leaves the band does not report
    // the one that replaced it, so the visible set has to be remembered.
    const visible = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        // Document order wins when two sections share the band, so scrolling
        // down never briefly highlights the section you just left.
        const firstVisible = sectionIds.find((id) => visible.has(id));
        if (firstVisible) setActiveId(firstVisible);
      },
      { rootMargin: "-12% 0px -70% 0px", threshold: 0 }
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [key]);

  return activeId;
}
