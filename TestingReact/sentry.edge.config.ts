/**
 * @file sentry.edge.config.ts
 * @description Sentry for the Edge runtime (middleware and any route that
 * opts into it). Nothing in this app runs on the edge today — the proxy and AI
 * routes both pin `runtime = "nodejs"` — but Next.js initialises the edge
 * runtime regardless, and without this file an edge-side error would vanish.
 *
 * Loaded from `src/instrumentation.ts` when NEXT_RUNTIME is "edge".
 */

import * as Sentry from "@sentry/nextjs";
import {
  SENTRY_DSN,
  SENTRY_ENABLED,
  TRACES_SAMPLE_RATE,
  IGNORE_ERRORS,
  scrubEvent,
} from "./src/sentry.shared";

if (SENTRY_ENABLED) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: TRACES_SAMPLE_RATE,
    ignoreErrors: IGNORE_ERRORS,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,
    debug: false,
  });
}
