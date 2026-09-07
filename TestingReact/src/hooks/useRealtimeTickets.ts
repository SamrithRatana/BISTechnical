"use client";

/**
 * @file useRealtimeTickets.ts
 * @description Memory-safe, Multi-Tab Multiplexed Realtime Hook.
 *
 * Uses a single browser-wide EventSource via BroadcastChannel leader election:
 * - Exactly ONE tab in the browser maintains the persistent /api/events connection.
 * - All other tabs receive events with 0ms latency over BroadcastChannel.
 * - Solves the browser 6-connection pool exhaustion when opening multiple tabs.
 */

import { useEffect, useRef, useCallback } from "react";
import type { TicketEvent, TicketEventType, RealtimeResource } from "@/services/eventBus";
import { invalidateCachePrefix } from "@/services/api";
import { clearListCache } from "@/hooks/useInfiniteList";

const TICKET_EVENT_TYPES: TicketEventType[] = [
  "ticket_created",
  "ticket_updated",
  "ticket_deleted",
  "status_changed",
];

const DEBOUNCE_MS = 300;
const POLL_MS = 30_000;

type StreamHandler = (event: TicketEvent) => void;

const streamHandlers = new Set<StreamHandler>();
let sharedSource: EventSource | null = null;
let sharedReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let sharedReconnectDelay = 1000;
let sharedCloseTimer: ReturnType<typeof setTimeout> | null = null;
const STREAM_CLOSE_GRACE_MS = 2000;

// Multi-Tab BroadcastChannel Leader System
const BROADCAST_NAME = "bis_realtime_ticket_channel";
const LEADER_KEY = "bis_realtime_leader_tab_id";
const HEARTBEAT_KEY = "bis_realtime_leader_heartbeat";
const TAB_ID = "tab_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

let broadcastChannel: BroadcastChannel | null = null;
let isLeader = false;
let leaderCheckInterval: ReturnType<typeof setInterval> | null = null;

function dispatchToLocalHandlers(event: TicketEvent) {
  if (typeof window !== "undefined") {
    invalidateCachePrefix("spareparts");
    invalidateCachePrefix("repairservices");
    invalidateCachePrefix("dashboard");
    clearListCache();
  }

  for (const handler of Array.from(streamHandlers)) {
    try {
      handler(event);
    } catch {
      // Ignore individual subscriber errors
    }
  }
}

export function notifyLocalRealtime(event: Partial<TicketEvent> = {}) {
  const fullEvent: TicketEvent = {
    type: event.type || "status_changed",
    resource: event.resource || "ticket",
    status: event.status,
    at: event.at || new Date().toISOString()
  };

  dispatchToLocalHandlers(fullEvent);

  try {
    initBroadcastChannel();
    broadcastChannel?.postMessage({
      type: "TICKET_EVENT",
      payload: fullEvent,
    });
  } catch {}
}

function initBroadcastChannel() {
  if (typeof window === "undefined" || broadcastChannel) return;
  try {
    broadcastChannel = new BroadcastChannel(BROADCAST_NAME);
    broadcastChannel.onmessage = (msgEvent) => {
      const data = msgEvent.data;
      if (!data) return;

      if (data.type === "TICKET_EVENT" && data.payload) {
        // Received event from leader tab
        dispatchToLocalHandlers(data.payload as TicketEvent);
      } else if (data.type === "LEADER_RESIGNED" && !isLeader) {
        checkAndClaimLeadership();
      }
    };
  } catch {
    // BroadcastChannel unsupported fallback
  }
}

function checkAndClaimLeadership() {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const currentLeader = localStorage.getItem(LEADER_KEY);
  const lastHeartbeat = Number(localStorage.getItem(HEARTBEAT_KEY)) || 0;

  // Leader expired or unassigned
  if (!currentLeader || currentLeader === TAB_ID || now - lastHeartbeat > 3500) {
    becomeLeader();
  }
}

function becomeLeader() {
  if (isLeader) {
    localStorage.setItem(HEARTBEAT_KEY, Date.now().toString());
    return;
  }
  isLeader = true;
  localStorage.setItem(LEADER_KEY, TAB_ID);
  localStorage.setItem(HEARTBEAT_KEY, Date.now().toString());

  if (streamHandlers.size > 0 && !sharedSource) {
    openSharedStream();
  }
}

function startLeaderHeartbeat() {
  if (leaderCheckInterval || typeof window === "undefined") return;
  initBroadcastChannel();
  checkAndClaimLeadership();

  leaderCheckInterval = setInterval(() => {
    const now = Date.now();
    if (isLeader) {
      localStorage.setItem(HEARTBEAT_KEY, now.toString());
      localStorage.setItem(LEADER_KEY, TAB_ID);
    } else {
      const lastHeartbeat = Number(localStorage.getItem(HEARTBEAT_KEY)) || 0;
      if (now - lastHeartbeat > 3500) {
        checkAndClaimLeadership();
      }
    }
  }, 1500);

  window.addEventListener("beforeunload", () => {
    if (isLeader) {
      localStorage.removeItem(LEADER_KEY);
      localStorage.removeItem(HEARTBEAT_KEY);
      broadcastChannel?.postMessage({ type: "LEADER_RESIGNED" });
    }
  });
}

function cancelPendingClose() {
  if (sharedCloseTimer === null) return;
  clearTimeout(sharedCloseTimer);
  sharedCloseTimer = null;
}

let sharedOpenPending = false;

function openSharedStream() {
  if (sharedSource || sharedOpenPending || typeof window === "undefined") return;
  // If not leader, non-leader tabs let the leader stream
  if (!isLeader) {
    checkAndClaimLeadership();
    if (!isLeader) return;
  }

  if (document.readyState !== "complete") {
    sharedOpenPending = true;
    window.addEventListener(
      "load",
      () => {
        sharedOpenPending = false;
        if (streamHandlers.size > 0 && isLeader) openSharedStream();
      },
      { once: true }
    );
    return;
  }

  try {
    const es = new EventSource("/api/events");
    sharedSource = es;

    es.onopen = () => {
      sharedReconnectDelay = 1000;
    };

    es.onmessage = (e: MessageEvent<string>) => {
      let event: TicketEvent;
      try {
        event = JSON.parse(e.data) as TicketEvent;
      } catch {
        return;
      }
      if ((event.type as string) === "connected") return;

      // 1. Dispatch to local tab subscribers
      dispatchToLocalHandlers(event);

      // 2. Broadcast across all other open tabs in the browser with 0 sockets
      try {
        broadcastChannel?.postMessage({
          type: "TICKET_EVENT",
          payload: event,
        });
      } catch {}
    };

    es.onerror = () => {
      es.close();
      if (sharedSource === es) sharedSource = null;

      if (streamHandlers.size === 0) return;
      if (sharedReconnectTimer !== null) return;

      sharedReconnectTimer = setTimeout(() => {
        sharedReconnectTimer = null;
        sharedReconnectDelay = Math.min(sharedReconnectDelay * 2, 20_000);
        if (isLeader) openSharedStream();
      }, sharedReconnectDelay);
    };
  } catch {
    // EventSource fallback
  }
}

function closeSharedStream() {
  cancelPendingClose();
  sharedOpenPending = false;
  sharedSource?.close();
  sharedSource = null;
  if (sharedReconnectTimer !== null) {
    clearTimeout(sharedReconnectTimer);
    sharedReconnectTimer = null;
  }
  sharedReconnectDelay = 1000;
}

function subscribeToStream(handler: StreamHandler): () => void {
  cancelPendingClose();
  streamHandlers.add(handler);
  startLeaderHeartbeat();

  if (isLeader) {
    openSharedStream();
  }

  return () => {
    streamHandlers.delete(handler);
    if (streamHandlers.size > 0) return;

    cancelPendingClose();
    sharedCloseTimer = setTimeout(() => {
      sharedCloseTimer = null;
      if (streamHandlers.size === 0) closeSharedStream();
    }, STREAM_CLOSE_GRACE_MS);
  };
}

export function subscribeSharedStream(handler: (event: TicketEvent) => void): () => void {
  return subscribeToStream(handler);
}

interface UseRealtimeTicketsOptions {
  disabled?: boolean;
  resource?: RealtimeResource;
}

export function useRealtimeTickets(
  filterStatus?: string | null,
  onUpdate?: () => void,
  options: UseRealtimeTicketsOptions = {}
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerUpdate = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onUpdateRef.current?.();
    }, DEBOUNCE_MS);
  }, []);

  const { disabled = false, resource = "ticket" } = options;

  useEffect(() => {
    if (disabled || !onUpdate) return;

    const handler: StreamHandler = (event: TicketEvent) => {
      const eventResource = (event.resource || "ticket").toLowerCase();
      const targetResource = (resource || "ticket").toLowerCase();
      
      const matches = 
        targetResource === "all" ||
        eventResource === "all" ||
        eventResource === targetResource ||
        targetResource === "sparepart" ||
        (eventResource.startsWith("ticket") && targetResource.startsWith("ticket")) ||
        (event.status === "Sent Spareparts" && targetResource === "sparepart") ||
        (eventResource === "sparepart" && targetResource === "ticket");

      if (!matches) return;

      if (TICKET_EVENT_TYPES.includes(event.type as TicketEventType)) {
        triggerUpdate();
      }
    };

    const unsubscribe = subscribeToStream(handler);

    const pollInterval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        onUpdateRef.current?.();
      }
    }, POLL_MS);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [disabled, resource, triggerUpdate, onUpdate]);
}

export function useRealtimeResource(resource: RealtimeResource, onUpdate?: () => void) {
  return useRealtimeTickets(null, onUpdate, { resource });
}

export default useRealtimeTickets;
