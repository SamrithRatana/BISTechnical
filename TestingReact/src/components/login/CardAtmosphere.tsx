"use client";

/**
 * @file components/login/CardAtmosphere.tsx
 * @description The card's interior light — Prismwell dual-lobe interference.
 * Two pre-painted radial lobes in COMPANION hues roam the card off the same
 * sprung pointer, the second on an inverted lagged mapping, so as the pointer
 * moves the hues cross and the interior visibly shifts temperature. Both are
 * MOVED via transform (never a repainted `background` at the cursor); when
 * the rig is frozen the springs rest at 0 and both lobes sit centered.
 *
 * Plus the light beam sweeping the top rim and a static film-grain texture.
 * The beam is gated off while `frozen` — a moving glint crossing a live QR
 * or camera preview is exactly what the freeze exists to prevent (this gate
 * was missing in v1: the beam kept sweeping over the QR).
 *
 * The grain is an SVG-noise background-image — rasterized once, no live
 * filter, so it is safe inside the 3D-transformed subtree. All layers are
 * pointer-events-none and sit under the content columns (z-10).
 */

import React from "react";
import { motion, useTransform } from "framer-motion";
import { BEAM_SWEEP } from "./motion";
import type { HoloTriad } from "./color";
import type { LoginMotionMode } from "./useLoginMotionMode";
import type { LoginTiltRig } from "./useLoginTilt";

/** Lightweight rasterized dot-matrix grain, tiled at 24px (zero SVG filter computation). */
const GRAIN_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='0.75' fill='%23ffffff' fill-opacity='0.15'/%3E%3C/svg%3E\")";

interface CardAtmosphereProps {
  rig: LoginTiltRig;
  holo: HoloTriad;
  mode: LoginMotionMode;
  /** True while a QR or the camera is visible — kills the rim beam. */
  frozen: boolean;
}

export default function CardAtmosphere({ rig, holo, mode, frozen }: CardAtmosphereProps) {
  const full = mode === "full";

  // Lobe A roams with the pointer; lobe B counters it on a lagged inverse
  // mapping — same springs, no new listeners. Where they cross, hues mix.
  const lobeAX = useTransform(rig.springPx, [-0.5, 0.5], [-420, 420]);
  const lobeAY = useTransform(rig.springPy, [-0.5, 0.5], [-240, 240]);
  const lobeBX = useTransform(rig.springPx, [-0.5, 0.5], [280, -280]);
  const lobeBY = useTransform(rig.springPy, [-0.5, 0.5], [160, -160]);

  return (
    <>
      {/* Interference lobe A — the accent hue */}
      <motion.div
        style={{
          x: lobeAX,
          y: lobeAY,
          willChange: "transform",
          background: `radial-gradient(circle, ${holo.a}1c 0%, ${holo.a}08 38%, transparent 62%)`,
        }}
        className="pointer-events-none absolute left-1/2 top-1/2 -ml-[320px] -mt-[320px] w-[640px] h-[640px] rounded-full z-0"
      />

      {/* Interference lobe B — companion hue, counter-roaming */}
      <motion.div
        style={{
          x: lobeBX,
          y: lobeBY,
          willChange: "transform",
          background: `radial-gradient(circle, ${holo.b}14 0%, ${holo.b}06 40%, transparent 62%)`,
        }}
        className="pointer-events-none absolute left-1/2 top-1/2 -ml-[190px] -mt-[190px] w-[380px] h-[380px] rounded-full z-0"
      />

      {/* Film grain */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.02] dark:opacity-[0.04]"
        style={{ backgroundImage: GRAIN_URI }}
      />

      {/* Beam sweeping the top rim (full mode only, never over a QR/camera;
          the static rim light in page.tsx keeps the edge defined when off) */}
      <div className="pointer-events-none absolute top-0 inset-x-8 h-px overflow-hidden z-30">
        {full && !frozen && (
          <motion.div
            className="h-full w-1/4"
            style={{
              background: `linear-gradient(90deg, transparent, ${holo.a}cc 40%, ${holo.b}99 60%, transparent)`,
            }}
            animate={{ x: ["-100%", "400%"] }}
            transition={{
              duration: BEAM_SWEEP.duration,
              repeatDelay: BEAM_SWEEP.repeatDelay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}
      </div>
    </>
  );
}
