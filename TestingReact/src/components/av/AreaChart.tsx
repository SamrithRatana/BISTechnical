"use client";

import { memo, useCallback, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * @file components/av/AreaChart.tsx
 * @description The main dashboard chart — smooth area/line with a gradient
 * fill, visible data points, and a hover tooltip that tracks the curve.
 *
 * Still no charting library. The whole thing is one `<path>` for the fill, one
 * for the stroke, and N circles.
 *
 * TWO THINGS KEEP THIS CHEAP ON A SLOW MACHINE:
 *
 * 1. The geometry is memoised on `data` alone. Hovering changes
 *    `hoverIndex` — a number — and re-renders only the tooltip and the
 *    highlighted circle. The Bézier path is not recomputed to move a
 *    crosshair, which is the usual reason chart hover feels sticky.
 *
 * 2. Hit-testing is arithmetic, not DOM. One `pointermove` on the SVG maps
 *    the x offset to the nearest index. The alternative — an invisible
 *    `<rect>` per point with its own handler — is N listeners and N hit-test
 *    candidates per frame.
 */

const VIEW_W = 800;
const VIEW_H = 260;
const PAD_X = 40;
const PAD_Y = 28;

export interface AreaChartPoint {
  label: string;
  value: number;
}

export interface AreaChartProps {
  data: AreaChartPoint[];
  className?: string;
  /** Formats the tooltip value. Defaults to a localised integer. */
  formatValue?: (value: number) => string;
  height?: number;
}

export const AreaChart = memo(function AreaChart({
  data,
  className,
  formatValue,
  height = 260,
}: AreaChartProps) {
  const gradId = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const fmt = useCallback(
    (v: number) => (formatValue ? formatValue(v) : v.toLocaleString()),
    [formatValue]
  );

  const geom = useMemo(() => {
    if (data.length < 2) return null;

    const values = data.map((d) => d.value);
    const max = Math.max(...values);
    const min = Math.min(...values, 0);
    // Head-room above the peak so the highest point and its label are not
    // clipped by the top edge of the viewBox.
    const top = max * 1.12 || 1;
    const range = top - min || 1;

    const pts = data.map((d, i) => ({
      x: PAD_X + (i / (data.length - 1)) * (VIEW_W - PAD_X * 2),
      y: PAD_Y + (1 - (d.value - min) / range) * (VIEW_H - PAD_Y * 2),
      ...d,
    }));

    let line = `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      line += ` C ${cpX.toFixed(2)},${p0.y.toFixed(2)} ${cpX.toFixed(2)},${p1.y.toFixed(2)} ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`;
    }

    const baseline = VIEW_H - PAD_Y;
    return {
      pts,
      line,
      area: `${line} L ${pts[pts.length - 1].x.toFixed(2)},${baseline} L ${pts[0].x.toFixed(2)},${baseline} Z`,
      baseline,
    };
  }, [data]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!geom || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      if (rect.width === 0) return;

      // Client px -> viewBox units, then nearest point by index. Uniform
      // spacing means this is a divide, not a search.
      const xView = ((e.clientX - rect.left) / rect.width) * VIEW_W;
      const span = (VIEW_W - PAD_X * 2) / (data.length - 1);
      const idx = Math.round((xView - PAD_X) / span);
      const clamped = Math.max(0, Math.min(data.length - 1, idx));

      setHoverIndex((prev) => (prev === clamped ? prev : clamped));
    },
    [data.length, geom]
  );

  const onPointerLeave = useCallback(() => setHoverIndex(null), []);

  if (!geom) {
    return (
      <div
        className={cn("grid place-items-center text-sm text-ink-muted", className)}
        style={{ height }}
      >
        Not enough data to plot
      </div>
    );
  }

  const active = hoverIndex !== null ? geom.pts[hoverIndex] : null;

  return (
    <div className={cn("relative w-full", className)} style={{ height }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full h-full touch-none"
        preserveAspectRatio="none"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        role="img"
        aria-label={`Trend chart, ${data.length} points, latest ${fmt(data[data.length - 1].value)}`}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--av-accent-bright)" stopOpacity="0.26" />
            <stop offset="100%" stopColor="var(--av-accent-bright)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal guides, dashed so they read as a measuring grid rather
            than as part of the drawing. `non-scaling-stroke` keeps them true
            hairlines — and keeps the dash pattern from being stretched into
            uneven blocks — even though preserveAspectRatio="none" scales the
            viewBox unevenly to fill the container. */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = PAD_Y + f * (VIEW_H - PAD_Y * 2);
          return (
            <line
              key={f}
              x1={PAD_X}
              x2={VIEW_W - PAD_X}
              y1={y}
              y2={y}
              stroke="var(--av-border-subtle)"
              strokeWidth="1"
              strokeDasharray="5 6"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        <path d={geom.area} fill={`url(#${gradId})`} />
        <path
          d={geom.line}
          fill="none"
          stroke="var(--av-accent-base)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {active && (
          <line
            x1={active.x}
            x2={active.x}
            y1={PAD_Y}
            y2={geom.baseline}
            stroke="var(--av-accent-base)"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.4"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {geom.pts.map((p, i) => (
          <circle
            key={p.label + i}
            cx={p.x}
            cy={p.y}
            r={hoverIndex === i ? 5.5 : 3.5}
            fill="var(--av-bg-surface)"
            stroke="var(--av-accent-base)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            style={{ transition: "r var(--av-dur-fast) var(--av-ease)" }}
          />
        ))}
      </svg>

      {/* Tooltip lives in HTML, not SVG: real text rendering, real box
          shadow, and it can escape the chart's bounds without clipping.
          Positioned with a percentage transform so it needs no measurement. */}
      {active && (
        <div
          className="pointer-events-none absolute z-10 rounded-xl bg-surface border border-subtle shadow-soft-lg px-3 py-2"
          style={{
            left: `${(active.x / VIEW_W) * 100}%`,
            top: `${(active.y / VIEW_H) * 100}%`,
            transform: "translate(-50%, calc(-100% - 12px))",
          }}
        >
          <div className="text-[11px] text-ink-secondary whitespace-nowrap">{active.label}</div>
          <div className="text-sm font-semibold text-ink tabular-nums whitespace-nowrap">
            {fmt(active.value)}
          </div>
        </div>
      )}

      {/* Axis labels. Thinned to at most ~8 so a 30-point series does not
          render an unreadable smear of overlapping text. */}
      <div className="absolute inset-x-0 bottom-0 flex justify-between px-[5%] text-[10px] text-ink-muted">
        {geom.pts.map((p, i) => {
          const step = Math.ceil(geom.pts.length / 8);
          if (i % step !== 0 && i !== geom.pts.length - 1) return null;
          return (
            <span key={p.label + i} className="truncate">
              {p.label}
            </span>
          );
        })}
      </div>
    </div>
  );
});
