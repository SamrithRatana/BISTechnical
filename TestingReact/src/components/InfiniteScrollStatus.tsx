"use client";

/**
 * Status line rendered inside the infinite-scroll sentinel row at the bottom
 * of every paged table. Shared so the wording — especially the row-cap
 * message, which tells the user results were *withheld* — stays identical
 * everywhere instead of drifting per page.
 */

import { RefreshCw } from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";

interface InfiniteScrollStatusProps {
  isLoadingMore: boolean;
  reachedEnd: boolean;
  /** Row cap hit — more matches exist but loading stopped to protect memory. */
  limitReached: boolean;
  /** Rows currently loaded. */
  count: number;
}

export default function InfiniteScrollStatus({
  isLoadingMore,
  reachedEnd,
  limitReached,
  count,
}: InfiniteScrollStatusProps) {
  const { t } = useI18n();

  if (isLoadingMore) {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-ink-secondary ">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        {t("msg.loadingMore")}
      </span>
    );
  }

  // Checked before `reachedEnd`: hitting the cap is NOT the end of the result
  // set, and saying so would hide matches the user still needs.
  if (limitReached) {
    return (
      <span className="text-xs text-warning ">
        {t("msg.limitReached", { count })}
      </span>
    );
  }

  if (reachedEnd) {
    return (
      <span className="text-xs text-ink-muted ">
        {t("msg.endOfResults", { count })}
      </span>
    );
  }

  return <span className="text-xs text-ink-muted ">{t("msg.scrollForMore")}</span>;
}
