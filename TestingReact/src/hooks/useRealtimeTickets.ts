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

    let es: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = 1000; // start at 1s, cap at 30s
    let mounted = true;

    function connect() {
      if (!mounted) return;

      es = new EventSource("/api/events");

      es.onopen = () => {
        reconnectDelay = 1000; // reset back-off on successful connect
      };

      es.onmessage = (e: MessageEvent<string>) => {
        try {
          const event = JSON.parse(e.data) as TicketEvent;

          if ((event.type as string) === "connected") return;

          // Ignore other record types — a spare-part save shouldn't reload the
          // ticket queues, and vice versa. Events without a resource predate
          // that field and are treated as tickets.
          if ((event.resource ?? "ticket") !== resource) return;

          if (!TICKET_EVENT_TYPES.includes(event.type)) return;

          // NOTE: deliberately NOT filtered by `event.status`.
          //
          // A status change affects two lists — the one the ticket left and the
          // one it joined — but the event only carries the *destination*
          // status. Matching on it meant the source page ignored the very event
          // that should have removed the row: moving a ticket Inspecting →
          // Inspection broadcast status "Inspection", which the Inspecting
          // queue discarded, so other users kept seeing a ticket that had
          // already moved on. Refreshing on every relevant ticket event costs
          // one bounded request (debounced 400ms) and is always correct.
          scheduleUpdate();
        } catch {
          // Malformed event — ignore
        }
      };

      es.onerror = () => {
        // EventSource will attempt its own native reconnect.
        // If it fails, we add exponential back-off with a 30s cap.
        es?.close();
        es = null;
        if (!mounted) return;

        reconnectTimeout = setTimeout(() => {
          reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
          connect();
        }, reconnectDelay);
      };
    }

    connect();

    // ✅ Cleanup: runs on unmount OR when filter/disabled changes
    return () => {
      mounted = false;

      // Close SSE connection
      es?.close();
      es = null;

      // Clear reconnect timer
      if (reconnectTimeout !== null) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }

      // Clear debounce timer
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
