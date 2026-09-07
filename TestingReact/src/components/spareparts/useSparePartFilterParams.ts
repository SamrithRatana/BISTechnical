"use client";

import { useEffect, useRef } from "react";
import type { SparePartFilters } from "@/services/api";

const KEYS = ["categoryId", "typeId", "brandId"] as const;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Keeps the catalogue's Category / Type / Brand filters in the URL
 * (`?categoryId=&typeId=&brandId=`) so a filtered view can be bookmarked or
 * sent to a colleague, the same way `?q=` seeds the search box.
 *
 * Read once on mount through `apply` (an effect, not a `useState` seed — the
 * server render has no `window`, and seeding from it would mismatch on
 * hydration; see `useSearchQueryParam`). Written with `replaceState` so
 * changing a filter does not stack history entries. Other parameters, `q`
 * included, are left untouched.
 */
export function useSparePartFilterParams(filters: SparePartFilters, apply: (initial: SparePartFilters) => void) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const initial: SparePartFilters = {};
    for (const key of KEYS) {
      const raw = params.get(key);
      // Only a well-formed GUID is accepted; anything else in the URL is
      // ignored rather than sent to the API as a filter.
      if (raw && GUID.test(raw)) initial[key] = raw;
    }
    if (initial.categoryId || initial.typeId || initial.brandId) apply(initial);
    // Runs once on mount: it seeds the initial filters and must not fight the
    // user's own choices afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The write effect skips its first run: on mount `filters` is still the
  // empty default while the read effect above has only just *scheduled* the
  // seed from the URL, and writing `{}` here would strip those parameters a
  // frame before they are applied.
  const firstWrite = useRef(true);
  useEffect(() => {
    if (firstWrite.current) {
      firstWrite.current = false;
      return;
    }
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    for (const key of KEYS) {
      const v = filters[key];
      if (v) url.searchParams.set(key, v);
      else url.searchParams.delete(key);
    }
    const next = url.pathname + (url.search ? url.search : "") + url.hash;
    const current = window.location.pathname + window.location.search + window.location.hash;
    if (next !== current) window.history.replaceState(window.history.state, "", next);
  }, [filters]);
}
