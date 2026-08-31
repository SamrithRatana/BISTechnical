"use client";

/**
 * @file components/docs/AtlasPlanes.tsx
 * @description What the atlas is MADE of: the five chapter planes, the orbit
 * chips, and the one plane component that draws a card.
 *
 * Split out of `AtlasCore.tsx` (which owns the rig, the pose and the lighting)
 * so neither file runs past ~300 lines. The 3D rules in that file's header
 * apply here too — every surface below is a solid fill.
 */

import React from "react";
import { motion } from "framer-motion";
import { DOCS_ICONS } from "./docsIcons";
import { ACCENT } from "./docsAccent";
import { LIFECYCLE_STAGES } from "./content/lifecycle";
import { DOCS_REPORT_COUNT } from "./content/reportCount";
import { DUR, LOAD, PLANE_GAP_PX, SETTLE_EASE, STATIC_PLANE_SPREAD } from "./motion";
import type { DocsIconName, DocsAccent } from "./docsTypes";

interface PlaneSpec {
  icon: DocsIconName;
  accent: DocsAccent;
  /** English-only rig micro-label — this is chrome, not copy. */
  label: string;
  /** Stack position, 0 = frontmost. */
  depth: number;
  offsetX: number;
  offsetY: number;
}

/** Five planes: the five things the manual actually covers. */
export const PLANES: readonly PlaneSpec[] = [
  { icon: "shield", accent: "violet", label: "ACCESS", depth: 0, offsetX: 26, offsetY: 34 },
  { icon: "workflow", accent: "cyan", label: "WORKFLOW", depth: 1, offsetX: 13, offsetY: 17 },
  { icon: "package", accent: "emerald", label: "INVENTORY", depth: 2, offsetX: 0, offsetY: 0 },
  { icon: "chart", accent: "amber", label: "REPORTS", depth: 3, offsetX: -13, offsetY: -17 },
  { icon: "settings", accent: "sky", label: "ADMIN", depth: 4, offsetX: -26, offsetY: -34 },
];

interface ChipSpec {
  icon: DocsIconName;
  label: string;
  position: string;
  z: number;
  floatDuration: number;
  delay: number;
}

/**
 * The stage count is DERIVED, never typed in: a chip that reads "10 stages"
 * beside a rail drawing eleven of them is a small lie the reader will spot,
 * and it is exactly what happens when a number is maintained by hand next to
 * a list that grows.
 *
 * `DOCS_REPORT_COUNT` cannot be derived the same way — its authority is
 * `services/reportCatalog.ts`, which carries column definitions for all 29
 * reports and would be a heavy import for one integer. It is a mirrored
 * constant declared once, with that caveat, in `content/index.ts`.
 */
export const CHIPS: readonly ChipSpec[] = [
  { icon: "scan", label: "Face ID", position: "-right-8 top-6", z: 150, floatDuration: 6, delay: LOAD.glyphDelays[0] },
  {
    icon: "wrench",
    label: `${LIFECYCLE_STAGES.length} stages`,
    position: "-left-14 top-1/3",
    z: 118,
    floatDuration: 7.5,
    delay: LOAD.glyphDelays[1],
  },
  {
    icon: "chart",
    label: `${DOCS_REPORT_COUNT} reports`,
    position: "-right-12 bottom-20",
    z: 132,
    floatDuration: 9,
    delay: LOAD.glyphDelays[2],
  },
  { icon: "phone", label: "CAM ID", position: "-left-8 bottom-4", z: 96, floatDuration: 8.2, delay: LOAD.glyphDelays[3] },
];

/** One plane of the stack. Solid fill, one hairline, two skeleton copy bars. */
export function AtlasPlane({ spec, full }: { spec: PlaneSpec; full: boolean }) {
  const skin = ACCENT[spec.accent];
  const Icon = DOCS_ICONS[spec.icon];
  const z = (spec.depth - 2) * PLANE_GAP_PX;

  /**
   * Lite Mode forces `transform-style: flat`, so the Z separation collapses and
   * the planes land on top of each other with only these x/y offsets left to
   * tell them apart. Spreading them further in that mode is what keeps the
   * static version a legible fan of cards rather than one card with four
   * shadows behind it — the same "designed, not degraded" rule the rest of the
   * page follows.
   */
  const spread = full ? 1 : STATIC_PLANE_SPREAD;

  return (
    <motion.div
      className="absolute left-1/2 top-1/2 w-[236px] sm:w-[268px]"
      style={{ marginLeft: -134, marginTop: -74 }}
      initial={full ? { opacity: 0, z: 0, x: 0, y: 0 } : false}
      animate={{ opacity: 1, z, x: spec.offsetX * spread, y: spec.offsetY * spread }}
      transition={
        full
          ? {
              duration: DUR.settle,
              delay: LOAD.atlasDelay + spec.depth * 0.07,
              ease: SETTLE_EASE,
            }
          : { duration: 0 }
      }
    >
      <div
        className={`relative rounded-2xl border ${skin.border} bg-[#0a0c18] p-3.5 shadow-[0_24px_60px_-24px_rgb(0_0_0/0.9)]`}
      >
        <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-2xl" style={{ background: skin.hairline }} />
        <div className="flex items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${skin.tile}`}>
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[10px] font-bold tracking-[0.18em] text-slate-400">
              {spec.label}
            </span>
            <span className="mt-1.5 block h-1.5 w-full rounded-full bg-white/10" />
            <span className="mt-1 block h-1.5 w-2/3 rounded-full bg-white/[0.06]" />
          </span>
        </div>
      </div>
    </motion.div>
  );
}
