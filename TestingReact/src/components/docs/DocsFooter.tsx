"use client";

/**
 * @file components/docs/DocsFooter.tsx
 * @description Quiet close: the two ways out of the manual (sign in, get the
 * app) and the honesty note. Nothing here animates beyond the shared reveal —
 * the page should end still.
 */

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { LogIn, Smartphone } from "lucide-react";
import { DUR, REVEAL_EASE, VIEWPORT_ONCE } from "./motion";
import { useDocsText } from "./useDocsText";
import { FOOTER_COPY } from "./content/heroCopy";
import type { DocsMotionMode } from "./useDocsMotionMode";

export default function DocsFooter({ mode }: { mode: DocsMotionMode }) {
  const { text, isKhmer } = useDocsText();
  const full = mode === "full";

  return (
    <footer className="relative overflow-hidden border-t border-white/5">
      {/* Mirrored echo of the hero's key-light wedge */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 left-[-25%] h-[320px] w-[150vw] rotate-[16deg]"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgb(6 182 212 / 0.05) 45%, rgb(139 92 246 / 0.09))",
        }}
      />

      <motion.div
        className="relative mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6"
        initial={full ? { opacity: 0, y: 20 } : false}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={VIEWPORT_ONCE}
        transition={{ duration: DUR.reveal, ease: REVEAL_EASE }}
      >
        <div className="flex flex-wrap items-center justify-center gap-3">
          {/* Anchors, not buttons — see the note in DocsHeader. */}
          <Link
            href="/login"
            className="flex min-h-[48px] items-center gap-2.5 rounded-2xl bg-violet-400 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_0_40px_-12px_rgb(139_92_246/0.7)] transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
          >
            <LogIn className="h-4 w-4" />
            <span>{text(FOOTER_COPY.signIn)}</span>
          </Link>
          <Link
            href="/download"
            className="flex min-h-[48px] items-center gap-2.5 rounded-2xl border border-cyan-400/40 px-5 py-3 text-sm font-bold text-cyan-300 transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Smartphone className="h-4 w-4" />
            <span>{text(FOOTER_COPY.download)}</span>
          </Link>
        </div>

        <p
          className={`max-w-2xl text-[11px] leading-relaxed text-slate-600 ${
            isKhmer ? "leading-loose" : ""
          }`}
        >
          {text(FOOTER_COPY.note)}
        </p>
      </motion.div>
    </footer>
  );
}
