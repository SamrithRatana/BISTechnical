# Project Structure

Root: C:\Users\DELL\Desktop\Cloudflare-image\Cloudflare-image\ServiceMaintenanceApplication\ServiceMaintenanceApplication

This repo has two parts:

## Backend (.NET, old full-stack)

- Path: ./src
- Layout:
  - src/APIs    - API projects
  - src/Apps    - application layer (Old UI Blazor C#)
  - src/Core    - core/domain logic
  - src/Shared  - shared utilities/libraries
- Solution file: ServiceMaintenanceApplication.sln (repo root)

## Frontend (Next.js UI)

- Path: ./TestingReact
- This is the current UI.
- Has its own CLAUDE.md and AGENTS.md at TestingReact/ - these load
  automatically when working inside that folder. Don't duplicate
  their content here.
- package.json confirmed at TestingReact/package.json

# How to Run

## Frontend (Next.js)

```
cd TestingReact
npm install
npm run dev
```
Serves at http://localhost:3000.

## Backend (.NET)

```
dotnet restore ServiceMaintenanceApplication.sln
dotnet build ServiceMaintenanceApplication.sln
```
Each project under src/APIs and src/Apps/ServiceMaintenance can also be run
individually with `dotnet run --project <path-to-csproj>`. Every API/App
needs its own `appsettings.json` populated first - see below.

# GitHub

- Remote: https://github.com/SamrithRatana/bistechnical
- Default branch: main

# Continuing Development on a New PC

Follow this once per new machine to pick up exactly where you left off,
with Claude Code working the same way it does here.

1. **Install prerequisites**
   - Git for Windows (includes Git Bash + Git Credential Manager)
   - .NET 8 SDK (for the backend under ./src)
   - Node.js (LTS) (for TestingReact)
   - Claude Code CLI, signed in to the same account

2. **Clone the repo**
   ```
   git clone https://github.com/SamrithRatana/bistechnical.git
   cd bistechnical
   ```
   Git Credential Manager will open a browser sign-in the first time it
   needs GitHub auth.

3. **Restore the secret config files** - these are intentionally
   gitignored (never pushed to GitHub) and won't exist after a fresh
   clone. Copy each `*.example` file, drop the `.example` suffix, and
   fill in the real values (ask whoever holds them, or check a
   password manager - they are never in git history):
   - `.env.example` -> `.env` (repo root: RabbitMQ, JWT, DB, Redis, SMTP)
   - `TestingReact/.env.local.example` -> `TestingReact/.env.local` (includes
     `R2_*` — the Cloudflare R2 credentials `api/upload/route.ts` uses for
     every image upload in the app. Same account the old Blazor UI's
     `R2StorageConfig.cs` already uses; that file's key is plaintext in git —
     see the "UI Redesign" section below before treating it as safe to reuse
     without rotating.)
   - `src/APIs/UserManagementAPI/appsettings.json.example` -> `appsettings.json`
   - `src/APIs/TechnicalService.API/appsettings.json.example` -> `appsettings.json`
   - `src/APIs/EmployeeManagement.Api/appsettings.json.example` -> `appsettings.json`
   - `src/Apps/ServiceMaintenance/appsettings.json.example` -> `appsettings.json`

   Also not in git (regenerated automatically, no action needed unless
   something breaks): ASP.NET Data Protection keys under
   `dataprotection-keys/` folders and `src/Apps/ServiceMaintenance/keys/`.

4. **Install dependencies and run** - see "How to Run" above.

5. **Open the folder in Claude Code** - `CLAUDE.md` (this file) and the
   nested `TestingReact/CLAUDE.md` load automatically, so Claude Code
   has the same project context as on any other machine.

6. **Keep it in sync** - `git pull` before starting work, `git push`
   after committing, on every machine you use.

# Rolling Back a Bad Change

Use this whenever a new change breaks something and you want back to a
known-good state, without needing to redo work from scratch.

- **See what happened**
  ```
  git log --oneline -20      # recent history, one line per commit
  git status                 # what's currently changed/uncommitted
  git diff                   # uncommitted changes, in detail
  ```

- **Uncommitted changes went wrong (nothing committed yet)**
  ```
  git restore <file>         # discard changes to one file
  git restore .              # discard ALL uncommitted changes
  ```

- **Want to pause half-finished work instead of discarding it**
  ```
  git stash                  # shelve current changes
  git stash pop              # bring them back later
  ```

- **Already committed, but the last commit(s) are bad and NOT pushed
  yet** (check with `git log` vs `git log origin/main`)
  ```
  git reset --hard HEAD~1    # drop the last commit entirely
  git reset --soft HEAD~1    # undo the commit, keep the changes staged
  ```

- **Already pushed to GitHub, or other people/machines might have
  pulled it** - don't rewrite shared history. Add a new commit that
  undoes the bad one instead:
  ```
  git revert <bad-commit-hash>
  git push
  ```

- **Just want to look at (not switch to) an old version to compare**
  ```
  git log --oneline           # find the commit hash you want
  git show <commit-hash>:<path/to/file>   # view that file as of that commit
  ```

- **Before trying something risky** - branch first, so `main` is
  always safe to fall back to:
  ```
  git checkout -b experiment-name
  # ...make risky changes, test them...
  # if it works: git checkout main && git merge experiment-name
  # if it fails: git checkout main   (experiment-name still exists, untouched)
  ```

General rule: never `git push --force` to `main` unless you're certain
no one else (including you, on another PC) has pulled the commits
you're rewriting.

# UI Redesign — "Aura Velvet" (OS 3.2)

Frontend-wide redesign of `./TestingReact`. Component-level detail lives in
`TestingReact/src/components/CLAUDE.md` (the `av/` section) — not repeated here.
Reference implementation is the separate `aura-soft-ui` demo app (port 3001).

## What changed

- **Design tokens** — all colour/elevation/radius/motion defined once in
  `TestingReact/src/app/globals.css` as `--av-*`, bridged into Tailwind via
  `@theme inline` as semantic utilities (`bg-surface`, `text-ink-secondary`,
  `border-subtle`, `bg-success-soft`, …).
- **Old design system deleted** — 7 presets, 6 accents and the dark palette.
  3,028 hardcoded palette utilities → 0; 1,104 dead `dark:` utilities → 0.
  *(The "→ 0" was aspirational for two years: 34 survived the original sweep —
  coloured shadow tints like `shadow-emerald-500/20` paired with an already
  migrated `bg-accent`, `divide-slate-100`, `placeholder-slate-400`. Retired
  since; it now genuinely measures 0. Re-measure, don't trust the number.)*
- **New component library** at `src/components/av/`: Card, Badge, ProgressBar,
  ToggleGroup, Sparkline, KpiCard, ChartPanel, AreaChart, **Skeleton,
  EmptyState, ErrorState, ConfirmDialog**.
- **Route-change animation** — `PageTransition` keyed on pathname.
- **Dark mode** — `.dark` token overrides, header `ThemeToggle`
  (light/dark/system), pre-paint via `ThemeScript`, 200ms cross-fade.
- **Row virtualization** — spare-parts table via `@tanstack/react-virtual`.
- **Shared SSE connection** — `useRealtimeTickets` multiplexes one EventSource
  per tab instead of one per call site.
- **Responsive drawer** — sidebar is off-canvas below `lg`, icon rail above.

## Key decisions (and why)

- **Dark mode was removed, then rebuilt properly.** ~~Light-only.~~ The
  original removal was correct *at the time*: the palette had been deleted
  while `ThemeScript` still stamped `.dark` by the clock, so the app rendered
  half-broken every evening. It is now back as **token overrides only** — a
  `.dark { --av-* }` block in `globals.css`. No component changes colour,
  because none names one. **The clock-based `auto` mode is NOT back and must
  not come back** — `system` covers the real want and the OS keeps it correct;
  a second scheduler that can disagree with the OS is the exact failure mode
  that broke this before. See `ModeName` in `theme/themeConfig.ts`.
- **`useTheme()` carries ergonomics *and* colour mode** — radius, density,
  font scale, motion, plus `mode` (`light`/`dark`/`system`) and a resolved
  `isDark`. (It briefly carried ergonomics only, between the removal and the
  rebuild.)
- **Accent colour is back as a real preference.** ~~"colour is no longer a
  user preference"~~ — that line is still in `theme/themeConfig.ts`'s and
  `app/settings/page.tsx`'s header comments as history, but it stopped being
  true when Settings → Theme & Branding shipped: curated swatches, a custom
  hex picker, and a colour suggested from the user's profile photo (via
  `lib/dominantColor.ts`'s canvas pixel sampling), all applying live. This
  does NOT reopen the multi-preset system — there is still exactly one design
  system. `ThemePrefs.accentColor` (`null` = Aura Velvet's own accent) is one
  override on top of it: `theme/accentPalette.ts` derives all 8
  `--av-accent-*` tokens from the one hex a user picks, and `ThemeProvider`
  writes them as an inline style on `<html>`, which is why a light/dark
  toggle and a custom accent don't fight each other. `surfaceStyle`
  (`cushion`/`glass`/`flat`, in the same prefs object) is the other new
  preference — see `Card.tsx`'s `--av-card-*` tokens.
- **Status colours were MAPPED, not collapsed** — emerald→success,
  rose→danger, amber→warning, blue/teal/cyan→info. They encode ticket state;
  making everything accent-green would have destroyed meaning. `teal`→`info`
  on purpose: beside an emerald accent, a teal "done" chip and a green
  "selected" row stop being distinguishable.
- **No fabricated metrics.** The old KPI cards showed hardcoded `"+100%"` /
  `"23.5% vs last month"` that never changed with the data. Trends/sparklines
  are now computed from real ticket dates, and are OMITTED when the comparison
  window is empty (a rise from zero has no percentage).
- **framer-motion 13.1.0, not CSS transitions.** ~~CSS only, no dependency.~~
  Reversed deliberately: a CSS keyframe can only animate an element that
  EXISTS, so the outgoing page had no exit animation available to it and
  vanished in one frame. Shared constants live in `src/lib/animations.ts` —
  timing and easing are defined once, never inline. `motion` (the successor
  package) is deliberately NOT installed alongside it: two copies of the same
  engine ship to the browser and `layoutId` will not match across them.
- **View Transitions API: tried, reverted.** `<ViewTransition>` exists in the
  canary React that Next 16.3 vendors and the bundled docs say it works with no
  config, but the router never activates it — `onEnter`/`onExit`/`onShare`/
  `onUpdate` never fire and `document.startViewTransition` is never called;
  `experimental.viewTransition` is not a valid key in this release. Re-check on
  a future Next upgrade; `PageTransition` is the single file to change.

## Motion, performance and the audits (later session)

- **Route exit is imperative, not `<AnimatePresence>`.** In the App Router
  every route is a distinct component, so React destroys `PageWrapper` — and
  any AnimatePresence inside it — before it could animate anything. Measured:
  stage opacity went `1.000 → 0.104` with no descent. `useAnimatedNavigate`
  plays the exit on the live stage. Only sidebar navigations animate out;
  browser back/forward and header-search jumps do not. Fixing that needs
  Sidebar+Header moved into a real shared layout.
- **The push is NOT chained off the exit animation** — it used to be
  (`animate(...).then(() => router.push(href))`) and that was two bugs, both
  fixed 2026-08-18. (1) It serialised the next route's *render* behind the
  fade, so every ms the route cost was spent on a blank stage under the OLD
  url: measured on a production build, 487ms blank unthrottled, 1,786ms at
  600ms latency. The sidebar links are `<Link>`s and were already prefetched —
  that half-second is React rendering a heavy route, so it cannot be
  prefetched away, only overlapped. (2) A cancelled framer animation's
  `finished` promise **never settles** (`JSAnimation.cancel()` tears down
  without `notifyFinished()`; `GroupAnimation.finished` is a `Promise.all` over
  those, carrying an explicit `TODO: Filter out cancelled or stopped
  animations`) — so an interrupted exit dropped the navigation permanently,
  stranding the stage at opacity 0 with no timeout and no recovery. Now
  `startTransition(() => router.push(href))` fires FIRST and the exit plays
  over the top; the animation can no longer prevent a navigation. Measured
  after: url changes at 109ms instead of 725ms, blank 487ms → 44ms, and 40
  randomised rapid clicks produced 0 stuck states.
- **There is no `loading.tsx` anywhere in `app/`**, so during a pending
  transition React keeps rendering the OUTGOING page — the one being faded to
  invisible. `Sidebar` renders a `role="progressbar"` top bar off the
  transition's `isNavigating` to cover that window. It is deliberately not
  shown for fast navigations (they commit before it can mount), so it never
  flashes.
- **Sidebar pill travels** via shared `layoutId`, and moves on click via an
  optimistic `pendingHref` — deriving "active" from `pathname` alone left the
  menu unresponsive for the whole ~230ms exit.
- **Sidebar collapse lives in a module store, not `useState`.** `PageWrapper`
  is rendered by each of the 25 pages rather than by a shared layout, so React
  unmounts it on navigation and a `useState(true)` went with it: collapse the
  rail on `/spareparts` (256px → 80px), navigate, and it was 256px again.
  `services/sidebarPreference.ts` holds it at module scope and persists it,
  read through `useSyncExternalStore` like the token and the language.
  - **It does not flash on reload**, and that is load-bearing rather than
    lucky: `useSyncExternalStore` would normally render `getServerSnapshot()`
    first and reconcile after hydration, which on this aside
    (`transition-[width,transform] duration-300`) is a visible slide. It does
    not happen because `AuthGuard` renders the "verifying" screen on the
    server, so the sidebar is never in the server HTML and its first render is
    client-side. Verified: 24 consecutive width samples after reload, all 80px.
    **Moving the shell into a real layout above `AuthGuard` would make the
    flash live** — that is what `readSidebarOpenOnServer` is there for.
  - **The write is gated on `(min-width: 1024px)`.** Below `lg` the same
    boolean is a transient drawer, closed by three separate paths (mount
    default, scrim, navigating). Persisting any of those would have silently
    collapsed the rail on the user's desktop. Verified: a phone opening and
    closing the drawer leaves `sidebar_open` unset.
- **Virtualization: spacer rows, not absolute positioning.** Absolutely
  positioned rows leave table layout and every column collapses. Real rows
  stay in flow; two empty `<tr>` hold the space. Requires **uniform row
  height** — verified 225 spare-part rows at exactly 96px before adopting it.
- **Memoise the row, or virtualization makes scrolling worse.** Windowing
  alone regressed scroll to 16.3% of frames >32ms, because all ~22 windowed
  rows re-rendered every scroll frame. Memoised `PartRow` + `useCallback`
  handlers taking the part as an **argument** (a closure is a new identity
  per render and silently defeats `memo`) → 3.7% @1200px/s, 0% @8400px/s.
- **Numbers, fully loaded (665 rows):** 129,556 → 15,499 DOM nodes; 224 →
  43.6 MB heap; 447 → 106ms blocking on navigation.
- **Bugs found only by measuring:** `.av-glass` hardcoded
  `rgba(255,255,255,0.82)` (pale header band in dark); dark surfaces were
  green-tinted and read as a wash; `bg-accent-soft` + `text-accent-fg` was
  **1.14:1 in light** and 1.29:1 in dark — invisible text, pre-existing.
- **Backend audit (`src/APIs`, `src/Core`, `src/Shared`; `src/Apps` is the
  old Blazor UI, out of scope).** Clean: DB-level `.Skip/.Take` pagination,
  no raw SQL, no hardcoded secrets, no manual `DbContext`/`SqlConnection`
  outside DI, `CacheHelper` removes its locks, `RefreshTokenCleanupService`
  honours its stopping token. All in-scope projects build 0 warnings/0 errors.

## Known issues left unresolved

- **52 ESLint problems** (baseline was 47; +5, all benign and explained: one
  `no-img-element` on the lightbox — parts-DB image hosts can't be whitelisted
  for `next/image`; React Compiler reporting it skipped `useVirtualRows`
  because tanstack's hook isn't compiler-compatible; and three more
  `no-img-element` from the image-upload work — the Settings page's
  profile-photo preview, the header dropdown's mini-avatar, and the sidebar's
  system-logo mark, all showing an arbitrary R2 URL for the same reason the
  lightbox does). Of the original 47: 20 `no-explicit-any`, 11 unused
  *variables*, 8 `<img>` instead of `next/image`, 4
  `react-hooks/set-state-in-effect`, 3 unescaped entities, 1 immutability.
  - The unused variables are NOT safe to bulk-delete — e.g.
    `const ok = await deleteTechnicalService(item.id)` has an unused binding but
    the call performs the deletion.
  - The 4 `set-state-in-effect` are real cascading-render smells in
    `ServiceDetailModal`, `PrintPreviewSidebar`, `AiLauncher`, `users/page` —
    each needs a real refactor, not a mechanical edit.
- **No time-series endpoint.** `DashboardStats` returns running totals only, so
  sparklines are bucketed client-side from a bounded ~400-ticket sample
  (`hooks/useTicketSeries.ts`). A busier window than that is clipped. Proper fix
  is a server-side aggregate endpoint.
- **Not built from the original spec**: sidebar per-item subtitles + trailing
  badges (needs ~40 new i18n strings), navbar ⌘K hint / credits badge / sound
  icon.
- `MaxListenersExceededWarning` in the dev log is **noise, not a leak** — it
  only ever reports 11 (Node warns once per emitter past its default of 10),
  never climbing.
- **`ServiceTable` is not virtualized** — its rows wrap (53–57px, variable),
  so it needs `measureElement` (dynamic mode), not the fixed-height approach
  used for spare parts. It has `content-visibility: auto` instead.
- **Modals other than `ConfirmDialog`/`MediaLightbox` still animate in via
  CSS** (`enter-fade`/`enter-pop`) and vanish on close, with no focus trap.
  Converting `ServiceDetailModal` (1,404 lines) and `InspectItemDialog` (704)
  is real work, not a mechanical edit.
- **Backend, flagged not fixed** (each needs a judgement call, not a guess):
  - `AsNoTracking()` missing on 13 read queries in `TechnicalServiceQueries`.
    The one-line global default would also hit command handlers and could
    **silently break saves** — must be applied per-query with verification.
  - `RefreshTokenCleanupService` schedules on `DateTime.Now` (server-local).
  - `PermissionIcons.Icons` is a `public static` mutable `Dictionary`.
  - `CreateUserViewModel` / `UserRolesViewModel` orphaned by the removal of
    the dead `UsersController`.
- **Stock-band filter chips filter LOADED rows, not the catalogue** — the
  parts endpoint accepts only `searchTerm`. Surfaced honestly in the UI as a
  `15 / 26` badge; a real catalogue-wide count needs a server-side filter.
- **`api.ts` falls back to `mockData` on every read error** — a backend outage
  renders a full, plausible table. So `ErrorState` almost never appears, and
  **"rows rendered" is not proof the backend is up.**
- **The R2 access key/secret are plaintext in git**, in
  `src/Apps/ServiceMaintenance/Services/R2CloudStorage/R2StorageConfig.cs` —
  in the current working tree, not just history. `TestingReact/.env.local`
  now holds the same credentials (gitignored, so that file itself is fine),
  but copying them there does not fix the exposure in the old file. Rotate
  the key in the Cloudflare dashboard; same class of issue as the
  already-documented exposed admin password in the AI Assistant section
  below.
- **"Suggested from your photo" (`lib/dominantColor.ts`) needs the R2 bucket
  to serve permissive CORS headers**, or the canvas read throws and the
  function just resolves `null` (no suggestion shown, nothing crashes) — this
  was not verified against the actual bucket's CORS policy while building it.
  If the swatch never appears, check the bucket's CORS rules in the
  Cloudflare dashboard before assuming the code is wrong.
- **Uploading a profile photo broadcasts a spurious `ticket_updated` SSE
  event.** `services/api.ts`'s `updateProfilePictureUrl` goes through the
  generic `/api/proxy/[...path]` PUT handler, which broadcasts on every
  successful PUT with no "not a ticket" case in `RealtimeResource`. Harmless
  (an extra debounced table refetch elsewhere) and rare enough that
  special-casing the shared proxy route for it wasn't worth the added
  branching — flagged here so it doesn't look like an unexplained refetch.

## Conventions to keep

- **Never write a raw palette utility.** No `bg-slate-50`, `text-violet-600`.
  There are currently ZERO in `src/` — keep it that way. Use the semantic
  names, or add a token if one is genuinely missing.
- **Colour lives in `globals.css` only.** No component hardcodes a hex — that
  discipline is *why* dark mode cost one CSS block and zero component edits.
  Exceptions that must stay hardcoded: `ExcelViewer` (renders the
  spreadsheet's own colours), `PrintPreviewSidebar` (legacy print replica),
  `global-error.tsx` (renders when the stylesheet may be unavailable),
  `RobotMascot` (illustration asset), the barcode/lightbox media wells —
  a barcode is read by reflectance and must stay pale in both themes — and
  `app/settings/page.tsx`'s `ACCENT_SWATCHES` array plus the native
  `<input type="color">`'s value prop. Those hexes are the FEATURE, not UI
  chrome: a swatch preview and a native colour picker both inherently need a
  literal colour to show or seed from, the same way `ExcelViewer` inherently
  needs the spreadsheet's own colours.
- **`*-soft` backgrounds pair with `*-soft-fg`, never `*-fg`.** `accent-fg` is
  the colour that sits on the SOLID accent. Pairing it with `accent-soft` gave
  white-on-pale-green at 1.14:1 — text that was there and could not be read,
  in *both* themes, for a long time before anyone measured it.
- **Any new surface token needs a `.dark` counterpart.** `.av-glass` was
  missed because it was a raw CSS declaration, not a Tailwind utility, so the
  `bg-white` sweep never saw it. Grep `globals.css`, not just `src/`.
- **Animate transform/opacity only.** Never width/height/top/left. Route
  animations need `key={pathname}` — a CSS animation does NOT replay on a
  reused DOM node, which is what made the old page transitions silently do
  nothing.
- **All user-visible text goes through i18n** in BOTH `en` and `km`
  (`km` is typed against `TranslationKey`, so a missing key is a compile error).
- **Verify in a real browser, not by assertion.** Playwright driving the system
  Chrome (`channel: "chrome"`) works here — **headless**; headed sessions kept
  dying mid-run. AuthGuard now validates the token's `exp` (a malformed string
  still passes, since an unreadable expiry is treated as valid; a *captured
  real* token will expire on you). Use CDP `Performance.getMetrics` for
  nodes/listeners/heap and `PerformanceObserver` for long tasks.
- **Distrust your own probe before you distrust the app.** Every "failure" that
  turned out to be measurement error, from this work:
  - contrast measured against an `rgba()` value without compositing it over
    the surface beneath → read 1.2:1, actually 9:1
  - `addInitScript` re-runs on **every** navigation including `reload()`, so
    it overwrote the theme under test → looked like dark mode was broken
  - sampling a modal 500ms after Escape, when its exit spring settles at
    ~600ms → looked like Escape didn't close it
  - a 2s full-table scroll sweep is ~8,400px/s — a dragged scrollbar, not
    reading. Measure at 1,200–2,500px/s before calling scroll janky.
- **Measure before optimising, and re-measure after.** `content-visibility`
  looked like it fixed the table; it halved the cost but couldn't touch
  unmount. Virtualization looked like a pure win; it regressed scroll until
  the row was memoised. Both were only visible in numbers.
- **Flex items holding wide content need `min-w-0`**, or `overflow-x-auto` on
  an inner scroller is ignored and the whole document scrolls sideways.

# AI Assistant — Gemini audit (2026-08-17)

Audit of the one Gemini integration, `TestingReact/src/app/api/ai-search/`.
Route-level detail lives in `TestingReact/src/app/CLAUDE.md`; not repeated here.

## What was already right (don't "fix" it again)

- **One integration, server-side only.** Nothing in `./src` (.NET) touches
  Gemini; nothing reaches the browser bundle. The key is `GEMINI_API_KEY` with
  no `NEXT_PUBLIC_` prefix, so Next cannot inline it.
- **The model reads the data; the frontend never supplies it.** The client
  posts `{ query, model?, imageModel?, history? }` and nothing else — no rows,
  no filtered client state. Tools in `tools.ts` execute real `no-store` reads
  against the ASP.NET services, and `count_tickets` uses the backend's own
  `totalCount` rather than counting a page.

## What was fixed, and why

- **Hardcoded admin credentials removed** (`backend.ts`). `getJson` fell back
  to a committed `admin` password whenever the caller had no token or a backend
  returned 401 — so an unauthenticated POST was answered from admin-scoped
  rows, and the per-user visibility guarantee was decorative. `POST` now 401s
  without a bearer token (`degraded: "notSignedIn"`, new i18n key
  `header.aiSignedOut` in en + km). **The password is still in git history
  (commit `093d8f4`) — rotate it.**
- **Identity no longer guessed.** `activeUser` fell back to the `admin` account
  or `users[0]` when the token matched nobody, so "who am I?" could confidently
  name a stranger. Unresolvable callers now get an explicit "say you can't
  tell" instruction instead of an identity block.
- **`GEMINI_MODELS` reordered and pruned.** The file's comment claimed
  "strongest first, 3.7-flash leads, lite models near the end"; the array had
  three lite models in slots 1–3 and `3.7-flash` seventh. Every question was
  being answered by `gemini-3.1-flash-lite` — a *deprecated* model — at the
  bottom of the quality range. Now genuinely strongest-first.
- **`thinkingLevel: "low"` added** to `generationConfig`. Measured 6.7s → 1.8s
  on `gemini-3.5-flash` for an identical tool-calling request, with no
  correctness cost for a workload that is "pick a tool, read rows, summarise".

## Verified against the live API, not from memory (2026-08-17)

- **Both Pro entries had no free tier at all** — `gemini-3.1-pro-preview` and
  `gemini-pro-latest` (which resolves to `gemini-3.1-pro`) answer 429 in ~0.5s
  on an unbilled key, every time. They were the two strongest-looking entries
  in the rotation and could never once have produced an answer. Removed.
- **`gemini-3.6-flash` is 21–45s per round** — it works, but under
  `AGENT_BUDGET_MS` (50s) it can only ever finish a single-tool question. Kept
  last for its separate allowance, never in the fast path.
- `gemini-3.1-flash-lite-preview` is listed as shut down but **still answers
  today** — which is exactly how a dead entry survives a review. Removed.
- `gemini-2.5-flash` / `-flash-lite` now 404 ("no longer available to new
  users"). Every model carries a 1,048,576-token input window.
- **The free-tier rate-limit table is no longer published** — `/rate-limits`
  defers to AI Studio. The "20/day per model" figure in `route.ts` is folklore;
  treat it as an estimate, not a fact.

## Known issues left unresolved

- **The admin password is in git history.** Removing it from the working tree
  does not remove it from `git log`, and the repo is on GitHub. Rotating the
  account is the only real fix; that is an ops action, not a code change.
- **`grounded: true` does not mean "verified against data"** — it means the
  model answered rather than falling back to keyword search. A greeting is
  `grounded: true` having run zero tools. Deliberately not changed: the panel
  keys "show the answer text" off this flag, so tying it to tool execution
  would blank out every legitimate general answer.
- **`gemini-2.5-flash-image` shuts down 2026-10-02** (in `image.ts`'s
  `IMAGE_MODELS`). Not urgent — every image model is paid-only, so the free
  install answers pictures via Pollinations anyway.
- **The image path is not behind the auth gate**, by design: it reads no
  workshop data and has a keyless fallback, so gating it would remove the only
  thing an unconfigured install can still do.

## Conventions to keep

- **Never add a Gemini model from memory.** Probe it first — 404 means retired
  for that project, 429 means it exists and the allowance is spent, and *200
  does not mean supported* (a shut-down model can still answer). The measured
  latencies live in the `GEMINI_MODELS` header comment; re-measure rather than
  trusting them.
- **Check free-tier availability separately from existence.** `ListModels`
  happily returns models the free tier will never serve. `ai.google.dev/pricing`
  is the source for "Free Tier: Not available"; a 429 in ~0.5s on a cold key is
  the live tell.
- **A comment describing intent is not the code.** The model ordering was
  documented correctly and implemented backwards for long enough that the
  comment was quoted as evidence. Read the array.
- **The assistant answers with the caller's token or not at all.** No service
  account, no admin fallback, no "just for dev" shortcut — that is precisely
  what was there before and it silently defeated the whole design.
- **A failed lookup must reach the model as an error, never as an empty
  result.** `{ items: [] }` reads as "there is nothing there" and gets
  confidently reported as zero; `runTool`'s error string makes it say the
  system was unreachable instead.
- **`NEXT_PUBLIC_TECHNICAL_API_URL` points at `http://localhost:8000` in
  `.env.local`** — the local .NET API. With it not running, every ticket/parts
  tool fails and the assistant correctly says "unreachable". That is a local
  config state, not a regression; start the API or override the var to the
  remote host when testing the assistant.

# AI Assistant — fallback and accuracy pass (2026-08-17, later session)

Follows the Gemini audit above. Same route; the rotation already existed, so
this was about why it still gave up, and whether the answers were true.

## Model rotation: it rotated, but nothing was ever skipped

- **A cooldown never removed anything from the rotation.** `readyKeysFor`
  ended in `ready.length > 0 ? ready : live`, so once *every* key for a model
  was cooling it fell back to trying them all anyway. `noteRateLimit`'s comment
  said parking a model "makes the rotation skip them outright"; it did not.
  Every question for the rest of the day re-walked all eight spent models, one
  guaranteed 429 each, and the *picker* meanwhile showed them as unavailable
  because it read `modelCooldowns` directly. Cooldown entries now carry their
  `scope`: a short-term one is still probed (it is an estimate), a `day` one is
  skipped (it is a fact from Google's own `quotaId`).
- **"AI daily limit reached" was mostly a mislabelled timeout.** The leaders
  429 in under a second, so the first thing a question hit late in the day
  pinned `degraded` to `quotaExceeded`; if the budget then ran out further down
  the list, that stale reason was what the user saw — "it resets tomorrow",
  while models with quota were still in the list untried. Quota and non-quota
  failures are now tracked separately and the reason is decided at the end:
  `quotaExceeded` only when the rotation genuinely ran out of models.
- **Per-attempt timeout added** (`MODEL_ATTEMPT_MS`). Every attempt used to get
  the whole remaining budget, so one stalling model starved the rest of the
  list. Plus `MAX_MODEL_ATTEMPTS`, because the budget bounds the wait, not the
  spend.
- **Measured live, one key, 2026-08-17:** `3.7-flash`, `3-flash-preview` and
  `flash-latest` all 429 with `GenerateRequestsPerDayPerProjectPerModel-FreeTier`
  — confirming again that the alias shares the leader's bucket — while five
  models still answered. That is the state the feature was degrading in.
  Latencies moved a lot between probes on the same day (`3.6-flash` 21–45s then
  1.8s; `3.1-flash-lite` 2.7s then 15.5s), which is the argument for capping an
  attempt rather than re-sorting the list on one sample.
- Docs re-checked: the model list matches `ai.google.dev/gemini-api/docs/models`.
  The rate-limits page still publishes **no** per-model free-tier table (it
  defers to AI Studio) but now states plainly that limits are **per project,
  not per API key** — so extra keys from the same project still buy nothing.

## Dates: two bugs, both of the confident-wrong-answer kind

- **`today` was UTC.** `new Date().toISOString().slice(0,10)` in a UTC+7
  workshop names *yesterday* from 00:00 to 07:00 ICT, every day. The model was
  told "Today is <yesterday>" and resolved "today"/"ថ្ងៃនេះ" against it, then
  showed the wrong day back under "Understood as" and agreed with itself. Now
  `businessToday()` via `Intl` in `Asia/Phnom_Penh` (`AI_BUSINESS_TIMEZONE`
  overrides), and the zone is named in the prompt so the model cannot re-derive
  it.
- **A date window means different things with and without a status, and the
  prompt had it backwards.** Measured against the live API:
  - window alone → filters on **arrival** (`serviceDate`);
  - window **plus a status** → filters on **when that status was set**;
  - `useProcessDateFiltering` → matches the ticket's **process history**, a
    broader set again.

  The prompt instructed that "how many machines came in today" be asked as
  status `Item Recieved` **plus** today's window — which silently answers "how
  many arrived today *and nobody has touched yet*". Verified: it reported **1**
  when three machines had come in, because the other two had already moved on.
  With the status dropped it reports 3, matching a direct query. The
  `dateFilterMode` tool description made the same false claim and is corrected.

## Other fixes

- **`countTickets` could fabricate a count.** It asks for `pageSize: 1`, and
  `unwrap` fell back to "rows on this page" when an envelope carried no
  `totalCount` — so a filter matching hundreds would answer **1**, indistinguishable
  from a real count. `unwrap` now reports `totalKnown` and `countTickets`
  throws instead, which reaches the model as a failed lookup.
- **"Understood as" is reconciled against what actually ran.** The badges came
  from `present_results`, which is a *separate* object from the tool calls —
  nothing tied the two together, so the label could describe a query that never
  happened. `ToolContext.executedTicketQueries` records each real lookup and
  `buildFilters` fills gaps from the values every lookup agreed on. Fields the
  lookups disagreed on (a comparison across statuses or months) are left alone,
  and nothing the model stated is overwritten.

## Verified, not asserted (all against the running app + local API)

| Question | Assistant | Direct query |
|---|---|---|
| machines came in today | 3 | 3 |
| moved to Awaiting Sparepart today | 5 | 5 (3 still there + 2 moved on) |
| Awaiting Sparepart today | 3 | 3 |
| came in on 2020-01-01 | "No machines came in" | 0 |

Unknown part and unknown staff name both answered honestly ("not in our
system", "not a registered user") rather than being invented.

## Known issues left unresolved

- **The TechnicalServices API serves reads with no `Authorization` header —
  in production, not just locally.** Confirmed 2026-08-17 by a plain
  unauthenticated `curl`:
  `https://technicalservicesapi.camprotec.com.kh/api/technicalservices/search`
  answers **200** with `totalCount: 3662` and full 44-field ticket rows —
  company name, contact name, address, phone. The local :8000 API behaves the
  same way, so this is not a dev-only config.

  This is the most serious thing in this file. It means the assistant's
  "it can only surface rows that user could already open" guarantee is
  **decorative in production** — not because of anything in `ai-search`, whose
  auth gate and token forwarding are correct, but because the data underneath
  has no gate at all. Fixing the assistant cannot fix this; the API has to
  require and validate the bearer token. Until it does, treat every ticket,
  customer and machine record as publicly readable.

  **Root cause found and half-fixed.** `TechnicalService.API` already had JWT
  bearer validation behind a `Jwt:Enabled` flag, with Key/Issuer/Audience
  filled in — but **no endpoint anywhere called `RequireAuthorization()`**
  (grep across `src/`: zero hits). `UseAuthentication()` only *reads* a token
  when one is presented and `UseAuthorization()` only acts where an endpoint
  asks, so with nothing asking, turning the flag on would have changed no
  behaviour at all. It read as a working security switch and was not one.
  `Program.cs` now calls `repairs.RequireAuthorization()` under that same flag,
  so the switch is real.

  **The flag is still `false` and the exposure is still open** — that is a
  deployment decision, not a code one. Before flipping it, confirm the tokens
  the frontend actually holds carry `iss = https://user.camprotec.com.kh` and
  `aud = https://technicalsystem.camprotec.com.kh`; every proxy route forwards
  the header but only `if (authHeader)`, so a caller that sends none currently
  succeeds and would start 401ing. Health checks are mapped outside the group
  and stay anonymous. Any *new* endpoint group needs its own
  `RequireAuthorization()` or it is public.

  (`user.camprotec.com.kh/api/UserManagement` also answers 200 unauthenticated
  but returned **no rows**, so it may be gated differently — check it properly
  rather than assuming either way.)
- The backend's status+date semantics are described accurately to the model now
  but were **not changed** — whether "Awaiting Sparepart between two dates"
  *should* mean the transition date is a business-rule call, not a code fix.
- An explicitly picked model that is day-parked is now skipped rather than
  probed. The substitution is reported (`servedBy` / `requestedModel`), but it
  is a behaviour change from "the user may know the quota just reset".

# Sparepart stock ledger + UI sweep (2026-08-18, later session)

## Stock In/Out was dated by the ticket's CURRENT status

`GetSparepartUsageByDateRangeAsync`'s default mode reconstructed each
service-sourced movement from `Services` × `SparepartItems` and synthesised its
date from whatever status the ticket was in *now* (`Finished → FinishedDate`,
`Repairing → RepairDate`, …). Two failures, both of the confident-wrong-answer
kind, both proven against the live DB before changing anything:

- **The date moved retroactively.** Every one of the 15 units today's report
  claimed had left the shelf was a ticket someone *closed* today — four of them
  parts on a machine that arrived **2026-06-04**. Advance a ticket tomorrow and
  its stock-out follows it, so a report printed last week stops reconciling with
  the same report today.
- **Rows vanished.** Those per-status date columns are nullable and both date
  filters required a value, so a ticket in a status whose column was NULL was
  dropped from *every* date range — stock gone, no report would ever show it.

Now reads `SparepartStockAuditLog.Timestamp`, the moment the trigger fired.
Keyed on `QuantityChange != 0` rather than the `OperationType` string — the
trigger bodies are not in this repo, and a zero change is the documented marker
for a tracking-only row, so this gets Section 7.2's exclusion for free.
Condition is left-joined from `SparepartItems`: a stock-in restore fires
*because* that row was deleted, so it must still be counted. Detail in
`src/APIs/TechnicalService.API/CLAUDE.md`.

- **Verified old-vs-fixed on the live DB, from an isolated build on :8010** so
  the running API was never touched: all-time service usage 2,308 → 738, July
  180 → 152, today 15 → 9.
- **The ledger's earliest row is 2026-02-19** — that is when the triggers went
  in. 2025-09 → 2026-02 read 0 under the ledger against 55/118/63/122/94/87
  before. `sql/sparepart-stock-ledger-backfill.sql` reconstructs the gap from
  `InspectDate` (the stamp `SetInspection` writes in the same unit of work as
  `AddSparepartItem`, so it is when the trigger *would* have fired), marks the
  rows with a `BACKFILL:` prefix on `Remarks`, and previews before it inserts.
  **Not yet run.** Checked against the live DB 2026-08-18:
  - **It cannot fire a trigger.** `SELECT COUNT(*) FROM sys.triggers WHERE
    parent_id = OBJECT_ID('dbo.SparepartStockAuditLog')` returns **0**; all
    seven triggers sit on `Services` (2), `SparepartItems` (3),
    `SparepartManualStockOut` and `Spareparts`. The script INSERTs into the
    audit log and nothing else, so `Spareparts.Quantity` never moves and
    `SkipDirectQuantityAudit` is not involved.
  - **`FK_AuditLog_Spareparts` would have failed the whole run.** 33
    `SparepartItems` rows reference a part deleted from the catalogue, and one
    INSERT statement means those 33 would roll back all 1,433 candidates. The
    script now requires the part to still exist and reports the excluded rows
    in its own section rather than dropping them silently.
  - Guarded candidate set: **1,400 rows / 1,401 units** — 1,382 in the
    pre-trigger gap (2025-01-15 → 2026-02-17) and **18 dated after the ledger
    starts**, which are worth investigating before committing: a part that
    moved while the triggers were live and left no row.
- `sql/sparepart-stock-ledger.sql` carries an `OperationType` census that checks
  the `QuantityChange` assumption against real data, and the reconciliation
  identity. Use the **backfill** script's section 4 instead once a backfill is
  committed: reconstructed rows carry zero balances (unrecoverable) and would
  make every part report a false mismatch.
- **`SparepartStockAuditLog` is not under EF migrations** (only `InitialCreate`
  and `AddRentalService` exist). Its schema, indexes, CHECK constraints and
  triggers are all managed directly in the database — do not generate a
  migration for it; a generated one would carry every bit of accumulated
  snapshot drift with it.

## Two mistakes made during that work, both worth not repeating

- **`SET PARSEONLY ON` does not make a batch read-only.** It applies to
  SUBSEQUENT batches; the batch containing it has already been compiled and
  runs normally. A harness written to "validate SQL without executing it"
  therefore executed it — against production. Three redundant indexes were
  created on `dbo.SparepartStockAuditLog` as a result; they were **dropped the
  same session** via `sql/drop-redundant-audit-indexes.sql` and the table is
  back to its original PK + four `IX_AuditLog_*`. No data was written at any
  point: the backfill INSERT was rejected by `CK_AuditLog_OperationType` inside
  its own transaction. **To check SQL without running it, send it as its own
  batch after a separate `SET PARSEONLY ON` batch, or use a parser rather than
  the server.**
- **An empty EF entity configuration is not evidence of a missing index.**
  Section 7.6 of the brief was reported as "a real gap" purely because
  `SparepartStockAuditLogEntityTypeConfiguration.cs` declares no `HasIndex`.
  The database already had all four indexes; this table's schema simply is not
  described by the Fluent API. Check `sys.indexes`. Relatedly, an
  `IF NOT EXISTS ... WHERE name = '...'` guard compares NAMES and will happily
  create a byte-perfect duplicate of an existing index under a new name.

## Report date-vs-status independence was already correct

Worth knowing before "fixing" it again: `services/reports.ts` sends
`forceServiceDateOnly=true` on every report request, and
`TechnicalServiceQueries.cs` honours it by filtering `ServiceDate` alone.
Status arrives as a separate optional param applied at STEP 1, defaulting to
unset via `EMPTY_FILTERS`. So "everything that came in on date X regardless of
what happened since" is already the **default** on all eight report pages, and
status-scoped is reachable through `ReportFilterBar`'s multi-select. The
status-scoped date branches further down that method only run when
`ForceServiceDateOnly` is false — which no report sends.

## Shell state and responsive breaks on the two pages that bypass `PageWrapper`

`/` and `/users` render `Sidebar` + `Header` themselves rather than going
through `PageWrapper`, and both had drifted from it:

- **`users/page.tsx` used `ml-64` / `ml-20` with no `lg:` prefix.** The aside is
  `position: fixed` and below `lg` it is an off-canvas drawer occupying no
  layout space, so every phone and small tablet indented the content column
  256px with nothing in the gap — about **134px of usable width at 390px**.
- **Both used `useState(true)` for the sidebar** instead of
  `services/sidebarPreference`. That is exactly the bug the module store was
  written for, surviving on the two routes that were not converted: collapse the
  rail anywhere, land on the dashboard, and it is expanded again — and toggling
  it there persisted nothing, so leaving snapped it back.

Both now read the store through `useSyncExternalStore`, same as `PageWrapper`.
**Any new page that renders the shell itself must do both**, or it reintroduces
these.

## Animation constants had drifted from `lib/animations.ts`

The rule is that no duration or easing is written anywhere else. Two violations:

- `PAGE_TRANSITION_SPRING` was declared **twice**, character-identical, in
  `lib/animations.ts` and `PageTransition.tsx`. The latter now imports and
  re-exports it.
- `ModalWrapper.tsx` **imported `MODAL_SPRING` and then ignored it**, animating
  on a private 450/30 copy — so every dialog in the app moved on a spring
  nothing else knew about. It also rebuilt `variants` as a fresh object literal
  in the render body, which framer diffs by identity, so any parent re-render
  while a dialog was open read as a variant change. Both fixed; variants are two
  frozen module-scope objects keyed by `placement`.
- `PageWrapper` and `users/page.tsx` used `transition-all` on the full-height
  content column, so `all` picked up `background-color` and every theme toggle
  dragged a 300ms cross-fade across it on top of the 200ms one `globals.css`
  already runs. Now `transition-[margin]`.

**Still unresolved / deliberately not changed:**
- `lib/animations.ts`'s `modalVariants`, `backdropVariants`, `drawerVariants`,
  the list/stagger variants, `TAP`, `HOVER_LIFT` and `HOVER_ZOOM` have **zero
  consumers**. The file documents a system nothing imports. Adopt or delete —
  it is a judgement call, not a mechanical edit.
- The sidebar animates `width` and the content column animates `margin`, the
  only layout-triggering animations left. They are paired: the aside is `fixed`,
  so the margin is what reserves its space. Converting to `transform` means the
  rail overlaying content rather than reflowing it — a different design, not an
  optimisation. One 300ms layout pass per deliberate toggle.
- `TemplateReportView` renders a **failed** load as `report.noData` ("no data")
  with only a transient toast to distinguish it, and offers no Retry. An outage
  is indistinguishable from an empty period once the toast fades. Same class of
  problem as `api.ts` falling back to `mockData`.
- `StockNotificationOutbox` appears **nowhere** in this repo — it is written by
  the triggers and has no consumer here, so there was nothing to audit.

# Sections 3-5: memory, Lite Mode, data loading (2026-08-18, same session)

## Memory (Section 3) — already in good shape; three real findings

The census came back balanced: 26 `addEventListener` against 25
`removeEventListener` (the odd one is `req.signal` in the SSE route, which
needs none), 3 observers created and 3 disconnected, `useVirtualizer` managing
its own teardown, one multiplexed `EventSource`, and `useSafeTimeout` already
extracted and adopted at five call sites. What was actually wrong:

- **`SparePartSpecModal` and `MediaLightbox` each held a bare 2s
  `setTimeout`** resetting a "Copied!" flag — in modals the user usually closes
  immediately after copying, so it fired `setCopied` against an unmounted
  component and pinned the component scope until it did. Both now use
  `useSafeTimeout`. (Both also hardcoded their toast string in English;
  now `common.copiedValue` in en + km.)
- **`downloadWorkbook` revoked the object URL on the very next line after
  `link.click()`.** A click-initiated download is asynchronous, so this races
  the read it is meant to feed — survivable for a small workbook, not for a
  monthly report, and the failure is silent: no error, no file. Now revoked on
  a 60s timer, and the anchor is in the document when clicked (a detached `<a>`
  works in Chromium and does nothing at all in Firefox).

## Lite Mode (Section 4)

`prefs.lite` in `ThemePrefs`, stamped as `html[data-lite]`. **It is a theme
preference, not its own context+storage key**, and that is the whole design: it
has to be on the first frame (a weak machine painting one blurred frame then
dropping it is the stutter it exists to prevent), it has to survive a reload,
and it has to sync across tabs — `ThemeScript` and the `ui-prefs` store already
do all three. Adding a field to `DEFAULT_PREFS` + `themeAttributes` was enough;
`ThemeScript` serialises that function, so it stamps pre-paint for free.

- **Separate from `motion`, deliberately.** `motion: "reduced"` collapses
  animation; `lite` drops `backdrop-filter`, layered shadows and 3D transforms,
  which cost on every *paint*. A weak GPU with a fast CPU wants one; someone who
  finds animation distracting wants the other. Accepting the prompt sets both,
  because a machine that failed the frame benchmark wants both — after that they
  are independently adjustable in Settings.
- **`lib/deviceTier.ts` scores, it does not branch.** Every descriptive signal
  lies or is missing somewhere (`deviceMemory` is Chromium-only and capped at 8;
  `hardwareConcurrency` counts threads not speed; the WebGL renderer is masked
  under privacy settings), so each contributes a vote and the ~600ms frame
  benchmark — the only input that *measures* rather than describes — is weighted
  heaviest and can carry the verdict alone. Unknown lands on **medium**, never
  low or high.
- The benchmark is deferred to `requestIdleCallback`; running it during first
  paint would compete with the work it is measuring and make the detector the
  jank. It also releases its WebGL context explicitly (`WEBGL_lose_context`) —
  browsers cap live contexts, and leaking one from a *performance* detector
  would be its own joke.
- **Detection never switches anything on.** It decides whether to *offer*.
  A capable machine misread as slow would otherwise silently lose the design
  with nothing on screen to explain it. Asked once per browser
  (`perf-prompt-seen`, kept out of `ui-prefs` because it is a note that a
  conversation happened, not a preference — resetting appearance settings should
  not re-interrogate someone about their hardware).
- **`usePerformance().isLiteMode` is the preference OR the OS reduced-motion
  setting** — read that, never `prefs.lite`. Consumed by `PageTransition`
  (both halves: the imperative exit via `data-lite` on the DOM, and the enter
  via the hook). The rule for what Lite Mode takes: **animations that composite
  the whole viewport**, not small local ones.
- **Row virtualization is untouched by design** — a data-rendering optimisation,
  not decoration, and it matters more on a weak machine.

**`--av-shadow-soft-*` DOES NOT EXIST — do not write it.** The real tokens are
`--av-shadow-{sm,md,lg,xl,inner,cushion,cushion-hover}`; `shadow-soft-sm` is the
Tailwind *utility*, mapped via `@theme inline` to `var(--av-shadow-sm)`. The
first version of the Lite block overrode invented names and was dead CSS. It was
caught only by measuring a rendered element's computed `box-shadow` in a browser
— and nearly missed, because the `grep` that "confirmed" the tokens existed was
matching the lines that had just been written. **Grepping for a token you just
added proves nothing.**

## Data loading (Section 5)

- **`TemplateReportView` rendered a failed load as `report.noData`** — "No
  records in this period" — with only a toast to say otherwise. So a backend
  outage read as a confident statement that nothing happened that month, on the
  eight screens whose entire job is answering that question, with no way back
  short of reloading the browser (the effect only re-runs when a filter or date
  changes). Now a distinct `failed` state renders `av/ErrorState` with a working
  Retry, driven by a `retryToken` dependency, and the exception goes to Sentry
  tagged with the template.
- **`av/ErrorState` had zero consumers before this** — built with a Retry
  affordance and never wired to anything. Worth checking the rest of `av/` for
  the same.
- Still true and still the biggest caveat here: `api.ts` falls back to
  `mockData` on every read error, so most reads never reach an error state at
  all. `ErrorState` is for the calls that genuinely surface one.

## Verified in a real browser (headless system Chrome via playwright-core)

| check | result |
|---|---|
| `data-lite` stamped pre-paint | `off` / `on` correctly |
| blur removed, dialog open | 5 blurred elements → **0** (`blur(14px)` gone) |
| shadow tokens | `sm/md/lg/cushion/card` → `none`; `xl`/`panel` → the 1px ring |
| rendered `shadow-soft-sm` element | multi-stop shadow → `none` |
| `/users` at 390 / 768 | `margin-left: 0`, no horizontal overflow |
| `/users` at 1024 / 1366 / 1440 / 1920 | `margin-left: 256px`, no overflow |
| sidebar collapse across `/`, `/users`, `/customers` | 80px on all three |
| device tier + console | "Handles everything comfortably", 0 errors |

`npx tsc --noEmit` clean, `npm run build` succeeds, and ESLint is **58 problems
— byte-identical to before this session** across ~15 edited and 3 new files.

Playwright is **not** a project dependency and was not added to
`package.json` — it was installed in a scratch directory as an ad-hoc tool, per
the `verify-ui` skill.

# Production performance audit (2026-08-22, later session)

Measured against `next start`, never the dev server, in headless Chrome via
playwright-core. **`waitUntil: "networkidle"` can never fire in this app** —
`useRealtimeTickets` holds one `EventSource` open for the life of the page — so
every such wait burns its full timeout. Use `domcontentloaded` plus a selector.

## The verdict

Fast on a normal machine, slow on a weak one. Unthrottled: FCP 120-288ms, LCP
396-672ms, **CLS 0.003**, SPA route change 98-158ms with the first painted
frame at 114-184ms, scroll at a 16.7ms median with **0% of frames over 32ms**.
The one weak metric is **TBT, 290-544ms per route** — one ~200ms task each,
which is hydration of a large tree, not a hot loop.

At **4x CPU throttle** that is the whole story: dashboard TBT **3,075ms** with a
single **1,365ms** task, and route changes of 742-1,766ms. A CPU profile
attributes it to React hydration plus style recalculation spread thin, so there
is no single function to delete — it is tree size.

**There is no memory leak.** Nodes appeared to climb 9,429 -> 20,700 over six
navigations, which reads exactly like detached DOM. After a forced
`HeapProfiler.collectGarbage` it plateaus: 15,361 -> 17,196 -> **17,196**, with
listeners flat at 1,142. CDP's `Nodes` counts uncollected detached nodes, so a
rising figure proves nothing until GC has run. That is Next's bounded router
cache behaving correctly.

## Three fixed, measured before and after

| | before | after |
|---|---|---|
| SSE connections over 6 navigations | 1 -> **7** | 1 -> **1** |
| `/api/proxy/UserManagement` over 6 navigations | 4 -> **11** | 1 -> **1** |
| `/api/health` over 6 navigations | 2 -> **14** | 2 -> **8** |

- **`fetchUserMap` had a negative-cache miss.** It treats only a NON-EMPTY map
  as cached, but a failed or empty lookup still stored an empty one — so the
  guard never tripped and every caller refetched, forever, with no backoff. The
  app hammered the user API hardest exactly when it was already unwell. Now an
  empty result is remembered for 60s (`USER_MAP_EMPTY_TTL_MS`); a successful
  one still caches for the session and clears it.
- **The SSE stream was torn down and reopened on every navigation.** Each page
  renders its own `PageWrapper`, so the outgoing subscriber unmounts before the
  incoming one mounts and the handler count passes through 0. The server held
  exactly 1 session throughout, so this was churn, not a leak. `closeSharedStream`
  is now deferred by `STREAM_CLOSE_GRACE_MS` (1.5s) and cancelled when the next
  subscriber arrives. The old comment covered React's dev double-mount but not
  the navigation case.
- **`/api/health` fired twice per navigation and zero times while idle** — so it
  was never the pollers, it was the remounts, which also meant `Sidebar`'s 60s
  interval never reached 60s. New `services/healthSnapshot.ts` holds one shared,
  30s-TTL copy. `SystemStatus` is deliberately **not** a consumer: its request
  is a *measurement* (it times the round trip for the header's "62 ms" badge),
  so a stored response would make it report ~0ms. It is a publisher instead, and
  the sidebar now normally issues no request at all.

## Two defects removed from `globals.css`

- **23 dead selectors** written `.dark html[data-cmd-palette-style=...]`.
  `ThemeProvider` toggles `.dark` on `<html>` itself, so a descendant `html`
  can never match — they had never applied to anything, while still being
  matched against every element on every recalculation.
- **A permanent layout-animating transition on 185 elements.**
  `h1..h6, p, span, label, button, a, td, th` carried
  `transition: letter-spacing, line-height` unconditionally; both properties
  trigger layout, against this project's own "transform and opacity only" rule.
  Now `html.av-type-transition`, added by `ThemeProvider.withTypeFade()` only
  when `fontScale` or `density` changes — the same opt-in shape
  `.av-theme-transition` already used. Verified through the real Settings UI:
  fires for both, and **0** elements now carry it at rest (was 185).

## The theme toggle: measured, explained, NOT changed

Still ~840ms of blocking on `/spareparts` (3,146 elements). Neither change
above moved it, and it is worth recording why so it is not "fixed" again by
guesswork. Median style-recalc per toggle cycle, same add/remove cycle
throughout:

| cross-fade reach | recalc |
|---|---|
| none | 139ms |
| ~7 structural elements | 231ms |
| curated surfaces (~271) | 450ms |
| **every element (shipped)** | **767ms** |

So ~630ms of it is `.av-theme-transition *` — the 200ms colour cross-fade —
not the `.dark` invalidation, which is only ~139ms. Confirmed the extra root
class is not itself the cost: toggling `.dark` alongside an **inert** second
class that matches no rule measured 184ms against 203ms for `.dark` alone.

Every narrowing that saves real time also lets small elements snap while the
surfaces behind them fade, which is a visible-quality decision, not a
performance one — so it was left alone and handed to the user. **Two earlier
readings of this were wrong before the clean experiment**: a "narrow selector"
variant that looked no faster had been left with the class permanently on
rather than cycled, and a 822ms -> 1212ms "regression" was a single sample
inside a 15-1051ms spread. Take 6+ samples of anything interaction-shaped.

## Conventions to keep

- **Never `waitUntil: "networkidle"` here.** The SSE stream guarantees it never
  fires.
- **A failing dependency needs a negative cache.** Caching only success means
  retrying a broken endpoint on every call, which is the opposite of what a
  degraded system needs.
- **"No subscribers" is a state this app passes through on every navigation**,
  because pages render the shell rather than inheriting it. Anything that tears
  down on the last unsubscribe must defer it.
- **Force GC before believing a node or heap count.** CDP counts what has not
  been collected yet.
- **Interaction timings need repeats.** Single samples here spanned 15-1051ms
  for the same action.

# Dialog height on a 1366x768 screen (2026-08-22)

The reported symptom was "modals don't fit"; the cause was that **no panel had
a height limit at all** — `ModalWrapper`'s panel was `overflow-hidden` with
`max-height: none`, so a dialog taller than the screen turned the whole overlay
into a scrolling page and its heading scrolled off the top with the close
button. A 1366x768 laptop has ~625px of viewport once browser chrome and the
Windows taskbar are gone, which is where the app's larger dialogs cross that
line. Measured before: the spare-part lightbox was **648px in a 625px
viewport**.

## What was wrong, precisely

- **The gutter was not what it said it was.** The centering wrapper read
  `pt-16 sm:pt-18 pb-6 px-3 sm:p-4 lg:p-4 xl:p-6` — the `p-*` shorthand mixed
  with `pt-*`/`pb-*` longhands. Tailwind emits the shorthand first, so from
  `sm` upward `p-4`/`p-6` won every edge and the `pt-16` written to clear the
  floating header did nothing on any desktop width. Computed at 1366x768:
  24px on all four sides. **Read the computed padding, not the class list**,
  whenever a class string mixes `p-` with `pt-`/`pb-`.
- **The panel cap was missing, not merely wrong.** The two-element
  scroller/centering split (documented in `ModalWrapper`) makes an over-tall
  panel *reachable*; it does not stop it being over-tall.
- **Four panels sized themselves in `vh`** (`92vh`, `90vh`, `96vh sm:85vh`)
  while the wrapper spent another 48px around them. `92vh + 48px` is 623px of
  a 625px viewport — it fit by two pixels, and stopped fitting the moment a
  bookmarks bar appeared.

## The fix

`--av-modal-gutter` / `--av-modal-gutter-top` in `globals.css`, tightening on
short (`max-height: 780px`) and narrow viewports, feed two derived vars:

- **`--av-modal-maxh`** — `ModalWrapper`'s own cap on the panel. Nothing else
  should use it.
- **`--av-modal-inner-maxh`** — `maxh - 2px`, what anything INSIDE a panel
  uses. The two exist separately because the panel has a 1px border and
  `box-sizing` is `border-box`: a child capped at the panel's own value is 2px
  taller than the panel's content box, and the panel grows a second scrollbar
  beside the child's. That was measured (`scrollHeight` 601 vs `clientHeight`
  599), not predicted.

The panel is now `max-h-[var(--av-modal-maxh)] … overflow-y-auto`, deliberately
**not** `overflow-hidden` — a cap that clips is worse than the scrolling page
it replaces, because clipped content is unreachable. Every one of the 21
`<ModalWrapper>` call sites inherits this, including any added later.

`MediaLightbox`, `SparePartSpecModal` and `ApproveRepairDialog` additionally
became three-part columns (pinned header / `flex-1 min-h-0 overflow-y-auto`
middle / pinned action bar). The cap alone keeps a dialog on screen; the column
is what keeps its title and its buttons reachable once the middle has to
scroll. `ServiceDetailModal`, `InspectItemDialog` and the customers /
spare-parts form modals already had that shape and only needed the `vh` swapped
for the var.

## Dialogs must also clear the header, not merely fit the screen

Capping the panel stopped dialogs running off the bottom; it did not stop them
sliding under the header. `Header` is `sticky top-0` and, while a dialog is
open, deliberately raised to `z-[2500]` — **above** the modal layer at 1120 —
so a viewport-centred panel is painted *under* the band and loses its top
corner and part of its title row. That is what the long-dead `pt-16` in
`ModalWrapper` had been reaching for.

`Header` now publishes its own height as **`--av-header-h`** on `<html>`, and
`.av-modal-center` / `.av-modal-top` reserve it. Measured, not hardcoded: the
height is breakpoint-dependent (60px at `lg`, 76px at `xl`) and a
`ResizeObserver` also covers the density and font-scale preferences, which
resize the bar with no viewport change at all. Removed on unmount, so `/login`
and `/scanner` fall through to the `0px` default in the `var()` and reserve
nothing.

- **Observe the BORDER box.** The bar inside the header is a fixed
  `h-11`..`xl:h-14`, so the header's *content* box is 56px at every
  breakpoint — only the `py-1.5` / `xl:py-2.5` padding changes. Observed as
  content-box (the default) the callback never fires on a breakpoint crossing
  and the published value silently keeps the previous breakpoint's height.
  Caught by resizing 1920 → 1200 and reading 76px back off a 68px element.
- Verified across five live viewport changes with no reload: 76 → 60 → 60 →
  76 → 76, header height and published var in sync at every step.
- Cost at 1366x768: the panel budget goes 601px → 525px. `CompanionScannerModal`
  crossed the line at 553px and became a three-part column like the others.

## The sidebar flyout was the worse bug, and was found by accident

The collapsed-rail flyout (`motion-expansion` style) positioned itself with
`Math.min(window.innerHeight - 280, …)` — a magic number asserting no flyout is
ever taller than 280px. The **Reports** group has 29 links and renders **869px
tall**; at 1366x768 that put **421px of it below the bottom edge**, on a
`fixed` element with no scroll. Roughly a dozen report pages were unreachable
from the collapsed rail. Now clamped against a real 420px minimum with a
`maxHeight` computed from wherever it lands, plus `overflow-y-auto`: measured
445px, bottom edge at 621 of 625, scrolling internally.

## Verified (real browser, live APIs, 1366x625 unless stated)

| check | result |
|---|---|
| 45 routes swept in an iframe | 0 horizontal overflow, 0 escaping elements |
| 16 dialogs opened and measured | panel ≤ cap, panel overflow 0, overlay overflow 0 |
| tallest dialog (`MediaLightbox`) | 648px overflowing → 601px capped, title pinned |
| `ServiceDetailModal` | 601px = cap exactly, inner cap 599px, **no double scrollbar** |
| 8 sidebar styles x open/collapsed | 0 overflow in all 16 combinations |
| every dialog vs the header band | panel top 88, header bottom 76 — 12px clear, all fully inside the viewport |
| `--av-header-h` across 5 live resizes | in sync at every step, no reload |
| heights 560 / 625 / 1080, `mobile` 375x812 | cap tracks the viewport, gutter switches at 780px |
| `tsc --noEmit`, `npm run build` | clean / exit 0 |

## Conventions to keep

- **A dialog gets its height from `--av-modal-inner-maxh`, never from `vh`.**
  `vh` does not know about the gutter, so anything sized that way is guessing
  at a number the wrapper already knows.
- **A capped panel must scroll, not clip.** If a new modal needs a pinned
  header, make its content a `flex flex-col` capped at the inner var with a
  `flex-1 min-h-0 overflow-y-auto` body — do not add `overflow-hidden` to
  something with a cap and no scrolling child.
- **No magic viewport arithmetic.** `innerHeight - 280` is an assertion about a
  component's height written somewhere that cannot see it. Pair a `top` with a
  `maxHeight` derived from that same `top`, and the panel fits by construction
  at any size.
- **A dialog reserves the header, it does not overlap it.** Anything that
  positions itself against the viewport top needs `--av-header-h`, because the
  header outranks the modal layer while a dialog is open.
- **Framer animations do not run when the browser pane is not compositing** —
  and neither do `ResizeObserver` callbacks, which are delivered on the same
  rendering lifecycle. A freshly constructed observer did not even fire its
  guaranteed initial observation, which read exactly like the border-box fix
  being wrong. **Anything driven by rAF, RO or `IntersectionObserver` has to be
  checked in headless Chrome via playwright-core, not in the Browser pane.**
  Panels sit at their `hidden` variant — `opacity: 0`, `scale(0.95)` — so
  `getBoundingClientRect()` reports 95% of the real size and `AnimatePresence`
  exits never complete, leaving closed dialogs in the DOM where they intercept
  clicks. **Use `offsetHeight`/`clientHeight` for size, and reload between
  modals.** A stuck command palette at `z-index: 1200` silently ate a whole
  round of sidebar clicks in this session before it was spotted.

# Sections 2 and 5 completed (2026-08-19)

## Section 2 — responsive, finished

Everything the earlier pass skipped is now measured. **Two of the four bugs
found were in the probe, not the app** — recorded because the same mistake is
easy to repeat:

- An element wider than the viewport is NOT overflow when it sits inside an
  `overflow-x-auto` container. The first probe reported a 1421px table inside a
  390px page as broken while `documentElement.scrollWidth` measured exactly
  390 = 390. Gate on the DOCUMENT scrolling, then only blame elements with no
  scrollable ancestor.
- `rows=5, rowH=[96,49]` on the spare-parts table was `MOCK_SPARE_PARTS` with
  skeleton rows mixed in — the APIs were down. Virtualization does not even
  engage below 60 rows, so that run measured nothing. **Start the APIs before
  measuring anything data-shaped.**

Verified with both APIs live:

| check | result |
|---|---|
| 3840x2160, 2560x1440, 414, 390, 360 | no page scrolls sideways |
| browser zoom 80 / 100 / 125 / 150 / 175 / 200% | clean at every level |
| spare-parts table, 7 sizes | 25 windowed rows, **rowH uniform [96]**, inner scroll engages below 1920 |
| ExcelViewer, monthly report (740 cells), 9 sizes | renders everywhere, table shrinks 752 → 331px, no doc overflow |
| modal vs header | headerZ 140, modalZ 1100, **dialog paints on top** at every size |

`next/image` was NOT adopted: `next.config.ts` has no `images.remotePatterns`,
and the URLs are arbitrary R2/parts-DB hosts. Whitelisting an open host set to
satisfy a lint rule is the wrong trade — the `<img>` tags stay deliberate.

## Section 5 — data loading, finished

**The fallback was unreachable for the failure it existed to cover.** Every
fetcher in `services/api.ts` wraps its request in `try { fetch } catch { return
mockData }`. A `fetch` against a host that accepts the connection and then goes
silent NEVER rejects — so that `catch` never ran, `cachedFetch` never cleared
the key from `inflightRequests`, and every later caller joined a promise that
would never settle. Measured before the fix: `/spareparts` still showing 80
skeleton elements after **45 seconds**, with no recovery short of a reload.

- All **26** `fetch(` calls in `api.ts` are now `fetchWithTimeout` (20s), which
  aborts via `AbortController` so each fetcher's own `catch` runs normally.
  Measured after: `/spareparts` recovers at **22.1s**, `/receive-item` at
  **21.7s**, skeletons cleared, fallback rows rendered.
- `cachedFetch` keeps a **30s** outer `timeoutAfter` as a backstop for a
  fetcher that hangs for some other reason. It rethrows rather than falling
  back, because at that point there is no fallback to reach.
- **`uploadImage` moved from `fetch` to `XMLHttpRequest`.** `fetch` cannot
  report upload progress — no browser fires progress events for the request
  half, and the Streams request body that would allow it is not supported for
  `FormData`. So a 10MB photo over a phone tether showed a spinner and nothing
  else. Now reports 0-100 and carries a 30s **inactivity** timeout (reset on
  every progress event, so a slow upload is never cut off while bytes move).
  Verified under CDP throttling at 200 KB/s: **56 samples, 0% → 100%,
  monotonic**.
- `AiAssistantProvider` gained a **70s** client timeout — above every
  server-side budget (`AGENT_BUDGET_MS` 50s, `IMAGE_BUDGET_MS` 55s,
  `maxDuration` 60s) so it only fires when the response is genuinely not
  coming. A `timedOut` flag distinguishes it from a supersede, which the catch
  returns silently on; without that the timeout would abort into silence.

**Deliberately NOT done:**
- **No `loading.tsx` added.** The absence is load-bearing: `PageTransition`
  plays the exit on the live stage and `Sidebar` renders the pending bar off
  `isNavigating`. A route-level loading boundary would replace the outgoing
  page with a fallback and undo that whole design.
- **No web worker for exceljs.** `fillTemplate` is behind a dynamic `import()`
  (already code-split) and `TemplateReportView` shows a spinner throughout. At
  740 cells — the busiest month in the data — it renders without a visible
  stall. A worker would be complexity bought for a cost that has not been
  measured to exist.

## Probe discipline, third instance

Three separate times this session a "failure" was the measurement, not the
code: the `overflow-x` false positives, the mock-data table, and a seed script
where `\+` inside a JS template literal collapsed to `+` and made
`new RegExp("/+/g")` throw — so `addInitScript` died, AuthGuard bounced every
page to `/login`, and the audit reported "no dialog" at every viewport. Write
harness files with the Write tool, not a bash heredoc, when they contain regex
escapes.
