"use client";

/**
 * @file useInfiniteList.ts
 * @description Shared scroll-to-load-more list state, used by every paged
 * table in the app (ticket queues, spare parts, items, customers).
 *
 * Replaces page-number pagination: the backend is still called with
 * `pageNumber`/`pageSize` exactly as before, but batches accumulate instead of
 * replacing each other, so a search that matches more rows than one page can
 * hold stays fully reachable by scrolling.
 *
 * Handles the parts that were previously re-implemented (and quietly gotten
 * wrong) per page:
 * - request sequencing, so a slow response for a previous filter can't land
 *   last and overwrite the rows the user is actually looking at
 * - de-duplication, for endpoints that fan out into several queries and can
 *   return the same row in more than one batch
 * - refreshing only the pages currently on screen, so a realtime/manual
 *   refresh doesn't discard rows the user scrolled down to
 */

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * How many of the loaded pages a refresh re-fetches.
 *
 * Refreshing *every* loaded page sounds more correct, but it multiplies with
 * scroll depth: 20 pages deep, on a 30s poll, is 20 concurrent requests every
 * 30 seconds — per user. Lists here sort newest-first, so inserts and the
 * status changes people actually watch for land in the first page or two;
 * rows the user edits directly are already patched locally. Bounded refresh
 * cost matters more than re-reading rows far down that rarely move.
 */
const REFRESH_PAGE_LIMIT = 3;

/**
 * Safety cap on accumulated rows. Infinite scroll grows the DOM without
 * bound, and these tables render ~9 cells plus interactive controls per row,
 * so a broad search left scrolling can bloat memory and slow scrolling to a
 * crawl. At this point loading stops and the UI asks for a narrower search.
 * Raise it only alongside row virtualization.
 */
const DEFAULT_MAX_ITEMS = 2000;

/** Minimal shape this hook needs back from a paged endpoint. */
export interface InfinitePage<T> {
  items: T[];
  totalCount: number;
}

export interface UseInfiniteListOptions<T> {
  /**
   * Fetches a single page. Identity may change every render — it's read
   * through a ref, so an inline arrow function here is fine.
   */
  fetchPage: (pageNumber: number, pageSize: number) => Promise<InfinitePage<T>>;
  /** Rows requested per batch. */
  pageSize: number;
  /**
   * Changing this restarts the list from page 1. Pass everything the query
   * depends on (search term, status filter, ...) joined into one string.
   */
  resetKey: string;
  /** Resolves a stable id, used to drop duplicates. Omit to keep every row. */
  getId?: (item: T) => string | undefined;
  /** Skip fetching entirely (e.g. while waiting on auth). */
  disabled?: boolean;
  /** Safety cap on accumulated rows. Defaults to {@link DEFAULT_MAX_ITEMS}. */
  maxItems?: number;
}

export function useInfiniteList<
  T,
  TRoot extends HTMLElement = HTMLDivElement,
  TSentinel extends HTMLElement = HTMLDivElement,
>({
  fetchPage,
  pageSize,
  resetKey,
  getId,
  disabled = false,
  maxItems = DEFAULT_MAX_ITEMS,
}: UseInfiniteListOptions<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [loadedPages, setLoadedPages] = useState(1);

  // The scrolling container and the sentinel are tracked as state behind
  // callback refs, not as plain refs.
  //
  // Both elements mount conditionally — the tables only render the sentinel
  // row once rows exist, and the spare-part / company / item pickers mount
  // their whole panel only while the dropdown is open. Assigning a ref
  // doesn't re-render, so the observer effect below (which can only run on a
  // dependency change) would run once while the sentinel was still unmounted,
  // find nothing to observe, and never get another chance: the list sat on
  // "Scroll for more" and never loaded page 2. As state, the sentinel
  // appearing IS a dependency change, so the observer attaches the moment the
  // panel opens and detaches when it closes.
  const [scrollRoot, setScrollRoot] = useState<TRoot | null>(null);
  const [sentinel, setSentinel] = useState<TSentinel | null>(null);

  /** Attach to the scrolling container. Falls back to the viewport if unset. */
  const scrollRootRef = useCallback((node: TRoot | null) => {
    setScrollRoot(node);
  }, []);
  /** Attach to an element rendered after the last row. */
  const sentinelRef = useCallback((node: TSentinel | null) => {
    setSentinel(node);
  }, []);

  // Read callbacks through refs so a new inline function each render doesn't
  // restart the list — `resetKey` is the single source of truth for that.
  const fetchPageRef = useRef(fetchPage);
  useEffect(() => {
    fetchPageRef.current = fetchPage;
  }, [fetchPage]);

  const getIdRef = useRef(getId);
  useEffect(() => {
    getIdRef.current = getId;
  }, [getId]);

  /** Bumped on every reset; in-flight responses from an older seq are dropped. */
  const requestSeq = useRef(0);

  const dedupe = useCallback((rows: T[]): T[] => {
    const resolve = getIdRef.current;
    if (!resolve) return rows;

    const seen = new Set<string>();
    const out: T[] = [];
    for (const row of rows) {
      const id = resolve(row);
      if (id) {
        if (seen.has(id)) continue;
        seen.add(id);
      }
      out.push(row);
    }
    return out;
  }, []);

  // Reset to page 1 whenever the query changes.
  useEffect(() => {
    if (disabled) return;

    const seq = ++requestSeq.current;
    let cancelled = false;

    void (async () => {
      const result = await fetchPageRef.current(1, pageSize);
      if (cancelled || seq !== requestSeq.current) return;

      const batch = result.items || [];
      setItems(dedupe(batch));
      setTotalCount(result.totalCount || batch.length);
      setLoadedPages(1);
      setReachedEnd(batch.length < pageSize);
      setLimitReached(false);
      setIsLoadingMore(false);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [resetKey, pageSize, disabled, dedupe]);

  /** Appends the next page. Driven by the scroll sentinel. */
  const loadMore = useCallback(async () => {
    if (disabled || reachedEnd || limitReached || isLoading || isLoadingMore) return;

    const seq = requestSeq.current;
    const nextPage = loadedPages + 1;
    setIsLoadingMore(true);

    const result = await fetchPageRef.current(nextPage, pageSize);
    if (seq !== requestSeq.current) return; // superseded; reset effect owns state now

    const batch = result.items || [];
    setItems((prev) => {
      const merged = dedupe([...prev, ...batch]);
      if (merged.length >= maxItems) setLimitReached(true);
      return merged;
    });
    if (result.totalCount) setTotalCount(result.totalCount);
    setLoadedPages(nextPage);
    if (batch.length < pageSize) setReachedEnd(true);
    setIsLoadingMore(false);
  }, [disabled, reachedEnd, limitReached, isLoading, isLoadingMore, loadedPages, pageSize, maxItems, dedupe]);

  /**
   * Re-fetches the head of the list and rebuilds it, keeping any rows further
   * down that the refresh didn't cover. Bounded by REFRESH_PAGE_LIMIT so
   * polling cost stays flat no matter how far the user has scrolled.
   */
  const refresh = useCallback(async () => {
    if (disabled) return;

    const pagesToRefresh = Math.min(loadedPages, REFRESH_PAGE_LIMIT);
    const seq = requestSeq.current;
    const results = await Promise.all(
      Array.from({ length: pagesToRefresh }, (_, i) => fetchPageRef.current(i + 1, pageSize))
    );
    if (seq !== requestSeq.current) return;

    const head = results.flatMap((r) => r.items || []);
    // Keep rows past the refreshed head; dedupe drops any that moved up into it.
    setItems((prev) => dedupe([...head, ...prev.slice(pagesToRefresh * pageSize)]));
    // Page 1 carries the total; later pages deliberately omit it (they ask the
    // backend to skip the COUNT). Reading the *last* result therefore found no
    // count once that optimisation landed, and the displayed total would stop
    // updating on refresh even though a fresh one had just arrived in page 1.
    const total = results.find((r) => r?.totalCount)?.totalCount;
    if (total) setTotalCount(total);
    setIsLoading(false);
  }, [disabled, loadedPages, pageSize, dedupe]);

  // Pull the next batch as the sentinel nears the viewport. `rootMargin`
  // starts the fetch before the user actually reaches the bottom.
  useEffect(() => {
    if (!sentinel || disabled || reachedEnd || limitReached || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { root: scrollRoot, rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, scrollRoot, disabled, reachedEnd, limitReached, isLoading, loadMore]);

  return {
    items,
    totalCount,
    isLoading,
    isLoadingMore,
    reachedEnd,
    /** Row cap hit — more matches exist, but loading stopped to protect memory. */
    limitReached,
    scrollRootRef,
    sentinelRef,
    /**
     * The scrolling container element itself, once attached.
     *
     * `scrollRootRef` is a callback ref, so callers have no way to reach the
     * node — and row virtualization needs it, both to subscribe to scroll and
     * to know the viewport height. Exposed as the state value rather than a
     * ref object on purpose: it changes from `null` to the element on mount,
     * and a consumer has to re-render at that moment to start windowing.
     */
    scrollRoot,
    refresh,
    loadMore,
    /** Escape hatches for optimistic local edits. */
    setItems,
    setTotalCount,
  };
}
