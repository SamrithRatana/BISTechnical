/**
 * @file sentry.server.config.ts
 * @description Sentry for the Next.js Node runtime — route handlers, the
 * `/api/proxy/*` hops, the SSE stream and the AI search route.
 *
 * Loaded from `src/instrumentation.ts` when NEXT_RUNTIME is "nodejs".
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

    // Request bodies can carry a whole inspection record — customer request
    // text, contact details, spare-part notes. Stack traces and the request
    // path are enough to debug a proxy failure.
    sendDefaultPii: false,

    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,

    debug: false,
  });
}
