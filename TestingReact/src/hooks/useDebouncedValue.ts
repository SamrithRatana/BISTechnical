"use client";

/**
 * @file useDebouncedValue.ts
 * @description Returns a copy of `value` that only updates once the input has
 * been quiet for `delayMs`.
 *
 * Search boxes here feed a server-side query, so binding the request straight
 * to onChange fires one API call per keystroke — and because responses can
 * land out of order, a slow early request could overwrite the results of a
 * later one. Debouncing the term the query depends on avoids both.
 * Matches the 300ms the Blazor app used for its own search fields.
 */

import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
