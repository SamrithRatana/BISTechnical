"use client";

/**
 * @file components/docs/useScrollSpy.ts
 * @description Which section of the article is the reader currently in?
 *
 * ─── Why this is not an IntersectionObserver ────────────────────────────────
 *
 * It was, and the observer version got two cases wrong — both measured, both
 * structural rather than tuning:
 *
 *  1. **Adjacent sections tie.** The band was the top 18% of the viewport and
 *     the winner was "first in document order among those intersecting". A
 *     section whose bottom edge sits four pixels inside the band still counts
 *     as intersecting, and being earlier in the document it won — so scrolling
 *     from Overview to the flowchart left the rail pointing at Overview.
 *  2. **The last section can never win.** Once the page is at maximum scroll
 *     it stops moving, so a short final section that never reaches the band is
 *     unreachable. "Notes & warnings" was permanently unhighlightable.
 *
 * Both come from asking "what is inside a band" when the question is "what
 * have I scrolled past". So this reads positions directly and takes the LAST
 * section whose top has crossed the activation line — unambiguous when two
 * sections touch, and it can be overridden at the bottom of the page.
 *
 * The cost objection to a scroll handler was `getBoundingClientRect()` per
 * element per frame. That holds for a long chapter list; here the callers pass
 * at most five ids, the work is throttled to one measurement per animation
 * frame, and the listener is passive — so it never blocks the scroll itself.
 */

import { useEffect, useState } from "react";

/**
 * Distance from the top of the viewport at which a section becomes "current".
 * Matches the `scroll-mt-28` (112px) the sections carry, plus a little, so a
 * heading the reader has just clicked to registers immediately rather than one
 * pixel later.
 */
const ACTIVATION_LINE_PX = 128;

/** How close to the bottom counts as "the end of the page". */
const BOTTOM_EPSILON_PX = 4;

export function useScrollSpy(ids: readonly string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(ids[0] ?? null);
  const key = ids.join("|");

  useEffect(() => {
    const sectionIds = key ? key.split("|") : [];
    if (sectionIds.length === 0) {
      setActiveId(null);
      return;
    }

    // Reset when the article changes: the previous article's section could
    // otherwise stay highlighted until the reader happens to scroll.
    setActiveId(sectionIds[0]);

    let frame = 0;

    const measure = () => {
      frame = 0;

      // At the bottom there is no scrolling left to do, so whatever the line
      // says, the reader is looking at the final section.
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - BOTTOM_EPSILON_PX;
      if (atBottom) {
        setActiveId(sectionIds[sectionIds.length - 1]);
        return;
      }

      // Last one whose top has crossed the line. Falls back to the first
      // section while the reader is still above all of them.
      let current = sectionIds[0];
      for (const id of sectionIds) {
        const element = document.getElementById(id);
        if (!element) continue;
        if (element.getBoundingClientRect().top <= ACTIVATION_LINE_PX) current = id;
        else break;
      }
      setActiveId(current);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [key]);

  return activeId;
}
