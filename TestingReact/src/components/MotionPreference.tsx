"use client";

import React from "react";
import { MotionConfig } from "framer-motion";
import { useTheme } from "@/theme/ThemeProvider";

/**
 * @file components/MotionPreference.tsx
 * @description Bridges the app's own motion setting to framer-motion.
 *
 * This exists because the reduced-motion rules in `globals.css` cannot reach
 * a framer animation. Both blocks there work by overriding
 * `animation-duration` / `transition-duration` with `!important`, which
 * collapses every CSS keyframe and CSS transition in the app — but framer
 * drives `opacity` and `transform` as inline styles written from JavaScript on
 * each frame. There is no CSS animation or transition on the element for those
 * `!important` rules to shorten, so without this component a user who had
 * switched motion off would still get the full page transition and the full
 * sidebar spring.
 *
 * Two sources, matching the two the stylesheet already honours:
 *
 * - `reducedMotion="user"` follows the OS `prefers-reduced-motion` setting,
 *   the same signal as the `@media` block.
 * - `"always"` is forced when the in-app switch is set, mirroring the
 *   `html[data-motion="reduced"]` block. That switch exists because someone may
 *   want a calm interface without changing a system-wide accessibility
 *   preference — on a shared workshop PC the OS setting is not theirs to
 *   change.
 *
 * Framer's reduced-motion mode disables transform and layout animations while
 * still allowing opacity to cross-fade, so navigation stays legible rather
 * than becoming an instant, disorienting cut.
 *
 * Must be mounted inside `<ThemeProvider>` — `useTheme()` throws otherwise.
 */
export default function MotionPreference({
  children,
}: {
  children: React.ReactNode;
}) {
  const { prefs } = useTheme();

  return (
    <MotionConfig reducedMotion={prefs.motion === "reduced" ? "always" : "user"}>
      {children}
    </MotionConfig>
  );
}
