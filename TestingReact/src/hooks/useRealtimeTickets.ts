"use client";

/**
 * @file useRealtimeTickets.ts
 * @description Memory-safe React hook that subscribes to the SSE event stream
 * and calls `onUpdate()` whenever a relevant ticket event arrives.
 *
 * Memory safety guarantees:
 * 1. EventSource is closed in the useEffect cleanup — always fires on unmount
 *    or when dependencies change (filter/onUpdate change).
 * 2. Debounce timer is cleared in cleanup — never leaks a stale callback.
 * 3. `onUpdate` ref prevents stale closure issues — latest callback always used
 *    without re-running the effect.
 * 4. Reconnect back-off is bounded — EventSource native reconnect + our
 *    exponential cap prevents runaway reconnect storms on server restart.
 *
 * Usage:
 *   useRealtimeTickets("Received", loadData);  // auto-refreshes when tickets change
 */

import { useEffect, useRef, useCallback } from "react";
import type { TicketEvent, TicketEventType, RealtimeResource } from "@/services/eventBus";

/**
 * Every ticket event type can affect every ticket list, so there is no
 * per-status allow-list any more.
 *
 * There used to be one, and each row of it leaked updates:
 * - "Received" omitted `status_changed`, so a ticket moving on stayed put.
 * - Most statuses omitted `ticket_deleted`, so a ticket another user deleted
 *   remained on screen — clickable, and actionable — until a manual reload.
 *
 * The reasoning behind the map was that a list only cares about its own
 * status, but that isn't true: a create adds a row, a delete removes one, an
 * update can change any displayed field, and a status change moves a ticket
 * *out* of one list and *into* another. A refresh is one bounded request and
 * events are debounced, so filtering here only ever risked showing stale data.
 */
const TICKET_EVENT_TYPES: TicketEventType[] = [
  "ticket_created",
  "ticket_updated",
  "ticket_deleted",
  "status_changed",
];

const DEBOUNCE_MS = 400; // batch rapid events (e.g. 10 users saving at once)

/**
 * Fallback poll interval. The SSE bus only sees mutations that pass through
 * *this* Next.js process's `/api/proxy` routes — changes made by the legacy
 * Blazor app, a second Next.js instance, or anything calling the API directly
 * never reach it. Polling closes that gap; it only runs while the tab is
 * visible, so a backgrounded tab costs nothing.
 */
const POLL_MS = 30_000;

/* ══════════════════════════════════════════════════════════════════════
   ONE SHARED EVENTSOURCE FOR THE WHOLE TAB
   ══════════════════════════════════════════════════════════════════════

   Every call of this hook used to open its own `EventSource`. That is one
   permanently-open HTTP connection per subscribing component — and the
   dashboard has two (the ticket table and the chart panel), while a queue page
   with a live sidebar widget would have more.

   Three costs, all real:

   1. **Browser connection budget.** HTTP/1.1 allows ~6 concurrent connections
      per origin. Each SSE stream holds one open forever, so two subscribers
      permanently spend a third of the budget that the app's own API calls need.
      A third and fourth subscriber start starving normal requests.

   2. **Server-held streams.** Each connection is a `ServerResponse` the Node
      process keeps alive with its own heartbeat interval and event-bus
      subscriber. This is the source of the `MaxListenersExceededWarning:
      11 close listeners added to [ServerResponse]` flooding the dev log.

   3. **Duplicated delivery.** The same broadcast is serialised and pushed N
      times to one tab, then parsed N times by the client.

   The stream carries no per-subscriber state — every connection receives the
   identical firehose and each hook filters locally — so there is no reason for
   more than one. This multiplexes: the first subscriber opens the connection,
   the last one to leave closes it, and reconnect back-off is shared rather
   than N independent back-off timers stampeding a restarting server.
*/

type StreamHandler = (event: TicketEvent) => void;

const streamHandlers = new Set<StreamHandler>();
let sharedSource: EventSource | null = null;
let sharedReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let sharedReconnectDelay = 1000;

function openSharedStream() {
  if (sharedSource || typeof window === "undefined") return;

  const es = new EventSource("/api/events");
  sharedSource = es;

  es.onopen = () => {
    sharedReconnectDelay = 1000; // reset back-off on a successful connect
  };

  es.onmessage = (e: MessageEvent<string>) => {
    let event: TicketEvent;
    try {
      event = JSON.parse(e.data) as TicketEvent;
    } catch {
      return; // malformed frame — ignore
    }
    if ((event.type as string) === "connected") return;

    // Snapshot before iterating: a handler that unsubscribes during dispatch
    // would otherwise mutate the Set mid-iteration.
    for (const handler of Array.from(streamHandlers)) {
      try {
        handler(event);
      } catch {
        // One subscriber throwing must not stop delivery to the others.
      }
    }
  };

  es.onerror = () => {
    es.close();
    if (sharedSource === es) sharedSource = null;

    // Only retry while someone is still listening. Without this check a
    // fully-unmounted app would keep reconnecting forever in the background.
    if (streamHandlers.size === 0) return;
    if (sharedReconnectTimer !== null) return;

    sharedReconnectTimer = setTimeout(() => {
      sharedReconnectTimer = null;
      sharedReconnectDelay = Math.min(sharedReconnectDelay * 2, 30_000);
      openSharedStream();
    }, sharedReconnectDelay);
  };
}

function closeSharedStream() {
  sharedSource?.close();
  sharedSource = null;
  if (sharedReconnectTimer !== null) {
    clearTimeout(sharedReconnectTimer);
    sharedReconnectTimer = null;
  }
  sharedReconnectDelay = 1000;
}

/** Adds a handler, opening the shared stream if it is the first. */
function subscribeToStream(handler: StreamHandler): () => void {
  streamHandlers.add(handler);
  openSharedStream();

  return () => {
    streamHandlers.delete(handler);
    // Last one out closes the connection. In React's development double-mount
    // the count dips to 0 and back to 1 within a tick; the reopen is cheap and
    // correctness does not depend on the connection surviving it.
    if (streamHandlers.size === 0) closeSharedStream();
  };
}

interface UseRealtimeTicketsOptions {
  /** Disable the SSE subscription (e.g. during heavy operations). Default: false */
  disabled?: boolean;
  /** Fallback poll interval in ms. `0` disables polling. Default: 30000 */
  pollMs?: number;
  /** Record type to listen for. Default: "ticket" */
  resource?: RealtimeResource;
}

/**
 * @param filter   The current page's status filter (e.g. "Received", "Inspecting")
 * @param onUpdate Callback to refresh data — must be stable (useCallback-wrapped)
 * @param options  Optional config
 */
export function useRealtimeTickets(
  filter: string,
  onUpdate: () => void,
  options: UseRealtimeTicketsOptions = {}
): void {
  const { disabled = false, pollMs = POLL_MS, resource = "ticket" } = options;

  // Use a ref so we always call the latest `onUpdate` without re-running the effect
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);

  // Debounce timer ref — cleared in cleanup
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleUpdate = useCallback(() => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      onUpdateRef.current();
    }, DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    if (disabled || typeof window === "undefined") return;

    // Filtering happens here, per subscriber, against the shared firehose —
    // which is exactly why one connection can serve every consumer.
    const unsubscribe = subscribeToStream((event) => {
      // Ignore other record types — a spare-part save shouldn't reload the
      // ticket queues, and vice versa. Events without a resource predate that
      // field and are treated as tickets.
      if ((event.resource ?? "ticket") !== resource) return;

      if (!TICKET_EVENT_TYPES.includes(event.type)) return;

      // NOTE: deliberately NOT filtered by `event.status`.
      //
      // A status change affects two lists — the one the ticket left and the one
      // it joined — but the event only carries the *destination* status.
      // Matching on it meant the source page ignored the very event that should
      // have removed the row: moving a ticket Inspecting → Inspection broadcast
      // status "Inspection", which the Inspecting queue discarded, so other
      // users kept seeing a ticket that had already moved on. Refreshing on
      // every relevant ticket event costs one bounded request (debounced 400ms)
      // and is always correct.
      scheduleUpdate();
    });

    // Cleanup: runs on unmount OR when filter/disabled/resource changes.
    return () => {
      unsubscribe();

      // Clear the debounce timer, or a queued refresh fires after unmount and
      // calls setState on a component that no longer exists.
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [filter, disabled, resource, scheduleUpdate]);

  // Fallback polling — catches mutations the in-process SSE bus never sees
  // (legacy Blazor app, other Next.js instances, direct API calls). Also
  // refreshes immediately when the user returns to the tab, so a screen left
  // open for hours isn't showing stale rows the moment it's looked at again.
  useEffect(() => {
    if (disabled || pollMs <= 0 || typeof window === "undefined") return;

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") scheduleUpdate();
    };

    const interval = setInterval(refreshIfVisible, pollMs);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [disabled, pollMs, scheduleUpdate]);
}

/**
 * Live updates for the non-ticket CRUD screens (spare parts, item models,
 * customers).
 *
 * These lists previously had no subscription at all, so one user adding,
 * editing or deleting a record left everyone else looking at stale rows until
 * they reloaded the page by hand.
 *
 * @param resource Record type this screen shows
 * @param onUpdate Refresh callback — must be stable (useCallback-wrapped)
 */
export function useRealtimeResource(
  resource: Exclude<RealtimeResource, "ticket">,
  onUpdate: () => void,
  options: Omit<UseRealtimeTicketsOptions, "resource"> = {}
): void {
  // "All" opts into every event type; the resource check does the filtering.
  useRealtimeTickets("All", onUpdate, { ...options, resource });
}
