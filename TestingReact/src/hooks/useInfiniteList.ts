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

interface CachedList<T> {
  items: T[];
  totalCount: number;
  timestamp: number;
}

import { registerSessionCacheClearer } from "@/services/authSession";

const MAX_LIST_CACHE_ENTRIES = 20;
const listMemoryCache = new Map<string, CachedList<unknown>>();

registerSessionCacheClearer(() => {
  listMemoryCache.clear();
});

function evictListCacheIfNeeded(): void {
  if (listMemoryCache.size <= MAX_LIST_CACHE_ENTRIES) return;
  const sorted = Array.from(listMemoryCache.entries()).sort(
    ([, a], [, b]) => a.timestamp - b.timestamp
  );
  for (let i = 0; i < 5 && i < sorted.length; i++) {
    const key = sorted[i][0];
    listMemoryCache.delete(key);
    if (typeof window !== "undefined") {
      try { sessionStorage.removeItem(`inf_list_${key}`); } catch {}
    }
  }
}

function readCachedList<T>(key: string): CachedList<T> | null {
  const mem = listMemoryCache.get(key);
  if (mem && Date.now() - mem.timestamp < 3 * 60 * 1000) {
    return mem as CachedList<T>;
  }
  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(`inf_list_${key}`);
      if (raw) {
        const parsed = JSON.parse(raw) as CachedList<T>;
        if (Date.now() - parsed.timestamp < 3 * 60 * 1000) {
          listMemoryCache.set(key, parsed);
          return parsed;
        }
      }
    } catch {}
  }
  return null;
}

export function clearListCache(prefix?: string): void {
  if (!prefix) {
    listMemoryCache.clear();
    if (typeof window !== "undefined") {
      try {
        const keys = Object.keys(sessionStorage);
        for (const k of keys) {
          if (k.startsWith("inf_list_")) sessionStorage.removeItem(k);
        }
      } catch {}
    }
  } else {
    for (const k of listMemoryCache.keys()) {
      if (k.toLowerCase().includes(prefix.toLowerCase())) listMemoryCache.delete(k);
    }
    if (typeof window !== "undefined") {
      try {
        const keys = Object.keys(sessionStorage);
        for (const k of keys) {
          if (k.toLowerCase().includes(prefix.toLowerCase())) sessionStorage.removeItem(k);
        }
      } catch {}
    }
  }
}

export function primeListCache<T>(key: string, items: T[], totalCount: number) {
  evictListCacheIfNeeded();
  const entry: CachedList<T> = {
    items,
    totalCount,
    timestamp: Date.now(),
  };
  listMemoryCache.set(key, entry as CachedList<unknown>);
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(`inf_list_${key}`, JSON.stringify(entry));
    } catch {}
  }
}

const writeCachedList = primeListCache;

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
  const initialCache = readCachedList<T>(resetKey);
  const [items, setItems] = useState<T[]>(() => initialCache?.items ?? []);
  const [totalCount, setTotalCount] = useState(() => initialCache?.totalCount ?? 0);
  const [isLoading, setIsLoading] = useState(() => !initialCache);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [loadedPages, setLoadedPages] = useState(1);

  // The scrolling container and the sentinel are tracked as state behind
  // callback refs, not as plain refs.
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

  /**
   * How many pages are loaded, readable without making `refresh` depend on it.
   *
   * `refresh` is handed to callers and ends up in THEIR `useCallback`
   * dependency lists — `ServiceTable` puts it in `handleInlineStatusChange`,
   * which is a prop on every memoised `TicketRow`. Depending on `loadedPages`
   * directly gave `refresh` a new identity on every appended page, so scrolling
   * to page 20 re-rendered all 500 loaded rows instead of the 25 new ones:
   * O(n) per append, O(n²) across the scroll, which is precisely the cost the
   * row memoisation exists to remove.
   *
   * Mirrored in an effect, like `fetchPageRef` above — a render-time ref write
   * is a bug this project lints against, because a render can be discarded and
   * replayed. `refresh` only ever runs from an SSE event, a status change or a
   * poll, all of which are long after effects have flushed, so it never reads a
   * stale count. It starts at 1, which is the correct initial page count.
   */
  const loadedPagesRef = useRef(loadedPages);
  useEffect(() => {
    loadedPagesRef.current = loadedPages;
  }, [loadedPages]);

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

    const cached = readCachedList<T>(resetKey);
    const isCacheFresh = cached && (Date.now() - cached.timestamp < 60_000);

    if (cached) {
      queueMicrotask(() => {
        if (!cancelled && seq === requestSeq.current) {
          setItems(cached.items);
          setTotalCount(cached.totalCount);
          setIsLoading(false);
        }
      });
    }

    void (async () => {
      try {
        const result = await fetchPageRef.current(1, pageSize);
        if (cancelled || seq !== requestSeq.current) return;

        const batch = result?.items || [];
        const deduped = dedupe(batch);
        const total = result?.totalCount || batch.length;
        writeCachedList(resetKey, deduped, total);
        setItems(deduped);
        setTotalCount(total);
        setLoadedPages(1);
        setReachedEnd(batch.length < pageSize);
        setLimitReached(false);
      } catch (err) {
        console.warn("[useInfiniteList] Page 1 fetch error:", err);
      } finally {
        if (!cancelled && seq === requestSeq.current) {
          setIsLoadingMore(false);
          setIsLoading(false);
        }
      }
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

    try {
      const result = await fetchPageRef.current(nextPage, pageSize);
      if (seq !== requestSeq.current) return; // superseded; reset effect owns state now

      const batch = result?.items || [];
      setItems((prev) => {
        const merged = dedupe([...prev, ...batch]);
        if (merged.length >= maxItems) setLimitReached(true);
        return merged;
      });
      if (result?.totalCount) setTotalCount(result.totalCount);
      setLoadedPages(nextPage);
      if (batch.length < pageSize) setReachedEnd(true);
    } catch (err) {
      console.warn(`[useInfiniteList] Page ${nextPage} fetch error:`, err);
      setReachedEnd(true); // Don't infinite loop on error
    } finally {
      if (seq === requestSeq.current) {
        setIsLoadingMore(false);
      }
    }
  }, [disabled, reachedEnd, limitReached, isLoading, isLoadingMore, loadedPages, pageSize, maxItems, dedupe]);

  /**
   * Re-fetches the head of the list and rebuilds it, keeping any rows further
   * down that the refresh didn't cover. Bounded by REFRESH_PAGE_LIMIT so
   * polling cost stays flat no matter how far the user has scrolled.
   */
  const refresh = useCallback(async () => {
    if (disabled) return;

    const pagesToRefresh = Math.min(loadedPagesRef.current, REFRESH_PAGE_LIMIT);
    const seq = requestSeq.current;
    try {
      /**
       * Settled per page, with the failure kept DISTINGUISHABLE from an empty
       * result. This used to be `.catch(() => ({ items: [], totalCount: 0 }))`,
       * which made "the request failed" and "this page is genuinely empty" the
       * same value — and the rebuild below splices `head` over the first
       * `pagesToRefresh * pageSize` rows, so a failed refresh DELETED the rows
       * it could not re-fetch.
       *
       * That was reachable, not theoretical: `updateServiceStatus` and the SSE
       * handler both `invalidateCachePrefix("repairservices")` before
       * refreshing, so there is no cached entry left for `cachedFetch` to
       * serve and its 30s backstop rethrows. A status change or a ticket event
       * while the backend was hanging emptied the visible table — and, because
       * `writeCachedList` ran on the truncated result, persisted that deletion
       * to `sessionStorage` so it survived a reload.
       */
      const results = await Promise.all(
        Array.from({ length: pagesToRefresh }, (_, i) =>
          fetchPageRef.current(i + 1, pageSize).then(
            (value) => ({ ok: true as const, value }),
            (error: unknown) => ({ ok: false as const, error })
          )
        )
      );
      if (seq !== requestSeq.current) return;

      /**
       * Any failure abandons the whole refresh, rather than merging what did
       * arrive. A partial merge is not a safe halfway house: `head` would be
       * missing the failed pages entirely while the splice still removes their
       * rows from `prev`, so the rows vanish and the order of everything after
       * them shifts. A refresh is a consistency update — it must never be able
       * to destroy data. The next SSE event or 30s poll retries.
       */
      const failures = results.filter((r) => !r.ok);
      if (failures.length > 0) {
        console.warn(
          `[useInfiniteList] Refresh abandoned: ${failures.length}/${pagesToRefresh} page fetch(es) failed. ` +
            `Keeping the rows already on screen.`,
          (failures[0] as { error: unknown }).error
        );
        return;
      }

      const pages = results.map((r) => (r as { value: InfinitePage<T> }).value);
      const head = pages.flatMap((r) => r?.items || []);
      const total = pages.find((r) => r?.totalCount)?.totalCount;
      if (total) setTotalCount(total);
      setItems((prev) => {
        const finalItems = dedupe([...head, ...prev.slice(pagesToRefresh * pageSize)]);
        writeCachedList(resetKey, finalItems, total || finalItems.length);
        return finalItems;
      });
    } catch (err) {
      console.warn("[useInfiniteList] Refresh error:", err);
    } finally {
      setIsLoading(false);
    }
    // `loadedPages` is read through `loadedPagesRef`, deliberately — see the
    // note on that ref. Adding it here re-breaks row memoisation on scroll.
  }, [disabled, pageSize, dedupe, resetKey]);

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
