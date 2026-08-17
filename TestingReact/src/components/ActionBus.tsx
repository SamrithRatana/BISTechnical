"use client";

/**
 * @file ActionBus.tsx
 * @description Lets one part of the app ask another to perform a UI action.
 *
 * The capabilities in this app are locked inside the component that renders
 * them: printing is `useState` in `ServiceTable`, stock-out is `activeModal` in
 * the spare-parts page, the sidebar's width is `useState` in `PageWrapper`.
 * Nothing outside those components can reach them, which is why the assistant
 * could navigate to a page but never press a button on it.
 *
 * This is the missing seam. A component registers a handler for an action id
 * (`useActionHandler`), and anything holding the bus can request that action by
 * id (`useActionBus().request`). The assistant is just one caller — a keyboard
 * shortcut or a deep link would use the same path.
 *
 * Two things make it enough for "do this for me" rather than only "open that":
 *
 * - **A queue, not a slot.** One instruction is routinely several actions —
 *   "open the parts page, collapse the sidebar and start a stock-out for toner"
 *   is three. A single pending slot silently dropped all but the last.
 * - **Values ride along.** A request can carry the field values the dialog
 *   should open with, so the assistant can fill a form in. It stops there by
 *   design: nothing here submits, so the save/confirm click stays with the user.
 *
 * The awkward part is timing: a requested action usually arrives *before* the
 * page that handles it has mounted, and even then its rows are still loading,
 * so the target record doesn't exist yet. So a request is held rather than
 * fired: handlers report whether they could take it, and the bus keeps
 * re-offering it as pages mount and their data arrives, until someone succeeds
 * or it expires.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/** How long a request stays live before it's assumed unhandleable. */
const PENDING_TTL_MS = 20_000;

/**
 * Field values for a form the action opens, keyed by the field names in
 * `@/config/actions`. Values arrive as strings from the model and are coerced by
 * whichever dialog consumes them — it owns the field's real type.
 */
export type ActionValues = Record<string, string>;

export interface ActionRequest {
  /** An id from `@/config/actions`. */
  id: string;
  /**
   * Which record it targets — a report number, part name or serial. Handlers
   * match it against the rows they have; omitted for page-level actions.
   */
  recordRef?: string;
  /**
   * What to put in the form the action opens. Prefill only: a handler applies
   * these to its field state and stops, leaving the user to save.
   */
  values?: ActionValues;
}

interface PendingAction extends ActionRequest {
  /** Distinguishes two identical requests so the second isn't swallowed. */
  token: number;
  requestedAt: number;
}

interface ActionBusValue {
  pending: PendingAction[];
  /** Requests one action, or a batch to be handled in order. */
  request: (action: ActionRequest | ActionRequest[]) => void;
  /** Called by a handler that took the action, clearing it for everyone else. */
  resolve: (token: number) => void;
}

const ActionBusContext = createContext<ActionBusValue | null>(null);

export function ActionBusProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingAction[]>([]);
  const tokenRef = useRef(0);

  const request = useCallback((action: ActionRequest | ActionRequest[]) => {
    const batch = Array.isArray(action) ? action : [action];
    if (batch.length === 0) return;
    const now = Date.now();
    setPending((current) => [
      ...current,
      ...batch.map((a) => ({ ...a, token: ++tokenRef.current, requestedAt: now })),
    ]);
  }, []);

  const resolve = useCallback((token: number) => {
    setPending((current) => current.filter((a) => a.token !== token));
  }, []);

  // Drop requests nobody could take — otherwise one would fire late, on some
  // unrelated page the user has since navigated to. The timer is set from the
  // oldest entry, so a queue expires entry by entry rather than all at once.
  const oldest = pending.length > 0 ? pending[0].requestedAt : null;
  useEffect(() => {
    if (oldest === null) return;
    const id = setTimeout(
      () => setPending((current) => current.filter((a) => Date.now() - a.requestedAt < PENDING_TTL_MS)),
      Math.max(PENDING_TTL_MS - (Date.now() - oldest), 0)
    );
    return () => clearTimeout(id);
  }, [oldest]);

  const value = useMemo(() => ({ pending, request, resolve }), [pending, request, resolve]);

  return <ActionBusContext.Provider value={value}>{children}</ActionBusContext.Provider>;
}

/** Null outside the provider, so a component can be rendered in isolation. */
export function useActionBus(): ActionBusValue | null {
  return useContext(ActionBusContext);
}

/**
 * Handles one action id.
 *
 * `handler` returns true if it performed the action. Returning false means "not
 * yet" — typically the target record isn't loaded — and the bus will offer it
 * again. `readyKey` is what makes that retry happen: pass something that
 * changes when the component's data does (usually `items.length`), and the
 * handler is re-offered the request each time it changes.
 *
 * `values` is whatever the caller wants put in the form this action opens. A
 * handler should apply them to its field state and nothing more — the bus has
 * no concept of saving, and every write in this app stays behind the user's own
 * confirm click.
 *
 * One handler per id, per mounted tree. Two components registering the same id
 * would both run against the same pending entry in one commit — the first one's
 * `resolve` can't cancel an effect that has already been scheduled — so the
 * second would quietly undo the first. Page-scoped ids like `ui.refresh` and
 * `export.csv` are registered once per page, which holds because only one page
 * is mounted at a time.
 */
export function useActionHandler(
  id: string,
  handler: (recordRef?: string, values?: ActionValues) => boolean,
  readyKey: string | number = 0
) {
  const bus = useActionBus();
  const pending = bus?.pending;
  const resolve = bus?.resolve;

  // Read through a ref so an inline handler (a new function every render)
  // doesn't re-run the effect on its own — `pending` and `readyKey` decide that.
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  // Only the first match is offered per pass: two requests for the same id are
  // usually "do this, then that", and running both against one render would
  // leave the component showing only the second.
  const match = pending?.find((a) => a.id === id) ?? null;

  useEffect(() => {
    if (!match || !resolve) return;
    if (handlerRef.current(match.recordRef, match.values)) resolve(match.token);
  }, [match, resolve, readyKey]);
}
