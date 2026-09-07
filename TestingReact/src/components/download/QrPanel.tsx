"use client";

/**
 * @file components/download/QrPanel.tsx
 * @description The in-place QR reveal. The plate is PURE WHITE and never sits
 * under an active 3D transform — scan contrast and flat rasterization are
 * non-negotiable (the owning card freezes its tilt while this is open).
 */

import React from "react";
import { Check, Copy, QrCode, RefreshCw } from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";
import type { PlatformContent } from "./platformContent";

interface QrPanelProps {
  content: PlatformContent;
  dataUrl: string;
  pageUrl: string;
  hasCopied: boolean;
  onCopy: () => void;
}

const ACCENT = {
  android: {
    text: "text-emerald-400",
    bracket: "border-emerald-400/70",
    spinner: "text-emerald-500",
  },
  ios: {
    text: "text-cyan-400",
    bracket: "border-cyan-400/70",
    spinner: "text-cyan-500",
  },
} as const;

export default function QrPanel({ content, dataUrl, pageUrl, hasCopied, onCopy }: QrPanelProps) {
  const { t } = useI18n();
  const a = ACCENT[content.key];

  return (
    <div className="mb-4 rounded-2xl border border-white/10 bg-[#070b12] p-4">
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        {/* White plate with corner brackets */}
        <div className="relative shrink-0 p-2">
          <span className={`absolute left-0 top-0 h-4 w-4 rounded-tl border-l-2 border-t-2 ${a.bracket}`} />
          <span className={`absolute right-0 top-0 h-4 w-4 rounded-tr border-r-2 border-t-2 ${a.bracket}`} />
          <span className={`absolute bottom-0 left-0 h-4 w-4 rounded-bl border-b-2 border-l-2 ${a.bracket}`} />
          <span className={`absolute bottom-0 right-0 h-4 w-4 rounded-br border-b-2 border-r-2 ${a.bracket}`} />
          <div className="rounded-xl bg-white p-2.5 shadow-xl">
            {dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- data: URL QR; next/image cannot optimize it
              <img src={dataUrl} alt={t(content.qrTitleKey)} className="h-32 w-32" />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center">
                <RefreshCw className={`w-6 h-6 animate-spin ${a.spinner}`} />
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-2">
          <div className={`inline-flex items-center gap-1.5 text-xs font-bold ${a.text}`}>
            <QrCode className="w-4 h-4" />
            <span>{t(content.qrTitleKey)}</span>
          </div>
          <p className="text-[11px] leading-snug text-slate-400">{t(content.qrHintKey)}</p>
          {pageUrl && (
            <button
              type="button"
              onClick={onCopy}
              className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-left transition-colors hover:border-white/25"
            >
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-300">
                {pageUrl}
              </span>
              {hasCopied ? (
                <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
