"use client";

/**
 * @file components/login/LoginStage.tsx
 * @description The 3D rig around the card — the Prismwell strata. Perspective
 * → pointer tilt → depth planes as SIBLINGS on the preserve-3d plane (never
 * inside the flat card): a deep echo plane at −160px, the glow plane at −90px
 * (now lagging the card slightly for perceived volume), the card itself, and
 * two front glass shards floating at +56/+96px that "extrude" out of the card
 * on load. Shards ride WITH the pointer while the backdrop parallaxes against
 * it — opposite travel at different depths is what sells the volume.
 *
 * HARD RULE (inherited from download/PhoneRig): no backdrop-filter, no filter,
 * and no overflow-hidden on ANY preserve-3d ancestor in this subtree — Safari
 * silently flattens the rig. Every 3D surface is a solid fill or unblurred
 * gradient. All depth planes are hidden below lg.
 */

import React from "react";
import { motion, useTransform } from "framer-motion";
import { DUR, LOAD, SETTLE_EASE, SHARD_DELAYS } from "./motion";
import type { HoloTriad } from "./color";
import type { LoginMotionMode } from "./useLoginMotionMode";
import type { LoginTiltRig } from "./useLoginTilt";

interface LoginStageProps {
  mode: LoginMotionMode;
  rig: LoginTiltRig;
  holo: HoloTriad;
  children: React.ReactNode;
}

export default function LoginStage({ mode, rig, holo, children }: LoginStageProps) {
  const full = mode === "full";

  // The glow plane trails the card by ±10px off the same springs — free
  // perceived volume, zero new listeners.
  const glowLagX = useTransform(rig.springPx, [-0.5, 0.5], [10, -10]);
  const glowLagY = useTransform(rig.springPy, [-0.5, 0.5], [8, -8]);

  // Front shards ride WITH the pointer (backdrop rides against it); the
  // nearer shard moves more.
  const shardNearX = useTransform(rig.springPx, [-0.5, 0.5], [-16, 16]);
  const shardNearY = useTransform(rig.springPy, [-0.5, 0.5], [-12, 12]);
  const shardFarX = useTransform(rig.springPx, [-0.5, 0.5], [-10, 10]);
  const shardFarY = useTransform(rig.springPy, [-0.5, 0.5], [-7, 7]);

  const shardEntrance = (z: number, delay: number) =>
    full
      ? {
          initial: { opacity: 0, z: 0 },
          animate: { opacity: 1, z },
          transition: { duration: DUR.card, delay: LOAD.cardDelay + delay, ease: SETTLE_EASE },
        }
      : { initial: false as const, animate: { opacity: 1, z } };

  return (
    <div
      className="w-full max-w-md lg:max-w-3xl xl:max-w-[920px] 2xl:max-w-[980px] my-1 sm:my-1.5 lg:my-auto relative z-10 shrink-0 [perspective:1600px]"
      onPointerMove={rig.onPointerMove}
      onPointerLeave={rig.onPointerLeave}
    >
      <motion.div
        style={{ rotateX: rig.rotateX, rotateY: rig.rotateY, willChange: "transform" }}
        className="relative [transform-style:preserve-3d]"
      >
        {/* Deep echo plane 160px behind (dark mode only) */}
        <motion.div
          initial={full ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={full ? { duration: DUR.card, delay: LOAD.cardDelay, ease: SETTLE_EASE } : { duration: 0 }}
          className="pointer-events-none absolute -inset-4 hidden dark:lg:block rounded-3xl"
          style={{
            z: -160,
            scale: 0.94,
            willChange: "opacity",
            background: `radial-gradient(ellipse at 50% 45%, ${holo.a}14, transparent 70%)`,
          }}
        />

        {/* Glow plane 90px behind (dark mode only) */}
        <motion.div
          className="pointer-events-none absolute -inset-8 hidden dark:lg:block"
          style={{
            x: glowLagX,
            y: glowLagY,
            z: -90,
            willChange: "transform",
            background: `radial-gradient(ellipse at 50% 42%, ${holo.a}2e, ${holo.c}1a 48%, transparent 72%)`,
          }}
        />

        {/* Card entrance — a separate layer so settle and tilt never fight
            over the same transform */}
        <motion.div
          initial={full ? { opacity: 0, y: 16, scale: 0.985 } : false}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={full ? { duration: DUR.card, delay: LOAD.cardDelay, ease: SETTLE_EASE } : { duration: 0 }}
          style={{ willChange: "transform, opacity" }}
        >
          {children}
        </motion.div>

        {/* Front shards (dark mode only) */}
        <motion.div
          {...shardEntrance(56, SHARD_DELAYS[0])}
          style={{
            x: shardFarX,
            y: shardFarY,
            rotate: -10,
            border: `1px solid ${holo.b}66`,
            background: `linear-gradient(120deg, ${holo.b}1f, transparent)`,
          }}
          className="pointer-events-none absolute -top-6 -right-10 w-28 h-10 rounded-lg hidden dark:lg:block"
        />
        <motion.div
          {...shardEntrance(96, SHARD_DELAYS[1])}
          style={{
            x: shardNearX,
            y: shardNearY,
            rotate: 8,
            border: `1px solid ${holo.c}66`,
            background: `linear-gradient(120deg, ${holo.c}1f, transparent)`,
          }}
          className="pointer-events-none absolute -bottom-8 -left-12 w-20 h-8 rounded-lg hidden dark:lg:block"
        />
      </motion.div>
    </div>
  );
}
