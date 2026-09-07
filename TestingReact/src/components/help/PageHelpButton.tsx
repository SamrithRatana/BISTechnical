"use client";

/**
 * @file components/help/PageHelpButton.tsx
 * @description Header Help Button and F1 shortcut handler.
 *
 * Mounts in the global Header and triggers the PageHelpDrawer.
 * Features:
 * - F1 keyboard shortcut listener (press F1 on any screen to open help).
 * - Responsive display: icon + label on desktop, compact icon button on mobile.
 * - Tooltip displaying the help action.
 */

import React, { useState, useEffect } from "react";
import { HelpCircle, BookOpen } from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";
import PageHelpDrawer from "./PageHelpDrawer";

export default function PageHelpButton() {
  const [isOpen, setIsOpen] = useState(false);
  const { lang } = useI18n();
  const isKhmer = lang === "km";

  // Global F1 keyboard listener for quick help
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept F1 if user is typing in an input with other modifier keys
      if (e.key === "F1") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-subtle bg-cushion/80 hover:bg-sunken text-ink hover:text-accent transition-all text-xs font-medium group active:scale-95 shadow-sm"
        title={isKhmer ? "ជំនួយ និងរបៀបប្រើប្រាស់ទំព័រនេះ (F1)" : "Page Help & Documentation (F1)"}
        aria-label={isKhmer ? "ជំនួយទំព័រនេះ (F1)" : "Page Help (F1)"}
      >
        <BookOpen className="w-3.5 h-3.5 text-accent transition-transform group-hover:scale-110" />
        <span className="hidden sm:inline font-medium">
          {isKhmer ? "ជំនួយ" : "Help"}
        </span>
        <kbd className="hidden lg:inline-flex items-center px-1 text-[9px] font-mono font-semibold rounded bg-surface border border-subtle text-ink-muted">
          F1
        </kbd>
      </button>

      <PageHelpDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
