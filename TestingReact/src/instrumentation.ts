/**
 * @file instrumentation.ts
 * @description Server-side Sentry bootstrap for the Next.js layer.
 *
 * `register()` runs once per server process before any request is handled.
 * The runtime check matters: the Node and Edge SDKs are different builds, and
 * importing the wrong one fails at module load.
 *
 * `onRequestError` is what actually reports failures inside route handlers —
 * including the `/api/proxy/*` routes every backend call travels through — so
 * a broken proxy hop shows up in Sentry instead of only in server logs.
 */

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
