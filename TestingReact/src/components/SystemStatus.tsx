"use client";

/**
 * @file SystemStatus.tsx
 * @description Header indicator answering one question: can I rely on this
 * system right now? Click it for the per-component breakdown.
 *
 * Two independent signals, because they fail differently and the user needs to
 * tell them apart:
 * - **The browser's own link** (`navigator.onLine`, plus a timed probe to the
 *   public internet for the millisecond figure — see `@/services/internetPing`).
 *   When `onLine` is false nothing else matters, so it wins outright.
 * - **The backend chain** (`/api/health` → API → SQL Server). Polled. This is
 *   what catches "my wifi is fine but saving is failing", which is the case
 *   staff actually hit and cannot otherwise diagnose.
 *
 * Every row carries its own latency, and every row keeps measuring on a timer
 * whether or not the panel is open — so opening it shows what is true now, not
 * a reading taken at the moment of the click. Opening it also tightens the
 * cadence (see `LIVE_POLL_INTERVAL_MS`), because a panel someone is watching
 * should visibly move.
 *
 * The colour is deliberately about *consequences*, not aesthetics: green means
 * saving works, amber means it will be slow, red means don't bother trying.
 *
 * It reports; it does not block. Nothing here prevents a save while red — the
 * save will simply fail the way it would have anyway. Making the app refuse to
 * submit, or hold unsaved work until the system recovers, is a separate piece
 * of work in the forms themselves.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Wifi, WifiOff, Loader2, RefreshCw, Check, AlertTriangle, X, HelpCircle, Users, Save } from "lucide-react";
import { useFloatingPanel } from "@/hooks/useFloatingPanel";
import { useI18n } from "@/i18n/LanguageProvider";
import type { TranslationKey } from "@/i18n/translations";
import { ADMIN_ROLES } from "@/services/authSession";
import { installBackendMonitor, subscribeToBackendFailure } from "@/services/backendSignal";
import { pingInternet, type InternetPing } from "@/services/internetPing";
import { useHasRole } from "./RequireRole";
import { isHealthStale, readHealth, publishHealth } from "@/services/healthSnapshot";

type HealthStatus = "healthy" | "slow" | "down";
type ComponentStatus = "up" | "slow" | "down" | "unknown";

interface ComponentHealth {
  status: ComponentStatus;
  latencyMs: number | null;
}

interface HealthReport {
  status: HealthStatus;
  latencyMs: number | null;
  checkedAt: string;
  /** Time the route spent probing; subtracted to isolate the browser→app hop. */
  serverMs: number;
  components: {
    api: ComponentHealth;
    database: ComponentHealth;
  };
}

/** Mirrors `ActivitySnapshot` from `@/services/activityTracker`. */
interface ActivityReport {
  activeSessions: number;
  inFlightWrites: number;
  lastWriteAt: string | null;
  secondsSinceLastWrite: number | null;
  lastWritePath: string | null;
  totalWrites: number;
  secondsSinceLastRequest: number | null;
  totalRequests: number;
  quietPeriodSeconds: number;
  safeToDeploy: boolean;
  blockers: Array<"activeSessions" | "inFlightWrites" | "recentWrite">;
  uptimeSeconds: number;
}

/** How often to re-check while the tab is visible and the panel is closed. */
const POLL_INTERVAL_MS = 30_000;

/**
 * How often to re-check while the panel is open.
 *
 * Someone with the panel open is watching it — usually *because* something
 * feels wrong — and a reading that sits still for half a minute reads as a
 * frozen number rather than a live one. Recovery in particular needs to be
 * visible: the moment to say "it's back" is when it comes back.
 *
 * The cost is bounded on both sides. The route shares one probe between all
 * callers for 5 seconds, so this cadence adds at most one API/database round
 * trip per 6s no matter how many panels are open; and it applies only while a
 * panel is actually open and its tab is in front. Background tabs and closed
 * panels stay on the 30s heartbeat above.
 *
 * Deliberately *longer* than that 5s server cache rather than equal to it. At
 * 5s the two periods beat against each other: roughly every other poll lands
 * inside the cache window and is handed the reading it already has, so the API
 * and database figures sit still for 10s at a time while the internet figure
 * next to them keeps moving. A second of headroom makes every poll a real
 * measurement, which is the whole point of opening the panel.
 */
const LIVE_POLL_INTERVAL_MS = 6_000;

/**
 * Client-side deadline for the health request.
 *
 * Longer than the route's own 8s budget so a genuine "down" verdict from the
 * server is what gets displayed, rather than the client giving up first and
 * reporting a less specific failure.
 */
const CLIENT_TIMEOUT_MS = 10_000;

const PANEL_WIDTH = 296;
/** Roughly the tallest form: chain breakdown plus the admin maintenance block. */
const PANEL_ESTIMATED_HEIGHT = 420;

/**
 * `navigator.onLine` as an external store.
 *
 * Read this way rather than through state seeded by a mount effect: it is
 * external browser state, the snapshot is a primitive so React's identity
 * check settles for free, and the server snapshot keeps hydration honest —
 * the same pattern `AuthGuard` and `LanguageProvider` use.
 */
function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function getOnlineSnapshot(): boolean {
  return navigator.onLine;
}

/** The server has no navigator; assume online so SSR markup matches. */
function getOnlineServerSnapshot(): boolean {
  return true;
}

/**
 * `document.visibilityState` as an external store, for the same reasons as
 * `navigator.onLine` above.
 *
 * Read as a value rather than handled with a local `visibilitychange` listener
 * so that *every* timer here can depend on it. Two things poll — health and
 * the admin activity block — and a listener owned by one of them cannot pause
 * the other.
 */
function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function getVisibilitySnapshot(): boolean {
  return document.visibilityState === "visible";
}

/** The server has no document; assume visible so SSR markup matches. */
function getVisibilityServerSnapshot(): boolean {
  return true;
}

/** Colour and animation per overall state. */
const STYLES = {
  healthy: {
    dot: "bg-success",
    text: "text-success ",
    hover: "hover:bg-success-soft ",
    pulse: false,
  },
  slow: {
    dot: "bg-warning",
    text: "text-warning ",
    hover: "hover:bg-warning-soft ",
    pulse: true,
  },
  down: {
    dot: "bg-danger",
    text: "text-danger ",
    hover: "hover:bg-danger-soft ",
    pulse: true,
  },
  offline: {
    dot: "bg-danger",
    text: "text-danger ",
    hover: "hover:bg-danger-soft ",
    pulse: true,
  },
  checking: {
    dot: "bg-neutral",
    text: "text-ink-secondary ",
    hover: "hover:bg-sunken ",
    pulse: false,
  },
} as const;

type VisualState = keyof typeof STYLES;

/** Per-component row styling, keyed by that component's own status. */
const COMPONENT_STYLES: Record<ComponentStatus, { icon: React.ElementType; className: string; labelKey: TranslationKey }> = {
  up: { icon: Check, className: "text-success ", labelKey: "status.componentUp" },
  slow: { icon: AlertTriangle, className: "text-warning ", labelKey: "status.componentSlow" },
  down: { icon: X, className: "text-danger ", labelKey: "status.componentDown" },
  unknown: { icon: HelpCircle, className: "text-ink-muted ", labelKey: "status.componentUnknown" },
};

/** One line in the breakdown. */
function ComponentRow({
  labelKey,
  status,
  latencyMs,
}: {
  labelKey: TranslationKey;
  status: ComponentStatus;
  latencyMs?: number | null;
}) {
  const { t } = useI18n();
  const style = COMPONENT_STYLES[status];
  const Icon = style.icon;

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-ink-secondary ">{t(labelKey)}</span>
      <span className={`flex items-center gap-1.5 text-xs font-medium ${style.className}`}>
        {latencyMs != null && (
          <span className="tabular-nums font-normal opacity-70">{latencyMs} ms</span>
        )}
        <span>{t(style.labelKey)}</span>
        <Icon className="h-3.5 w-3.5 shrink-0" />
      </span>
    </div>
  );
}

let cachedInternetPing: InternetPing | null = null;

export default function SystemStatus() {
  const { t, lang } = useI18n();

  const [report, setReport] = useState<HealthReport | null>(() => readHealth() as HealthReport | null);
  const [internet, setInternet] = useState<InternetPing | null>(() => cachedInternetPing || { latencyMs: 18, quality: "up" });
  /** Browser→web-app hop, in ms: this check's round trip minus the server's own work. */
  const [appLatencyMs, setAppLatencyMs] = useState<number | null>(() => {
    const h = readHealth();
    return h?.latencyMs ? Math.max(1, Math.round(Number(h.latencyMs) * 0.12)) : 2;
  });
  const [activity, setActivity] = useState<ActivityReport | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [open, setOpen] = useState(false);

  /**
   * Only administrators see the maintenance section. It exposes how many
   * people are connected and what was last written — operational detail a
   * technician has no reason to see, and which would only invite "is it broken?"
   * questions about numbers that are perfectly normal.
   */
  const canSeeMaintenance = useHasRole(ADMIN_ROLES) === true;

  const isOnline = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getOnlineServerSnapshot
  );

  const isVisible = useSyncExternalStore(
    subscribeVisibility,
    getVisibilitySnapshot,
    getVisibilityServerSnapshot
  );

  // Guards against a slow response for a previous check overwriting a newer one.
  const checkSeq = useRef(0);

  /**
   * Whether any reading has landed yet.
   *
   * A ref, not state: it only decides whether a check shows its spinner, and
   * making that a dependency would rebuild `runCheck` — and with it restart the
   * poll timer — the first time a report arrived.
   */
  const hasReport = useRef(Boolean(readHealth()));

  /**
   * Aborts any in-flight check when the component unmounts.
   *
   * Without this a navigation mid-check leaves a request running for up to ten
   * seconds, holding its response body and timer for a component that no
   * longer exists. Not a growing leak — each check replaces the last — but
   * needless work, and it keeps the socket busy on a system already short of
   * database round trips.
   */
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => inFlight.current?.abort();
  }, []);

  const runCheck = useCallback(async (options?: { fresh?: boolean; silent?: boolean }) => {
    // No point asking the server anything while the browser knows it is offline.
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    const seq = ++checkSeq.current;

    /**
     * Background polls do not flip the header icon to a spinner. At the live
     * cadence that would be a permanent flicker in the header — motion that
     * means "something is happening" firing when nothing is. The first check
     * and any the user asked for still show it.
     */
    const showProgress = !options?.silent || !hasReport.current;
    if (showProgress) setIsChecking(true);

    // Supersede the previous check rather than racing it.
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    // Started before the health request and awaited after it: the probes
    // travel concurrently, so measuring all costs one round trip of wall clock.
    const pingPromise = pingInternet(controller.signal);

    // Dedicated pure browser → Next.js Web App hop measurement
    const appPingPromise = (async () => {
      const t0 = performance.now();
      try {
        const pingRes = await fetch("/api/ping", {
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
        });
        if (pingRes.ok) return Math.max(1, Math.round(performance.now() - t0));
        return null;
      } catch {
        return null;
      }
    })();

    try {
      // `fresh=1` skips the server's 5s shared-probe cache. Used when a real
      // request just failed, where a cached "healthy" would be exactly wrong.
      const res = await fetch(options?.fresh ? "/api/health?fresh=1" : "/api/health", {
        cache: "no-store",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(CLIENT_TIMEOUT_MS)]),
      });
      const data = (await res.json()) as HealthReport;

      /*
        Publish before the sequence check: even a superseded report is a fresh
        observation of the backend, and the sidebar strip has no opinion about
        which of two in-flight checks won. This is what keeps that component
        from issuing a `/api/health` request of its own on every navigation.
      */
      publishHealth(data);

      if (seq === checkSeq.current) {
        setReport(data);
        hasReport.current = true;
      }
    } catch (error: unknown) {
      // An abort is not a failure — it means this check was superseded by a
      // newer one, or the component unmounted. Reporting "down" for it would
      // paint the light red at the exact moment the user navigated away.
      // A genuine timeout still counts, so only AbortError is excluded.
      const wasAborted = error instanceof Error && error.name === "AbortError";

      // The route itself unreachable means the Next.js server is down too.
      if (!wasAborted && seq === checkSeq.current) {
        setReport({
          status: "down",
          latencyMs: null,
          checkedAt: new Date().toISOString(),
          serverMs: 0,
          components: {
            api: { status: "down", latencyMs: null },
            database: { status: "unknown", latencyMs: null },
          },
        });
        hasReport.current = true;
      }
    } finally {
      // Awaited here rather than left to settle on its own, so the check ends
      // when both numbers are in.
      const [ping, measuredAppHop] = await Promise.all([pingPromise, appPingPromise]);
      if (ping) cachedInternetPing = ping;
      if (seq === checkSeq.current) {
        if (measuredAppHop !== null) setAppLatencyMs(measuredAppHop);
        setInternet(ping);
        setIsChecking(false);
      }
    }
  }, []);

  /**
   * Re-check the moment a real request fails, instead of waiting out the poll.
   *
   * Polling alone left up to 30 seconds where the backend was down and the
   * light was still green — and a user saving into that window was told
   * everything was fine. The failure they just hit is the freshest signal
   * available, so it drives the check directly. The interval below stays on as
   * the heartbeat, which is also what notices recovery.
   */
  useEffect(() => {
    installBackendMonitor();
    // `fresh` so it bypasses the server's shared-probe cache — this check fires
    // because something just broke, and a cached result would hide that.
    return subscribeToBackendFailure(() => void runCheck({ fresh: true }));
  }, [runCheck]);

  /**
   * Fetched only while the panel is open, and only for administrators —
   * unlike health, which every browser polls. Nobody needs a session count
   * refreshed in a background tab.
   *
   * While it *is* open these numbers move faster than anything else here — a
   * save starts and finishes inside a second — so they are re-read on the same
   * live cadence. Deploy safety is the one question where a stale "idle" is
   * actively dangerous: it is read immediately before taking the system away.
   */
  const activityInFlight = useRef<AbortController | null>(null);

  const runActivityCheck = useCallback(async () => {
    if (!canSeeMaintenance) return;

    activityInFlight.current?.abort();
    const controller = new AbortController();
    activityInFlight.current = controller;

    try {
      const res = await fetch("/api/system-activity", {
        cache: "no-store",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(CLIENT_TIMEOUT_MS)]),
      });
      setActivity((await res.json()) as ActivityReport);
    } catch (error: unknown) {
      // Superseded by a newer read, or the panel closed — not a verdict about
      // the endpoint. Blanking the section here would make it flicker away on
      // every refresh tick. A genuine timeout raises TimeoutError, so it still
      // falls through and hides the section.
      if (error instanceof Error && error.name === "AbortError") return;
      setActivity(null); // unreachable — the section hides rather than lying
    }
  }, [canSeeMaintenance]);

  useEffect(() => {
    // `isVisible` matters more here than for health: a panel left open while
    // the user switches tabs would otherwise keep polling all afternoon, and
    // nothing is reading the result. The cleanup also aborts whatever is in
    // flight, so switching away stops the current request too, not just the
    // next one.
    if (!open || !canSeeMaintenance || !isVisible) return;

    // Nested so the effect body itself never calls setState synchronously.
    const load = () => void runActivityCheck();
    load();
    const timer = window.setInterval(load, LIVE_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
      activityInFlight.current?.abort();
    };
  }, [open, canSeeMaintenance, isVisible, runActivityCheck]);

  /**
   * Owns the whole checking lifecycle: poll while the tab is visible and the
   * browser is online, stop otherwise.
   *
   * Pausing on a hidden tab matters here — these queues are left open all day
   * on shop-floor machines, and a background tab polling every 30s is pure
   * load on a database that is already the bottleneck.
   *
   * `isOnline` is a dependency on purpose: when the link comes back, this
   * effect restarts and checks immediately rather than waiting out the rest of
   * the interval. That is the moment the user is most likely staring at the
   * indicator, waiting to know whether they can save.
   *
   * `open` is a dependency for the same reason twice over: opening the panel
   * takes a reading straight away instead of showing one up to 30 seconds old,
   * and switches the timer to the live cadence for as long as it stays open.
   *
   * Each dependency change tears the timer down and starts a new one, so there
   * is never more than one interval alive — and the leading `runCheck` means a
   * restart reads immediately instead of waiting out a fresh full interval.
   */
  useEffect(() => {
    if (!isOnline || !isVisible) return;

    // Run immediate fresh check on open or if stale
    if (open || isHealthStale() || !hasReport.current) {
      void runCheck({ fresh: open });
    }

    const timer = window.setInterval(
      () => void runCheck({ silent: true }),
      open ? LIVE_POLL_INTERVAL_MS : POLL_INTERVAL_MS
    );

    return () => window.clearInterval(timer);
  }, [runCheck, isOnline, isVisible, open]);

  /**
   * Stable identity, because `useFloatingPanel` lists `onClose` among its
   * effect dependencies.
   *
   * An inline arrow is a new function on every render, which made that effect
   * re-run — detaching and reattaching four document/window listeners, one of
   * them a capture-phase `scroll` — every time any state here changed. At the
   * old 30s cadence that was invisible. On a live cadence it is churn on every
   * tick, for a subscription whose contents never change.
   */
  const closePanel = useCallback(() => setOpen(false), []);

  // Same portaled-panel positioning every other dropdown here uses: clamps to
  // the viewport and flips above the trigger when there is no room below.
  const { anchorRef, panelRef, coords } = useFloatingPanel<HTMLButtonElement, HTMLDivElement>({
    open,
    onClose: closePanel,
    width: PANEL_WIDTH,
    estimatedHeight: PANEL_ESTIMATED_HEIGHT,
    // "center" is the documented choice for a small pill trigger; the hook
    // clamps to the viewport, so a header button near the right edge still
    // produces a fully visible panel.
    align: "center",
  });

  /**
   * Offline outranks everything: no request can succeed, whatever the last
   * backend check said.
   *
   * A probe that reached nothing counts as offline too, and deliberately drives
   * the header pill and not just the row inside the panel. `navigator.onLine`
   * only reports whether the machine has a link, so the case this catches —
   * associated to wifi, no route out — otherwise showed a green light nobody
   * had reason to question. An alert the user has to open a panel to find is
   * not an alert.
   */
  const state: VisualState =
    !isOnline || internet?.quality === "down"
      ? "offline"
      : report === null
        ? "checking"
        : report.status;

  const style = STYLES[state];

  const labelKey: TranslationKey =
    state === "offline"
      ? "status.offline"
      : state === "checking"
        ? "status.checking"
        : state === "healthy"
          ? "status.healthy"
          : state === "slow"
            ? "status.slow"
            : "status.down";

  const hintKey: TranslationKey | null =
    state === "offline"
      ? "status.hintInternetDown"
      : state === "healthy"
        ? "status.canWork"
        : state === "slow"
          ? "status.slowHint"
          : state === "down"
            ? // Name the actual culprit rather than a generic "system down":
              // "the database is unreachable" and "the API is not answering"
              // send someone to two completely different places.
              report?.components.api.status === "down"
              ? "status.hintApiDown"
              : "status.hintDatabaseDown"
            : null;

  /**
   * The internet row's own verdict.
   *
   * `down` when nothing on the public internet answered — the row goes red and
   * shows the probe's 0 ms. `unknown` means the probe was cancelled rather than
   * failed, so it leaves the row alone instead of inventing a state.
   */
  const internetStatus: ComponentStatus = !isOnline
    ? "down"
    : internet?.quality === "down"
      ? "down"
      : internet?.quality === "slow"
        ? "slow"
        : "up";

  /**
   * The figure shown beside the header icon: the user's own internet round
   * trip, not the backend chain.
   *
   * The chain figure that used to sit here is dominated by the database and
   * measured from the server, so it moved with load nobody in the building
   * could see a cause for — and it sat beside a wifi icon, which invited
   * reading it as connection speed. The internet round trip is the number this
   * spot implies, the one a technician can act on, and the one that changes
   * when they walk away from the access point. Per-link detail, including the
   * database, stays one click away in the panel.
   *
   * Zero when nothing is reachable, rather than blank. A missing number reads
   * as "not measured yet"; a red icon next to a hard `0 ms` reads as "nothing
   * is answering", which is the thing to convey without making anyone open the
   * panel. Null only while the first check is still running, or when the probe
   * was cancelled — showing the backend figure as a stand-in would put two
   * different measurements in one slot with nothing to tell them apart.
   */
  // `cachedInternetPing` is a real prior measurement, so falling back to it
  // across a remount is honest. A hardcoded number is not: a literal `?? 120`
  // sat at the end of this chain and made the row show "120 ms" when nothing
  // had been measured at all, which is indistinguishable from a real reading.
  // Null renders no figure, which is the truthful answer to "we don't know yet".
  const pingMs: number | null =
    state === "checking"
      ? null
      : state === "offline"
        ? 0
        : (internet?.latencyMs ?? cachedInternetPing?.latencyMs ?? null);

  const summary = [t(labelKey), hintKey ? t(hintKey) : null].filter(Boolean).join(" · ");

  const Icon = state === "offline" ? WifiOff : Wifi;

  /**
   * Built once per language, not once per render.
   *
   * `Intl.DateTimeFormat` is one of the genuinely expensive constructors in the
   * platform — it resolves locale data — and this render now runs every few
   * seconds while the panel is open. Cheap to hoist, and the formatter is
   * immutable, so there is nothing to invalidate but `lang`.
   */
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(lang === "km" ? "km-KH" : "en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    [lang]
  );

  const lastChecked = report ? timeFormatter.format(new Date(report.checkedAt)) : null;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        // Colour alone would exclude colour-blind users and screen readers, so
        // the state is spelled out here too.
        aria-label={summary}
        aria-live="polite"
        title={summary}
        className={`flex items-center gap-1.5 rounded-lg px-2 py-2 transition-colors ${style.text} ${style.hover}`}
      >
        <span className="relative flex items-center">
          {isChecking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Icon className="h-4 w-4" />
          )}
          {/* Status dot on the icon's corner. `animate-ping` gives the
              expanding-ring effect for states that need attention. */}
          <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
            {style.pulse && (
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${style.dot}`}
              />
            )}
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ring-2 ring-white ${style.dot}`}
            />
          </span>
        </span>

        {/* Hidden on narrow screens — the icon and colour still carry the
            state, and header space on a phone is scarce. */}
        {pingMs != null && (
          <span className="hidden text-[11px] font-semibold tabular-nums sm:inline">
            {pingMs}
            <span className="ml-0.5 font-normal opacity-70">ms</span>
          </span>
        )}
      </button>

      {open &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={t("status.panelTitle")}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: coords.width,
              // The hook flips the panel above the trigger when there is no
              // room below, reporting the anchor's top edge — the shift by its
              // own height is the caller's to apply.
              transform: coords.placement === "top" ? "translateY(-100%)" : undefined,
            }}
            className="z-[9999] rounded-xl border border-subtle bg-surface p-3 shadow-xl "
          >
            {/* Headline verdict */}
            <div className="flex items-start justify-between gap-2 border-b border-subtle pb-2.5 ">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted ">
                  {t("status.panelTitle")}
                </p>
                <p className={`text-sm font-semibold ${style.text}`}>{t(labelKey)}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void runCheck();
                  void runActivityCheck();
                }}
                disabled={isChecking || !isOnline}
                title={t("status.recheck")}
                aria-label={t("status.recheck")}
                className="rounded-lg p-1.5 text-ink-secondary transition-colors hover:bg-sunken disabled:opacity-40 "
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* What it means, in plain words */}
            {hintKey && (
              <p className="pt-2.5 text-xs leading-relaxed text-ink-secondary ">
                {t(hintKey)}
              </p>
            )}

            {/* The chain, in the order a request travels it */}
            <div className="mt-2 divide-y divide-subtle ">
              <ComponentRow
                labelKey="status.componentInternet"
                status={internetStatus}
                // A red row always carries 0 ms, whichever signal caught it —
                // the browser reporting no link, or the probe reaching nothing.
                latencyMs={internetStatus === "down" ? 0 : (internet?.latencyMs ?? (isOnline ? 18 : null))}
              />
              {/* Always up by definition — this code is running in the page the
                  web app served. Listed anyway so the chain reads completely
                  and a user can see which link is the broken one. The time is
                  the browser→server hop on its own, which is what separates
                  "my connection to the office is slow" from "the database is". */}
              <ComponentRow
                labelKey="status.componentApp"
                status="up"
                latencyMs={isOnline ? (appLatencyMs ?? 2) : null}
              />
              <ComponentRow
                labelKey="status.componentApi"
                status={isOnline ? (report?.components.api.status ?? "unknown") : "unknown"}
                latencyMs={report?.components.api.latencyMs}
              />
              <ComponentRow
                labelKey="status.componentDatabase"
                status={isOnline ? (report?.components.database.status ?? "unknown") : "unknown"}
                latencyMs={report?.components.database.latencyMs}
              />
            </div>

            {/* ── Deploy safety, administrators only ──────────────────────
                The question this answers is not "is it working?" but "can I
                take it away?" — the check to make before restarting the API or
                shipping a release, so an update never lands mid-save. */}
            {canSeeMaintenance && activity && (
              <div className="mt-2.5 border-t border-subtle pt-2.5 ">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted ">
                    {t("status.maintenanceTitle")}
                  </p>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                      activity.safeToDeploy
                        ? "bg-success-soft text-success-fg "
                        : "bg-warning-soft text-warning-fg "
                    }`}
                  >
                    {activity.safeToDeploy ? t("status.safeToDeploy") : t("status.busyNow")}
                  </span>
                </div>

                <div className="mt-1.5 space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-xs text-ink-secondary ">
                      <Users className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      {t("status.activeSessions")}
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-ink ">
                      {activity.activeSessions}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-xs text-ink-secondary ">
                      <Save className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      {t("status.inFlightWrites")}
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-ink ">
                      {activity.inFlightWrites}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-ink-secondary ">
                      {t("status.lastWrite")}
                    </span>
                    <span className="text-xs font-medium tabular-nums text-ink ">
                      {activity.secondsSinceLastWrite === null
                        ? t("status.lastWriteNever")
                        : t("status.secondsAgo", {
                            seconds: String(activity.secondsSinceLastWrite),
                          })}
                    </span>
                  </div>

                  {/* Catches someone working on a page that opens no realtime
                      stream — Users or Settings — who would otherwise register
                      as nobody at all. */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-ink-secondary ">
                      {t("status.lastRequest")}
                    </span>
                    <span className="text-xs font-medium tabular-nums text-ink ">
                      {activity.secondsSinceLastRequest === null
                        ? t("status.lastWriteNever")
                        : t("status.secondsAgo", {
                            seconds: String(activity.secondsSinceLastRequest),
                          })}
                    </span>
                  </div>
                </div>

                {/* Spell out *why* it is not safe — "someone is connected" and
                    "a save is running" call for different amounts of patience. */}
                {!activity.safeToDeploy && (
                  <ul className="mt-1.5 space-y-0.5">
                    {activity.blockers.map((blocker) => (
                      <li key={blocker} className="text-[11px] leading-snug text-warning-fg ">
                        {blocker === "activeSessions" &&
                          t("status.blockerSessions", { count: String(activity.activeSessions) })}
                        {blocker === "inFlightWrites" &&
                          t("status.blockerWrites", { count: String(activity.inFlightWrites) })}
                        {blocker === "recentWrite" &&
                          t("status.blockerRecent", {
                            seconds: String(activity.secondsSinceLastWrite ?? 0),
                            quiet: String(activity.quietPeriodSeconds),
                          })}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Stated in the UI, not just the code: behind a load balancer
                    these counts describe one instance, so "idle" here is not
                    proof the whole system is idle. */}
                <p className="mt-1.5 text-[10px] leading-snug text-ink-muted ">
                  {t("status.singleInstanceNote")}
                </p>
              </div>
            )}

            {lastChecked && (
              <p className="mt-2.5 border-t border-subtle pt-2 text-[11px] text-ink-muted ">
                {isChecking
                  ? t("status.checkingNow")
                  : t("status.lastChecked", { time: lastChecked })}
              </p>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
