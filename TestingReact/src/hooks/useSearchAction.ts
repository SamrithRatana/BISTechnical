"use client";

/**
 * @file useSearchAction.ts
 * @description Wires a page's own search box to the `ui.search` action, so the
 * assistant can filter the list the user is already looking at instead of
 * navigating them somewhere new.
 *
 * Every table page has the same shape — one search string in local state — so
 * this exists to keep the guard below in one place rather than repeated at each
 * of them.
 */

import { useActionHandler } from "@/components/ActionBus";

/**
 * Registers `ui.search` against `apply`, the page's search-term setter.
 *
 * A request with no `query` at all is refused rather than applied as an empty
 * string. The two cases look the same at the setter but are not: the model
 * omitting the value is a slip, and blanking the box on it would wipe a filter
 * the user typed by hand. Clearing on purpose sends `query: ""`, which is a
 * real value and passes through.
 */
export function useSearchAction(apply: (value: string) => void) {
  useActionHandler("ui.search", (_ref, values) => {
    if (!values || values.query === undefined) return false;
    apply(values.query);
    return true;
  });
}
