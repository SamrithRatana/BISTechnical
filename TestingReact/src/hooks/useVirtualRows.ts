"use client";

import { useVirtualizer } from "@tanstack/react-virtual";

/**
 * @file hooks/useVirtualRows.ts
 * @description Renders only the table rows that are on screen.
 *
 * ── Why ────────────────────────────────────────────────────────────────────
 *
 * Measured on the spare-parts table with every row loaded: 110,000 DOM nodes,
 * 164 MB of JS heap, and a 278 ms blocking task when navigating away — React
 * tearing down ~630 rows of ten cells each, on the main thread, while the user
 * is waiting for the next page. Scrolling itself was fine (60 fps median); the
 * cost was the sheer number of rows kept realised.
 *
 * `content-visibility: auto` cut that roughly in half by skipping layout and
 * paint for off-screen rows, but it cannot help the unmount cost, because the
 * nodes still exist. This does: at any moment the table holds one screenful
 * plus `overscan`, whatever the row count.
 *
 * ── The spacer-row approach, and why not absolute positioning ──────────────
 *
 * The usual recipe positions each row absolutely with a transform. That breaks
 * `<table>` outright: absolutely-positioned rows leave the table layout, so the
 * browser stops sizing columns from their content and every column collapses.
 * You then have to hand-manage widths, which is exactly the thing an HTML
 * table is good at.
 *
 * So instead the real rows stay in normal flow, and two empty `<tr>` elements
 * hold the space above and below them. Column sizing, the sticky header, row
 * striping and the scrollbar all behave as if the whole list were present.
 *
 * ── Requires uniform row heights ──────────────────────────────────────────
 *
 * `rowHeight` is a fixed estimate, not a measurement, so this is only correct
 * where rows really are one height. Verified before adopting it: 225 sampled
 * spare-part rows measured 96px — every single one, min and max identical.
 * If a table gains a wrapping cell this assumption breaks and the scrollbar
 * will drift; switch to `measureElement` (dynamic mode) at that point rather
 * than nudging the constant.
 */

export interface UseVirtualRowsOptions {
  /** How many rows exist in total (post-filter, pre-windowing). */
  count: number;
  /**
   * The scrolling container. Pass the element, not a ref: it starts null and
   * becomes the node on mount, and windowing must begin on that render.
   */
  scrollElement: HTMLElement | null;
  /** Fixed row height in px. Must match the rendered height. */
  rowHeight: number;
  /**
   * Rows rendered beyond the viewport on each side.
   *
   * 8 rather than the library default of 1: a bigger buffer means a fast
   * flick-scroll on a touchpad reaches already-rendered rows instead of
   * momentarily showing blank space, and eight 96px rows is under a
   * screenful — cheap enough that it costs nothing measurable.
   */
  overscan?: number;
  /** Skip windowing entirely (e.g. while loading, or for short lists). */
  disabled?: boolean;
}

export interface VirtualRowsResult {
  /** The window to render: the index of each visible row. */
  items: { index: number }[];
  /** Height of the spacer above the window, in px. */
  paddingTop: number;
  /** Height of the spacer below the window, in px. */
  paddingBottom: number;
  /** True when windowing is active — false means render everything. */
  enabled: boolean;
}

/**
 * Below this many rows, windowing costs more than it saves: the scroll
 * listener and re-render on every frame outweigh the DOM it removes, and a
 * short list has no unmount problem to begin with.
 */
const MIN_ROWS_TO_VIRTUALIZE = 60;

export function useVirtualRows({
  count,
  scrollElement,
  rowHeight,
  overscan = 8,
  disabled = false,
}: UseVirtualRowsOptions): VirtualRowsResult {
  const enabled = !disabled && count >= MIN_ROWS_TO_VIRTUALIZE;

  // The hook must be called unconditionally — React requires a stable hook
  // order — so it is given a count of 0 when windowing is off, which makes it
  // inert rather than absent.
  const virtualizer = useVirtualizer({
    count: enabled ? count : 0,
    getScrollElement: () => scrollElement,
    estimateSize: () => rowHeight,
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();

  if (!enabled || virtualItems.length === 0) {
    return { items: [], paddingTop: 0, paddingBottom: 0, enabled: false };
  }

  const total = virtualizer.getTotalSize();
  const first = virtualItems[0];
  const last = virtualItems[virtualItems.length - 1];

  return {
    items: virtualItems.map((v) => ({ index: v.index })),
    paddingTop: first.start,
    paddingBottom: Math.max(0, total - last.end),
    enabled: true,
  };
}
