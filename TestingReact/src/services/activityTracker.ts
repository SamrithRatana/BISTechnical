/**
 * @file activityTracker.ts
 * @description Answers "is anyone using this right now?" so a deploy or a
 * maintenance restart doesn't land in the middle of someone's work.
 *
 * The failure this exists to prevent: restarting the API while a technician is
 * halfway through saving an inspection. The write fails, their unsaved form is
 * gone, and nothing in the system ever said the moment was a bad one.
 *
 * Three signals, in increasing order of how much they should stop you:
 * - **Active sessions** — browsers holding the SSE stream open. Someone has a
 *   queue on screen. They may be idle, but they are there.
 * - **Seconds since the last write** — someone recently changed data, so they
 *   are working, not just watching.
 * - **In-flight writes** — a mutation is executing *right now*. Restarting
 *   during one is how a half-applied change happens.
 *
 * ## Scope, and why it matters
 *
 * State lives in this Node process's memory, exactly like `eventBus`. With more
 * than one instance behind a load balancer these counts describe **only the
 * instance that answered**, so a quiet reading is not proof the system is
 * quiet. The same Redis Pub/Sub swap that `eventBus` needs would fix both.
 * Until then, treat "safe" as "safe on this instance".
 */

import { subscriberCount } from "./eventBus";

/** Mutations currently executing. */
let inFlightWrites = 0;

/** When the last mutation *completed*, as an epoch ms timestamp. */
let lastWriteAt: number | null = null;

/** Which endpoint that was — enough to tell "a save" from "a status flip". */
let lastWritePath: string | null = null;

/** Mutations completed since this process started. Purely informational. */
let totalWrites = 0;

/** When any request last passed through, write or read, as epoch ms. */
let lastRequestAt: number | null = null;

/** Requests seen since this process started. */
let totalRequests = 0;

/**
 * How long the system must be write-free before it counts as quiet.
 *
 * Two minutes rather than a few seconds: staff type into inspection and
 * customer-request fields for a while between saves, so a 10-second gap means
 * nothing. Two minutes without a write, with nobody connected, is a genuine
 * lull.
 */
const QUIET_PERIOD_MS = 120_000;

export interface ActivitySnapshot {
  /** Browsers holding the SSE stream open on this instance. */
  activeSessions: number;
  /** Mutations executing right now. */
  inFlightWrites: number;
  /** ISO timestamp of the last completed mutation, or null if none yet. */
  lastWriteAt: string | null;
  /** Seconds since that write; null when there has been none. */
  secondsSinceLastWrite: number | null;
  /** The endpoint of that last write. */
  lastWritePath: string | null;
  /** Mutations completed since this process started. */
  totalWrites: number;
  /**
   * Seconds since *any* request — read or write. Catches a user who is working
   * on a page that holds no SSE stream, so "nobody is here" is not inferred
   * from session count alone.
   */
  secondsSinceLastRequest: number | null;
  /** Requests seen since this process started. */
  totalRequests: number;
  /** Seconds a process must be write-free to count as quiet. */
  quietPeriodSeconds: number;
  /** Whether it looks safe to restart or deploy right now. */
  safeToDeploy: boolean;
  /**
   * Machine-readable reasons it is *not* safe. Empty when it is.
   * The caller turns these into translated sentences.
   */
  blockers: Array<"activeSessions" | "inFlightWrites" | "recentWrite">;
  /** How long this process has been up, in seconds. */
  uptimeSeconds: number;
}

/**
 * Records the start of a mutation. Call the returned function when it settles,
 * whether it succeeded or failed — an abandoned counter would pin the system
 * at "busy" forever and make the indicator useless.
 */
export function beginWrite(path: string): () => void {
  inFlightWrites++;
  recordRequest();
  let ended = false;

  return () => {
    if (ended) return; // guard against a double call double-decrementing
    ended = true;
    inFlightWrites = Math.max(0, inFlightWrites - 1);
    lastWriteAt = Date.now();
    lastWritePath = path;
    totalWrites++;
  };
}

/**
 * Records a non-mutating request — a read, a search, a login.
 *
 * Deliberately does not block a deploy on its own: someone reading a queue
 * loses nothing to a restart, unlike someone mid-save. It exists so idle
 * detection doesn't rest solely on the SSE session count, which only pages
 * mounting `ServiceTable` open — a user sitting on Users or Settings would
 * otherwise be invisible.
 *
 * **Do not call this from `/api/health` or `/api/system-activity`.** Every open
 * browser polls health every 30 seconds, so counting those would keep
 * "last request" permanently fresh and the system permanently non-idle —
 * the indicator would be measuring itself.
 */
export function recordRequest(): void {
  lastRequestAt = Date.now();
  totalRequests++;
}

/** Current activity, computed fresh on every call. */
export function getActivity(): ActivitySnapshot {
  const activeSessions = subscriberCount();
  const msSinceLastWrite = lastWriteAt === null ? null : Date.now() - lastWriteAt;

  const blockers: ActivitySnapshot["blockers"] = [];
  if (activeSessions > 0) blockers.push("activeSessions");
  if (inFlightWrites > 0) blockers.push("inFlightWrites");
  if (msSinceLastWrite !== null && msSinceLastWrite < QUIET_PERIOD_MS) {
    blockers.push("recentWrite");
  }

  return {
    activeSessions,
    inFlightWrites,
    lastWriteAt: lastWriteAt === null ? null : new Date(lastWriteAt).toISOString(),
    secondsSinceLastWrite: msSinceLastWrite === null ? null : Math.floor(msSinceLastWrite / 1000),
    lastWritePath,
    totalWrites,
    secondsSinceLastRequest:
      lastRequestAt === null ? null : Math.floor((Date.now() - lastRequestAt) / 1000),
    totalRequests,
    quietPeriodSeconds: QUIET_PERIOD_MS / 1000,
    safeToDeploy: blockers.length === 0,
    blockers,
    uptimeSeconds: Math.floor(process.uptime()),
  };
}
