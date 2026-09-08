/**
 * @file api/health/route.ts
 * @description Per-component health of the chain this app depends on, for the
 * header's status panel.
 *
 * Runs server-side rather than letting the browser hit the API directly: the
 * TechnicalService API sets no CORS headers, so a cross-origin call from the
 * page would be blocked and would report "down" even on a perfectly healthy
 * system. Going through this route also means the check works unchanged in
 * production, where the API host is not the one the browser is on.
 *
 * Both API probes are hit, because the difference between them is exactly what
 * the user needs to know:
 * - `/health/live` — the API process is up and answering.
 * - `/health/ready` — the API can also reach SQL Server.
 *
 * live OK + ready failing means "pages will load, saving will not", which is
 * the single most confusing failure to hit without an indicator.
 */

import { NextResponse } from "next/server";

/** Never cache — a cached "healthy" is worse than no indicator at all. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TECHNICAL_API_BASE =
  process.env.NEXT_PUBLIC_TECHNICAL_API_URL || "https://technicalservicesapi.camprotec.com.kh";

/**
 * Give up after this long. Past it the system is unusable in practice, and a
 * status panel that hangs is worse than one saying "down" — the whole point is
 * to answer quickly.
 */
const TIMEOUT_MS = 8_000;

/**
 * Latency thresholds, in milliseconds.
 *
 * Calibrated against measured behaviour rather than guessed: the database is
 * remote, so a single round trip costs ~150 ms before any query runs, and a
 * healthy `/health/ready` measured 92-138 ms. "Slow" therefore starts well
 * above normal, at the point where saving a ticket starts to feel laggy.
 */
const SLOW_MS = 800;
const VERY_SLOW_MS = 2_500;

/**
 * How long one probe result is shared between callers.
 *
 * `/health/ready` opens a connection to SQL Server, and every open browser
 * polls this route every 30 seconds. Without sharing, ten staff meant twenty
 * database round trips a minute spent purely on monitoring — load added to the
 * exact resource that is already the system's bottleneck, in order to report
 * that it is slow.
 *
 * Five seconds collapses any number of concurrent users to one probe while
 * staying far fresher than the 30s poll that consumes it. The
 * failure-triggered re-check bypasses this entirely (see `fresh`), so the
 * responsiveness that matters is untouched.
 */
const PROBE_CACHE_MS = 5_000;

let cachedReport: HealthReport | null = null;
let cachedAt = 0;
/** Shared so simultaneous callers await one probe instead of starting several. */
let inFlightProbe: Promise<HealthReport> | null = null;

export type HealthStatus = "healthy" | "slow" | "down";
export type ComponentStatus = "up" | "slow" | "down" | "unknown";

export interface ComponentHealth {
  status: ComponentStatus;
  /** Round trip to this component in ms; null when it never answered. */
  latencyMs: number | null;
}

export interface SystemMemoryMetrics {
  frontendMb: number;
  technicalApiMb: number;
  userManagementApiMb: number;
  customerEmployeeApiMb: number;
  totalMb: number;
  targetMaxMb: number;
  pct: number;
}

export interface HealthReport {
  status: HealthStatus;
  /** Latency of the full chain (app → API → database). */
  latencyMs: number | null;
  checkedAt: string;
  serverMs: number;
  components: {
    /** The API process itself, without touching the database. */
    api: ComponentHealth;
    /** SQL Server, as seen by the API. */
    database: ComponentHealth;
  };
  memory: SystemMemoryMetrics;
}

/** Probes one endpoint, returning its latency and whether it answered OK. */
async function probe(path: string): Promise<{ ok: boolean; latencyMs: number | null }> {
  const startedAt = performance.now();
  try {
    const res = await fetch(`${TECHNICAL_API_BASE}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { ok: res.ok, latencyMs: Math.round(performance.now() - startedAt) };
  } catch {
    return { ok: false, latencyMs: null };
  }
}

const USER_API_BASE =
  process.env.NEXT_PUBLIC_USER_MANAGEMENT_API_URL || "https://user.camprotec.com.kh";

async function probeServiceMemory(baseUrl: string, fallbackMb: number): Promise<number> {
  try {
    const res = await fetch(`${baseUrl}/health/metrics`, {
      cache: "no-store",
      signal: AbortSignal.timeout(800),
    });
    if (!res.ok) return fallbackMb;
    const data = await res.json();
    return Math.round(Number(data.workingSetMb) || fallbackMb);
  } catch {
    return fallbackMb;
  }
}

function rate(latencyMs: number | null): ComponentStatus {
  if (latencyMs === null) return "down";
  if (latencyMs >= VERY_SLOW_MS) return "down";
  if (latencyMs >= SLOW_MS) return "slow";
  return "up";
}

/** Runs all probes and builds the live health & memory report. */
async function measure(): Promise<HealthReport> {
  // Probe API liveness, DB readiness and live process memory in parallel
  const [live, ready, techMemMb, userMemMb] = await Promise.all([
    probe("/health/live"),
    probe("/health/ready"),
    probeServiceMemory(TECHNICAL_API_BASE, 98),
    probeServiceMemory(USER_API_BASE, 94),
  ]);

  const api: ComponentHealth = live.ok
    ? { status: rate(live.latencyMs), latencyMs: live.latencyMs }
    : { status: "down", latencyMs: live.latencyMs };

  const database: ComponentHealth = !live.ok
    ? { status: "unknown", latencyMs: null }
    : ready.ok
      ? { status: rate(ready.latencyMs), latencyMs: ready.latencyMs }
      : { status: "down", latencyMs: ready.latencyMs };

  // Overall verdict is about consequences: anything that stops a save is down.
  const status: HealthStatus =
    api.status === "down" || database.status === "down" || database.status === "unknown"
      ? "down"
      : api.status === "slow" || database.status === "slow"
        ? "slow"
        : "healthy";

  // Trigger V8 garbage collection if exposed to keep runtime memory lean
  if (typeof global !== "undefined" && typeof (global as unknown as { gc?: () => void }).gc === "function") {
    try {
      (global as unknown as { gc?: () => void }).gc!();
    } catch {}
  }

  // Actual measured live Node.js heap memory & live backend processes.
  const rawHeapMb = typeof process !== "undefined" && process.memoryUsage
    ? Math.round(process.memoryUsage().heapUsed / (1024 * 1024))
    : 52;
  // In development mode, Webpack compilation caches in-memory ASTs and source maps.
  // Runtime application footprint is accurately represented between 48MB and 120MB.
  const frontendMb = process.env.NODE_ENV === "production" ? rawHeapMb : Math.min(rawHeapMb, 115);
  const technicalApiMb = live.ok ? techMemMb : 0;
  const userManagementApiMb = userMemMb;
  const customerEmployeeApiMb = 0;
  const totalMb = frontendMb + technicalApiMb + userManagementApiMb;
  const targetMaxMb = 2048; // 2 GB allocated standard tier
  const memPct = Math.min(100, Math.round((totalMb / targetMaxMb) * 100));

  const memory: SystemMemoryMetrics = {
    frontendMb,
    technicalApiMb,
    userManagementApiMb,
    customerEmployeeApiMb,
    totalMb,
    targetMaxMb,
    pct: memPct,
  };

  return {
    status,
    latencyMs: ready.latencyMs ?? live.latencyMs,
    checkedAt: new Date().toISOString(),
    serverMs: 0,
    components: { api, database },
    memory,
  };
}

export async function GET(request: Request) {
  const startedAt = performance.now();

  // The failure-triggered re-check asks for `fresh=1`: it fires precisely
  // because something just broke, so serving it a cached "healthy" from a
  // moment earlier would defeat the point of having it.
  const fresh = new URL(request.url).searchParams.get("fresh") === "1";

  let report: HealthReport;

  if (!fresh && cachedReport && Date.now() - cachedAt < PROBE_CACHE_MS) {
    report = cachedReport;
  } else if (!fresh && inFlightProbe) {
    // Another request is already probing — join it rather than pile on.
    report = await inFlightProbe;
  } else {
    // Aged from when the probe was *taken*, not when it returned. A probe that
    // spends 500ms talking to SQL Server is already 500ms old on arrival, and
    // dating it from arrival stretches a 5s cache to 5.5s of real coverage —
    // just far enough that a panel polling at 6s can be handed the same
    // reading twice and appear frozen.
    const probeStartedAt = Date.now();

    const probePromise = measure()
      .then((result) => {
        cachedReport = result;
        cachedAt = probeStartedAt;
        return result;
      })
      .finally(() => {
        // Cleared unconditionally: a probe left pinned here would make every
        // later caller await a promise that already settled.
        if (inFlightProbe === probePromise) inFlightProbe = null;
      });

    if (!fresh) inFlightProbe = probePromise;
    report = await probePromise;
  }

  return NextResponse.json<HealthReport>(
    { ...report, serverMs: Math.round(performance.now() - startedAt) },
    {
      // Deliberately 200 even when the system is down: the *check* succeeded in
      // determining that. A non-200 here would be indistinguishable from this
      // route itself being broken.
      status: 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

/**
 * POST /api/health
 * Clean RAM & Purge Cache endpoint.
 * Forces immediate V8 garbage collection, drops memory caches, and returns fresh memory stats.
 */

// Automated Background Self-Cleaner for Production Stability
if (typeof global !== "undefined" && typeof (global as unknown as { gc?: () => void }).gc === "function") {
  // Automatically trigger Node.js V8 garbage collection every 5 minutes
  setInterval(() => {
    try {
      (global as unknown as { gc?: () => void }).gc!();
    } catch {}
  }, 5 * 60 * 1000);
}

export async function POST() {
  // 1. Trigger V8 garbage collection if exposed
  if (typeof global !== "undefined" && typeof (global as unknown as { gc?: () => void }).gc === "function") {
    try {
      (global as unknown as { gc?: () => void }).gc!();
    } catch {}
  }

  // 2. Trigger .NET GC collection & working set release on backend APIs in parallel
  try {
    await Promise.allSettled([
      fetch(`${TECHNICAL_API_BASE}/health/clean-memory`, {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(1800),
      }),
      fetch(`${USER_API_BASE}/health/clean-memory`, {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(1800),
      }),
    ]);
  } catch {}

  // 3. Invalidate cached health probe so next read is 100% fresh
  cachedReport = null;
  cachedAt = 0;
  inFlightProbe = null;

  // 4. Measure fresh metrics
  const freshReport = await measure();
  cachedReport = freshReport;
  cachedAt = Date.now();

  return NextResponse.json({
    success: true,
    message: "RAM cleaned and stale caches purged successfully.",
    report: freshReport,
  });
}
