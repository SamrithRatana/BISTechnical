"use client";

/**
 * Status line rendered inside the infinite-scroll sentinel row at the bottom
 * of every paged table. Shared so the wording — especially the row-cap
 * message, which tells the user results were *withheld* — stays identical
 * everywhere instead of drifting per page.
 */

import { RefreshCw } from "lucide-react";

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
  if (isLoadingMore) {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        Loading more…
      </span>
    );
  }

  // Checked before `reachedEnd`: hitting the cap is NOT the end of the result
  // set, and saying so would hide matches the user still needs.
  if (limitReached) {
    return (
      <span className="text-xs text-amber-600 dark:text-amber-400">
        Showing the first {count} matches — narrow your search to see the rest.
      </span>
    );
  }

  if (reachedEnd) {
    return (
      <span className="text-xs text-slate-400 dark:text-slate-500">
        End of results — {count} shown
      </span>
    );
  }

  return <span className="text-xs text-slate-400 dark:text-slate-500">Scroll for more</span>;
}
