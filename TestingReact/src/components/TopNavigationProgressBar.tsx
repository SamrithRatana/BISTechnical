"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Global Top Navigation Progress Bar.
 *
 * Renders an ultra-fast, smooth progress indicator directly below the browser's
 * address bar during page transitions and route changes, providing instant (<16ms)
 * visual feedback for every user click.
 */
export default function TopNavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Complete and reset progress bar when navigation completes
  useEffect(() => {
    setProgress(100);
    const timeout = setTimeout(() => {
      setLoading(false);
      setProgress(0);
    }, 200);

    return () => {
      clearTimeout(timeout);
    };
  }, [pathname, searchParams]);

  // Intercept click on navigation links across the document to start progress bar instantly
  useEffect(() => {
    let safetyTimer: NodeJS.Timeout | null = null;
    let stepTimer1: NodeJS.Timeout | null = null;
    let stepTimer2: NodeJS.Timeout | null = null;

    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (
        href &&
        href.startsWith("/") &&
        !href.startsWith("//") &&
        !href.startsWith("/#") &&
        !anchor.hasAttribute("download") &&
        anchor.target !== "_blank" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        !e.altKey &&
        e.button === 0
      ) {
        if (href !== window.location.pathname) {
          setLoading(true);
          setProgress(35);

          if (safetyTimer) clearTimeout(safetyTimer);
          if (stepTimer1) clearTimeout(stepTimer1);
          if (stepTimer2) clearTimeout(stepTimer2);

          stepTimer1 = setTimeout(() => setProgress((p) => (p > 0 && p < 70 ? 70 : p)), 60);
          stepTimer2 = setTimeout(() => setProgress((p) => (p > 0 && p < 90 ? 90 : p)), 150);

          // Safety auto-dismiss: guaranteed finish to prevent stuck progress bar
          safetyTimer = setTimeout(() => {
            setProgress(100);
            setTimeout(() => {
              setLoading(false);
              setProgress(0);
            }, 120);
          }, 500);
        }
      }
    };

    document.addEventListener("click", handleAnchorClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleAnchorClick, { capture: true });
      if (safetyTimer) clearTimeout(safetyTimer);
      if (stepTimer1) clearTimeout(stepTimer1);
      if (stepTimer2) clearTimeout(stepTimer2);
    };
  }, []);

  if (!loading && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none overflow-hidden bg-transparent"
    >
      <div
        className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 shadow-[0_0_10px_rgba(16,185,129,0.7)] transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transition: progress === 100 ? "width 150ms ease-out, opacity 250ms ease-in" : "width 250ms ease-out",
        }}
      />
    </div>
  );
}
