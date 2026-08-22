/**
 * @file components/av/index.ts
 * @description The Aura Velvet (OS 3.2) component library.
 *
 * These are the reusable primitives the rest of the app composes from. All of
 * them read colour, elevation, radius and motion from the `--av-*` tokens in
 * `app/globals.css` — no component hardcodes a hex value, so the design system
 * stays changeable from one place.
 *
 * `AreaChart` is deliberately NOT re-exported here. It is the heaviest piece
 * in the set, and pages load it with `next/dynamic` so it lands in its own
 * chunk instead of the shared bundle every route pays for. Re-exporting it
 * from the barrel would pull it back into that bundle through this file and
 * quietly undo the code-split.
 */

export { Card, CardHeader } from "./Card";
export type { CardProps, CardVariant } from "./Card";

export { Badge } from "./Badge";
export type { BadgeProps, BadgeTone } from "./Badge";

export { ProgressBar } from "./ProgressBar";
export type { ProgressBarProps, ProgressTone } from "./ProgressBar";

export { ToggleGroup } from "./ToggleGroup";
export type { ToggleGroupProps, ToggleOption } from "./ToggleGroup";

export { Sparkline, buildSparkPath } from "./Sparkline";
export type { SparklineProps } from "./Sparkline";

export { KpiCard } from "./KpiCard";
export type { KpiCardProps } from "./KpiCard";

export { ChartPanel } from "./ChartPanel";
export type { ChartPanelProps, MiniStat, LegendEntry } from "./ChartPanel";

export { Skeleton, SkeletonText, SkeletonRow, SkeletonRows, SkeletonCard } from "./Skeleton";
export type { SkeletonProps, SkeletonRowProps, SkeletonRowsProps } from "./Skeleton";

export { EmptyState, EmptyStateRow } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";

export { ErrorState, ErrorStateRow } from "./ErrorState";
export type { ErrorStateProps } from "./ErrorState";

export { ConfirmDialog } from "./ConfirmDialog";
export type { ConfirmDialogProps } from "./ConfirmDialog";

export { ModalWrapper } from "./ModalWrapper";
export type { ModalWrapperProps } from "./ModalWrapper";
