"use client";

/**
 * @file global-error.tsx
 * @description Last-resort boundary for errors thrown in the root layout —
 * the one case React can't recover from with a normal `error.tsx`, because the
 * layout itself (and therefore <html>/<body>) failed to render.
 *
 * Two jobs: record the crash, and show the user something other than a blank
 * white page.
 *
 * The crash goes to `console.error` because there is no error-reporting service
 * in this project — Sentry was removed deliberately, not lost. Its SDK was
 * 611 KB of the 928 KB every route shipped, for a product nobody was reading.
 * If a reporting service is ever adopted, this effect and the one in
 * `components/TemplateReportView.tsx` are the two places that report.
 */

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root layout crashed:", error);
  }, [error]);

  return (
    // This component replaces the root layout, so it has to render its own
    // <html>/<body>. Text is deliberately untranslated: the i18n provider
    // lives in the layout that just failed.
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#F3F5F4",
          color: "#111827",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: "32rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#6B7280", marginBottom: "1.5rem", lineHeight: 1.6 }}>
            The page failed to load. Try again, and if it keeps happening, tell
            IT the reference below.
          </p>
          {error.digest && (
            <p
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.8125rem",
                color: "#9CA3AF",
                marginBottom: "1.5rem",
              }}
            >
              Reference: {error.digest}
            </p>
          )}
          <button
            onClick={() => reset()}
            style={{
              padding: "0.625rem 1.25rem",
              fontSize: "0.9375rem",
              fontWeight: 500,
              color: "#ffffff",
              background: "#0F6E4E",
              border: "none",
              borderRadius: "0.5rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
