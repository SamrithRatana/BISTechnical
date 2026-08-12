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
import type { TicketEvent, TicketEventType } from "@/services/eventBus";

/** Status name → event types that should trigger a refresh on that page */
const STATUS_EVENT_MAP: Record<string, TicketEventType[]> = {
  Received:                 ["ticket_created", "ticket_updated", "ticket_deleted"],
  Inspecting:               ["ticket_created", "ticket_updated", "status_changed", "ticket_deleted"],
  Inspection:               ["ticket_updated", "status_changed"],
  Repairing:                ["ticket_updated", "status_changed"],
  Finished:                 ["ticket_updated", "status_changed"],
  "Awaiting Customer Confirm": ["ticket_updated", "status_changed"],
  "Customer Rejected":      ["ticket_updated", "status_changed"],
  Unrepairable:             ["ticket_updated", "status_changed"],
  "Awaiting Sparepart":     ["ticket_updated", "status_changed"],
  "Sale Confirmed":         ["ticket_updated", "status_changed"],
  All:                      ["ticket_created", "ticket_updated", "ticket_deleted", "status_changed"],
};

const DEBOUNCE_MS = 400; // batch rapid events (e.g. 10 users saving at once)

interface UseRealtimeTicketsOptions {
  /** Disable the SSE subscription (e.g. during heavy operations). Default: false */
  disabled?: boolean;
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
  const { disabled = false } = options;

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

    // Determine which event types are relevant for this page's filter
    const relevantTypes = STATUS_EVENT_MAP[filter] ?? STATUS_EVENT_MAP["All"];

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

          // Only refresh if this event type is relevant to our current page
          if ((event.type as string) === "connected") return;
          if (!relevantTypes.includes(event.type)) return;

          // For status_changed events, only refresh if the new status matches ours
          if (event.type === "status_changed" && event.status) {
            if (
              filter !== "All" &&
              event.status.toLowerCase() !== filter.toLowerCase()
            ) return;
          }

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
  }, [filter, disabled, scheduleUpdate]);
}
