"use client";

/**
 * @file components/docs/TopicCard.tsx
 * @description One documented feature: header row (icon, title, route, role
 * chips) over an expandable body of numbered steps and precise facts.
 *
 * The card micro-tilts ±3.5° under a fine pointer. Expansion animates opacity
 * and y only — the height change is deliberately instant and masked by the
 * slide, because animating height would lay out the whole chapter on every
 * frame (the rule `download/PlatformCard.tsx` already follows).
 *
 * The surface is a SOLID fill: the card sits under a `perspective` and rotates,
 * so a `backdrop-filter` here would flatten it in Safari exactly as it would in
 * the atlas rig.
 */

import React, { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, CornerDownRight, Info, ShieldCheck } from "lucide-react";
import { ACCENT } from "./docsAccent";
import { DOCS_ICONS } from "./docsIcons";
import { CARD_TILT_RANGE, DUR, REVEAL_EASE, VIEWPORT_ONCE } from "./motion";
import { setDocsHash } from "./useDocsHash";
import { useDocsTilt } from "./useDocsTilt";
import { useDocsText } from "./useDocsText";
import type { DocTopic, DocsAccent } from "./docsTypes";
import type { DocsMotionMode } from "./useDocsMotionMode";

interface TopicCardProps {
  topic: DocTopic;
  accent: DocsAccent;
  mode: DocsMotionMode;
  entranceDelay: number;
  /** Search opens every match, so the reader never has to hunt twice. */
  forceOpen: boolean;
  /**
   * A deep link or a click on the lifecycle rail landed here. Unlike
   * `forceOpen` this only *opens* the card — it does not hold it open, so the
   * reader can still close what they were sent to.
   */
  spotlight: boolean;
}

const bodyMotion = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: DUR.panel },
} as const;

function TopicCard({
  topic,
  accent,
  mode,
  entranceDelay,
  forceOpen,
  spotlight,
}: TopicCardProps) {
  const { text, isKhmer } = useDocsText();
  // Seeded from `spotlight`, not `false`: a card that MOUNTS already
  // spotlighted (a deep link, or a search being cleared after the reader
  // clicked a lifecycle stop) has no transition for the adjustment below to
  // catch, and would otherwise open as a collapsed header.
  const [selfOpen, setSelfOpen] = useState(spotlight);
  const full = mode === "full";
  const skin = ACCENT[accent];
  const Icon = DOCS_ICONS[topic.icon];
  const rig = useDocsTilt(CARD_TILT_RANGE, CARD_TILT_RANGE, !full);
  const open = forceOpen || selfOpen;

  // Opening on spotlight is a one-way nudge, not a controlled prop: the reader
  // who followed the link may well want to close the card again, and an `open`
  // derived from `spotlight` would fight them for it.
  //
  // Adjusted DURING render, comparing against the previous value — React's
  // documented pattern for deriving state from a changing input. In an effect
  // this is a second render pass and a cascading-render lint error; here React
  // re-runs this component before touching the DOM, so nothing is painted
  // twice. Same reasoning as the layout's `hasOpened` latch.
  const [lastSpotlight, setLastSpotlight] = useState(spotlight);
  if (spotlight !== lastSpotlight) {
    setLastSpotlight(spotlight);
    if (spotlight) setSelfOpen(true);
  }

  const toggle = useCallback(() => {
    // Closing the card the URL points at drops it from the URL too. Without
    // that, clicking the same lifecycle stop again writes an unchanged hash,
    // nothing transitions, and the second click looks broken.
    if (selfOpen && spotlight) setDocsHash("");
    setSelfOpen((v) => !v);
  }, [selfOpen, spotlight]);

  const bodyId = `${topic.id}-body`;

  return (
    <div className="[perspective:900px]" id={topic.id}>
      <motion.article
        className={`relative scroll-mt-28 overflow-hidden rounded-3xl border bg-[#080a14] ${skin.border}`}
        onPointerMove={rig.onPointerMove}
        onPointerLeave={rig.onPointerLeave}
        style={{ rotateX: rig.rotateX, rotateY: rig.rotateY }}
        initial={full ? { opacity: 0, y: 26 } : false}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={VIEWPORT_ONCE}
        transition={{ duration: DUR.card, delay: entranceDelay, ease: REVEAL_EASE }}
        whileHover={full ? { y: -3 } : undefined}
      >
        {/* Accent hairline + interior wash: the card's two sanctioned gradients */}
        <div aria-hidden className="absolute inset-x-0 top-0 h-[2px]" style={{ background: skin.hairline }} />
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: skin.glow }} />

        {/* The heading wraps the button rather than sitting inside it: a
            heading is not phrasing content, so `<button><h3>` is invalid, and
            without a heading at all the page is five sections and 56
            unlabelled regions to anyone navigating by structure. */}
        <h3>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="relative flex w-full cursor-pointer items-start gap-3.5 p-5 text-left sm:gap-4 sm:p-6"
        >
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${skin.tile}`}>
            <Icon className="h-5 w-5" />
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <span className="text-base font-bold text-white sm:text-lg">{text(topic.title)}</span>
              {topic.route && (
                <span className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10.5px] text-slate-400">
                  {topic.route}
                </span>
              )}
              {topic.roles?.map((role) => (
                <span
                  key={role}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${skin.chip}`}
                >
                  <ShieldCheck className="h-3 w-3" />
                  {role}
                </span>
              ))}
            </span>
            <span
              className={`mt-1.5 block text-[13px] leading-relaxed text-slate-400 ${
                isKhmer ? "leading-loose" : ""
              }`}
            >
              {text(topic.blurb)}
            </span>
          </span>

          <motion.span
            className="mt-1 shrink-0 text-slate-500"
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: DUR.panel }}
          >
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </button>
        </h3>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div {...bodyMotion} id={bodyId} className="relative">
              <div className="border-t border-white/[0.06] px-5 pb-6 pt-5 sm:px-6">
                <ol className="space-y-3">
                  {topic.steps.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border font-mono text-[11px] font-bold ${skin.step}`}
                      >
                        {i + 1}
                      </span>
                      <span
                        className={`pt-0.5 text-[13px] leading-relaxed text-slate-300 ${
                          isKhmer ? "leading-loose" : ""
                        }`}
                      >
                        {text(step)}
                      </span>
                    </li>
                  ))}
                </ol>

                {topic.facts && topic.facts.length > 0 && (
                  <ul className="mt-5 space-y-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                    {topic.facts.map((fact, i) => (
                      <li key={i} className="flex gap-2.5">
                        {i === 0 ? (
                          <Info className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${skin.text}`} />
                        ) : (
                          <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
                        )}
                        <span
                          className={`text-xs leading-relaxed text-slate-400 ${
                            isKhmer ? "leading-loose" : ""
                          }`}
                        >
                          {text(fact)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.article>
    </div>
  );
}

/**
 * Memoised because the search box lives on the page: every keystroke
 * re-renders `DocsPage` and would otherwise re-render all 56 cards — each of
 * which owns a tilt rig with its own motion values. Every prop is a primitive
 * or a module constant, so the comparison is cheap and actually holds.
 */
export default React.memo(TopicCard);
