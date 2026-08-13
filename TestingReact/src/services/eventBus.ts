/**
 * @file eventBus.ts
 * @description Module-level event bus for broadcasting service ticket mutations
 * to all active SSE connections. Lives in Node.js module scope — works perfectly
 * in single-process deployments (next dev / next start).
 *
 * Memory safety:
 * - Subscribers stored in a plain Set<fn>
 * - subscribe() returns a cleanup function — callers must invoke it on disconnect
 * - broadcast() snapshots the Set before iterating (prevents iterator invalidation)
 *
 * Production scaling note:
 * - Single Node process: this file works as-is
 * - Multi-process (cluster / multiple Vercel instances): swap for Redis Pub/Sub
 *   keeping the same subscribe/broadcast API — React hooks stay unchanged
 */

export type TicketEventType =
  | "ticket_created"
  | "ticket_updated"
  | "ticket_deleted"
  | "status_changed";

/**
 * Which kind of record the event is about.
 *
 * Without this every mutation looked like a ticket event: saving a spare part
 * refreshed all the ticket queues (which don't care) while the spare-parts
 * list itself — the one screen that needed it — got nothing.
 */
export type RealtimeResource = "ticket" | "sparepart" | "item" | "customer";

export interface TicketEvent {
  type: TicketEventType;
  /** Record type this event concerns. Defaults to "ticket" when absent. */
  resource?: RealtimeResource;
  /**
   * The status the ticket now belongs to (e.g. "Inspection").
   *
   * Note this is the *destination* status only — the event carries no record
   * of where the ticket came from, so subscribers must not use it to decide
   * whether an event is theirs. See `useRealtimeTickets`.
   */
  status?: string;
  /** Ticket ID affected */
  id?: string;
  /** ISO timestamp */
  at: string;
}

type Subscriber = (event: TicketEvent) => void;

/** Global set of active SSE subscriber callbacks */
const subscribers = new Set<Subscriber>();

/**
 * Broadcast an event to all active SSE connections.
 * Called from proxy route handlers after successful mutations.
 */
export function broadcast(event: TicketEvent): void {
  // Snapshot before iterating so mid-iteration unsubscribes are safe
  const snapshot = Array.from(subscribers);
  for (const fn of snapshot) {
    try {
      fn(event);
    } catch {
      // Individual subscriber errors must not abort the broadcast
    }
  }
}

/**
 * Subscribe to ticket events. Returns a cleanup function.
 *
 * Usage:
 *   const cleanup = subscribe((event) => { ... });
 *   // later, on client disconnect:
 *   cleanup();
 */
export function subscribe(fn: Subscriber): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/** Current number of active SSE subscribers (for observability). */
export function subscriberCount(): number {
  return subscribers.size;
}
