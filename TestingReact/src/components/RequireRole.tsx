"use client";

/**
 * @file RequireRole.tsx
 * @description Hides a page from users whose role doesn't cover it.
 *
 * **This is a UX gate, not a security boundary.** It reads roles out of the
 * browser's own storage, which the user controls — anyone determined can edit
 * them and render the page. Its job is to keep staff out of screens that
 * aren't theirs and would only confuse or half-work for them.
 *
 * The actual protection has to live on the API. Today the TechnicalService API
 * accepts anonymous requests entirely (`Jwt:Enabled` is false), and even with
 * bearer validation switched on it has no per-role policies — so a determined
 * user could still call the endpoints directly. Adding those policies is the
 * follow-up that makes this real.
 */

import React from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { hasAnyRole, subscribeToSession } from "@/services/authSession";
import { useI18n } from "@/i18n/LanguageProvider";

/** The server has no localStorage, so the answer there is "not decided yet". */
function unknownOnServer(): boolean | null {
  return null;
}

/**
 * Whether the session covers `allowed`: `null` until resolved on the client,
 * then true/false.
 *
 * Exposed separately so a page can also skip *fetching* data it isn't allowed
 * to show. Hiding the markup while still pulling the full user list would make
 * the gate pure theatre.
 */
export function useHasRole(allowed: readonly string[]): boolean | null {
  // `useSyncExternalStore` rather than state seeded by a mount effect: roles
  // live in localStorage, which is external client state, and the effect
  // version rendered twice on every page and briefly reported "undecided" to a
  // user who was in fact permitted. Same pattern as `AuthGuard` and
  // `LanguageProvider`, for the same reason. The snapshot is a primitive, so
  // React's identity check settles without memoisation.
  const getSnapshot = React.useCallback(() => hasAnyRole(allowed), [allowed]);

  return React.useSyncExternalStore(subscribeToSession, getSnapshot, unknownOnServer);
}

interface RequireRoleProps {
  /** Any one of these roles grants access. */
  allowed: readonly string[];
  children: React.ReactNode;
}

export default function RequireRole({ allowed, children }: RequireRoleProps) {
  const { t } = useI18n();

  /**
   * Resolved after mount, never during render — `hasAnyRole` reads
   * localStorage, which doesn't exist on the server, so deciding during render
   * would make the server and client markup disagree and trigger a hydration
   * mismatch.
   */
  const granted = useHasRole(allowed);

  // Undecided — render nothing rather than flashing the page and snatching it
  // back, or flashing a denial at someone who turns out to be permitted.
  if (granted === null) return null;

  if (granted) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-warning/30 bg-warning/10 text-warning">
        <ShieldAlert className="h-7 w-7" />
      </div>
      <h2 className="mb-2 text-base font-semibold text-ink ">
        {t("auth.noAccessTitle")}
      </h2>
      <p className="mb-6 max-w-md text-sm leading-relaxed text-ink-secondary ">
        {t("auth.noAccessBody")}
      </p>
      <Link
        href="/"
        className="rounded-lg bg-info px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-info"
      >
        {t("auth.backToDashboard")}
      </Link>
    </div>
  );
}
