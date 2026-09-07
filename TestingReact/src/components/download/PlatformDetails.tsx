"use client";

/**
 * @file components/download/PlatformDetails.tsx
 * @description The expandable "advanced capabilities" list inside a platform
 * card. Content comes from `platformContent.ts`; the owning card handles the
 * AnimatePresence mount/unmount.
 */

import React from "react";
import { Sparkles } from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";
import type { PlatformContent } from "./platformContent";

const ICON_TINT = {
  android: ["text-emerald-400", "text-cyan-400", "text-teal-400", "text-amber-400"],
  ios: ["text-cyan-400", "text-blue-400", "text-amber-400", "text-teal-400"],
} as const;

export default function PlatformDetails({ content }: { content: PlatformContent }) {
  const { t } = useI18n();
  const headTint = content.key === "android" ? "text-emerald-400" : "text-cyan-400";

  return (
    <div className="mb-4 space-y-3 rounded-2xl border border-white/10 bg-[#070b12] p-4 text-xs">
      <div className={`flex items-center gap-2 border-b border-white/10 pb-2 font-bold ${headTint}`}>
        <Sparkles className="w-4 h-4" />
        <span>{t(content.detailsTitleKey)}</span>
      </div>

      <div className="space-y-2.5 text-slate-300">
        {content.details.map((detail, i) => (
          <div key={detail.titleKey} className="flex items-start gap-2.5">
            <detail.icon className={`mt-0.5 w-4 h-4 shrink-0 ${ICON_TINT[content.key][i]}`} />
            <div>
              <p className="font-semibold text-white">{t(detail.titleKey)}</p>
              <p className="text-[11px] text-slate-400">{t(detail.bodyKey)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
