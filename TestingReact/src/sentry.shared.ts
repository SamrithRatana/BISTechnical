/**
 * @file sentry.shared.ts
 * @description Settings every Sentry runtime in this app shares (browser,
 * Node server, edge), so the three init sites can't drift apart.
 *
 * Sentry is **opt-in**: with no DSN configured, `init()` is never called and
 * the SDK stays inert. That keeps a fresh clone — and anyone running the app
 * without the Sentry project set up — working exactly as before rather than
 * failing on a missing environment variable.
 */

/**
 * The parts of a Sentry event this module touches.
 *
 * Structural rather than importing Sentry's own `ErrorEvent`/`TransactionEvent`:
 * only the former is exported from the public entry point, and one shared
 * shape lets the same function serve `beforeSend` and `beforeSendTransaction`.
 */
interface ScrubbableEvent {
  request?: { url?: string; headers?: { [key: string]: string } };
  breadcrumbs?: Array<{ data?: { [key: string]: unknown } }>;
}

/**
 * Where events are sent. Public by design (it only allows *writing* events),
 * which is why it is a NEXT_PUBLIC_ variable: the browser bundle needs it.
 *
 * Find it in Sentry under Settings → Projects → <project> → Client Keys (DSN).
 */
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";

/** Whether Sentry should start at all in this process. */
export const SENTRY_ENABLED = SENTRY_DSN.length > 0;

/**
 * Fraction of requests traced for performance data.
 *
 * Full sampling in development makes every action show up while you are
 * looking for it; in production 10% is enough to see latency trends on the
 * ticket queues without paying for a span on every keystroke-debounced search.
 */
export const TRACES_SAMPLE_RATE =
  process.env.NODE_ENV === "production" ? 0.1 : 1.0;

/**
 * Noise filter, applied before anything leaves the process.
 *
 * These are conditions the app already handles and reports to the user; left
 * unfiltered they bury real regressions under thousands of duplicates.
 */
export const IGNORE_ERRORS = [
  // The proxy aborts in-flight reads when the user navigates away mid-fetch.
  // Expected, and already handled with a 499 response.
  "AbortError",
  "The operation was aborted",
  "The user aborted a request",
  // Browser/extension noise that says nothing about this app.
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications",
  "Non-Error promise rejection captured",
];

/**
 * Strips credentials and free-text search terms from events.
 *
 * Ticket search boxes carry customer names, phone numbers and serial numbers,
 * and those ride along in the `?searchTerm=` of every breadcrumb URL. None of
 * that is needed to debug a stack trace, and shipping it to a third party is a
 * data-protection decision nobody made deliberately — so it is removed here.
 */
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  const request = event.request;

  if (request?.headers) {
    delete request.headers["authorization"];
    delete request.headers["Authorization"];
    delete request.headers["cookie"];
    delete request.headers["Cookie"];
  }

  if (request?.url) {
    request.url = redactQuery(request.url);
  }

  for (const crumb of event.breadcrumbs ?? []) {
    if (typeof crumb.data?.url === "string") {
      crumb.data.url = redactQuery(crumb.data.url);
    }
  }

  return event;
}

/** Replaces the value of free-text/identifying query params with "[redacted]". */
const REDACTED_PARAMS = ["searchTerm", "q", "serialNumber", "token"];

function redactQuery(url: string): string {
  try {
    // Relative URLs (the proxy paths) need a base to parse against; it is
    // discarded again below when the URL turns out to have been relative.
    const isAbsolute = /^https?:\/\//i.test(url);
    const parsed = new URL(url, isAbsolute ? undefined : "http://local");
    let touched = false;
    for (const param of REDACTED_PARAMS) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, "[redacted]");
        touched = true;
      }
    }
    if (!touched) return url;
    return isAbsolute ? parsed.toString() : parsed.pathname + parsed.search;
  } catch {
    return url; // not a parseable URL — leave it alone
  }
}
