/**
 * @file lib/withTimeout.ts
 * @description Puts an upper bound on a wait, so nothing in the UI can hang
 * forever.
 *
 * ── Why this is needed at all ──────────────────────────────────────────────
 *
 * `fetch` has no default timeout. A request to a host that accepts the
 * connection and then goes silent — a proxy holding it open, a laptop that
 * moved between wifi networks mid-request, a backend deadlocked on a query —
 * never rejects. The promise simply never settles, so `finally { setLoading
 * (false) }` never runs and the spinner turns until the user reloads the page.
 * That is precisely the "stuck state that needs a refresh" this app is not
 * supposed to have.
 *
 * ── What `timeoutAfter` does and does not do ───────────────────────────────
 *
 * It bounds the **wait**, not the request. Racing a promise cannot cancel the
 * work behind it: the underlying `fetch` keeps running until the browser gives
 * up on it, and its response is discarded. That is a deliberate trade, because
 * the alternative — threading an `AbortSignal` through all 26 call sites in
 * `services/api.ts` — is a far larger change for the same user-visible result.
 *
 * Where a real abort IS available, use `fetchWithTimeout` instead: it wires an
 * `AbortController` so the request is genuinely cancelled and the connection
 * released.
 */

/** Thrown when a wait is abandoned. Distinguishable from a network failure. */
export class TimeoutError extends Error {
  constructor(public readonly ms: number, label?: string) {
    super(label ? `${label} timed out after ${ms}ms` : `Timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

export function isTimeoutError(err: unknown): err is TimeoutError {
  return err instanceof TimeoutError || (err as Error | null)?.name === "TimeoutError";
}

/**
 * Rejects with `TimeoutError` if `promise` has not settled within `ms`.
 *
 * The timer is always cleared, including on the success path — an uncleared
 * `setTimeout` per request would keep the whole closure alive for its full
 * duration, which on a busy queue page is a slow leak rather than a bug you
 * would ever notice directly.
 */
export function timeoutAfter<T>(promise: Promise<T>, ms: number, label?: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms, label)), ms);
  });
  return Promise.race([promise, guard]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  }) as Promise<T>;
}

/**
 * `fetch` that genuinely aborts when it runs long.
 *
 * Prefer this over `timeoutAfter(fetch(...))` wherever the call site can be
 * changed: aborting frees the connection instead of leaving it to run to
 * completion against a response nobody will read.
 *
 * An external `signal` is honoured as well as the timeout — whichever fires
 * first wins — so a component that already aborts on unmount keeps doing so.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number; label?: string } = {}
): Promise<Response> {
  const { timeoutMs = 20_000, label, signal: external, ...rest } = init;
  const controller = new AbortController();

  const onExternalAbort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener("abort", onExternalAbort, { once: true });
  }

  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } catch (err) {
    // An abort raised by our own timer is a timeout; an abort raised by the
    // caller's signal is a cancellation and must stay one, or a component
    // unmounting mid-request would report a spurious "timed out" to Sentry.
    if ((err as Error)?.name === "AbortError" && !external?.aborted) {
      throw new TimeoutError(timeoutMs, label);
    }
    throw err;
  } finally {
    clearTimeout(timer);
    external?.removeEventListener("abort", onExternalAbort);
  }
}

/**
 * `fetchWithTimeout` plus a bounded retry, for reads that are safe to repeat.
 *
 * ── What it retries, and what it deliberately does not ─────────────────────
 *
 * **Only idempotent methods.** GET and HEAD (and a missing `method`, which is
 * GET) are retried; everything else passes straight through with zero retries.
 * That check lives here rather than at the call site on purpose: `services/
 * api.ts` has 28 call sites, 10 of them mutations, and a retry on a POST that
 * actually reached the server is a duplicate ticket or a double stock-out. The
 * function refuses rather than trusting each caller to remember.
 *
 * **Only failures that a second attempt can plausibly fix**: a network-level
 * error, and 5xx / 429 responses. A 4xx other than 429 is the caller's own
 * request being wrong — repeating it produces the same 4xx and just delays the
 * error the UI needs to show.
 *
 * **Never after the caller aborted.** A component unmounting mid-request must
 * not have its request resurrected by a retry.
 *
 * ── Why the budget is small ────────────────────────────────────────────────
 *
 * `cachedFetch` in `services/api.ts` wraps reads in a 30s `timeoutAfter`
 * backstop that RETHROWS rather than falling back to `mockData`. Retries must
 * therefore fit comfortably inside it, or the retry itself would turn a
 * recoverable read into a hard error — the opposite of the point.
 *
 * The consequence is deliberate: with the default 20s per-attempt timeout, a
 * request that TIMES OUT has already spent the budget and is not retried. Only
 * *fast* failures — connection refused, a 502 from a restarting proxy, a 429 —
 * retry. That is the right split anyway: a user who has already waited 20s is
 * not helped by silently waiting 20 more.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit & {
    timeoutMs?: number;
    label?: string;
    /** Extra attempts after the first. Default 2, so 3 attempts at most. */
    retries?: number;
    /** Total wall-clock ceiling across all attempts, including backoff. */
    retryBudgetMs?: number;
  } = {}
): Promise<Response> {
  const { retries = 2, retryBudgetMs = 25_000, ...fetchInit } = init;

  const method = (fetchInit.method ?? "GET").toUpperCase();
  const idempotent = method === "GET" || method === "HEAD";
  const maxAttempts = idempotent ? retries + 1 : 1;

  const startedAt = Date.now();
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetchWithTimeout(input, fetchInit);

      // 5xx and 429 are worth another go; every other status is final, including
      // the 4xx family — returned as-is so `if (!res.ok)` at the call site still
      // sees exactly what the server said.
      const worthRetrying = res.status >= 500 || res.status === 429;
      if (!worthRetrying || attempt === maxAttempts) return res;

      const wait = backoffDelay(attempt, res.headers.get("Retry-After"));
      if (Date.now() - startedAt + wait >= retryBudgetMs) return res;
      await sleep(wait);
    } catch (err) {
      lastError = err;

      // The caller cancelled — not a failure to retry, and not ours to swallow.
      if ((fetchInit.signal as AbortSignal | undefined)?.aborted) throw err;

      if (attempt === maxAttempts) throw err;

      const wait = backoffDelay(attempt, null);
      if (Date.now() - startedAt + wait >= retryBudgetMs) throw err;
      await sleep(wait);
    }
  }

  // Unreachable: the loop either returns or throws on its final attempt.
  throw lastError;
}

/**
 * Exponential backoff with jitter, honouring `Retry-After` when the server
 * sends one.
 *
 * The jitter matters more than the curve here: without it, every table on a
 * page that failed together retries in the same millisecond and hits the
 * recovering backend as one synchronised wave.
 */
function backoffDelay(attempt: number, retryAfter: string | null): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    // `Retry-After` is either delta-seconds or an HTTP date; only the numeric
    // form is worth honouring, and only when it is short enough to wait out.
    if (Number.isFinite(seconds) && seconds > 0 && seconds <= 10) {
      return seconds * 1_000;
    }
  }
  const base = 300 * 2 ** (attempt - 1); // 300ms, 600ms, 1200ms, …
  return base + Math.random() * 200;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
