/**
 * @file backendSignal.ts
 * @description Turns a real failed request into an immediate health re-check,
 * so the status light stops waiting for its next poll to notice.
 *
 * ## Why interception rather than call-site reporting
 *
 * The health indicator polls every 30 seconds. That leaves a window where the
 * backend is down and the light is still green — and a user saves into it,
 * because the app just told them everything was fine. The failure they hit *is*
 * the freshest possible signal; it only needed connecting to the indicator.
 *
 * Reporting from each call site would mean editing 26 `fetch` calls in the
 * service layer plus six components that call `fetch` directly — and the
 * direct ones are the saves, the single most important case to catch. One
 * missed edit is a silent hole. Wrapping `fetch` once covers every call, and
 * any added later, with no per-call discipline required.
 *
 * ## What it does and does not do
 *
 * The wrapper **only observes**. It always delegates to the original `fetch`,
 * returns its result untouched, and re-throws its errors unchanged — so no
 * request behaves differently for having been watched. It never throws on its
 * own: a fault in monitoring must not break the app it monitors.
 */

/** Notified when a backend call looks like the backend is unhealthy. */
type Listener = () => void;

const listeners = new Set<Listener>();

let installed = false;
let lastNotifyAt = 0;

/**
 * Minimum gap between notifications.
 *
 * A page load fires several requests at once, so a backend outage produces a
 * burst of failures. Without this, one outage would trigger a dozen health
 * checks against a backend that is already struggling — the opposite of
 * helpful.
 */
const THROTTLE_MS = 3_000;

/**
 * Paths excluded from monitoring.
 *
 * The health endpoints must never trigger a health check: a failing check
 * would schedule another, which fails, which schedules another. Self-sustaining
 * request loops are exactly the kind of bug a monitoring feature should not
 * introduce.
 */
const IGNORED_PATHS = ["/api/health", "/api/system-activity"];

/**
 * Status codes that indicate the *backend* is unwell, rather than the request
 * being wrong.
 *
 * 4xx is deliberately excluded — a 404 for a deleted ticket or a 401 on an
 * expired token says nothing about system health, and treating them as outages
 * would turn the light red during perfectly normal use. The proxy answers 500
 * when it cannot reach the API and 504 when the API times out, so those two
 * carry most of the signal.
 */
function indicatesBackendFailure(status: number): boolean {
  return status === 500 || status === 502 || status === 503 || status === 504;
}

/** Whether this URL is one of our own backend calls, and worth watching. */
function isMonitoredUrl(url: string): boolean {
  try {
    // Resolves relative URLs ("/api/proxy/...") against the current origin.
    const { origin, pathname } = new URL(url, window.location.origin);
    if (origin !== window.location.origin) return false; // third party, not ours
    if (!pathname.startsWith("/api/")) return false;
    return !IGNORED_PATHS.some((p) => pathname.startsWith(p));
  } catch {
    return false;
  }
}

/** Tells subscribers the backend looks unhealthy, at most once per throttle window. */
function notifyFailure(): void {
  const now = Date.now();
  if (now - lastNotifyAt < THROTTLE_MS) return;
  lastNotifyAt = now;

  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      // One bad subscriber must not stop the others.
    }
  }
}

/** Extracts a URL string from any of `fetch`'s accepted input shapes. */
function urlFromInput(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

/**
 * Wraps `window.fetch` so failed backend calls raise the signal. Safe to call
 * repeatedly — it patches once.
 */
export function installBackendMonitor(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // Decide up front, so a throw still knows whether it was one of ours.
    let monitored = false;
    try {
      monitored = isMonitoredUrl(urlFromInput(input));
    } catch {
      monitored = false;
    }

    try {
      const response = await originalFetch(input, init);
      if (monitored && indicatesBackendFailure(response.status)) notifyFailure();
      return response;
    } catch (error) {
      // A rejected fetch is a network-level failure: DNS, refused connection,
      // or a timeout. An abort is not — the caller cancelled deliberately, and
      // the proxy aborts reads whenever a user navigates away mid-request.
      const aborted = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
      if (monitored && !aborted) notifyFailure();
      throw error; // unchanged — the caller's error handling is untouched
    }
  };
}

/** Subscribes to backend-failure signals. Returns an unsubscribe function. */
export function subscribeToBackendFailure(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
