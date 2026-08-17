/**
 * @file smartQuery.ts
 * @description Shared shape of an "Ask AI" result, plus the offline fallback.
 *
 * The interpretation itself happens server-side in `/api/ai-search`, where the
 * model can actually query the system before answering. This module only
 * defines what comes back and what the browser does when that route is
 * unreachable: run the question as an ordinary keyword search, with no answer
 * text — a real row list beats a sentence nobody verified.
 */

export type SmartCategory =
  | "tickets"
  | "spareParts"
  | "customers"
  | "items"
  | "users"
  /** Conversational reply — the UI shows the answer and no record list. */
  | "general";

/** Backend `/technicalservices/search` filters the AI resolved for this question. */
export interface SmartQueryExtras {
  fromDate?: string;
  toDate?: string;
  serviceType?: string;
  serviceLocation?: string;
  userIds?: string[];
  userFilterStatuses?: string[];
  useProcessDateFiltering?: boolean;
  statusesForProcessFiltering?: string[];
}

export interface SmartQueryResult {
  /** The assistant's reply, grounded in the rows it read. Empty when offline. */
  answer: string;
  category: SmartCategory;
  /** Free text for the row query. */
  searchTerm: string;
  /** Status the question was understood to be about — shown as a badge. */
  status: string | null;
  /** Status to pass to `fetchRepairServices`; "All" when filtering via extras. */
  listStatus: string;
  fromDate: string | null;
  toDate: string | null;
  serviceType: string | null;
  serviceLocation: string | null;
  /** Resolved staff member(s), when the question was about a person's work. */
  staffName: string | null;
  extras: SmartQueryExtras;
  /**
   * A page the assistant offers to open, shown as a one-click button under the
   * answer. Already validated server-side against the real menu, so the route
   * is known to exist.
   */
  navigateTo: { route: string; label: string; labelKhmer: string } | null;
  /**
   * The UI actions to perform, in order — opening the same dialogs the
   * on-screen buttons open, switching a tab, filling a form in. Validated
   * server-side against the action registry, so every id corresponds to
   * something a component has registered a handler for, and every field name in
   * `values` is one that action really has.
   *
   * A list rather than a single action because one instruction is routinely
   * several steps ("collapse the menu and start a stock-out for toner"). None
   * of them submits anything: the save, edit and delete clicks stay with the
   * user.
   */
  actions: SmartQueryAction[];
  /** False when no model ran and this is a plain keyword search. */
  grounded: boolean;
}

/** One step the assistant performs in the interface. */
export interface SmartQueryAction {
  id: string;
  label: string;
  labelKhmer: string;
  /** The record it targets — a report number, part name or serial. */
  recordRef: string | null;
  /** Field values to type into the form it opens, if it opens one. */
  values: Record<string, string> | null;
}

/**
 * Why the assistant didn't run, when it didn't. Surfaced so a quota-exhausted
 * search reads as "the AI is rate-limited until X" rather than the misleading
 * "no results found for <your whole question>".
 */
export interface SmartQueryDegraded {
  reason:
    | "quotaExceeded"
    | "unavailable"
    | "notConfigured"
    /**
     * No usable session token. The assistant reads every row with the caller's
     * own credentials, so it declines rather than answering from some other
     * account's view of the data.
     */
    | "notSignedIn"
    /** An image request specifically — the picture models, not the text ones. */
    | "imageQuotaExceeded"
    /**
     * The key's project has *no* free-tier image allowance (a reported limit of
     * zero), so retrying can never succeed. Kept apart from a quota wait
     * because the remedy is billing, not patience.
     */
    | "imageNotOnFreeTier"
    | "imageUnavailable";
  /** Seconds until the provider will accept requests again, when it says. */
  retryAfterSeconds?: number;
  /**
   * `"day"` means the free tier's daily allowance is gone until it rolls over
   * (Pacific midnight), NOT the few seconds the provider's own `retryDelay`
   * claims. `"shortTerm"` is a real, short wait worth counting down.
   */
  quotaScope?: "day" | "shortTerm";
}

/** Offline fallback: search for exactly what the user typed. */
export function parseSmartQuery(question: string): SmartQueryResult {
  return {
    answer: "",
    category: "tickets",
    searchTerm: question.trim(),
    status: null,
    listStatus: "All",
    fromDate: null,
    toDate: null,
    serviceType: null,
    serviceLocation: null,
    staffName: null,
    extras: {},
    navigateTo: null,
    actions: [],
    grounded: false,
  };
}
