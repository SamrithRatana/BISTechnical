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
import SessionHandshakePipeline from "./SessionHandshakePipeline";

/** The server has no localStorage; it renders the checking state. */
function readTokenOnServer(): string | null {
  return null;
}

/** How long a completed verification keeps the workspace "warm". */
const MAX_DATA_FRESHNESS_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Can this tab render the workspace straight away, or does it need the
 * pre-warm handshake first?
 *
 * Warm means BOTH of:
 *   1. a verification pipeline has already run in THIS tab
 *      (`workspace_pipeline_synced`, sessionStorage). The login screen's own
 *      5-node check stamps it, so a fresh sign-in is warm on arrival and must
 *      never be shown a second handshake;
 *   2. that run was recent (`last_workspace_sync_time` inside the freshness
 *      window). A tab left open for hours holds cold data and is worth
 *      re-warming before it renders.
 *
 * Either signal alone is not enough. The timestamp lives in localStorage, so by
 * itself a brand-new tab looks warm while its sessionStorage cache is empty;
 * the flag by itself never expires, so a long-idle tab would never re-warm.
 *
 * Pure read: this runs during render and must not write.
 */
function isWorkspaceWarm(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const token = localStorage.getItem("jwt_token");
    if (!token || isTokenExpired(token)) return false;

    if (sessionStorage.getItem("workspace_pipeline_synced") !== "true") return false;

    // Number("") and Number(null) are both 0, so the `<= 0` guard covers a
    // missing key as well as a corrupt one.
    const lastSync = Number(localStorage.getItem("last_workspace_sync_time"));
    if (!Number.isFinite(lastSync) || lastSync <= 0) return false;

    return Date.now() - lastSync < MAX_DATA_FRESHNESS_MS;
  } catch {
    return false;
  }
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();

  /**
   * Latch for "the handshake already ran during this mount".
   *
   * Warmth itself is recomputed on every render rather than latched at mount:
   * AuthGuard lives in the root layout, so it stays mounted across the
   * /login -> / navigation. Reading warmth once at mount froze the "cold"
   * answer taken while the user was still on the login screen, which is what
   * put a redundant handshake in front of every fresh sign-in.
   */
  const [handshakeRan, setHandshakeRan] = useState(false);
  const isWarm = isWorkspaceWarm();

  /**
   * The token is read during render rather than in an on-mount effect.
   * `useSyncExternalStore` resolves it before paint so an authenticated user goes straight to the page.
   */
  const token = useSyncExternalStore(subscribeToSession, readToken, readTokenOnServer);

  const isPublicPage = pathname === "/login" || pathname?.startsWith("/scanner");
  const isExpired = token !== null && isTokenExpired(token);

  const isAuthenticated = isPublicPage
    ? true
    : token === null
      ? undefined
      : !isExpired;

  /** Wipes the stored session and notifies this tab's subscribers. */
  const endSession = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("workspace_pipeline_synced");
      localStorage.removeItem("last_workspace_sync_time");
    }
    clearSession();
    window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
  }, []);

  /**
   * Stable identity on purpose: SessionHandshakePipeline lists `onComplete` in
   * its effect deps, so an inline arrow would restart the whole pipeline (and
   * arm a second fallback timer) on any re-render while it is on screen.
   */
  const handleHandshakeComplete = useCallback(() => setHandshakeRan(true), []);

  // Navigation is a real side effect and belongs in an effect
  useEffect(() => {
    if (isPublicPage) return;
    if (typeof window === "undefined") return;

    const current = readToken();
    if (current === null) {
      router.replace("/login");
      return;
    }
    if (isTokenExpired(current)) {
      endSession();
      router.replace("/login");
    }
  }, [isPublicPage, pathname, router, token, endSession]);

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

  // Send periodic login heartbeat to track multi-browser & multi-device sessions live
  useEffect(() => {
    if (isPublicPage || !token || isExpired) return;

    let browserSessionId = sessionStorage.getItem("browser_login_session_id");
    if (!browserSessionId) {
      browserSessionId = "sess-" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      sessionStorage.setItem("browser_login_session_id", browserSessionId);
    }

    const sendHeartbeat = () => {
      let userName = "User";
      let role = "Staff";
      let email = "";
      try {
        const stored = localStorage.getItem("user_info");
        if (stored) {
          const parsed = JSON.parse(stored);
          userName = `${parsed.firstName || ""} ${parsed.lastName || ""}`.trim() || parsed.userName || "User";
          role = parsed.roles?.[0] || parsed.role || "Staff";
          email = parsed.email || "";
        }
      } catch {}

      fetch("/api/auth/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: browserSessionId,
          userName,
          role,
          email,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.isRevoked) {
            endSession();
            router.replace("/login");
          }
        })
        .catch(() => {});
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 15000);
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

  // Unauthenticated
  if (!isAuthenticated) return null;

  // An already-authenticated session whose workspace is cold (new tab, cleared
  // storage) or stale (link left open a long time) pre-warms before rendering.
  // A fresh login never lands here: its own 5-node pipeline already verified
  // the stack and stamped the markers before pushing to this route.
  if (!isWarm && !handshakeRan) {
    return <SessionHandshakePipeline onComplete={handleHandshakeComplete} />;
  }

  // Authenticated with warm data ready: 0ms instant render!
  return <>{children}</>;
}
