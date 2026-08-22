/**
 * @file services/healthSnapshot.ts
 * @description One shared, short-lived copy of the last `/api/health` payload.
 *
 * ── why this exists ───────────────────────────────────────────────────────
 * Two shell components want to know whether the backend is up: `SystemStatus`
 * in the header (the latency badge and the status panel) and the health strip
 * at the foot of `Sidebar`. Both are rendered by `PageWrapper`, which every
 * page renders for itself rather than inheriting from a shared layout — so
 * both unmount and remount on every navigation, and both re-ran their mount
 * fetch each time. Measured on a production build: **14 `/api/health` requests
 * across 6 navigations, and 0 over 20 seconds of sitting still.** The traffic
 * was not the pollers at all; it was the remounts, which also meant the
 * sidebar's 60-second interval never actually reached 60 seconds.
 *
 * `SystemStatus` is deliberately NOT a consumer of this cache. Its request is
 * a *measurement* — it times the round trip to derive the header's "62 ms" and
 * subtracts the server's own probe time — so serving it a stored response
 * would make it report a latency of roughly zero. It is a *publisher*
 * instead: it keeps polling exactly as before and drops each fresh report in
 * here, which keeps this cache warm for free.
 *
 * So the sidebar normally issues no request at all. `fetchHealthSnapshot` is
 * the fallback for a consumer mounted somewhere `SystemStatus` is not, or
 * before its first poll has landed.
 */

/** The subset of `/api/health` these consumers read. Loose on purpose — the
 *  route owns the full shape, and this file should not have to change when a
 *  field is added to it. */
export interface HealthSnapshot {
  status?: string;
  components?: Record<string, { status?: string } | undefined>;
  memory?: {
    frontendMb?: number;
    technicalApiMb?: number;
    userManagementApiMb?: number;
    customerEmployeeApiMb?: number;
    totalMb?: number;
    pct?: number;
  };
}

/**
 * How long a stored payload is served before a consumer refetches.
 *
 * Longer than a navigation and shorter than the sidebar's own 60s cadence, so
 * moving between pages costs nothing while the displayed value stays roughly
 * as fresh as it was before. `SystemStatus` polls at 30s and publishes, so in
 * practice the fallback fetch below almost never runs.
 */
const TTL_MS = 30_000;

let cached: HealthSnapshot | null = null;
let cachedAt = 0;
let inflight: Promise<HealthSnapshot | null> | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  for (const l of Array.from(listeners)) {
    try {
      l();
    } catch {
      // One subscriber throwing must not stop the others being told.
    }
  }
}

/** Subscribe to changes. Shaped for `useSyncExternalStore`. */
export function subscribeToHealth(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The stored payload, or `null` if nothing has been fetched yet. */
export function readHealth(): HealthSnapshot | null {
  return cached;
}

/** Always `null` on the server — there is no health state during SSR. */
export function readHealthOnServer(): HealthSnapshot | null {
  return null;
}

/** True when the stored payload is old enough to be worth replacing. */
export function isHealthStale(): boolean {
  return !cached || Date.now() - cachedAt > TTL_MS;
}

/**
 * Store a payload someone else already fetched, and tell subscribers.
 *
 * Called by `SystemStatus` on every successful poll. That component fetches
 * regardless — this just stops a second component fetching the same thing.
 */
export function publishHealth(data: HealthSnapshot | null | undefined): void {
  if (!data) return;
  cached = data;
  cachedAt = Date.now();
  emit();
}

/**
 * Fetch only if the stored payload is missing or stale, deduping concurrent
 * callers onto one request.
 *
 * Note there is no `AbortSignal` parameter, by design: the request is shared,
 * so letting one consumer's unmount cancel it would cancel it for whoever else
 * is waiting. It is a single small GET and it is allowed to finish.
 */
export function fetchHealthSnapshot(): Promise<HealthSnapshot | null> {
  if (!isHealthStale()) return Promise.resolve(cached);
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      if (!res.ok) return cached;
      const data = (await res.json()) as HealthSnapshot;
      cached = data;
      cachedAt = Date.now();
      emit();
      return data;
    } catch {
      // Leave whatever is stored in place; the caller renders its own
      // unreachable state from a null return on the very first failure.
      return cached;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
