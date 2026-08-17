"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw, Home } from "lucide-react";
import Link from "next/link";

/**
 * @file app/error.tsx
 * @description Route-level error boundary — catches a render or effect error
 * in any page and keeps the rest of the app alive.
 *
 * ── Why this exists separately from `global-error.tsx` ─────────────────────
 *
 * The project had only `global-error.tsx`, which sits ABOVE the root layout.
 * It is the last resort: React unmounts the entire tree, including
 * `<html>`/`<body>`, so it has to render its own document and cannot rely on
 * the stylesheet — which is why that file is the one place allowed to hardcode
 * colours. The consequence is that any error thrown inside any page — a
 * malformed API response read one field too deep, a broken image handler, a
 * bad date — took the whole application down to a bare fallback screen, losing
 * the sidebar, the header and the user's place in the app.
 *
 * `error.tsx` sits INSIDE the root layout, so React replaces only the page
 * content. Providers above it stay mounted: the theme, the language, the
 * session, the action bus and the assistant all survive, and the user can pick
 * another page from the sidebar instead of reloading.
 *
 * ── Deliberately not internationalised ─────────────────────────────────────
 *
 * Every other user-visible string in this app goes through `t()`, and this one
 * does not. `useI18n()` throws outside `LanguageProvider`, and one plausible
 * cause of landing here is a fault in a provider itself — a boundary whose own
 * render can throw is not a boundary. The text is kept to a minimum for the
 * same reason.
 *
 * The `digest` is shown because it is the only handle on the real message:
 * Next strips server error text in production to avoid leaking internals, and
 * that hash is what correlates this screen with the server log or the Sentry
 * event.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Kept as console.error rather than a logging call: Sentry's Next.js SDK
    // already instruments this boundary, so reporting here would double-count.
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] grid place-items-center p-6">
      <div className="flex flex-col items-center text-center gap-3 max-w-md">
        <span
          aria-hidden
          className="grid place-items-center w-14 h-14 rounded-2xl bg-danger-soft text-danger"
        >
          <AlertTriangle className="w-7 h-7" />
        </span>

        <h1 className="text-base font-semibold text-ink">
          This page ran into a problem
        </h1>

        <p className="text-xs text-ink-secondary leading-relaxed">
          The rest of the app is still working — you can retry this page or pick
          another from the menu.
        </p>

        {error.digest && (
          <code className="px-2 py-1 rounded bg-sunken border border-subtle text-[11px] font-mono text-ink-secondary">
            {error.digest}
          </code>
        )}

        <div className="flex items-center gap-2 mt-1">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-accent hover:bg-accent-hover transition-colors shadow-soft-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Try again
          </button>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-ink bg-surface border border-prominent hover:bg-cushion transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
          >
            <Home className="w-3.5 h-3.5" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
