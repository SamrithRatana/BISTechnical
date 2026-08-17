---
name: add-api-call
description: Wire a new backend endpoint into the frontend — routing through the proxy, the typed client function in services/api.ts, the response shape, and the right cache invalidation. Use when the user asks to call a new API, add an endpoint, fetch or save data from the backend.
user-invocable: true
---

# add-api-call — wire up a backend endpoint

Every backend call goes browser → Next.js proxy route → external ASP.NET API.
The browser never talks to the backend directly, so "add an endpoint" means
deciding *how it reaches the proxy*, then writing the client function.

Work from `TestingReact/`.

## Step 1 — decide whether you need a route file at all

**Usually not.** `src/app/api/proxy/[...path]/route.ts` is a catch-all that
forwards anything to `{base}/api/{path}`. It already handles GET/POST/PUT/DELETE,
auth header forwarding, a 30s upstream timeout, `api-version`, write tracking,
and SSE broadcast on successful mutations.

Pick the backend with the `service` query param — it is consumed by the proxy
and never forwarded upstream:

| `?service=` | Base URL env var | Default if unset |
|---|---|---|
| *(omitted)* / `technical` | `NEXT_PUBLIC_TECHNICAL_API_URL` | `https://technicalservicesapi.camprotec.com.kh` |
| `customer` | `NEXT_PUBLIC_CUSTOMER_API_URL` | `https://customerapi.camprotec.com.kh` |
| `jwt` | `NEXT_PUBLIC_JWT_API_URL` | `https://user.camprotec.com.kh` |

> Those defaults are **production**. A dev box with no `.env.local` silently
> reads and writes live data. See the `run` skill.

Write a **dedicated route file** (`src/app/api/proxy/<name>/route.ts`) only when
the call needs behaviour the catch-all cannot express — a non-standard payload
transform, or a broadcast the generic path inference would get wrong.
`inspectitem` and `finishedrepair` are the two that exist, and both carry a
warning worth heeding:

- A dedicated route **bypasses the generic proxy**, so it loses the automatic
  `broadcast()` and `beginWrite()` calls. Both had to be re-added by hand.
  Without the broadcast, an accepted inspection lingered on every other user's
  queue until their next poll. Without `beginWrite`, the save was invisible to
  the deploy-safety check — and a restart mid-save loses a technician's entire
  diagnosis.

If you add one, copy `inspectitem/route.ts` wholesale, including
`UPSTREAM_TIMEOUT_MS`, `forwardHeaders`, the `broadcast(...)` call and the
`beginWrite(...)` / `finally { endWrite() }` pair.

### Broadcast inference (catch-all only)

After a successful mutation the catch-all infers what changed from the path, so
subscribers only refresh for events they care about. Check
`inferStatusFromPath` / `inferResourceFromPath` — if your new path does not
match any rule, the event defaults to resource `"ticket"`. Add a rule if that is
wrong. Order matters there: several ticket endpoints contain the substring
`sparepart` (`awaitingsparepart`, `sentspareparts`) but act on a *ticket*, so
the status match deliberately wins before the prefix check.

## Step 2 — the client function

All of it lives in `src/services/api.ts`. Follow the shape of its neighbours.

**Reads** — wrap in `cachedFetch`, catch to a mock:

```ts
export async function fetchWidgets(
  pageNumber = 1,
  pageSize   = 10,
  searchTerm = ""
): Promise<PaginatedResult<Widget>> {
  const cacheKey = `widgets:page${pageNumber}:size${pageSize}:search${searchTerm}`;
  return cachedFetch(cacheKey, async () => {
    try {
      const params = new URLSearchParams({
        pageNumber: pageNumber.toString(),
        pageSize:   pageSize.toString(),
      });
      if (searchTerm) params.set("searchTerm", searchTerm);
      const endpoint = searchTerm ? "/api/proxy/widgets/search" : "/api/proxy/widgets";

      const res = await fetch(`${endpoint}?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Record<string, unknown>;

      // Normalise mixed PascalCase / camelCase keys returned by the API
      const rawList = (data.items ?? data.Data ?? (Array.isArray(data) ? data : [])) as Record<string, unknown>[];
      const items: Widget[] = rawList.map((w) => ({
        id:       String(w.id ?? ""),
        itemName: String(w.itemName ?? w.ItemName ?? w.name ?? ""),
        quantity: Number(w.quantity ?? w.Quantity ?? 0),
      }));

      const total = (data.totalCount ?? data.TotalCount ?? items.length) as number;
      return { items, totalCount: total, pageNumber, pageSize,
               totalPages: Math.max(Math.ceil(total / pageSize), 1) };
    } catch {
      return { items: MOCK_WIDGETS, totalCount: MOCK_WIDGETS.length, pageNumber,
               pageSize, totalPages: 1 };
    }
  });
}
```

Three things that are not decoration:

- **The PascalCase/camelCase fallback chain is required.** The upstream APIs
  return both casings depending on endpoint. `String(x ?? y ?? "")` /
  `Number(x ?? y ?? 0)` is the house style — it also coerces nulls.
- **The mock fallback goes in the `catch`**, from `./mockData`. When it filters,
  mirror the server's search fields so offline behaviour matches rather than
  ignoring the term and showing everything.
- **Skip `cachedFetch` when the caller needs live state.** `fetchServiceById` is
  deliberately uncached because the edit form must not open on a stale row.

**Writes** — invalidate *first*, then fire:

```ts
export async function createWidget(widget: Widget): Promise<boolean> {
  invalidateCachePrefix("widgets");
  try {
    const res = await fetch("/api/proxy/widgets", {
      method:  "POST",
      headers: getAuthHeaders(),
      body:    JSON.stringify(payload),
    });
    return res.ok;
  } catch (err: unknown) {
    console.error("Failed to create widget:", err);
    return false;
  }
}
```

## Step 3 — invalidate the right prefixes

Cache keys are `"<prefix>:..."` and `invalidateCachePrefix` clears by prefix.
Existing prefixes: `repairservices`, `dashboard`, `spareparts`, `customers`,
`widgets`-style per-resource names.

A **ticket mutation must invalidate both `repairservices` and `dashboard`** —
the stat tiles are derived from the same rows, and clearing only one leaves the
tiles contradicting the table underneath them. Every ticket-writing function in
`api.ts` does both; match that.

## Step 4 — types

Request/response shapes go in `src/services/types.ts`, not inline in `api.ts`.
`api.ts` re-exports them. That file holds no fetch calls — keep it that way.

If you send a **date**, use `toBackendLocalDateTime(date)` from `types.ts`, not
`toISOString()`. The backend stores unmarked local Phnom Penh wall-clock
(`YYYY-MM-DDTHH:MM:SS`, UTC+7, no timezone suffix); an ISO string shifts every
timestamp by seven hours.

## Step 5 — auth

`getAuthHeaders()` adds `Content-Type` plus the bearer token from
`localStorage.jwt_token`, and is SSR-safe (returns base headers on the server).
Always use it. Never read `localStorage` directly in a new call.

## Verify

```bash
npx tsc --noEmit
npm run lint
```

Then exercise the call in the browser and watch the dev server log — the proxy
prints `📡 [Proxy GET] → <url>` in development only, which is the fastest way to
confirm the path and base URL resolved the way you expected.
