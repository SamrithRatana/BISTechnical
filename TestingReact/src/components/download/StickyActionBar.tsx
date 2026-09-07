"use client";

/**
 * @file components/download/StickyActionBar.tsx
 * @description Fixed bottom bar on the mobile install view — the current
 * step's primary action plus a copy-link shortcut, always thumb-reachable.
 * Solid fill, hairline top border, safe-area padding.
 */

import React from "react";
import { Check, Copy } from "lucide-react";
import type { InstallStepAction } from "./InstallStep";
import type { DownloadPlatform } from "./downloadConstants";

interface StickyActionBarProps {
  action: InstallStepAction;
  platform: DownloadPlatform;
  hasCopied: boolean;
  onCopy: () => void;
}

const ACCENT = {
  android: "bg-emerald-500 text-slate-950",
  ios: "bg-cyan-500 text-slate-950",
} as const;

export default function StickyActionBar({
  action,
  platform,
  hasCopied,
  onCopy,
}: StickyActionBarProps) {
  const run = () => {
    if (action.href) {
      window.open(action.href, "_blank", "noopener,noreferrer");
    }
    action.onClick();
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#06090e]/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3">
      <div className="mx-auto flex max-w-md items-center gap-2">
        <button
          type="button"
          onClick={run}
          className={`flex min-h-[48px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-transform duration-150 active:scale-[0.98] ${ACCENT[platform]}`}
        >
          {action.icon}
          <span className="truncate">{action.label}</span>
        </button>
        <button
          type="button"
          onClick={onCopy}
          aria-label="Copy link"
          className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300"
        >
          {hasCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
