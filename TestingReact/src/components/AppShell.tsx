"use client";

import React, { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import RouteWarmer from "@/components/RouteWarmer";
import {
  readSidebarOpen,
  readSidebarOpenOnServer,
  setSidebarOpen,
  subscribeToSidebar,
} from "@/services/sidebarPreference";
import { sidebarMarginClass } from "@/lib/sidebarMetrics";
import { useTheme } from "@/theme/ThemeProvider";
import { cn } from "@/lib/utils";

/**
 * Persistent App Shell.
 *
 * Renders the top-level application frame containing the Sidebar and Header once.
 * Because it is mounted at the RootLayout / AuthGuard level, the Sidebar and Header
 * NEVER unmount or re-render during client-side route changes.
 *
 * Only the inner `{children}` page content smoothly transitions.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sidebarOpen = useSyncExternalStore(
    subscribeToSidebar,
    readSidebarOpen,
    readSidebarOpenOnServer
  );
  const { prefs } = useTheme();

  // Public pages that do not have the internal management shell
  const isPublicPage =
    pathname === "/login" ||
    pathname?.startsWith("/scanner") ||
    pathname?.startsWith("/face-link") ||
    pathname?.startsWith("/download") ||
    pathname?.startsWith("/docs") ||
    pathname?.startsWith("/open-app");

  if (isPublicPage) {
    return <>{children}</>;
  }

  const marginClass = sidebarMarginClass(
    prefs.sidebarStyle || "classic",
    sidebarOpen
  );

  return (
    <div className="h-screen overflow-hidden bg-[var(--background)] text-ink font-sans flex">
      {/* ── Background Route & Data Pre-warmer ── */}
      <RouteWarmer />

      {/* ── Persistent Sidebar Navigation (Never unmounts across routes) ── */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* ── Persistent Header & Main Content Host ── */}
      <div
        className={cn(
          "flex-1 flex flex-col h-screen overflow-hidden min-w-0 transition-[margin] duration-300 ease-out",
          marginClass
        )}
      >
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
