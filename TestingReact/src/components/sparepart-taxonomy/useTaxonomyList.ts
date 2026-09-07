"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtimeResource } from "@/hooks/useRealtimeTickets";
import { invalidateTaxonomyCache } from "@/services/sparepartTaxonomyApi";

export type TaxonomyListStatus = "loading" | "ready" | "error";

/**
 * Loads one of the spare-part lookup lists and keeps it fresh.
 *
 * The lists are small and returned whole (no paging), so this is simpler
 * than `useInfiniteList`: one fetch, a status, and a `reload`. A response
 * that lands after the component unmounted — or after a newer load started —
 * is dropped by the generation counter, so nothing sets state on a dead
 * component (§14) and a slow first load cannot overwrite a fast second one.
 *
 * The effect only *starts* a load; every state write happens after the
 * await, in the promise continuation, never synchronously in the effect
 * body (`react-hooks/set-state-in-effect`). The initial status is already
 * `loading`, so there is nothing to set before the first request.
 *
 * Subscribes to the shared SSE stream for `sparepart` events: the proxy
 * broadcasts one after every successful taxonomy write, so a colleague's
 * rename shows up here without a refresh. That path drops the client cache
 * first — the 60s `cachedFetch` entry is per tab, so another user's write
 * arrives as an event but would otherwise be answered from the local copy.
 */
export function useTaxonomyList<T>(load: () => Promise<T[]>) {
  const [items, setItems] = useState<T[]>([]);
  const [status, setStatus] = useState<TaxonomyListStatus>("loading");
  const generation = useRef(0);
  const loadRef = useRef(load);
  // Mirrors `items` so the failure path can ask "is anything on screen?"
  // without reading state inside an updater (updaters must stay pure).
  const hasRows = useRef(false);

  // Keep the latest loader without making it an effect dependency: callers
  // pass an inline arrow, and re-running the effect per render would refetch
  // on every keystroke in the search box.
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  useEffect(() => {
    hasRows.current = items.length > 0;
  }, [items]);

  /** Starts a load and returns its generation; stale generations are ignored on arrival. */
  const start = useCallback(() => {
    const mine = ++generation.current;
    loadRef
      .current()
      .then((rows) => {
        if (mine !== generation.current) return;
        setItems(rows);
        setStatus("ready");
      })
      .catch(() => {
        if (mine !== generation.current) return;
        // A failed refresh of a list that already loaded keeps the rows on
        // screen (stale beats blank, §12); only a list with nothing to show
        // reports the error and offers Retry.
        setStatus(hasRows.current ? "ready" : "error");
      });
  }, []);

  /** Bumping the generation orphans every load in flight. */
  const cancel = useCallback(() => {
    generation.current++;
  }, []);

  useEffect(() => {
    start();
    return cancel;
  }, [start, cancel]);

  /**
   * Manual / realtime refresh. Keeps the current rows on screen while it
   * runs; only a list that had failed shows the loading state again, so the
   * Retry button visibly does something.
   */
  const reload = useCallback(() => {
    setStatus((prev) => (prev === "error" ? "loading" : prev));
    start();
  }, [start]);

  // Realtime only: the manual Retry keeps the cache (a failed request left
  // nothing in it anyway), and the writer's own tab already invalidated.
  const onRealtime = useCallback(() => {
    invalidateTaxonomyCache();
    reload();
  }, [reload]);
  useRealtimeResource("sparepart", onRealtime);

  return { items, status, reload };
}
