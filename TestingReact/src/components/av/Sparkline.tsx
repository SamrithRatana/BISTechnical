"use client";

import { memo, useId, useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * @file components/av/Sparkline.tsx
 * @description The inline mini-chart at the foot of a KPI card.
 *
 * Hand-rolled SVG, no charting library. A sparkline is one path and two
 * circles; the lightest chart library that could draw it costs tens of
 * kilobytes and, more to the point, re-renders on every parent render. This
 * memoises on the data array and computes the path once.
 *
 * The curve is a cubic Bézier with control points at the horizontal midpoint
 * between each pair — the standard smooth-through-points construction. It
 * cannot overshoot horizontally, so the line never doubles back on itself the
 * way a naive Catmull-Rom fit does on spiky data.
 */

const WIDTH = 120;
const HEIGHT = 36;

export interface SparklineProps {
  data: number[];
  /** Drives the stroke colour. Trend direction, not a colour name. */
  positive?: boolean;
  className?: string;
}

export function buildSparkPath(data: number[], width = WIDTH, height = HEIGHT) {
  if (data.length < 2) return { line: "", area: "", last: { x: 0, y: height / 2 } };

  const min = Math.min(...data);
  const max = Math.max(...data);
  // A flat series has zero range; guard so every point lands mid-box rather
  // than dividing by zero and rendering NaN into the path attribute.
  const range = max - min || 1;

  const pts = data.map((val, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((val - min) / range) * (height - 8) - 4,
  }));

  let line = `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const cpX = (p0.x + p1.x) / 2;
    line += ` C ${cpX.toFixed(2)},${p0.y.toFixed(2)} ${cpX.toFixed(2)},${p1.y.toFixed(2)} ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`;
  }

  return {
    line,
    area: `${line} L ${width},${height} L 0,${height} Z`,
    last: pts[pts.length - 1],
  };
}

export const Sparkline = memo(function Sparkline({
  data,
  positive = true,
  className,
}: SparklineProps) {
  // `useId` keeps the gradient id unique per instance. Duplicated ids across
  // several sparklines make every one of them resolve `url(#...)` to the first
  // definition in the document, so all cards share one card's gradient.
  const gradId = useId().replace(/:/g, "");
  const { line, area, last } = useMemo(() => buildSparkPath(data), [data]);

  if (!line) return null;

  const stroke = positive ? "var(--av-accent-bright)" : "var(--av-danger)";

  return (
    <div className={cn("w-28 h-9 shrink-0", className)} aria-hidden>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} />
        <path
          d={line}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={last.x}
          cy={last.y}
          r="2.5"
          fill="var(--av-bg-surface)"
          stroke={stroke}
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
});
