"use client";

/**
 * @file components/login/CardRim.tsx
 * @description The card's chromatic edge — the Prismwell signature surface.
 * Two pre-painted conic-gradient underlays sit 1px proud of the opaque card;
 * their opacities crossfade from the sprung pointer, so moving the mouse
 * left/right makes the rim light appear to ROTATE around the card with zero
 * repaint (opacity composites; both layers are painted once).
 *
 * Deliberately the mask-free underlay technique: mask-composite inside a 3D
 * subtree is Safari roulette, and this subtree sits on the tilt rig. When the
 * springs rest at 0 (static mode, QR/camera freeze) both layers sit at 0.55 —
 * a complete symmetric ring, so the frozen state is designed, not degraded.
 *
 * The refraction flash: when the curtain settles after a sweep, a third
 * pre-painted layer spikes opacity once — the passing plane of light
 * "charging" the card's edge. Keyed on `flipKey` so it replays per sweep.
 */

import React from "react";
import { motion, useTransform } from "framer-motion";
import { DUR, SHEAR } from "./motion";
import type { HoloTriad } from "./color";
import type { LoginMotionMode } from "./useLoginMotionMode";
import type { LoginTiltRig } from "./useLoginTilt";

interface CardRimProps {
  rig: LoginTiltRig;
  holo: HoloTriad;
  mode: LoginMotionMode;
  /** True while a QR or the camera is visible — no moving light survives it. */
  frozen: boolean;
  /** Changes whenever the curtain flips — triggers the refraction flash. */
  flipKey: string;
}

export default function CardRim({ rig, holo, mode, frozen, flipKey }: CardRimProps) {
  const full = mode === "full";

  // Left pointer → underlay A dominates; right → underlay B. Rest = 0.55/0.55.
  const opacityA = useTransform(rig.springPx, [-0.5, 0.5], [0.85, 0.25]);
  const opacityB = useTransform(rig.springPx, [-0.5, 0.5], [0.25, 0.85]);

  return (
    <div className="pointer-events-none absolute -inset-px rounded-[inherit] z-0 hidden dark:block" aria-hidden>
      <motion.div
        style={{
          opacity: opacityA,
          willChange: "opacity",
          background: `conic-gradient(from 200deg, transparent, ${holo.b}80 20%, ${holo.a}cc 45%, transparent 70%)`,
        }}
        className="absolute inset-0 rounded-[inherit]"
      />
      <motion.div
        style={{
          opacity: opacityB,
          willChange: "opacity",
          background: `conic-gradient(from 20deg, transparent, ${holo.c}80 20%, ${holo.b}cc 45%, transparent 70%)`,
        }}
        className="absolute inset-0 rounded-[inherit]"
      />

      {/* Refraction flash — one shot per curtain flip. Desktop only (below
          lg there is no curtain to refract) and never while a QR/camera is
          on screen. */}
      {full && !frozen && (
        <motion.div
          key={flipKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.45, 0] }}
          transition={{
            duration: SHEAR.flashDuration,
            // Land the flash as the curtain's long ease tail settles.
            delay: DUR.curtain * 0.7,
            times: [0, 0.4, 1],
          }}
          style={{
            background: `conic-gradient(from 20deg, transparent, ${holo.c}b3 20%, ${holo.b}e6 45%, transparent 70%)`,
          }}
          className="absolute inset-0 rounded-[inherit] hidden lg:block"
        />
      )}
    </div>
  );
}
