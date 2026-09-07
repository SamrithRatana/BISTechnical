import React from "react";
import { Skeleton, SkeletonRows } from "@/components/av";

/**
 * @file app/loading.tsx
 * @description Instant Route Loading Shell (Next.js App Router Suspense Boundary).
 *
 * When a user clicks any menu link, Next.js transitions the route immediately
 * on frame 0, rendering this instant table skeleton shell before the destination
 * page's code chunk or data finishes streaming in.
 *
 * This eliminates the feeling of "waiting a moment after clicking a menu"
 * by providing instant visual feedback and smooth content arrival.
 */
export default function GlobalLoading() {
  return (
    <main className="flex-1 flex flex-col p-2.5 sm:p-3.5 lg:p-3.5 xl:p-6 w-full mx-auto overflow-hidden min-h-0">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden gap-2.5 sm:gap-3">
        {/* Page title skeleton */}
        <div className="flex items-center justify-between shrink-0 mb-1">
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-48 rounded-lg" />
            <Skeleton className="h-3 w-64 rounded-md" />
          </div>
        </div>

        {/* Table Shell Skeleton */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 rounded-2xl overflow-hidden bg-surface border border-subtle shadow-soft-sm">
          {/* Table Toolbar Skeleton */}
          <div className="p-2.5 sm:p-3 lg:p-3 xl:p-4 shrink-0 flex flex-wrap items-center justify-between gap-3 lg:gap-3 xl:gap-4 border-b border-subtle bg-cushion">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-8 w-52 sm:w-64 lg:w-64 xl:w-80 rounded-xl" />
              <Skeleton className="h-8 w-8 rounded-xl" />
            </div>

            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-28 rounded-xl" />
              <Skeleton className="h-8 w-28 rounded-xl" />
            </div>
          </div>

          {/* Table Rows Skeleton */}
          <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
            <table className="w-full text-left border-collapse min-w-full">
              <thead>
                <tr className="sticky top-0 z-10 text-[10.5px] lg:text-[10.5px] xl:text-[11px] font-semibold uppercase tracking-wider shadow-soft-sm bg-cushion border-b border-subtle text-ink-muted">
                  <th className="py-2.5 lg:py-2.5 xl:py-3.5 px-2.5 sm:px-3 xl:px-3.5">
                    <Skeleton className="h-3 w-16" />
                  </th>
                  <th className="py-2.5 lg:py-2.5 xl:py-3.5 px-2.5 sm:px-3 xl:px-3.5">
                    <Skeleton className="h-3 w-20" />
                  </th>
                  <th className="py-2.5 lg:py-2.5 xl:py-3.5 px-2.5 sm:px-3 xl:px-3.5">
                    <Skeleton className="h-3 w-28" />
                  </th>
                  <th className="py-2.5 lg:py-2.5 xl:py-3.5 px-2.5 sm:px-3 xl:px-3.5">
                    <Skeleton className="h-3 w-24" />
                  </th>
                  <th className="py-2.5 lg:py-2.5 xl:py-3.5 px-2.5 sm:px-3 xl:px-3.5">
                    <Skeleton className="h-3 w-20" />
                  </th>
                  <th className="py-2.5 lg:py-2.5 xl:py-3.5 px-2.5 sm:px-3 xl:px-3.5 text-center">
                    <Skeleton className="h-3 w-12 mx-auto" />
                  </th>
                  <th className="py-2.5 lg:py-2.5 xl:py-3.5 px-2.5 sm:px-3 xl:px-3.5 text-center">
                    <Skeleton className="h-3 w-16 mx-auto" />
                  </th>
                  <th className="py-2.5 lg:py-2.5 xl:py-3.5 px-2.5 sm:px-3 xl:px-3.5">
                    <Skeleton className="h-3 w-16" />
                  </th>
                  <th className="py-2.5 lg:py-2.5 xl:py-3.5 px-2.5 sm:px-3 xl:px-3.5 text-center">
                    <Skeleton className="h-3 w-14 mx-auto" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--av-border-subtle)] text-xs text-ink">
                <SkeletonRows rows={8} columns={9} />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
