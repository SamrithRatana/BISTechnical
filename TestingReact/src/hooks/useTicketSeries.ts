"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchRepairServices } from "@/services/api";
import type { RepairServiceItem } from "@/services/types";

/**
 * @file hooks/useTicketSeries.ts
 * @description One shared sample of recent tickets, plus the bucketing helpers
 * that turn it into the dashboard's sparklines and trends.
 *
 * ── Why a shared module-level cache ────────────────────────────────────────
 *
 * The KPI row and the chart panel both want a time series, and both used to be
 * able to fetch their own. That is two 400-row requests on every dashboard
 * mount for the same rows. The fetch is hoisted to module scope with an
 * in-flight promise, so whichever component mounts first pays for it and the
 * rest read the same array — the same pattern `services/userService.ts` uses
 * for the user map.
 *
 * ── What the numbers mean ──────────────────────────────────────────────────
 *
 * These series count ticket INTAKE per day — how many tickets now in a given
 * status arrived on each day — not the running total. That distinction matters
 * for honesty: the big number on a KPI card is an authoritative all-time count
 * from `fetchDashboardStats`, while the sparkline underneath is recent daily
 * activity. They are different quantities, so the card labels the footer
 * explicitly rather than letting a reader assume the percentage applies to the
 * total above it.
 *
 * The sample is bounded to `FETCH_SIZE` most-recent tickets. A window busier
 * than that would be clipped, which is a real limitation of doing this
 * client-side; a server-side aggregate endpoint is the proper fix.
 */

const FETCH_SIZE = 400;

let cache: RepairServiceItem[] | null = null;
let inflight: Promise<RepairServiceItem[]> | null = null;

async function loadTickets(force = false): Promise<RepairServiceItem[]> {
  if (!force && cache) return cache;
  if (!force && inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetchRepairServices(1, FETCH_SIZE, "All", "");
      cache = res?.items ?? [];
      return cache;
    } catch (err) {
      console.warn("Ticket series failed to load:", err);
      cache = cache ?? [];
      return cache;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function useTicketSeries() {
  const [items, setItems] = useState<RepairServiceItem[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);

  const reload = useCallback(async () => {
    const next = await loadTickets(true);
    setItems(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    void loadTickets().then((next) => {
      if (!alive) return;
      setItems(next);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  return { items, loading, reload };
}

/** Midnight of the day `offset` days before today, in local time. */
function dayStart(offset: number): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offset);
  return d.getTime();
}

/**
 * Daily counts over the last `days` days, oldest first.
 *
 * `dateOf` picks which timestamp a ticket is counted on — intake date for most
 * cards, completion date for "Finished", where the day it arrived says nothing
 * about when the work was done.
 */
export function dailyCounts(
  items: RepairServiceItem[],
  days: number,
  match: (item: RepairServiceItem) => boolean,
  dateOf: (item: RepairServiceItem) => string | undefined | null
): number[] {
  const counts = new Array<number>(days).fill(0);
  const DAY = 86_400_000;
  const start = dayStart(days - 1);

  for (const item of items) {
    if (!match(item)) continue;
    const raw = dateOf(item);
    if (!raw) continue;
    const t = new Date(raw).getTime();
    if (!Number.isFinite(t) || t < start) continue;
    const idx = Math.floor((t - start) / DAY);
    if (idx >= 0 && idx < days) counts[idx] += 1;
  }
  return counts;
}

/**
 * Percentage change between the two halves of a series.
 *
 * Returns `undefined` — not 0 — when the earlier half is empty. A jump from
 * nothing to something has no meaningful percentage, and rendering "+100%" or
 * "0%" there would be inventing a measurement. The card omits the trend
 * instead.
 */
export function halfOverHalfTrend(series: number[]): number | undefined {
  if (series.length < 4) return undefined;
  const mid = Math.floor(series.length / 2);
  const earlier = series.slice(0, mid).reduce((a, b) => a + b, 0);
  const later = series.slice(mid).reduce((a, b) => a + b, 0);
  if (earlier === 0) return undefined;
  return ((later - earlier) / earlier) * 100;
}

/** Case/spacing-insensitive status test, tolerant of the DB's spellings. */
export function statusIs(item: RepairServiceItem, needle: string): boolean {
  return (item.status ?? "").toLowerCase().replace(/\s+/g, " ").includes(needle);
}
