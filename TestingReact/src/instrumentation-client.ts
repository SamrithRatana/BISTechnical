/**
 * @file instrumentation-client.ts
 * @description Sentry in the browser — the errors staff actually hit while
 * working the queues (failed saves, blank dialogs, crashed tables).
 *
 * Next.js loads this file automatically on the client; it must live at
 * `src/instrumentation-client.ts` for the App Router to pick it up.
 */

import * as Sentry from "@sentry/nextjs";
import {
  SENTRY_DSN,
  SENTRY_ENABLED,
  TRACES_SAMPLE_RATE,
  IGNORE_ERRORS,
  scrubEvent,
} from "./sentry.shared";

if (SENTRY_ENABLED) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,

    tracesSampleRate: TRACES_SAMPLE_RATE,
    ignoreErrors: IGNORE_ERRORS,

    // Session Replay records what the user did before the error. Sampling only
    // sessions that actually errored keeps it useful without recording every
    // ordinary shift.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,

    // Replay is attached below rather than here — see the note on startup cost.
    integrations: [],

    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,

    // Off by default; flip on locally when Sentry itself seems to be misbehaving.
    debug: false,
  });

  attachReplayWhenIdle();
}

/**
 * Adds Session Replay once the browser is idle, instead of during startup.
 *
 * Next.js measures how long this instrumentation hook blocks and warns when it
 * runs long ("Slow execution detected"). Replay is the expensive part: it walks
 * and instruments the DOM to start recording, and that ran before the app had
 * even painted — delaying the very interaction it exists to record.
 *
 * The trade-off: an error thrown in the first moment after load won't have a
 * replay attached. That is a fair price, because those are also the errors a
 * stack trace explains on its own, and everything after page load — the saves,
 * the dialogs, the status changes staff actually hit bugs in — is still covered.
 */
function attachReplayWhenIdle(): void {
  if (typeof window === "undefined") return;

  const attach = () => {
    try {
      Sentry.addIntegration(
        Sentry.replayIntegration({
          // Repair tickets carry customer names, phone numbers and addresses.
          // Masking is the SDK default; it is set explicitly here so that a
          // future "let's see the actual screen" tweak has to be a deliberate,
          // reviewable change.
          maskAllText: true,
          blockAllMedia: true,
        })
      );
    } catch {
      // Monitoring must never be the reason the app fails to start.
    }
  };

  // Checked via a separate boolean rather than `"requestIdleCallback" in window`:
  // the DOM types declare that property as always present, so an `in` check
  // narrows the else branch to `never` and the fallback stops compiling.
  const supportsIdleCallback =
    typeof (window as { requestIdleCallback?: unknown }).requestIdleCallback === "function";

  // `timeout` guarantees it still attaches on a page that never goes idle.
  if (supportsIdleCallback) {
    window.requestIdleCallback(attach, { timeout: 3_000 });
  } else {
    window.setTimeout(attach, 1_000); // Safari < 16.4
  }
}

/**
 * Reports client-side navigation timing. Next.js calls this on every route
 * change; without it, App Router navigations produce no transaction.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
