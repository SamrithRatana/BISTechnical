"use client";

/**
 * @file components/login/LoginBackdrop.tsx
 * @description The Prismwell depth field behind the card: cyber grid,
 * perspective floor, three concentric depth rings sliding at different rates
 * (the tunnel-into-the-screen read, borders only — near-zero paint), one
 * drifting aurora + one static glow (the right orb was deliberately demoted
 * from a drift to fund the ring/shard layers), and a three-tier particle
 * field — every chromatic surface tinted from the accent triad.
 *
 * Everything is `fixed`, `pointer-events-none` and transform/opacity only.
 * Ambient budget (full mode): ONE aurora drift + one particle-tier drift.
 * `frozen` pauses both while a QR or camera is on screen — ambient motion
 * behind a live camera preview is distraction with no payoff. Static mode
 * renders the same composition frozen at rest.
 */

import React from "react";
import { motion, useTransform, type MotionValue } from "framer-motion";
import { useTheme } from "@/theme/ThemeProvider";
import { PARTICLES } from "./constants";
import { CURTAIN_EASE, DUR } from "./motion";
import type { HoloTriad } from "./color";
import type { LoginMotionMode } from "./useLoginMotionMode";

interface LoginBackdropProps {
  mode: LoginMotionMode;
  /** Which side the curtain currently covers — the auroras lean away from it. */
  curtainSide: "left" | "right";
  /** True while a QR or the camera is visible — pauses the ambient drifts. */
  frozen: boolean;
  springPx: MotionValue<number>;
  springPy: MotionValue<number>;
  holo: HoloTriad;
}

/** Parallax multipliers per particle tier (near tiers slide more). */
const TIER_RANGE = [16, 24, 34] as const;

/** Tier-filtered once at module scope — the split never changes at runtime. */
const TIER_PARTICLES = [0, 1, 2].map((t) => PARTICLES.filter((p) => p.tier === t));

/**
 * Ambient drift keyframes START AND END AT REST: the loops pause while
 * `frozen` (framer holds the current value) and a resume jumps to the FIRST
 * keyframe — starting from 0 keeps that jump as small as it can be without
 * animation-controls plumbing.
 */
const AURORA_DRIFT = [0, -18, 0, 18, 0];
const PARTICLE_DRIFT = [0, -10, 0, 10, 0];

function LoginBackdrop({
  mode,
  curtainSide,
  frozen,
  springPx,
  springPy,
  holo,
}: LoginBackdropProps) {
  const full = mode === "full";
  const ambient = full && !frozen;
  const { isDark } = useTheme();

  // Parallax depths: far grid barely moves, rings/auroras drift, near
  // particles move the most. Signs are negative so the field slides opposite
  // the pointer.
  const gridX = useTransform(springPx, [-0.5, 0.5], [6, -6]);
  const gridY = useTransform(springPy, [-0.5, 0.5], [4, -4]);
  const ringNearX = useTransform(springPx, [-0.5, 0.5], [8, -8]);
  const ringNearY = useTransform(springPy, [-0.5, 0.5], [6, -6]);
  const ringMidX = useTransform(springPx, [-0.5, 0.5], [12, -12]);
  const ringMidY = useTransform(springPy, [-0.5, 0.5], [9, -9]);
  const ringFarX = useTransform(springPx, [-0.5, 0.5], [18, -18]);
  const ringFarY = useTransform(springPy, [-0.5, 0.5], [13, -13]);
  const auroraX = useTransform(springPx, [-0.5, 0.5], [14, -14]);
  const auroraY = useTransform(springPy, [-0.5, 0.5], [10, -10]);
  const tier0X = useTransform(springPx, [-0.5, 0.5], [TIER_RANGE[0], -TIER_RANGE[0]]);
  const tier0Y = useTransform(springPy, [-0.5, 0.5], [TIER_RANGE[0] * 0.7, -TIER_RANGE[0] * 0.7]);
  const tier1X = useTransform(springPx, [-0.5, 0.5], [TIER_RANGE[1], -TIER_RANGE[1]]);
  const tier1Y = useTransform(springPy, [-0.5, 0.5], [TIER_RANGE[1] * 0.7, -TIER_RANGE[1] * 0.7]);
  const tier2X = useTransform(springPx, [-0.5, 0.5], [TIER_RANGE[2], -TIER_RANGE[2]]);
  const tier2Y = useTransform(springPy, [-0.5, 0.5], [TIER_RANGE[2] * 0.7, -TIER_RANGE[2] * 0.7]);
  const tiers = [
    { x: tier0X, y: tier0Y },
    { x: tier1X, y: tier1Y },
    { x: tier2X, y: tier2Y },
  ];

  const modeShift = curtainSide === "right" ? -40 : 40;
  const leanTransition = full
    ? { duration: DUR.curtain, ease: CURTAIN_EASE }
    : { duration: 0 };

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {/* Light mode: elegant textured canvas with subtle micro-dots and gentle ambient glow */}
      <div className="absolute inset-0 dark:hidden pointer-events-none overflow-hidden">
        {/* Subtle mesh background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-100/80 via-[#edf2f7] to-slate-200/60" />
        {/* Clean subtle dot texture */}
        <div className="absolute inset-0 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:24px_24px] opacity-25" />
        {/* Soft top-left ambient aura */}
        <div
          className="absolute -top-32 left-[10%] w-[800px] h-[600px] rounded-full blur-[150px] opacity-60 pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${holo.a}30 0%, ${holo.b}18 45%, transparent 70%)`,
          }}
        />
        {/* Soft bottom-right ambient aura */}
        <div
          className="absolute -bottom-28 right-[10%] w-[700px] h-[550px] rounded-full blur-[150px] opacity-50 pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${holo.c}28 0%, ${holo.b}15 45%, transparent 70%)`,
          }}
        />
      </div>

      {/* Far plane: cyber grid (Dark mode only) */}
      <motion.div
        style={{ x: gridX, y: gridY }}
        className="absolute -inset-4 hidden dark:block bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:32px_32px]"
      />

      {/* Depth rings (Dark mode only) */}
      <div className="absolute inset-0 hidden dark:lg:flex items-center justify-center">
        <motion.div
          style={{ x: ringNearX, y: ringNearY }}
          className="absolute w-[720px] h-[540px] rounded-full border border-white/[0.06]"
        />
        <motion.div
          style={{ x: ringMidX, y: ringMidY, scale: 1.35 }}
          className="absolute w-[720px] h-[540px] rounded-full border border-white/[0.04]"
        />
        <motion.div
          style={{ x: ringFarX, y: ringFarY, scale: 1.8 }}
          className="absolute w-[720px] h-[540px] rounded-full border border-white/[0.025]"
        />
      </div>

      {/* Perspective floor (Dark mode only) */}
      <div
        className="absolute left-1/2 bottom-[-60px] w-[1400px] h-[340px] hidden dark:block opacity-35"
        style={{
          transform: "translateX(-50%) rotateX(76deg)",
          background: `repeating-linear-gradient(90deg, ${holo.a}14 0 1px, transparent 1px 44px), repeating-linear-gradient(0deg, rgb(255 255 255 / 0.05) 0 1px, transparent 1px 44px)`,
          maskImage: "radial-gradient(ellipse at 50% 30%, black 25%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 30%, black 25%, transparent 70%)",
        }}
      />

      {/* Mid plane: drifting aurora (dark mode only — leans away from the curtain) */}
      <motion.div
        animate={{ x: modeShift }}
        transition={leanTransition}
        className="absolute -top-[15%] left-[18%] w-[650px] xl:w-[850px] h-[550px] xl:h-[750px] hidden dark:block"
        style={{ willChange: "transform" }}
      >
        <motion.div style={{ x: auroraX, y: auroraY, willChange: "transform" }} className="w-full h-full">
          <motion.div
            animate={ambient ? { y: AURORA_DRIFT } : undefined}
            transition={
              ambient
                ? { duration: 18, repeat: Infinity, ease: "easeInOut" }
                : undefined
            }
            className="w-full h-full rounded-full blur-3xl opacity-40"
            style={{
              willChange: "transform",
              background: `radial-gradient(circle, ${holo.a} 0%, ${holo.b}26 45%, transparent 70%)`,
            }}
          />
        </motion.div>
      </motion.div>

      {/* Static glow (dark mode only) */}
      <motion.div
        animate={{ x: -modeShift }}
        transition={leanTransition}
        className="absolute -bottom-[20%] right-[12%] w-[600px] xl:w-[800px] h-[500px] xl:h-[700px] hidden dark:block"
        style={{ willChange: "transform" }}
      >
        <motion.div style={{ x: auroraX, y: auroraY, willChange: "transform" }} className="w-full h-full">
          <div
            className="w-full h-full rounded-full blur-3xl opacity-35"
            style={{
              background: `radial-gradient(circle, ${holo.c}4d 0%, ${holo.b}24 45%, transparent 70%)`,
            }}
          />
        </motion.div>
      </motion.div>

      {/* Near plane: particle field (dark mode only) */}
      <div className="absolute inset-0 hidden dark:sm:block">
        {tiers.map((tier, tierIdx) => (
          <motion.div
            key={tierIdx}
            style={{ x: tier.x, y: tier.y, willChange: "transform" }}
            className="absolute inset-0 pointer-events-none"
          >
            <motion.div
              animate={ambient && tierIdx === 2 ? { y: PARTICLE_DRIFT } : undefined}
              transition={
                ambient && tierIdx === 2
                  ? { duration: 14, repeat: Infinity, ease: "easeInOut" }
                  : undefined
              }
              className="w-full h-full"
              style={{ willChange: tierIdx === 2 ? "transform" : "auto" }}
            >
              {TIER_PARTICLES[tierIdx].map((p, i) => (
                <span
                  key={i}
                  className="absolute rounded-full bg-white shadow-xs"
                  style={{
                    left: p.left,
                    top: p.top,
                    width: p.size,
                    height: p.size,
                    opacity: p.opacity,
                  }}
                />
              ))}
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Atmosphere: top light + vignette (dark mode only) */}
      <div className="absolute inset-0 hidden dark:block bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.12),rgba(255,255,255,0))]" />
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          background: `radial-gradient(circle 800px at 50% 50%, ${holo.a}0f, transparent 100%)`,
        }}
      />
    </div>
  );
}

/**
 * Memoised: the page re-renders on every credential keystroke, and this is
 * its heaviest decorative subtree (20 useTransforms + 3 particle tiers).
 * Every prop is a primitive, a memoised triad, or a stable MotionValue, so
 * the shallow compare actually holds.
 */
export default React.memo(LoginBackdrop);
