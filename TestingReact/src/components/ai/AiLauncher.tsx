"use client";

/**
 * @file ai/AiLauncher.tsx
 * @description Animated floating Robot AI Assistant launcher.
 *
 * Behavior:
 * - Full-body Robot (with arms & legs "មានដៃមានជើង") pops out ONLY on JWT login success,
 *   waves hand "Hi 👋", displays speech bubble for 6 seconds, and retracts back inside.
 * - On Hover (ពេល Hover): Peeks just the cute Robot Head out above the capsule button (`robot-head-peek`).
 * - Clicking launcher opens the AI Assistant chat panel.
 * - Logging out and logging in again triggers full greeting sequence once more.
 */

import React, { useCallback, useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Sparkles, X, Bot } from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";
import { useAiAssistant } from "./AiAssistantProvider";
import RobotMascot from "./RobotMascot";

type RobotState = "poppedOut" | "retracting" | "hidden";

export default function AiLauncher() {
  const ai = useAiAssistant();
  const { t, lang } = useI18n();
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  const [robotState, setRobotState] = useState<RobotState>("hidden");
  const [showGreeting, setShowGreeting] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isKhmer = lang === "km";

  /**
   * Every pending timer this component owns, so unmounting can cancel all of
   * them. There used to be a single ref holding only the 6s greeting timer,
   * while the two 500ms retract timers that follow it were fired bare — so
   * navigating away mid-greeting left them running to completion against a
   * component that no longer existed, and React logged a state update on an
   * unmounted component. One entry per timer, cleared in one place.
   */
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const later = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, ms);
    timersRef.current.add(id);
    return id;
  }, []);

  /** Cancels every pending timer and returns the mascot to rest. */
  const cancelTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current.clear();
  }, []);

  // Check if AI search backend feature is enabled
  useEffect(() => {
    // Aborted on unmount so a slow reply can't resolve into a dead component.
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/ai-search", { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        setEnabled(Boolean(data.enabled));
      } catch {
        // Leave the launcher hidden rather than offering a dead chat.
      }
    })();
    return () => controller.abort();
  }, []);

  // ── Trigger Pop-out Greeting ONLY AFTER JWT Login Success ──────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    // On Login page: Robot stays inside button, no pop-out greeting
    if (pathname === "/login") {
      later(() => {
        setRobotState("hidden");
        setShowGreeting(false);
      }, 0);
      return cancelTimers;
    }

    const token = localStorage.getItem("jwt_token");
    const hasGreeted = sessionStorage.getItem("robot_greeted");

    // Only greet if user is logged in AND hasn't been greeted in this login session
    if (token && hasGreeted !== "true") {
      later(() => {
        setRobotState("poppedOut");
        setShowGreeting(true);
      }, 0);

      // Exactly 6 seconds duration for greeting & waving
      later(() => {
        setRobotState("retracting");
        setShowGreeting(false);
        sessionStorage.setItem("robot_greeted", "true");

        later(() => {
          setRobotState("hidden");
        }, 500); // match animate-robot-pop-in duration
      }, 6000);
    } else {
      later(() => {
        setRobotState("hidden");
        setShowGreeting(false);
      }, 0);
    }

    // Runs on unmount *and* on every navigation. Navigating mid-greeting used
    // to leave the 6s timer running and then start a second one on the new
    // page — two overlapping sequences fighting over one piece of state, with
    // the loser firing into an unmounted tree. Cancelling first means at most
    // one sequence is ever in flight, and `robot_greeted` still guarantees the
    // greeting itself happens once per login.
    return cancelTimers;
  }, [pathname, later, cancelTimers]);

  if (
    pathname === "/login" ||
    pathname?.startsWith("/scanner") ||
    pathname?.startsWith("/download") ||
    pathname?.startsWith("/docs") ||
    pathname?.startsWith("/open-app") ||
    !ai ||
    !enabled ||
    ai.open ||
    typeof document === "undefined"
  ) {
    return null;
  }

  const handleOpenChat = () => {
    ai.setOpen(true);
    ai.refreshModels();
  };

  const handleManualRetract = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowGreeting(false);
    setRobotState("retracting");
    later(() => {
      setRobotState("hidden");
    }, 500);
  };

  return createPortal(
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="fixed bottom-5 right-5 z-[90] flex flex-col items-end select-none"
    >
      {/* ── 1. Welcome Greeting Speech Bubble (Full Pop-out) ─────────── */}
      {robotState === "poppedOut" && showGreeting && (
        <div className="relative mb-2 animate-tooltip-pop max-w-[17.5rem] bg-white/95 text-ink p-3.5 rounded-2xl shadow-2xl border border-accent/80 backdrop-blur-md">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-accent ">
              <Sparkles className="w-3.5 h-3.5 text-accent animate-spin" style={{ animationDuration: "6s" }} />
              <span>{isKhmer ? "ជំនួយការ AI" : "AI Assistant"}</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] bg-accent-soft text-accent border border-accent font-semibold">
                Hi! 👋
              </span>
            </div>
            <button
              type="button"
              onClick={handleManualRetract}
              /* p-1.5, not p-1: 14px icon + 4px padding measured 22x22, under
                 the 24x24 minimum activation target. This button has no <label>
                 wrapper to borrow a bigger hit box from, so the button itself
                 has to carry it. */
              className="p-1.5 text-ink-muted hover:text-ink-secondary hover:bg-sunken rounded-full transition-colors"
              title={t("action.close")}
              aria-label={t("action.close")}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p
            onClick={handleOpenChat}
            className="text-[12.5px] leading-relaxed text-ink-secondary cursor-pointer hover:text-accent transition-colors font-medium"
          >
            {isKhmer
              ? "សួស្ដី! ខ្ញុំអាចជួយផ្ដល់ព័ត៌មាន ឬសម្រួលការងារអ្វីបានខ្លះ?"
              : "Hi there! 👋 How can I assist you with your tasks today?"}
          </p>

          {/* Pointer tail pointing down right to Robot */}
          <div className="absolute -bottom-2 right-8 w-3.5 h-3.5 bg-surface border-r border-b border-accent/80 rotate-45" />
        </div>
      )}

      {/* ── 2. Full-body Animated Pop-out Robot Mascot (JWT Login) ──── */}
      {robotState !== "hidden" && (
        <div
          className={`relative z-10 transition-all duration-300 ${
            robotState === "poppedOut"
              ? "animate-robot-walk-greeting"
              : "animate-robot-pop-in"
          }`}
        >
          <RobotMascot
            isWaving={robotState === "poppedOut"}
            isWalking={robotState === "poppedOut"}
            isPoppedOut={robotState === "poppedOut"}
            onClick={handleOpenChat}
          />
        </div>
      )}

      {/* ── 3. Robot Head Peeking Preview on Hover (ពេល Hover) ──────── */}
      {robotState === "hidden" && isHovered && (
        <div className="relative z-10 mb-[-18px] animate-robot-head-peek pointer-events-none self-center">
          <div className="w-[58px] h-[36px] overflow-hidden flex justify-center">
            <RobotMascot isWaving={false} className="scale-90 origin-top" />
          </div>
        </div>
      )}

      {/* ── 4. Capsule Dock Base Launcher Button ───────────────────────── */}
      <button
        type="button"
        onClick={handleOpenChat}
        title={t("ai.panelTitle")}
        aria-label={t("ai.panelTitle")}
        className="group relative flex items-center gap-2.5 px-4 py-2 rounded-full bg-gradient-to-r from-accent via-accent to-accent text-white shadow-lg hover:scale-105 transition-all duration-200 border border-white/25 active:scale-95 cursor-pointer"
        style={{
          boxShadow: "0 10px 25px -3px rgba(0, 0, 0, 0.18), inset 0 1px 1px rgba(255, 255, 255, 0.4)",
        }}
      >
        {/* Soft glowing aura in Theme branding color */}
        <span className="absolute inset-0 rounded-full bg-accent blur-md opacity-60 group-hover:opacity-90 transition-opacity duration-200 -z-10" />

        {/* Robot Icon Container with frosted glass ring */}
        <span className="relative flex items-center justify-center w-7 h-7 rounded-full bg-white/20 border border-white/30 text-white shadow-inner group-hover:bg-white/30 transition-colors duration-200">
          {/* Waves on hover */}
          <Bot className="w-4 h-4 text-white transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-12" />

          {/* Green Online status dot */}
          <span className="absolute -top-0.5 -right-0.5 inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 border border-white shadow-xs" />
        </span>

        {/* Label */}
        <span className="text-xs font-bold tracking-wide whitespace-nowrap text-white drop-shadow-xs font-sans">
          {isKhmer ? "ជំនួយការ AI" : "AI Assistant"}
        </span>
      </button>
    </div>,
    document.body
  );
}
