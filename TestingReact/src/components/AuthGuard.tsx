"use client";

import React, { useCallback, useEffect, useSyncExternalStore } from "react";
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

/** The server has no localStorage; it renders the checking state. */
function readTokenOnServer(): string | null {
  return null;
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();

  /**
   * The token is read during render rather than in an on-mount effect.
   *
   * It used to live in `useState(null)` filled in by a `useEffect`, which meant
   * every protected page rendered the full-screen "verifying" spinner first,
   * committed it, ran the effect, called setState and rendered a second time —
   * a guaranteed double render and a visible spinner flash on every navigation,
   * even for a user whose token was sitting in localStorage the whole time.
   *
   * `useSyncExternalStore` resolves it before paint instead, so an authenticated
   * user goes straight to the page. This is the same approach `LanguageProvider`
   * uses for the language preference, and for the same reason: the value is
   * external client state, not derived state.
   */
  const token = useSyncExternalStore(subscribeToSession, readToken, readTokenOnServer);

  const isLoginPage = pathname === "/login";

  /**
   * A token that has passed its `exp` is no session at all.
   *
   * Presence alone used to be the whole check, so an expired token left the
   * app fully rendered — sidebar, tables, save buttons — while every request
   * behind it failed. Treating expiry as logged-out sends the user somewhere
   * they can act instead.
   */
  const isExpired = token !== null && isTokenExpired(token);

  // Undefined while the server snapshot is in play — genuinely "not known yet",
  // which is different from "known to be absent" and must not redirect.
  const isAuthenticated = isLoginPage
    ? true
    : token === null
      ? undefined
      : !isExpired;

  /** Wipes the stored session and notifies this tab's subscribers. */
  const endSession = useCallback(() => {
    clearSession();
    window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
  }, []);

  // Navigation is a real side effect and belongs in an effect; only the *read*
  // moved out. Note this fires when the token is absent, which on the very
  // first server-snapshot render is indistinguishable from "still unknown" —
  // hence the `typeof window` guard, true only once the client store is live.
  useEffect(() => {
    if (isLoginPage) return;
    if (typeof window === "undefined") return;

    const current = readToken();
    if (current === null) {
      router.replace("/login");
      return;
    }
    if (isTokenExpired(current)) {
      // Clear first: leaving the dead token in place would let the next
      // navigation read it back and render as though still signed in.
      endSession();
      router.replace("/login");
    }
  }, [isLoginPage, pathname, router, token, endSession]);

  /**
   * Ends the session at the moment the token lapses, rather than waiting for
   * the next navigation.
   *
   * These queues are left open on a workshop screen for hours; without this a
   * user comes back to a page that looks live and silently fails on the first
   * click.
   */
  useEffect(() => {
    if (isLoginPage || !token || isExpired) return;

    const remaining = millisecondsUntilExpiry(token);
    if (remaining === null || remaining <= 0) return;

    // setTimeout clamps to a 32-bit delay (~24.9 days); anything longer would
    // fire immediately, which would log the user straight back out.
    const MAX_TIMEOUT_MS = 2_147_483_647;
    if (remaining > MAX_TIMEOUT_MS) return;

    const timer = window.setTimeout(endSession, remaining);
    return () => window.clearTimeout(timer);
  }, [token, isExpired, isLoginPage, endSession]);

  // Login page: render immediately, no auth check needed.
  if (isLoginPage) return <>{children}</>;

  if (isAuthenticated === undefined) {
    return (
      <div className="min-h-screen bg-ink text-ink flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-accent/20 border border-info/30 text-info flex items-center justify-center mb-4 animate-pulse">
          <Sparkles className="w-6 h-6" />
        </div>
        <p className="text-xs text-ink-muted font-medium">{t("auth.verifying")}</p>
      </div>
    );
  }

  // Unauthenticated — the effect above is redirecting.
  if (!isAuthenticated) return null;

  return <>{children}</>;
}
