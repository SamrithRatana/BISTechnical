"use client";

/**
 * @file components/login/FocusChrome.tsx
 * @description The Prismwell input-focus chrome: a pre-painted elevation
 * shadow and gradient rim (opacity-crossfaded — never an animated
 * box-shadow), plus target-lock corner ticks that slide 3px inward. All
 * CSS-only via group-focus-within so typing never touches framer, every
 * transition guarded with `motion-reduce:transition-none` (globals.css
 * deliberately leaves CSS alone under data-lite, so these files gate
 * themselves).
 */

import React from "react";
import type { HoloTriad } from "./color";

/** Rim + elevation around one input. Render INSIDE a `relative group` wrapper, before the input. */
export function FocusChrome({ holo }: { holo: HoloTriad }) {
  return (
    <>
      {/* Pre-painted elevation shadow, opacity-crossfaded on focus */}
      <span
        className="pointer-events-none absolute -inset-1 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-200 motion-reduce:transition-none"
        style={{ boxShadow: `0 10px 28px -8px ${holo.a}40` }}
      />
      {/* Gradient rim, 1px proud of the input (the input goes border-transparent on focus) */}
      <span
        className="pointer-events-none absolute -inset-px rounded-[13px] opacity-0 group-focus-within:opacity-100 transition-opacity duration-200 motion-reduce:transition-none"
        style={{ background: `linear-gradient(100deg, ${holo.a}99, ${holo.b}66)` }}
      />
    </>
  );
}

/** Target-lock corner ticks — rendered AFTER the input so they paint above it. */
export function CornerTicks({ holo }: { holo: HoloTriad }) {
  const base =
    "pointer-events-none absolute w-2 h-2 opacity-0 group-focus-within:opacity-100 group-focus-within:translate-x-0 group-focus-within:translate-y-0 transition-[opacity,transform] duration-200 motion-reduce:transition-none";
  return (
    <>
      <span
        className={`${base} left-0 top-0 border-l border-t rounded-tl-md -translate-x-[3px] -translate-y-[3px]`}
        style={{ borderColor: holo.a }}
      />
      <span
        className={`${base} right-0 bottom-0 border-r border-b rounded-br-md translate-x-[3px] translate-y-[3px]`}
        style={{ borderColor: holo.b }}
      />
    </>
  );
}
