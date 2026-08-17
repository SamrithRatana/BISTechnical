---
name: verify-ui
description: Drive the running frontend in a real browser to confirm a change works — getting past AuthGuard, avoiding the mock-data trap, and measuring animations and SSE connections correctly. Use when verifying, screenshotting, or debugging frontend behaviour rather than reasoning about it from the code.
user-invocable: true
---

# verify-ui — check it in a real browser

The project convention is *"Verify in a real browser, not by assertion."* This
is how, plus the four traps that make a browser check report the wrong answer
confidently.

Needs the dev server up — see the `run` skill. Assume **http://localhost:3000**.

## Getting past AuthGuard

Every route except `/login` is gated. Seed `localStorage` **before** first paint
— `AuthGuard` reads the token during render via `useSyncExternalStore`, not in
an on-mount effect, so setting it after load leaves you on the login screen.

**For ordinary pages**, any non-empty string works:

```js
localStorage.setItem("jwt_token", "dev-verification-token");
```

A token that does not parse as three JWT segments has no readable `exp`, and
`isTokenExpired` deliberately treats an unreadable expiry as *valid* — some
issuers omit `exp`, and the API is the real authority. So the malformed string
passes.

What does **not** pass is a well-formed JWT whose `exp` has gone by. If you are
reusing a captured real token, it expires — including a 30s early leeway — and
you get bounced with no obvious explanation. Mint a fresh one instead:

```js
const b64 = (o) => btoa(JSON.stringify(o))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const exp = Math.floor(Date.now() / 1000) + 8 * 3600;
localStorage.setItem("jwt_token",
  `${b64({ alg: "none", typ: "JWT" })}.${b64({ exp, role: ["Admin"] })}.sig`);
```

The signature is never checked client-side — decoding is base64url, not
verification. Include `role` only when you need it: `/users` and the role
administration screens gate on `Admin` / `SuperAdmin`, read from **both** the
JWT claims and `localStorage.user_info`.

Set `localStorage.lang = "km"` to verify the Khmer side.

## Trap 1 — you may be looking at mock data

This is the big one. Every read in `services/api.ts` catches its own errors and
returns a fallback dataset from `mockData.ts`:

```ts
} catch {
  return { items: MOCK_SPARE_PARTS, ... };
}
```

So a backend that is down, or one that rejects your fake bearer token, produces
a **fully populated, entirely plausible table** rather than an error. You can
verify a change against `MOCK_SERVICE_TICKETS` and conclude it works.

Confirm which you are seeing before trusting anything:

- Watch the dev server log — the proxy prints `📡 [Proxy GET] → <url>` in
  development. No line means the call never left, or you are reading cache.
- Check the network panel for a non-200 from `/api/proxy/...`.
- Cross-check a row against `src/services/mockData.ts`. Those datasets are
  small and fixed; real data is not.

Note the layer below it too: `api.ts` has a 3-minute SWR cache backed by
`sessionStorage`, which survives a reload. If a change should alter fetched
data and does not appear, clear it before concluding the code is wrong:

```js
sessionStorage.clear();
```

## Trap 2 — sampling animations at a fixed delay

Sampling `getAnimations()` after a set timeout misses route animations entirely
in dev, because the first navigation to a route waits on compilation and the
animation starts long after your sample. It reports "no animation" for a page
that animates fine.

Listen for the event instead:

```js
document.addEventListener("animationstart", (e) =>
  console.log("[anim]", e.animationName, e.target.className), true);
```

Read it back with the console-reading tool. Also remember a CSS animation does
**not** replay on a reused DOM node — that is why `PageTransition` is keyed on
`pathname`, and it is the first thing to check if a route animation silently
stops happening.

## Trap 3 — counting SSE connections in the browser

Counting EventSource requests client-side over-reports: reconnects and
navigations each show up, so one shared connection looks like several. The app
multiplexes **one** `EventSource("/api/events")` per tab at module scope.

Ask the server what it actually holds:

```bash
curl -s http://localhost:3000/api/system-activity
```

and read `activeSessions`. The dashboard should show 1, stable across
navigation, 0 shortly after the tab closes.

## Trap 4 — horizontal overflow

If the whole document scrolls sideways instead of an inner table, the cause is
almost always a flex item missing `min-w-0`. Without it the item refuses to
shrink below its content, and `overflow-x-auto` on the inner scroller is
ignored. Check the flex ancestors, not the scroller.

## Tooling

The `claude-in-chrome` MCP tools drive the user's real Chrome. Load them in one
`ToolSearch` call, then call `tabs_context_mcp` first and open a **new** tab
rather than reusing one of theirs.

To seed the token before first paint, create the tab on `/login` (ungated), run
the `localStorage` snippet with `javascript_tool`, then navigate to the target
route.

Playwright driving the system Chrome (`channel: "chrome"`) also works on this
machine and is the better option when you need a repeatable script with an init
script that runs pre-paint. It is not in `TestingReact/package.json` — treat it
as an ad-hoc tool, not a project dependency, and do not add it to
`package.json` as a side effect of a verification task.

**Never trigger `alert`/`confirm`/`prompt`.** They block the extension
completely. This app has delete confirmations — prefer verifying the dialog
opens over clicking through it.

## Reporting

Say what you observed and how you established it, including which data source
you were on. "Rows rendered" is not a result if they came from `mockData`.
