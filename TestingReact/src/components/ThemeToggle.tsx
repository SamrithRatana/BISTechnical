"use client";

import React, { useCallback } from "react";
import { motion } from "framer-motion";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/theme/ThemeProvider";
import { useI18n } from "@/i18n/LanguageProvider";
import type { ModeName } from "@/theme/themeConfig";
import type { TranslationKey } from "@/i18n/translations";
import { MODAL_SPRING } from "@/lib/animations";
import { cn } from "@/lib/utils";

/**
 * @file components/ThemeToggle.tsx
 * @description The light / dark / follow-system control in the header.
 *
 * ── Three states, not two ──────────────────────────────────────────────────
 *
 * A plain two-way switch cannot express "follow my machine", and dropping that
 * option would mean every user who wants it has to re-toggle this app whenever
 * their OS flips. So the button cycles light → dark → system, showing the
 * state it is currently IN rather than the one it would move to. Showing the
 * destination is a common shortcut and it is ambiguous the moment a third
 * state exists — a sun could mean "you are in light" or "click for light".
 *
 * `aria-label` therefore carries the current state as words, since the icon
 * alone is exactly the thing a screen reader user cannot see. The `title`
 * carries the same text for pointer users.
 *
 * ── Why `isDark` and not `prefs.mode` for the icon ─────────────────────────
 *
 * Under `system` neither light nor dark is "the preference", so the component
 * shows a monitor glyph for that state and uses the resolved `isDark` only to
 * tint it — that way the button still reflects what is on screen when the OS
 * decides. `isDark` comes from the provider because resolving it needs
 * `matchMedia`, which is not something a render should reach for directly.
 */

/**
 * Where the next click goes.
 *
 * Not a fixed `light -> dark -> system` ring, and the reason is worth keeping.
 * The shipped default is `system`, and most machines here are set to light —
 * so a fixed ring starting `system -> light` meant the very first click a new
 * user ever made changed nothing on screen. Measured in the browser: mode went
 * `system` to `light`, `<html>` kept no `.dark` class, the body background
 * stayed `rgb(243, 245, 244)`. A control whose first use appears broken is
 * worse than one with a slightly irregular order.
 *
 * So from `system` the next mode is whichever is the OPPOSITE of what is
 * currently on screen, which guarantees a visible change. The remaining step
 * (`light -> system`) can land on the same appearance, but that is the one
 * click where the *point* is opting back into following the OS, and the icon
 * changing to the monitor glyph says so.
 */
function nextMode(mode: ModeName, isDark: boolean): ModeName {
  if (mode === "system") return isDark ? "light" : "dark";
  if (mode === "dark") return "light";
  return "system";
}

const MODE_LABEL: Record<ModeName, TranslationKey> = {
  light: "theme.light",
  dark: "theme.dark",
  system: "theme.system",
};

export default function ThemeToggle({ className }: { className?: string }) {
  const { prefs, update, isDark } = useTheme();
  const { t } = useI18n();

  const mode = prefs.mode;
  const Icon = mode === "system" ? Monitor : mode === "dark" ? Moon : Sun;

  const cycle = useCallback(() => {
    update({ mode: nextMode(mode, isDark) });
  }, [mode, isDark, update]);

  const label = `${t("theme.toggle")} — ${t(MODE_LABEL[mode])}`;

  return (
    <button
      type="button"
      onClick={cycle}
      title={label}
      aria-label={label}
      className={cn(
        "relative grid place-items-center w-9 h-9 rounded-xl",
        "text-ink-secondary hover:text-ink hover:bg-cushion",
        "border border-transparent hover:border-subtle",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring",
        className
      )}
    >
      {/*
        Keyed on the mode so the icon genuinely remounts and animates. Without
        the key React swaps the SVG's path data in place and nothing moves —
        the same reason `PageTransition` keys on the pathname.

        Rotate + scale rather than a cross-fade: at 18px a fade between two
        line icons reads as a smudge, where a quarter-turn reads as a switch
        being thrown.
      */}
      <motion.span
        key={mode}
        initial={{ opacity: 0, rotate: -70, scale: 0.6 }}
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        transition={MODAL_SPRING}
        className={cn("grid place-items-center", isDark && "text-accent-bright")}
      >
        <Icon className="w-[18px] h-[18px]" />
      </motion.span>
    </button>
  );
}
