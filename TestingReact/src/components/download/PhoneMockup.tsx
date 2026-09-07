"use client";

/**
 * @file components/download/PhoneMockup.tsx
 * @description The CSS-built phone: casing, gradient rim, bezel, screen.
 *
 * Every surface here is a SOLID fill — this subtree lives inside a preserve-3d
 * rig, and a `backdrop-filter` or translucent stack on a 3D-transformed
 * element is exactly what flattens or shreds the effect in Safari. The screen
 * div owns the ONLY `overflow-hidden` allowed anywhere inside the rig (it has
 * no preserve-3d children, so it is safe).
 */

import React from "react";
import { motion, type MotionValue } from "framer-motion";
import ScanScreen from "./ScanScreen";
import type { DownloadMotionMode } from "./useDownloadMotionMode";

interface PhoneMockupProps {
  mode: DownloadMotionMode;
  size: "full" | "mini";
  /** Sprung sheen x-offset in px (from the tilt rig); omit for static mode. */
  sheenX?: MotionValue<number>;
}

export default function PhoneMockup({ mode, size, sheenX }: PhoneMockupProps) {
  const full = size === "full";

  return (
    <div
      className={
        full
          ? "relative h-[520px] w-[260px] sm:h-[600px] sm:w-[300px] xl:h-[660px] xl:w-[330px]"
          : "relative h-[300px] w-[150px]"
      }
    >
      {/* Casing: solid fill + 1px gradient rim via a padded gradient layer */}
      <div
        className={`absolute inset-0 ${full ? "rounded-[3.2rem]" : "rounded-[2rem]"} p-px`}
        style={{
          background:
            "linear-gradient(160deg, rgb(148 163 184 / 0.4), rgb(255 255 255 / 0.08) 40%, rgb(148 163 184 / 0.16))",
        }}
      >
        <div className={`h-full w-full bg-[#0b1017] ${full ? "rounded-[3.2rem]" : "rounded-[2rem]"}`} />
      </div>

      {/* Static left-rim highlight selling the key light */}
      <div
        className={`absolute bottom-6 left-0 top-6 w-[2px] ${full ? "rounded-[3.2rem]" : "rounded-[2rem]"}`}
        style={{
          background:
            "linear-gradient(180deg, transparent, rgb(52 211 153 / 0.55) 35%, rgb(34 211 238 / 0.45) 65%, transparent)",
        }}
      />

      {/* Screen — the one permitted overflow-hidden inside the rig */}
      <div
        className={`absolute overflow-hidden bg-[#070b12] ${
          full ? "inset-2.5 rounded-[2.6rem]" : "inset-1.5 rounded-[1.6rem]"
        }`}
      >
        {/* Notch */}
        <div
          className={`absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full bg-[#0b1017] ${
            full ? "h-5 w-24" : "h-3 w-12"
          }`}
        />

        <ScanScreen mode={mode} size={size} />

        {/* Specular sheen: the screen catches the key light as the phone turns */}
        {sheenX ? (
          <motion.div
            className="pointer-events-none absolute inset-y-0 left-1/2 w-2/3 -skew-x-12"
            style={{
              x: sheenX,
              background:
                "linear-gradient(100deg, transparent, rgb(255 255 255 / 0.05) 45%, rgb(255 255 255 / 0.09) 50%, rgb(255 255 255 / 0.05) 55%, transparent)",
            }}
          />
        ) : (
          <div
            className="pointer-events-none absolute inset-y-0 left-1/4 w-2/3 -skew-x-12"
            style={{
              background:
                "linear-gradient(100deg, transparent, rgb(255 255 255 / 0.04) 50%, transparent)",
            }}
          />
        )}
      </div>
    </div>
  );
}
