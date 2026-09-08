"use client";

/**
 * @file components/help/PageHelpButton.tsx
 * @description Header Help Button and F1 shortcut handler with 5-second contextual auto-tip.
 *
 * Features:
 * - 5-second floating tip popover on every page open prompting user to press F1.
 * - Directly routes to the corresponding article and section in /docs
 *   (e.g. /daily-report -> /docs#report-repair-operations--daily-report).
 * - F1 keyboard shortcut listener.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { BookOpen, X, Lightbulb, ExternalLink } from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";
import { resolveDocUrlForPath } from "@/lib/routeDocMap";

const TIP_DISABLED_STORAGE_KEY = "bis_help_tip_disabled";

export default function PageHelpButton() {
  const pathname = usePathname();
  const { lang } = useI18n();
  const isKhmer = lang === "km";

  const [showTip, setShowTip] = useState(false);
  const [dismissConfirm, setDismissConfirm] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 5-second tip timer on route open
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setDismissConfirm(false);

    // Don't show tip when already browsing the documentation manual
    if (pathname === "/docs") {
      setShowTip(false);
      return;
    }

    // Check if user permanently disabled the help tip
    try {
      if (typeof window !== "undefined" && localStorage.getItem(TIP_DISABLED_STORAGE_KEY) === "true") {
        setShowTip(false);
        return;
      }
    } catch {
      // Ignore localStorage access errors
    }

    setShowTip(true);
    timerRef.current = setTimeout(() => {
      setShowTip(false);
    }, 5000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [pathname]);

  const handleHelpNavigation = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setShowTip(false);
    setDismissConfirm(false);

    const targetUrl = resolveDocUrlForPath(pathname);

    if (pathname === "/docs") {
      const hash = targetUrl.split("#")[1];
      if (hash) {
        window.location.hash = hash;
      } else {
        const readerEl = document.getElementById("docs-reader");
        readerEl?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } else {
      // Open in a new tab without navigating the current page
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    }
  }, [pathname]);

  // User clicked [X] -> Pause countdown and prompt "Close once" vs "Close always"
  const handleXClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setDismissConfirm(true);
  };

  // Option 1: Close once (for this page only)
  const handleCloseOnce = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShowTip(false);
    setDismissConfirm(false);
  };

  // Option 2: Close always (save preference to localStorage)
  const handleCloseAlways = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(TIP_DISABLED_STORAGE_KEY, "true");
      }
    } catch {
      // Ignore localStorage write errors
    }
    setShowTip(false);
    setDismissConfirm(false);
  };

  // Global F1 keyboard listener for quick help
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept F1 if user is typing with alt/ctrl/meta modifiers
      if (e.key === "F1" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        handleHelpNavigation();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleHelpNavigation]);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={handleHelpNavigation}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all text-xs font-medium group active:scale-95 shadow-sm cursor-pointer ${
          showTip
            ? "border-violet-500/60 bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-2 ring-violet-500/30"
            : "border-subtle bg-cushion/80 hover:bg-sunken text-ink hover:text-accent"
        }`}
        title={isKhmer ? "ជំនួយពីការប្រើប្រាស់ទំព័រនេះ (F1) - បើកក្នុង Tab ថ្មី" : "Page Help & Documentation (F1) - Opens in new tab"}
        aria-label={isKhmer ? "ជំនួយទំព័រនេះ (F1)" : "Page Help (F1)"}
      >
        <BookOpen
          className={`w-3.5 h-3.5 transition-transform group-hover:scale-110 ${
            showTip ? "text-violet-500 animate-pulse" : "text-accent"
          }`}
        />
        <span className="hidden sm:inline font-medium">
          {isKhmer ? "ជំនួយ" : "Help"}
        </span>
        <kbd className="hidden lg:inline-flex items-center px-1 text-[9px] font-mono font-semibold rounded bg-surface border border-subtle text-ink-muted">
          F1
        </kbd>
      </button>

      {/* 5-second Floating Contextual Tip Popover */}
      {showTip && (
        <div
          onClick={dismissConfirm ? undefined : handleHelpNavigation}
          className="absolute right-0 top-full mt-2.5 z-50 rounded-xl bg-slate-900/95 text-white border border-violet-500/50 shadow-2xl backdrop-blur-md select-none transition-all animate-in fade-in slide-in-from-top-2 duration-300 hover:bg-slate-900"
          style={{ minWidth: "270px", maxWidth: "340px", cursor: dismissConfirm ? "default" : "pointer" }}
        >
          {/* Arrow indicator */}
          <div className="absolute -top-1.5 right-6 w-3 h-3 bg-slate-900 border-t border-l border-violet-500/50 rotate-45" />

          {dismissConfirm ? (
            /* Confirmation view: Close once vs Close always */
            <div className="p-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between pb-1.5">
                <span className="font-bold text-amber-300 text-[11.5px] flex items-center gap-1">
                  <span>❓ {isKhmer ? "បិទការដាស់តឿន Tip" : "Dismiss Help Tip"}</span>
                </span>
                <button
                  type="button"
                  onClick={handleCloseOnce}
                  className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-white/10 transition-colors"
                  title={isKhmer ? "បិទ" : "Close"}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-[11px] text-slate-300 leading-tight">
                {isKhmer
                  ? "តើអ្នកចង់បិទតែម្តងនេះ ឬកុំឱ្យបង្ហាញទៀតជារៀងរហូត?"
                  : "Dismiss for this page, or never show this tip again?"}
              </p>

              <div className="flex items-center gap-1.5 pt-2.5">
                <button
                  type="button"
                  onClick={handleCloseOnce}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white font-medium text-[11px] transition-all border border-white/15 text-center cursor-pointer active:scale-95"
                >
                  {isKhmer ? "បិទម្តងនេះ" : "Close once"}
                </button>
                <button
                  type="button"
                  onClick={handleCloseAlways}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-rose-500/25 hover:bg-rose-500/35 text-rose-300 hover:text-rose-200 font-semibold text-[11px] transition-all border border-rose-500/40 text-center cursor-pointer active:scale-95 shadow-sm"
                >
                  {isKhmer ? "កុំបង្ហាញទៀត" : "Close always"}
                </button>
              </div>
            </div>
          ) : (
            /* Normal tip view with 5s countdown */
            <div className="flex items-center gap-2.5 px-3 py-2">
              {/* Pulse icon */}
              <div className="relative flex h-3 w-3 shrink-0 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 relative z-10" />
              </div>

              <div className="flex-1 text-[11.5px] leading-snug">
                <div className="font-bold text-amber-300 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span>{isKhmer ? "គន្លឹះជំនួយ" : "Quick Tip"}</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-white/10 text-slate-300 font-normal font-mono">
                      5s
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-[9.5px] text-violet-300 font-normal">
                    <ExternalLink className="w-2.5 h-2.5" />
                    <span>{isKhmer ? "Tab ថ្មី" : "New tab"}</span>
                  </span>
                </div>
                <div className="text-slate-200 mt-0.5">
                  {isKhmer ? (
                    <>
                      ចុច{" "}
                      <kbd className="px-1 py-0.2 text-[10px] font-mono font-bold rounded bg-violet-500/40 border border-violet-400/40 text-violet-200">
                        F1
                      </kbd>{" "}
                      ដើម្បីបើកមើលការណែនាំ page នេះ
                    </>
                  ) : (
                    <>
                      Press{" "}
                      <kbd className="px-1 py-0.2 text-[10px] font-mono font-bold rounded bg-violet-500/40 border border-violet-400/40 text-violet-200">
                        F1
                      </kbd>{" "}
                      to open help guide in a new tab
                    </>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleXClick}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                title={isKhmer ? "បិទ" : "Close"}
              >
                <X className="w-3.5 h-3.5" />
              </button>

              {/* 5-second countdown progress bar */}
              <div className="absolute bottom-0 left-1 right-1 h-[2px] bg-white/10 overflow-hidden rounded-full">
                <div className="h-full bg-gradient-to-r from-violet-500 via-amber-400 to-emerald-400 animate-tip-countdown" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


