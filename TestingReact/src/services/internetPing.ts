/**
 * @file internetPing.ts
 * @description Measures the browser's own round trip to the public internet, so
 * the status panel's "Your internet" row can report a number rather than only
 * on/off.
 *
 * ## Why probe at all when `navigator.onLine` exists
 *
 * `navigator.onLine` says the machine has a network link. It does not say that
 * link reaches anywhere. A wifi association with a dead uplink — the shop-floor
 * router mid-reboot, a captive portal, an ISP outage — reads as "online" while
 * nothing works. A *timed* request to a host outside this system is the only
 * thing that can tell those apart from inside the browser, and the latency it
 * yields is the number staff actually want when the app "feels slow".
 *
 * ## Why not measure this on the server
 *
 * `/api/health` could ping the internet far more cheaply. It would be the wrong
 * measurement: it reports the *server's* connectivity, and the person reading
 * the panel is asking about their own. On a shop-floor machine those two are
 * routinely different, and that difference is the whole diagnosis.
 *
 * ## A probe that answers nowhere is reported as down
 *
 * When no endpoint answers inside the budget, this reports `down` with `0 ms`
 * — the indicator goes red and says there is no internet. That is a deliberate
 * trade: the endpoints are third parties, so a firewall or ad blocker that
 * refuses *both* of them will read as an outage on a working connection. Two
 * independent providers have to fail together before that happens, and the
 * cure for a site that blocks them is `NEXT_PUBLIC_INTERNET_PING_URL`.
 *
 * The alternative — staying quiet when nothing answers — is worse. Silence
 * during an outage is the one moment the indicator exists for, and a user
 * about to save work needs to be told before they lose it, not after.
 *
 * `unknown` is kept for the one case that genuinely says nothing: the probe was
 * cancelled (superseded by a newer check, or the component unmounted). A
 * cancelled probe is not evidence of anything and never changes the light.
 */

/**
 * Where to ping.
 *
 * Both are tiny, well-distributed endpoints that exist to be probed — the same
 * ones operating systems use for their own connectivity checks — so the
 * measurement is dominated by the network rather than by someone's origin
 * server. Two of them, from different providers, so one being blocked or having
 * a bad day is not mistaken for the connection being bad.
 *
 * Set `NEXT_PUBLIC_INTERNET_PING_URL` to probe somewhere else instead — a
 * deployment that must not talk to third parties can point this at its own
 * public host.
 */
const DEFAULT_ENDPOINTS = [
  "https://www.gstatic.com/generate_204",
  "https://cloudflare.com/cdn-cgi/trace",
];

const ENDPOINTS: string[] = (() => {
  const override = process.env.NEXT_PUBLIC_INTERNET_PING_URL?.trim();
  return override ? [override] : DEFAULT_ENDPOINTS;
})();

/**
 * Give up on a single endpoint after this long.
 *
 * Far above a healthy round trip (tens of milliseconds warm), and past the
 * point where the connection is usable anyway.
 */
const TIMEOUT_MS = 2_500;

/**
 * Ceiling for the whole probe, across every endpoint it tries.
 *
 * This has to finish inside the panel's live cadence, and that is a hard
 * correctness requirement, not tidiness. Each new check aborts the one before
 * it; if a full round of failures took longer than one interval, the probe
 * would be cancelled mid-flight every single time and could never reach a
 * verdict — so a real outage would leave the indicator green forever, which is
 * precisely the case it exists to catch. Per-endpoint timeouts alone don't
 * guarantee this (they multiply by the endpoint count), so the budget is
 * enforced across all of them.
 */
const BUDGET_MS = 5_000;

/**
 * Where "slow" starts, in milliseconds.
 *
 * Well above a normal round trip to a CDN edge (tens of milliseconds on the
 * office link, a couple of hundred on a phone hotspot) and at the point where
 * every request the app makes starts to feel like waiting.
 */
const SLOW_MS = 400;

export type PingQuality = "up" | "slow" | "down" | "unknown";

export interface InternetPing {
  /**
   * Round trip in ms. Zero when nothing answered — shown to the user as
   * "0 ms" beside a red row, which reads as "no connection" far more directly
   * than a blank space does. Null only when the probe was cancelled and there
   * is nothing to report either way.
   */
  latencyMs: number | null;
  /** `unknown` means the probe was cancelled — not that the link is bad. */
  quality: PingQuality;
}

/** Nothing measured, nothing claimed: the probe was cancelled. */
const CANCELLED: InternetPing = { latencyMs: null, quality: "unknown" };

/** Nothing on the public internet answered inside the budget. */
const UNREACHABLE: InternetPing = { latencyMs: 0, quality: "down" };

/**
 * The endpoint that answered last time, tried first next time.
 *
 * Two things come from this. A blocked endpoint is skipped after its first
 * failure instead of costing a 4s timeout on every cycle. And repeatedly
 * hitting one host keeps its connection warm, so what gets measured is the
 * round trip rather than a fresh DNS lookup and TLS handshake — which would
 * make a healthy link look several hundred milliseconds worse.
 */
let preferredEndpoint: string | null = null;

/**
 * Whether a connection to the preferred endpoint has already been opened.
 *
 * The first request of a page session pays for a DNS lookup and a TLS
 * handshake — measured from this network, 440-800 ms to hosts that answer in
 * tens of milliseconds once warm. Reported as-is, every page load would open
 * with a spurious amber "internet slow", and an indicator that is wrong on
 * arrival is one nobody reads by lunchtime. See `pingInternet` for the
 * remedy.
 */
let connectionWarm = false;

function rate(latencyMs: number): PingQuality {
  return latencyMs >= SLOW_MS ? "slow" : "up";
}

/**
 * One timed round trip. Resolves to null when the endpoint did not answer.
 *
 * The response is opaque (`mode: "no-cors"`) — these hosts send no CORS headers
 * and none is needed. Nothing is read from the body; that the response arrived
 * at all is the signal, and when it arrived is the measurement.
 */
async function measure(
  endpoint: string,
  budget: AbortSignal,
  signal?: AbortSignal
): Promise<number | null> {
  // Cache-busted per call: a probe answered from the HTTP cache would report a
  // sub-millisecond "connection" while the link is severed.
  const url = `${endpoint}${endpoint.includes("?") ? "&" : "?"}_=${Date.now()}`;

  const deadlines = [budget, AbortSignal.timeout(TIMEOUT_MS)];
  if (signal) deadlines.push(signal);

  const startedAt = performance.now();
  try {
    await fetch(url, {
      mode: "no-cors",
      cache: "no-store",
      signal: AbortSignal.any(deadlines),
    });
    return Math.round(performance.now() - startedAt);
  } catch {
    return null;
  }
}

/** Times a round trip to the first endpoint that answers. */
export async function pingInternet(signal?: AbortSignal): Promise<InternetPing> {
  // The browser already knows the link is gone; the panel reports that from
  // `navigator.onLine` directly, and spending the budget to confirm it would
  // only delay the next real measurement.
  if (typeof navigator !== "undefined" && !navigator.onLine) return CANCELLED;

  const budget = AbortSignal.timeout(BUDGET_MS);

  const ordered = preferredEndpoint
    ? [preferredEndpoint, ...ENDPOINTS.filter((url) => url !== preferredEndpoint)]
    : ENDPOINTS;

  for (const endpoint of ordered) {
    if (signal?.aborted) return CANCELLED;
    if (budget.aborted) break;

    let latencyMs = await measure(endpoint, budget, signal);

    if (latencyMs === null) {
      // Cancellation is the caller's doing and says nothing about the network.
      // Everything else — timeout, refused, DNS failure — is evidence, so keep
      // going and let the loop reach its verdict.
      if (signal?.aborted) return CANCELLED;

      // Stop preferring an endpoint that just failed, so the next cycle starts
      // with the other one rather than paying its timeout again.
      if (preferredEndpoint === endpoint) preferredEndpoint = null;
      continue;
    }

    preferredEndpoint = endpoint;

    // Setup cost, not connection quality: measure once more now that the
    // socket is open and report that instead. Only ever on the first probe of
    // a page session, and only when the reading was bad enough to be worth
    // disputing — a genuinely slow link simply measures slow twice.
    if (!connectionWarm) {
      connectionWarm = true;
      if (latencyMs >= SLOW_MS && !signal?.aborted && !budget.aborted) {
        latencyMs = (await measure(endpoint, budget, signal)) ?? latencyMs;
      }
    }

    return { latencyMs, quality: rate(latencyMs) };
  }

  // Every endpoint failed, or the budget ran out with none of them answering.
  // Two independent providers unreachable is the strongest statement this
  // probe can make: report it rather than shrug.
  return UNREACHABLE;
}

// Warm up the internet connection eagerly in browser background
if (typeof window !== "undefined") {
  setTimeout(() => {
    void pingInternet();
  }, 800);
}
