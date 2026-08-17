import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /**
   * The on-screen dev badge, turned off.
   *
   * It sat showing activity indefinitely after every menu navigation, which
   * read as "the page is stuck" when nothing was: the ticket queues hold an SSE
   * stream open on `/api/events` for live updates, and a stream that never
   * ends is a request the dev server never stops counting as in flight (the dev
   * log records them as `GET /api/events 200 in 75s`). The indicator was
   * telling the truth and the truth was useless — an alarm that is always on
   * teaches you to ignore it.
   *
   * Dev-only either way: this badge does not exist in a production build, so
   * nothing users see changes. Compile and runtime errors are still surfaced
   * with it off — see next/dist/docs/01-app/03-api-reference/05-config/
   * 01-next-config-js/devIndicators.md. Set to `{ position: "bottom-right" }`
   * instead of `false` to keep it while moving it out of the way.
   */
  devIndicators: false,

  allowedDevOrigins: [
    "192.168.0.222",
    "192.168.0.222:3000",
    "localhost:3000",
    "127.0.0.1:3000",
    "192.168.*",
  ],
};

/**
 * Sentry's build-time wrapper.
 *
 * It is applied unconditionally, but every part of it that needs credentials
 * is a no-op without them: source maps are only uploaded when SENTRY_AUTH_TOKEN
 * is set, so `npm run build` on a machine that has never seen the Sentry
 * project still succeeds. Runtime reporting is separately gated on
 * NEXT_PUBLIC_SENTRY_DSN — see src/sentry.shared.ts.
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? "cam-gg",
  project: process.env.SENTRY_PROJECT ?? "bis-technical",
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Keep the build output readable; the upload still logs failures.
  silent: !process.env.CI,

  // Uploads the source maps that turn a minified production stack trace into
  // real file/line numbers, then deletes them from the deployed bundle so they
  // are not served to browsers.
  sourcemaps: { deleteSourcemapsAfterUpload: true },

  // Routes Sentry's own requests through this origin, so ad blockers (which
  // block requests to *.sentry.io outright) don't silently discard the error
  // reports from the browsers that need reporting most.
  tunnelRoute: "/monitoring",

  // `disableLogger` and `automaticVercelMonitors` are deliberately not set:
  // both are deprecated in favour of `webpack.*` equivalents, and this app
  // builds with Turbopack, where neither has any effect. Passing them only
  // printed a deprecation warning on every dev start.
});
