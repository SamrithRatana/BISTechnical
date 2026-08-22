"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Activity, CheckCircle2, Clock, Wrench } from "lucide-react";
import type { RepairServiceItem } from "@/services/types";
import { useI18n } from "@/i18n/LanguageProvider";
import { useRealtimeTickets } from "@/hooks/useRealtimeTickets";
import { useTicketSeries } from "@/hooks/useTicketSeries";
import { ChartPanel, ToggleGroup, Badge } from "@/components/av";
import type { AreaChartPoint } from "@/components/av/AreaChart";

/**
 * @file components/DashboardChart.tsx
 * @description The main dashboard chart panel — ticket intake over time.
 *
 * ── The chart is code-split ────────────────────────────────────────────────
 *
 * `AreaChart` arrives through `next/dynamic` with `ssr: false`. It is the
 * heaviest component in the shell, it is below the fold, and it is useless on
 * the server — the geometry depends on the container's measured width. Every
 * other route in the app pays nothing for it.
 *
 * ── The series is real ─────────────────────────────────────────────────────
 *
 * Points are aggregated from actual ticket `serviceDate` values, not sampled
 * from a generator. `DashboardStats` exposes only running totals, so there is
 * no server-side time series to ask for; `useTicketSeries` buckets a bounded
 * sample of recent tickets client-side instead — see that file for the sample
 * size and what it means for accuracy.
 */

const AreaChart = dynamic(
  () => import("@/components/av/AreaChart").then((m) => m.AreaChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[190px] lg:h-[200px] xl:h-[250px] grid place-items-center text-sm text-ink-muted">
        Loading chart…
      </div>
    ),
  }
);

const RANGES = [
  { value: "1H", label: "1H" },
  { value: "24H", label: "24H" },
  { value: "7D", label: "7D" },
  { value: "30D", label: "30D" },
] as const;

type Range = (typeof RANGES)[number]["value"];

interface Bucket {
  /** Milliseconds per bucket. */
  step: number;
  count: number;
  label: (d: Date) => string;
}

const BUCKETS: Record<Range, Bucket> = {
  "1H": { step: 5 * 60_000, count: 12, label: (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}` },
  "24H": { step: 60 * 60_000, count: 24, label: (d) => `${String(d.getHours()).padStart(2, "0")}:00` },
  "7D": { step: 24 * 60 * 60_000, count: 7, label: (d) => d.toLocaleDateString(undefined, { weekday: "short" }) },
  "30D": { step: 24 * 60 * 60_000, count: 30, label: (d) => `${d.getDate()}/${d.getMonth() + 1}` },
};

/** Buckets tickets into a fixed-width series ending at now. */
function toSeries(items: RepairServiceItem[], range: Range): AreaChartPoint[] {
  const { step, count, label } = BUCKETS[range];
  const now = Date.now();
  // Align the last bucket to the current step so labels are stable between
  // renders rather than drifting with every re-render's `Date.now()`.
  const end = Math.floor(now / step) * step + step;
  const start = end - step * count;

  const counts = new Array<number>(count).fill(0);
  for (const item of items) {
    const raw = item.serviceDate;
    if (!raw) continue;
    const t = new Date(raw).getTime();
    if (!Number.isFinite(t) || t < start || t >= end) continue;
    const idx = Math.floor((t - start) / step);
    if (idx >= 0 && idx < count) counts[idx] += 1;
  }

  return counts.map((value, i) => ({
    label: label(new Date(start + i * step)),
    value,
  }));
}

export default function DashboardChart() {
  const { t } = useI18n();
  const [range, setRange] = useState<Range>("7D");
  const [streaming, setStreaming] = useState(true);

  // Shared with the KPI row: one 400-row sample serves both, instead of each
  // component issuing its own request for the same tickets.
  const { items, loading, reload } = useTicketSeries();

  /**
   * Live refresh, throttled.
   *
   * `useRealtimeTickets` already debounces the SSE stream by 400ms, but a busy
   * afternoon can still produce a steady trickle, and each refresh here is a
   * 400-row fetch plus a re-bucket. This adds a hard floor of one reload per
   * 15s so the "Live" pill stays honest without turning the dashboard into a
   * polling loop. The ref holds the last run so the throttle survives renders.
   */
  const lastRun = useRef(0);
  const onRealtime = useCallback(() => {
    const now = Date.now();
    if (now - lastRun.current < 15_000) return;
    lastRun.current = now;
    void reload();
  }, [reload]);

  useRealtimeTickets("All", onRealtime, { disabled: !streaming });

  const series = useMemo(() => toSeries(items, range), [items, range]);

  // Mini-stats are derived from the same fetched rows, so they can never
  // disagree with the curve above them.
  const stats = useMemo(() => {
    const inRange = series.reduce((sum, p) => sum + p.value, 0);
    const byStatus = (needle: string) =>
      items.filter((i) => (i.status ?? "").toLowerCase().includes(needle)).length;

    return [
      { label: t("dash.todayReport"), value: inRange, icon: <Activity className="w-4 h-4" /> },
      { label: t("status.inspecting"), value: byStatus("inspect"), icon: <Wrench className="w-4 h-4" /> },
      { label: t("status.awaitingSparepart"), value: byStatus("awaiting"), icon: <Clock className="w-4 h-4" /> },
      { label: t("status.finished"), value: byStatus("finish"), icon: <CheckCircle2 className="w-4 h-4" /> },
    ];
  }, [items, series, t]);

  return (
    <ChartPanel
      title={t("dash.ticketVolume")}
      subtitle={t("dash.ticketVolumeHint")}
      legend={[{ label: t("dash.ticketsReceived"), color: "var(--av-accent-base)" }]}
      stats={stats}
      actions={
        <div className="flex items-center gap-2">
          <ToggleGroup
            options={RANGES}
            value={range}
            onChange={setRange}
            ariaLabel={t("dash.timeRange")}
          />
          <button
            type="button"
            onClick={() => setStreaming((s) => !s)}
            aria-pressed={streaming}
            className="rounded-full transition-opacity duration-150 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            title={streaming ? t("dash.streamOnHint") : t("dash.streamOffHint")}
          >
            <Badge tone={streaming ? "success" : "neutral"} dot pulse={streaming} size="md">
              {streaming ? t("dash.streamOn") : t("dash.streamOff")}
            </Badge>
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="h-[190px] lg:h-[200px] xl:h-[250px] grid place-items-center text-sm text-ink-muted">
          {t("common.loading")}
        </div>
      ) : (
        <AreaChart data={series} height={210} />
      )}
    </ChartPanel>
  );
}
