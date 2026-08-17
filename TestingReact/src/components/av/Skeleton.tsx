"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

/**
 * @file components/av/Skeleton.tsx
 * @description Placeholder shapes shown while data is in flight.
 *
 * Why these exist at all: every table in this app previously rendered a
 * spinner in an empty box, then swapped in a full table. The row height, the
 * column widths and the page height all changed in one frame, so the content
 * under the cursor jumped and anything the user had started reading moved.
 * A skeleton occupies the same space the real row will, so arrival is a
 * repaint rather than a reflow.
 *
 * The shimmer is a CSS background animation, declared once in `globals.css` as
 * `.av-skeleton`. It is deliberately NOT a framer animation: there can be
 * dozens on screen and each framer instance would run its own rAF loop and
 * commit inline styles every frame, where the CSS version is one composited
 * gradient shared by every element. It is also the only animation in the app
 * that legitimately loops, which is why `globals.css` exempts it from the
 * reduced-motion collapse the same way it exempts spinners: a frozen skeleton
 * next to a pending request reads as a hung screen.
 */

export interface SkeletonProps {
  className?: string;
  /** Rounded-full instead of the default rounded-md — for avatars and dots. */
  circle?: boolean;
}

export const Skeleton = memo(function Skeleton({ className, circle }: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "av-skeleton block",
        circle ? "rounded-full" : "rounded-md",
        className
      )}
    />
  );
});

export interface SkeletonTextProps {
  /** Number of lines. The last one is rendered short, as real text wraps. */
  lines?: number;
  className?: string;
}

export const SkeletonText = memo(function SkeletonText({
  lines = 3,
  className,
}: SkeletonTextProps) {
  return (
    <span className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </span>
  );
});

export interface SkeletonRowProps {
  /** Must match the real table's column count or the header shifts. */
  columns: number;
  /** Renders the first cell as a thumbnail block — for the parts table. */
  leadingThumbnail?: boolean;
}

/**
 * One placeholder `<tr>`.
 *
 * Column count is a required prop rather than a default: a skeleton with the
 * wrong number of cells makes the header and body disagree, and the table
 * visibly snaps into alignment when real data lands — the exact jump these are
 * here to prevent.
 */
export const SkeletonRow = memo(function SkeletonRow({
  columns,
  leadingThumbnail = false,
}: SkeletonRowProps) {
  return (
    <tr className="border-b border-subtle">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="py-3 px-3.5">
          {leadingThumbnail && i === 0 ? (
            <Skeleton className="w-14 h-14 mx-auto rounded-lg" />
          ) : (
            <Skeleton
              className={cn("h-3.5", i % 3 === 0 ? "w-3/4" : i % 3 === 1 ? "w-full" : "w-1/2")}
            />
          )}
        </td>
      ))}
    </tr>
  );
});

export interface SkeletonRowsProps {
  rows?: number;
  columns: number;
  leadingThumbnail?: boolean;
}

/** A block of placeholder rows, for a table's first load or its next page. */
export const SkeletonRows = memo(function SkeletonRows({
  rows = 8,
  columns,
  leadingThumbnail,
}: SkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} columns={columns} leadingThumbnail={leadingThumbnail} />
      ))}
    </>
  );
});

/** Placeholder for a KPI tile or any small panel. */
export const SkeletonCard = memo(function SkeletonCard({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-subtle bg-surface p-4 flex flex-col gap-3",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton circle className="h-8 w-8" />
      </div>
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
});
