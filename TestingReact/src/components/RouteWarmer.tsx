"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { prefetchRouteData } from "@/services/routePrefetch";

/**
 * High-frequency primary application routes to pre-warm on initial sign-in.
 * Secondary routes are warmed on-demand on mouse hover to preserve memory.
 */
const ESSENTIAL_WARM_ROUTES = [
  "/",
  "/received-inventory",
  "/receive-item",
  "/inspect-item",
  "/approve-repair",
  "/spareparts",
  "/customers",
];

/**
 * @file RouteWarmer.tsx
 * @description Background Route & Data Pre-warmer.
 *
 * Runs during browser idle periods right after initial dashboard load.
 * Sequentially warms up all Next.js route JS chunks (via router.prefetch)
 * and primes the in-memory SWR list cache (via prefetchRouteData).
 *
 * This ensures that on the VERY FIRST CLICK of any menu item, the page
 * and its data open instantaneously (0ms) without cold-compilation lag.
 */
export default function RouteWarmer() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    let isCancelled = false;

    const timers: (NodeJS.Timeout | number)[] = [];

    const startWarming = () => {
      if (isCancelled) return;

      // Stagger each route warmup by 120ms so the CPU and memory remain 100% lean
      ESSENTIAL_WARM_ROUTES.forEach((route, index) => {
        const t = setTimeout(() => {
          if (isCancelled) return;
          try {
            // 1. Tell Next.js router to compile/download the route chunk into browser memory
            router.prefetch(route);
            // 2. Fetch and prime the API data into in-memory list cache
            prefetchRouteData(route);
          } catch {
            // Silently ignore background warming errors
          }
        }, index * 120);
        timers.push(t);
      });
    };

    const timer = setTimeout(() => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(startWarming, { timeout: 3000 });
      } else {
        startWarming();
      }
    }, 500);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      timers.forEach((t) => clearTimeout(t));
    };
  }, [router]);

  return null;
}
