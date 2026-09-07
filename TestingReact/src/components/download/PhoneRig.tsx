"use client";

/**
 * @file components/download/PhoneRig.tsx
 * @description The hero's 3D rig: float loop → settle/rest pose → pointer tilt
 * → glow plane, floor grid, phone body and three parallax chips.
 *
 * HARD RULE: no backdrop-filter, no filter, and no overflow-hidden on ANY
 * preserve-3d ancestor in this subtree — Safari silently flattens the rig.
 * The screen inside PhoneMockup owns the only overflow-hidden. Every surface
 * is a solid fill. A future "make it glassy" edit is the likeliest regression.
 *
 * Ambient budget at rest: one 8s float loop here, three tiny chip floats, and
 * the 4s sweep wedge inside ScanScreen. Nothing else moves.
 */

import React from "react";
import { motion, useTransform } from "framer-motion";
import { Lock, ScanFace, Zap, type LucideIcon } from "lucide-react";
import PhoneMockup from "./PhoneMockup";
import { DUR, LOAD, REST_POSE, SETTLE_EASE } from "./motion";
import type { DownloadMotionMode } from "./useDownloadMotionMode";
import type { TiltRig } from "./useTiltRig";

interface PhoneRigProps {
  mode: DownloadMotionMode;
  rig: TiltRig;
}

interface ChipSpec {
  icon: LucideIcon;
  /** English-only telemetry micro-label (see ScanScreen's language note). */
  label: string;
  position: string;
  z: number;
  floatDuration: number;
  delay: number;
}

const CHIPS: readonly ChipSpec[] = [
  { icon: Zap, label: "59ms", position: "-right-6 top-20", z: 90, floatDuration: 6, delay: LOAD.chipDelays[0] },
  { icon: Lock, label: "AES-256", position: "-left-10 top-1/2", z: 55, floatDuration: 7, delay: LOAD.chipDelays[1] },
  { icon: ScanFace, label: "3D depth", position: "-right-4 bottom-24", z: 70, floatDuration: 9, delay: LOAD.chipDelays[2] },
];

export default function PhoneRig({ mode, rig }: PhoneRigProps) {
  const full = mode === "full";
  const sheenX = useTransform(rig.springPx, [-0.5, 0.5], [-120, 120]);

  return (
    <motion.div
      className="relative [transform-style:preserve-3d]"
      animate={full ? { y: [-6, 6], rotateZ: [-0.5, 0.5] } : undefined}
      transition={
        full
          ? { duration: 8, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }
          : undefined
      }
    >
      {/* Settle into the three-quarter resting pose (static pose when motion is off) */}
      <motion.div
        className="[transform-style:preserve-3d]"
        initial={full ? { opacity: 0, y: 48, rotateY: -34, rotateX: REST_POSE.rotateX } : false}
        animate={{ opacity: 1, y: 0, rotateY: REST_POSE.rotateY, rotateX: REST_POSE.rotateX }}
        transition={
          full ? { duration: DUR.settle, delay: LOAD.phoneDelay, ease: SETTLE_EASE } : { duration: 0 }
        }
      >
        {/* Pointer tilt on top of the pose */}
        <motion.div
          className="[transform-style:preserve-3d]"
          style={{ rotateX: rig.rotateX, rotateY: rig.rotateY }}
        >
          {/* Glow plane, 140px behind the phone — static gradient, no filter */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] xl:h-[640px] xl:w-[640px]"
            style={{
              transform: "translate3d(-50%, -50%, -140px)",
              background:
                "radial-gradient(circle at 45% 40%, rgb(16 185 129 / 0.25), rgb(6 182 212 / 0.12) 45%, transparent 70%)",
            }}
          />

          {/* Floor grid — pure decoration; first cut if performance suffers */}
          {full && (
            <div
              className="pointer-events-none absolute left-1/2 top-full hidden h-[260px] w-[560px] lg:block"
              style={{
                transform: "translate3d(-50%, -120px, -60px) rotateX(76deg)",
                background:
                  "repeating-linear-gradient(90deg, rgb(255 255 255 / 0.05) 0 1px, transparent 1px 40px), repeating-linear-gradient(0deg, rgb(255 255 255 / 0.05) 0 1px, transparent 1px 40px)",
                maskImage: "radial-gradient(ellipse at center, black 30%, transparent 72%)",
                WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 72%)",
              }}
            />
          )}

          <PhoneMockup mode={mode} size="full" sheenX={full ? sheenX : undefined} />

          {/* Floating telemetry chips — solid fills, deeper Z ⇒ more parallax */}
          {CHIPS.map((chip) => (
            <motion.div
              key={chip.label}
              className={`absolute ${chip.position}`}
              style={full ? { z: chip.z } : undefined}
              initial={full ? { opacity: 0, scale: 0.85 } : false}
              animate={{ opacity: 1, scale: 1 }}
              transition={full ? { duration: 0.25, delay: chip.delay } : { duration: 0 }}
            >
              <motion.div
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0a1017]/95 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-widest text-slate-200 shadow-[0_8px_30px_rgb(0_0_0/0.45)]"
                animate={full ? { y: [-4, 4] } : undefined}
                transition={
                  full
                    ? {
                        duration: chip.floatDuration,
                        repeat: Infinity,
                        repeatType: "mirror",
                        ease: "easeInOut",
                      }
                    : undefined
                }
              >
                <chip.icon className="w-3.5 h-3.5 text-emerald-300" />
                <span>{chip.label}</span>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
