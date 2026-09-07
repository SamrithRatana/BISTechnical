"use client";

/**
 * @file components/docs/AtlasCore.tsx
 * @description The hero's 3D rig — "the Atlas": the manual drawn as an
 * exploded stack of the system's own layers, one plane per chapter, held apart
 * on Z and lit from behind.
 *
 * Load timeline: the stack arrives collapsed and flat, then separates into
 * depth as it settles into its three-quarter pose (`ATLAS_REST_POSE`); the
 * orbit chips pop in afterwards on `LOAD.glyphDelays`.
 *
 * HARD RULE, inherited verbatim from `download/PhoneRig.tsx`: no
 * `backdrop-filter`, no `filter`, and no `overflow-hidden` on ANY
 * `preserve-3d` ancestor in this subtree — Safari silently flattens the whole
 * rig, and the page's signature becomes a pile of stacked rectangles. Every
 * surface here is a SOLID fill. A future "make the planes glassy" edit is the
 * likeliest regression.
 *
 * Ambient budget at rest: one 9s float loop on the rig, one 24s yaw drift, and
 * four small chip floats. Nothing else moves.
 */

import React from "react";
import { motion, useTransform } from "framer-motion";
import { useDocsTheme } from "./DocsThemeContext";
import { DOCS_ICONS } from "./docsIcons";
import { AtlasPlane, CHIPS, PLANES } from "./AtlasPlanes";
import { ATLAS_REST_POSE, DUR, LOAD, SETTLE_EASE } from "./motion";
import type { DocsMotionMode } from "./useDocsMotionMode";
import type { DocsTiltRig } from "./useDocsTilt";

interface AtlasCoreProps {
  mode: DocsMotionMode;
  rig: DocsTiltRig;
  /**
   * Whether the never-ending loops should be running (see `useAmbientMotion`).
   * Distinct from `mode`: the ONE-SHOT load choreography still plays under
   * `mode`, because it has already finished by the time the reader can scroll
   * away. Only the forever-loops answer to this.
   */
  ambient: boolean;
}

export default function AtlasCore({ mode, rig, ambient }: AtlasCoreProps) {
  const { isDark } = useDocsTheme();
  const full = mode === "full";
  // The spine leans with the pointer, a touch more than the stack does — the
  // difference is what makes the beam read as behind the planes.
  const spineShift = useTransform(rig.springPx, [-0.5, 0.5], [26, -26]);

  return (
    <motion.div
      className="relative h-[340px] w-[300px] [transform-style:preserve-3d] sm:h-[400px] sm:w-[360px]"
      /* Every loop below animates back to its resting value rather than to
         `undefined` when it stops — that leaves the rig parked where it was
         mid-cycle, so scrolling back finds a slightly cocked stack. */
      animate={ambient ? { y: [-7, 7] } : { y: 0 }}
      transition={
        ambient
          ? { duration: 9, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }
          : { duration: DUR.reveal, ease: SETTLE_EASE }
      }
    >
      {/* Settle into the three-quarter resting pose */}
      <motion.div
        className="absolute inset-0 [transform-style:preserve-3d]"
        initial={full ? { opacity: 0, rotateY: -46, rotateX: 30 } : false}
        animate={{
          opacity: 1,
          rotateY: ATLAS_REST_POSE.rotateY,
          rotateX: ATLAS_REST_POSE.rotateX,
        }}
        transition={
          full ? { duration: DUR.settle, delay: LOAD.atlasDelay, ease: SETTLE_EASE } : { duration: 0 }
        }
      >
        {/* Yaw drift, as its own layer so the settle above can finish at the
            rest pose and hand over without a jump. The keyframes start and end
            at 0 for the same reason: a loop opening on -5 would snap 5° the
            instant its delay elapsed. */}
        <motion.div
          className="absolute inset-0 [transform-style:preserve-3d]"
          animate={ambient ? { rotateY: [0, -5, 0, 5, 0] } : { rotateY: 0 }}
          transition={
            ambient
              ? {
                  duration: 24,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: LOAD.atlasDelay + DUR.settle,
                }
              : { duration: DUR.reveal, ease: SETTLE_EASE }
          }
        >
        {/* Pointer tilt, layered on top of the pose */}
        <motion.div
          className="absolute inset-0 [transform-style:preserve-3d]"
          style={{ rotateX: rig.rotateX, rotateY: rig.rotateY }}
        >
          {/* Key light, 220px behind the stack — a static gradient, no filter */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px]"
            style={{
              transform: "translate3d(-50%, -50%, -220px)",
              /* Half strength on white, for the reason `docsAccent`'s light
                 skins give: a wash that lifts a near-black stage only dirties
                 a near-white one. */
              background: isDark
                ? "radial-gradient(circle at 48% 42%, rgb(139 92 246 / 0.28), rgb(6 182 212 / 0.12) 46%, transparent 70%)"
                : "radial-gradient(circle at 48% 42%, rgb(139 92 246 / 0.14), rgb(6 182 212 / 0.06) 46%, transparent 70%)",
            }}
          />

          {/* The spine: one beam running through the whole stack.
              Desktop only, and for a layout reason rather than a taste one:
              the beam is taller than the rig, and on a phone the stage sits at
              the bottom of a stacked hero, so those extra pixels escape the
              section and draw a stray vertical line across the next one. The
              hero cannot simply clip them — an `overflow-hidden` ancestor
              flattens the whole preserve-3d subtree (see the header note). The
              floor grid is gated for the same reason. */}
          {/* Two elements, and it has to be two: framer scrapes `x` into the
              transform it BUILDS, and a built transform overwrites a raw
              `transform` string in the same style object. Putting both on one
              node silently drops the `-50% -50%` centring and the -120px Z
              push, and the beam ends up hanging off-centre in FRONT of the
              planes. The static pose lives on the wrapper; only the pointer
              lean is a motion value. */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 hidden lg:block"
            style={{ transform: "translate3d(-50%, -50%, -120px)" }}
          >
            <motion.div
              className="h-[420px] w-[2px]"
              style={{
                x: full ? spineShift : 0,
                /* The dark beam is a light source, so it is drawn in the
                   -400 steps. On white nothing can be lit — the same beam has
                   to be drawn as ink instead, or it disappears. */
                background: isDark
                  ? "linear-gradient(180deg, transparent, rgb(167 139 250 / 0.55), rgb(34 211 238 / 0.35), transparent)"
                  : "linear-gradient(180deg, transparent, rgb(124 58 237 / 0.5), rgb(8 145 178 / 0.35), transparent)",
              }}
            />
          </div>

          {/* Floor grid — pure decoration; first cut if performance suffers */}
          {full && (
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-full hidden h-[240px] w-[520px] lg:block"
              style={{
                transform: "translate3d(-50%, -130px, -70px) rotateX(76deg)",
                /* White rules on a white page are no grid at all — the light
                   theme draws the same lattice in slate ink. */
                background: isDark
                  ? "repeating-linear-gradient(90deg, rgb(255 255 255 / 0.05) 0 1px, transparent 1px 40px), repeating-linear-gradient(0deg, rgb(255 255 255 / 0.05) 0 1px, transparent 1px 40px)"
                  : "repeating-linear-gradient(90deg, rgb(15 23 42 / 0.09) 0 1px, transparent 1px 40px), repeating-linear-gradient(0deg, rgb(15 23 42 / 0.09) 0 1px, transparent 1px 40px)",
                maskImage: "radial-gradient(ellipse at center, black 28%, transparent 72%)",
                WebkitMaskImage: "radial-gradient(ellipse at center, black 28%, transparent 72%)",
              }}
            />
          )}

          {PLANES.map((plane) => (
            <AtlasPlane key={plane.label} spec={plane} full={full} />
          ))}

          {/* Orbit chips — solid fills, deeper Z means more parallax */}
          {CHIPS.map((chip) => {
            const Icon = DOCS_ICONS[chip.icon];
            return (
              <motion.div
                key={chip.label}
                className={`absolute ${chip.position}`}
                style={full ? { z: chip.z } : undefined}
                initial={full ? { opacity: 0, scale: 0.85 } : false}
                animate={{ opacity: 1, scale: 1 }}
                transition={full ? { duration: 0.25, delay: chip.delay } : { duration: 0 }}
              >
                <motion.div
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-widest transition-colors ${isDark ? "border-white/10 bg-[#0a0c18]/95 text-slate-200 shadow-[0_8px_30px_rgb(0_0_0/0.5)]" : "border-slate-200 bg-white/95 text-slate-800 shadow-[0_8px_25px_rgb(0_0_0/0.1)]"}`}
                  animate={ambient ? { y: [-4, 4] } : { y: 0 }}
                  transition={
                    ambient
                      ? {
                          duration: chip.floatDuration,
                          repeat: Infinity,
                          repeatType: "mirror",
                          ease: "easeInOut",
                        }
                      : { duration: DUR.reveal, ease: SETTLE_EASE }
                  }
                >
                  <Icon className={`h-3.5 w-3.5 ${isDark ? "text-violet-300" : "text-violet-700"}`} />
                  <span>{chip.label}</span>
                </motion.div>
              </motion.div>
            );
          })}
        </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
