"use client";

import React, { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";
import {
  SESSION_CHANGED_EVENT,
  clearSession,
  isTokenExpired,
  millisecondsUntilExpiry,
  readToken,
  subscribeToSession,
} from "@/services/authSession";
import { subscribeSharedStream } from "@/hooks/useRealtimeTickets";

/** The server has no localStorage; it renders the checking state. */
function readTokenOnServer(): string | null {
  return null;
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();

  const [mounted, setMounted] = useState(false);

  // Sync token with external storage updates (cross-tab and in-tab)
  const token = useSyncExternalStore(subscribeToSession, readToken, readTokenOnServer);

  // Public pages that never require authentication
  const isPublicPage =
    pathname === "/login" ||
    pathname?.startsWith("/scanner") ||
    pathname?.startsWith("/face-link") ||
    pathname?.startsWith("/download") ||
    pathname?.startsWith("/docs") ||
    pathname?.startsWith("/open-app");

  // Synchronously resolve live token on client to prevent SSR null latch
  const activeToken = typeof window !== "undefined" ? (token ?? readToken()) : token;
  const isExpired = activeToken !== null && isTokenExpired(activeToken);

  // Once mounted on client: boolean. During SSR: undefined (or true for public)
  const isAuthenticated = isPublicPage
    ? true
    : !mounted
      ? undefined
      : activeToken !== null && !isExpired;

  /** Wipes the stored session and notifies this tab's subscribers. */
  const endSession = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("workspace_pipeline_synced");
      sessionStorage.removeItem("workspace_dashboard_prewarmed_v1");
      localStorage.removeItem("last_workspace_sync_time");
    }
    clearSession();
    window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
  }, []);

  // Mount effect to transition from SSR to client immediately
  useEffect(() => {
    setMounted(true);
  }, []);

  // Navigation effect: unauthenticated users redirect to /login immediately
  useEffect(() => {
    if (isPublicPage || !mounted) return;
    if (typeof window === "undefined") return;

    const current = readToken();
    if (!current || isTokenExpired(current)) {
      if (current && isTokenExpired(current)) {
        endSession();
      }
      router.replace("/login");

      // Hard redirect fallback: guarantee navigation within 120ms if router stalls
      const fallbackTimer = setTimeout(() => {
        if (window.location.pathname !== "/login" && !window.location.pathname.startsWith("/login")) {
          window.location.replace("/login");
        }
      }, 120);

      return () => clearTimeout(fallbackTimer);
    }
  }, [isPublicPage, mounted, pathname, router, token, endSession]);

  useEffect(() => {
    if (isPublicPage || !token || isExpired) return;

    const remaining = millisecondsUntilExpiry(token);
    if (remaining === null) return;

    const timer = setTimeout(() => {
      endSession();
      router.replace("/login");
    }, remaining);

    return () => clearTimeout(timer);
  }, [isPublicPage, isExpired, pathname, router, token, endSession]);

  // 1. Real-time Remote Kill Switch & Session Revocation, via the SHARED
  //    /api/events stream. This used to open its own EventSource per tab —
  //    alongside the ticket stream and the scanner stream that consumed 3 of
  //    the browser's ~6 connections per origin, and queued data fetches then
  //    expired on their own 20s abort timers while waiting for a socket.
  useEffect(() => {
    if (isPublicPage || !token || isExpired) return;

    const unsubscribe = subscribeSharedStream((data) => {
      if (data?.type !== "force_logout") return;

      const currentBrowserSessionId = sessionStorage.getItem("browser_login_session_id") || "";
      let currentUserName = "";
      try {
        const stored = localStorage.getItem("user_info");
        if (stored) {
          const p = JSON.parse(stored);
          currentUserName = String(p.userName || p.UserName || "").toLowerCase();
        }
      } catch {}

      const targetStatus = String(data.status || "").toLowerCase();
      const targetId = String(data.id || "");
      const targetUser = String(data.user || "").toLowerCase();

      // Only an EXPLICIT match may log this browser out. An event with
      // an empty status used to match everyone — so revoking one other
      // session signed out every browser of every user, including the
      // one that clicked, which read as the app breaking mid-test.
      //   all    -> everyone
      //   others -> this user's browsers EXCEPT the session in `id`
      //   id     -> exactly that browser session
      //   name   -> every browser signed in as that user
      let shouldLogout = false;
      if (targetStatus === "all") {
        shouldLogout = true;
      } else if (targetStatus === "others") {
        shouldLogout =
          targetId !== currentBrowserSessionId &&
          (targetUser === "" || targetUser === currentUserName);
      } else if (targetId !== "") {
        shouldLogout = targetId === currentBrowserSessionId;
      } else if (targetStatus !== "") {
        shouldLogout = targetStatus === currentUserName;
      }

      if (shouldLogout) {
        console.warn("[AuthGuard] Remote session revocation received. Logging out...");
        // Retire this browser-session id: the server row was revoked, and a
        // future sign-in heartbeating under the same id would be bounced.
        try {
          sessionStorage.removeItem("browser_login_session_id");
        } catch {}
        endSession();
        router.replace("/login");
      }
    });

    return unsubscribe;
  }, [isPublicPage, token, isExpired, endSession, router]);

  // 2. Periodic login heartbeat to track multi-browser & multi-device sessions live (Deduplicated 60s cadence)
  useEffect(() => {
    if (isPublicPage || !token || isExpired) return;

    let browserSessionId = sessionStorage.getItem("browser_login_session_id");
    if (!browserSessionId) {
      browserSessionId = "sess-" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      sessionStorage.setItem("browser_login_session_id", browserSessionId);
    }

    let isHeartbeatInFlight = false;
    let lastHeartbeatTime = 0;

    const sendHeartbeat = () => {
      const now = Date.now();
      // Throttle: Never fire heartbeats more than once every 30 seconds
      if (isHeartbeatInFlight || now - lastHeartbeatTime < 30_000) return;

      isHeartbeatInFlight = true;
      lastHeartbeatTime = now;

      let userName = "User";
      let un = "";
      let role = "Staff";
      let email = "";
      try {
        const stored = localStorage.getItem("user_info");
        if (stored) {
          const parsed = JSON.parse(stored) as Record<string, unknown>;
          const fn = String(parsed.firstName || parsed.FirstName || "").trim();
          const ln = String(parsed.lastName || parsed.LastName || "").trim();
          un = String(parsed.userName || parsed.UserName || "");
          const rawRoles = parsed.roles || parsed.Roles || (parsed.role ? [parsed.role] : []);
          const roles = Array.isArray(rawRoles) ? rawRoles : [];
          userName = `${fn} ${ln}`.trim() || un || "User";
          role = String(roles[0] || "Staff");
          email = String(parsed.email || parsed.Email || "");
        }
      } catch {}

      fetch("/api/auth/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: browserSessionId,
          userName: un || userName,
          role,
          email,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.isRevoked) {
            console.warn("[AuthGuard] Heartbeat confirmed session is revoked. Logging out...");
            try {
              sessionStorage.removeItem("browser_login_session_id");
            } catch {}
            endSession();
            router.replace("/login");
          }
        })
        .catch(() => {})
        .finally(() => {
          isHeartbeatInFlight = false;
        });
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 60_000);
    return () => clearInterval(interval);
  }, [isPublicPage, token, isExpired, endSession, router]);

  // Public pages (login, mobile scanner): render immediately
  if (isPublicPage) return <>{children}</>;

  if (isAuthenticated === undefined) {
    return (
      <div className="min-h-screen bg-[#06090E] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans select-none">
        <div className="absolute w-[440px] h-[440px] bg-emerald-500/20 rounded-full blur-[140px] pointer-events-none animate-pulse" />
        <div className="relative z-10 flex flex-col items-center text-center space-y-4 max-w-xs">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Sparkles className="w-7 h-7 animate-pulse" />
            </div>
          </div>
          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-white tracking-wide">
              {t("auth.verifying")}
            </h3>
            <p className="text-[11px] text-slate-400">
              Securing enterprise connection...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Unauthenticated: null while navigation effect redirects to /login
  if (!isAuthenticated) return null;

  // Authenticated: render workspace immediately with zero lag
  return <>{children}</>;
}
