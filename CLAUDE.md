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
  spreadsheet's own colours), `src/report-layout/` (the printed report is black ink on white paper regardless of the app's theme, and the same stylesheet has to render inside the phone's WebView where no `--av-*` token exists),
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

# Face Authentication login — WebAuthn / passkeys (2026-08-22)

"Face Login" for the system, built as **WebAuthn passkeys** rather than server-side
face recognition. The device does the biometric check — Face ID, Windows Hello,
Android biometric unlock — and only then unlocks a private key that signs our
challenge. **No face image, and no face embedding, is stored anywhere in this
system.** What `security.UserCredentials` holds is a public key.

## Why not actual face matching

Three approaches were compared before building (browser-side `face-api.js`,
server-side ONNX/ArcFace, WebAuthn). WebAuthn won on this codebase specifically:

- **The device model already matches it.** `/scanner` + `CompanionScannerModal`
  pair a desktop with a personal phone over a QR code. WebAuthn's cross-device
  flow is the same gesture — desktop shows a QR, the phone's Face ID authorises,
  the desktop signs in — so staff learn nothing new.
- **Days, not weeks.** No model, no liveness arms race, no accuracy threshold to
  re-tune. A photo held up to a camera defeats naive face matching; there is
  nothing here for it to defeat.
- **A leaked face embedding is a credential nobody can change.** A leaked public
  key is worth nothing.
- **Priority.** The TechnicalServices API still answers 200 unauthenticated (see
  the AI Assistant section). Spending weeks on face recognition while the data
  underneath is open was the wrong order.

**Be honest about what it delivers:** WebAuthn guarantees *biometric* login, not
*face* login. iPhone gives Face ID; many budget Android phones rate their face
unlock as a weak biometric and fall back to fingerprint or PIN; an office desktop
without an IR camera has no Windows Hello face at all. The UI strings therefore
say "Face or Passkey" in both languages rather than promising a face everywhere.

## Where it lives

| Piece | File |
|---|---|
| Endpoints | `src/APIs/UserManagementAPI/Controllers/WebAuthnController.cs` |
| Table | `src/APIs/UserManagementAPI/Models/UserCredential.cs` → `security.UserCredentials` |
| JWT + refresh minting | `src/APIs/UserManagementAPI/Services/TokenIssuer.cs` |
| Config | `WebAuthn:{ServerDomain,ServerName,Origins}` in `appsettings.json` |
| Proxy | `TestingReact/src/app/api/auth/webauthn/[...path]/route.ts` |
| Browser ceremonies | `TestingReact/src/lib/webauthn.ts` |
| Typed client | `TestingReact/src/services/webauthn.ts` |
| Capability check | `TestingReact/src/hooks/usePasskeySupport.ts` |
| Device management UI | `TestingReact/src/components/PasskeyManager.tsx` (Settings) |
| Login button | `TestingReact/src/app/login/page.tsx` |
| Strings | 28 `passkey.*` keys × en + km |

Package added: `Fido2.AspNet` 4.0.1. Dev tool installed on this machine:
`dotnet-ef` 8.0.16 (global).

## Decisions worth not re-litigating

- **`ServerDomain` is the RP ID and must be the domain the USER's browser shows** —
  the frontend host, not the API host. They differ here. Locally `localhost`
  (a secure context even over http, so passkeys work with no certificate); in
  production `camprotec.com.kh`, a registrable parent of
  `technicalsystem.camprotec.com.kh`. Getting this wrong rejects every enrolment
  with a message that never names the cause. The port is not part of the domain
  but IS part of `Origins`.
- **`AuthenticatorAttachment` is deliberately unset.** Pinning it to `Platform`
  would restrict enrolment to the authenticator built into the machine in front
  of you — on an office desktop, none — and would remove the phone-over-QR flow
  that is the whole reason this approach was chosen.
- **Enrolment requires an existing session; login does not.** Adding a passkey
  binds a device to an account, so the bearer token is what authorises it. That
  is why the "Add this device" button is in Settings and not on the login screen.
- **`runLoginPipeline(authenticate)`** — the login page's five-stage pipeline now
  takes *how* the credential was proved as a parameter. Password and passkey
  share every stage after it, which is why `WebAuthnController.Login` answers in
  exactly the shape `AuthController.Login` does.
- **A cancelled prompt is silent.** `NotAllowedError` covers both "pressed
  cancel" and "timed out" and the spec will not distinguish them. Neither
  deserves a red toast.
- **Raw JSON in and out of the passkey endpoints**, bypassing MVC model binding,
  because this API is configured PascalCase and WebAuthn's wire format is fixed
  camelCase. Details in `src/APIs/UserManagementAPI/CLAUDE.md`.
- **The passkey proxy is its own route, not `api/proxy/[...path]`** — that one
  broadcasts an SSE event after every successful POST, and a sign-in is three
  POSTs. It would have fired three spurious `ticket_updated` events per login.
  Its path allow-list is not decoration: a catch-all segment is user input, and
  without it `webauthn/../../Auth/register-admin` would reach the User API.

## Verified, not asserted

Against the running API (isolated build on :8091, so the dev instance on :8087
was never touched) and headless system Chrome:

| check | result |
|---|---|
| `login-options` (usernameless) | `rpId: localhost`, `userVerification: required`, base64url challenge, `allowCredentials: []` — camelCase survived the PascalCase API |
| challenge replay | second use of the same ceremony id → "expired" (single-use holds) |
| unknown username | normal options, empty allow-list — indistinguishable from a real user with no passkeys |
| `register-options` / `credentials` with no token | 401 |
| empty credential `{}` | 400 JSON |
| login page, en / km | button renders, `type="button"`, **outside** the password form, password login intact, 0 console errors |
| Settings panel | renders; error path shows `ErrorState` + Retry |
| `tsc --noEmit`, `next build`, `dotnet build` | clean / exit 0 / 0 errors |
| ESLint on the 5 new frontend files | 0 problems |

**Full round trip, 7/7, against the live app and the real database** — headless
Chrome with a CDP virtual authenticator standing in for Face ID
(`scratchpad/verify/passkey-e2e.mjs`):

| step | result |
|---|---|
| password sign-in | `/`, token `alg: HS256` |
| enrol from Settings | 1 credential on the authenticator, `isResidentCredential: true`, `rpId: localhost` |
| Settings list | "Chrome on Windows — This device only · Last used: Not used yet" |
| sign out, then **passkey sign-in with no username typed** | `/`, real token, `signedInAs: admin`, `roles: [SuperAdmin]` |
| remove the passkey | list back to empty; `security.UserCredentials` back to **0 rows** |
| console errors across the whole run | **0** |

So the discoverable-credential path works end to end: the account was resolved
from the credential alone, with nothing typed.

**Two real defects were found only by running it**, both invisible to the type
checker: `JsonSerializer` turns `{}` into an all-null credential without
throwing, so a null `RawId` reached the database query; and an unhandled
exception left the route returning a stack trace instead of the JSON the
frontend parses. Both fixed (`Guarded(...)` + explicit null checks).

## Known issues left unresolved

- **The login page's "Quick Demo Personas" buttons are broken.** The Admin
  button fills `admin` / `admin123` and the API answers 401 — that password is
  not this account's. Pre-existing, unrelated to passkeys, but it means the one
  affordance on the page that looks like a quick way in is a dead end, and five
  clicks of it locks the account for five minutes.
- **Do not use plain `dotnet ef database update`** for the next migration either
  — see the migration note in `src/APIs/UserManagementAPI/CLAUDE.md`.
  `sql/webauthn-usercredentials.sql` has been applied (table + 2 indexes +
  history row all confirmed present).
- **`AuthController` still has its own private JWT + refresh-token methods**,
  duplicating `TokenIssuer`. Left alone deliberately — rewiring the password
  login path was more risk than this feature justified. They can drift.
- **The ceremony challenge is in `IMemoryCache`**, so it is sticky to one API
  process. If this API is ever scaled past one instance, logins will fail
  intermittently and look like browser bugs. Move it to a distributed cache or a
  table before that happens.
- **`Fido2Configuration.ChallengeSize` is left at the library default** (16
  bytes — the spec minimum). Fine, but it is a default rather than a decision.
- **No passkey-only accounts.** Every account still has a password, and this is
  additive. Removing password login is a separate product decision.

# Face verification — the actual camera (2026-08-22, later same day)

Added AFTER passkeys, because passkeys turned out not to be what was being asked
for. WebAuthn hands the biometric to the device and never opens a camera; the
machine this was built on has **no biometric hardware at all** — verified:
`Get-PnpDevice -Class Biometric` returns nothing, and
`isUserVerifyingPlatformAuthenticatorAvailable()` returns `false`. So "Face
Login" via passkey offered a PIN or a QR-to-phone, and there was no face on
screen. Both features now exist and they are different things:

| | Passkey (`api/auth/webauthn`) | Face verification (`api/auth/face`) |
|---|---|---|
| Who checks the face | the device | this app, in the browser |
| Camera opens | never | yes |
| Stored here | a public key | a 128-float descriptor |
| Strength | phishing-proof, hardware-bound | **second factor only** |
| Sensitive data | none | yes — biometric-derived |

## The flow, and why it is a real factor

```
POST api/auth/face/login-start  { userName, password }
     -> no face enrolled : the full session (drop-in for api/Auth/login)
     -> face enrolled    : { requiresFace: true, faceToken }   and NO token
POST api/auth/face/login-verify { faceToken, descriptor }
     -> the full session
```

The real session is not issued until the face matches. Someone holding only the
password gets a `faceToken`, which carries no roles, no permission claims and
nothing callable — a two-minute single-use receipt saying "somebody knew this
password". **Verified**: with a face enrolled, the correct password leaves the
browser on `/login` with no token in `localStorage`.

## Honest limits — read before promoting this

- **The descriptor is computed in the browser.** The server compares a vector it
  did not produce, so anyone who can craft a matching vector skips the camera.
  This is the ceiling of client-side face recognition and the entire reason this
  sits behind a password. Moving the embedding server-side (ONNX + ArcFace) is
  the upgrade path; until then it must not become a primary credential.
- **Liveness is a client-side blink check, so it is advisory.** It stops a photo
  held up to the lens. It does not stop devtools.
- **`Face:MatchThreshold` (0.45) has not been tuned on real faces.** face-api
  documents 0.6, tuned for photo tagging where a false accept costs a mislabel.
  Every verify logs `distance {value}` on success and failure — tune from that
  distribution across real staff in real lighting, not by nudging until a test
  passes. Too strict locks people out; too loose is the whole risk.
- **A passkey bypasses the face step, on purpose.** A hardware-bound credential
  is strictly stronger than password + client-side face, so requiring both would
  be cost with no gain.
- **A failed match never returns the distance.** That would be a similarity
  oracle a caller could hill-climb to a match without ever seeing the enrolled
  face. Only `attemptsLeft` comes back.

## Where it lives

Backend: `Controllers/FaceAuthController.cs`, `Services/FaceMatcher.cs`,
`Models/UserFaceTemplate.cs` → `security.UserFaceTemplates`, migration
`AddFaceTemplates` (applied via `sql/face-templates.sql`), config
`Face:MatchThreshold`.

Frontend: `lib/faceEmbedding.ts` (models + blink), `components/FaceCapture.tsx`
(the camera step, shared by both modes), `components/FaceVerificationManager.tsx`
(Settings), `services/faceAuth.ts`, `app/api/auth/face/[...path]/route.ts`, the
face branch in `app/login/page.tsx`, 39 `face.*` keys × en + km.

Dependency: `@vladmandic/face-api` 1.7.15. Its weights are copied into
`public/models/` — **only three of the seven** (`tiny_face_detector`,
`face_landmark_68`, `face_recognition`), 6.8MB total. They are fetched lazily on
first use, so nobody who never opens the face screen downloads them.

## Verified

**Backend, 19/19** (`scratchpad/verify/face-api-test.py`, live API + real DB):
enrolment refuses fewer than 3 samples and refuses all-zero descriptors; password
alone stops working once enrolled; a matching descriptor completes the sign-in; a
spent `faceToken` is rejected; a different face is rejected and decrements
`attemptsLeft`; the rejection body carries no distance; a malformed capture is a
400 that does **not** spend an attempt; the token dies when attempts run out and
even the right face cannot revive it; `status`/`enroll` require a session;
removal restores password-only login.

**Frontend, 7/7** (`scratchpad/verify/face-ui.mjs`, headless Chrome with
`--use-fake-device-for-media-stream`): Settings renders the section; the 6.8MB
models load through Next's bundler and the camera starts (1 live track) and the
detection loop runs; the camera is released on cancel; and the correct password
alone does not sign in once a face is enrolled. 0 console errors.

`tsc --noEmit` clean, `next build` compiles, `dotnet build` 0 warnings 0 errors,
ESLint back to **161** — identical to before this feature. Both test suites clean
up after themselves; `UserFaceTemplates` and `UserCredentials` are both back to
0 rows.

**Not verified, and only a human can:** a real face in front of a real camera.
Chrome's fake device emits a colour pattern, so the detector was never given a
face to recognise — everything up to and including the detection loop is proven,
the recognition itself is not.

## Probe discipline, again

The first run of the backend suite reported the matcher rejecting a legitimate
face. It was the test: gaussian noise at sigma 0.05 across 128 dimensions lands
**0.566** away, which is a borderline different face, not the same one. Distance
is `sqrt(128) * sigma`, so sigma 0.02 (~0.23) is what one person across two
frames actually looks like. The suite passed 19/19 once the probe was right.
Second time this session that a "failure" was the measurement.

# Face on the phone, over a QR code (2026-08-22, later still)

The desktop camera flow shipped and then did not work for the person it was
built for. Two things came out of that.

## The blink gate hung, and the cause was not the threshold

Reported as "the scan does not work at all". It did work: the camera opened, the
face was found, and the screen said *Blink once to continue* while the user
blinked at it repeatedly. Two compounding causes, both mine:

- **The loop ran the recognition net on every tick.** `readFace` computed the
  full 128-float descriptor 5x a second purely to measure eye aspect ratio. Each
  pass took longer than the 200ms interval that scheduled it, so the effective
  sample rate was ~3-4Hz — and **a blink lasts about 120ms**, so the closed-eye
  frames fell between samples. The gate could not see what it was asking for.
  Split into `probeFace` (detector + landmarks, roughly an order of magnitude
  cheaper) and `readFace` (adds the descriptor, called only at the moment of
  capture), with the tick at 100ms and a re-entrancy guard.
- **The 0.21 eye-aspect-ratio threshold is not universal.** It is the number from
  the original EAR paper, and it does not survive real users: eye shape, sitting
  distance and laptop-lid angle all move the ratio, so for one person 0.21 is
  never reached with their eyes shut and for another it is never exceeded with
  them open. `BlinkDetector` now learns each face's own open-eye baseline over
  ~6 frames and looks for a fall to 72% of it followed by a recovery past 85% —
  hysteresis, so noise cannot count as a blink. The UI says "hold still" until
  the baseline exists, because asking for a blink against a detector that cannot
  yet judge one is what made this feel broken.

**Neither was visible to any test that had run.** The headless suite uses
Chrome's fake camera, which emits a colour pattern with no face and therefore no
eyes — everything up to the blink gate passed, and the gate itself was never
exercised. That is the honest limit of that harness, now written down.

## Phone pairing: scan a QR, show your face on the phone

Requested because an office desktop's webcam is worse than everyone's phone.
Built on the same bridge shape as the existing barcode companion scanner
(`/scanner`), which staff already use.

```
Settings  -> QR -> phone captures 3 faces -> phone is PAIRED, keeps a device token
Login     -> QR -> phone captures 1 face  -> desktop receives the session
```

**The pairing is what makes this safe, and it is not optional.** The obvious
design — take the face and search every enrolled user for a match — is 1:N
identification, and it fails twice over: the face becomes the only credential,
and false accepts scale with headcount, because a threshold that rarely confuses
two given people will confuse *some* pair once it runs across fifty of them on
every login. Pairing the phone first turns it back into 1:1: the token names the
account, and the face only has to answer "is this that person". The result is two
real factors — something you have (this paired phone), something you are.

`security.UserFaceDevices` stores the token **hashed**, like a password: the row
is enough to sign in as its owner, so a table dump must not hand anyone a working
credential.

### Two secrets per pairing session, not one

`lib/faceLinkBridge.ts` issues an `id` **and** a `secret`:

- the `id` goes in the QR — anyone who can see the screen has it;
- the `secret` never leaves the desktop and is required to read the event stream.

On the login path that stream delivers a real JWT. Without the split, anyone who
photographed the QR could open the stream and collect the session. The barcode
scanner needs none of this because a barcode is not a credential.

The phone gets a device token and never a session; the desktop gets a session and
never the device token. Neither ever holds the other's secret.

## Verified

**17/17 end-to-end** (`scratchpad/verify/facelink-e2e.mjs`, both halves driven
from Node against the live app and real DB): a QR-only listener is refused (404),
a wrong secret is refused, the phone joins and the desktop is told, pairing
stores the face and returns a device token, a spent pairing session is refused
(409), a login session needs no auth, **a different face is refused**, the right
face is accepted, **the phone's response contains only `isSuccess`** — no token —
and the desktop receives the session with the correct user and roles. An unknown
device token gets nowhere. Cleanup leaves 0 faces, 0 paired phones, 0 passkeys.

`tsc --noEmit` clean, `next build` compiles (`/face-link` and both API routes
present), ESLint **161** — unchanged, new files contribute 0.

**Still only a human can check a real face in front of a real camera.**

## Known issues left unresolved

- **The pairing bridge is single-process**, like `eventBus` and `scannerBridge`.
  Behind more than one Node instance the phone's POST and the desktop's stream
  can land on different processes and pairing silently never completes. Move it
  to Redis before scaling out.
- **The stream secret travels as a query parameter**, because `EventSource`
  cannot set headers. It can therefore appear in an access log. Bounded
  deliberately: it grants only the right to read one five-minute session.
- **The QR points at the LAN IP** from `/api/scanner/network-ip`, so the phone
  must be on the same Wi-Fi. Same constraint the barcode scanner already has.

# Why the phone hung on the QR, and what it took (2026-08-22, same day)

The QR pairing shipped and the phone showed a spinner forever. Three separate
causes, found by measuring rather than guessing. Only one of them was in the
feature's own code.

## 1. `allowedDevOrigins` — the actual blocker, and it was already wrong

Every asset the phone requested came back **403**, so the page server-rendered
its header and React never hydrated. No error, no console message on the phone,
just a spinner. Next blocks cross-origin requests to dev-only assets by default.

`next.config.ts` already had an `allowedDevOrigins` list — and **two things in it
were wrong before this feature existed**:

- **`192.168.*` never matched anything.** Reading
  `next/dist/esm/server/app-render/csrf-protection.js`: patterns are matched by
  dot-separated segment, **right to left**, the same way image `remotePatterns`
  are, because the wildcard is meant for *subdomains*. So `192.168.*` matches a
  three-segment `192.168.x` and cannot match the four segments of
  `192.168.0.222`. Only the literal entry beside it ever worked. An IPv4 address
  needs all four: `192.168.*.*`.
- **`:3000` entries are inert.** `blockCrossSiteDEV` compares
  `parsedOrigin.hostname`, so a port in the list is never consulted.

The list now covers RFC1918 properly — `10.*.*.*`, `192.168.*.*`,
`172.16.*.*`..`172.31.*.*`. Chasing one address at a time does not work: the
laptop sits on 192.168.x on office Wi-Fi and 10.x on a phone hotspot, which is
exactly what happened here.

**This affects `/scanner` too**, not just face pairing — the barcode companion
page loads from the same LAN origin and would have been refused the same way on
any network other than the one hardcoded address.

## 2. A LAN http:// origin is not a secure context, so there is no camera

Even with the assets served, `navigator.mediaDevices` is **undefined** on
`http://10.199.229.22:3000`. Only https and localhost are secure contexts, and
outside one the browser does not refuse permission — it removes the API. Measured:
`isSecureContext: false`, `mediaDevices: "undefined"`.

`openCamera()` reported that as `noCamera` — *"No camera was found on this
device"* — on a phone plainly holding a camera. There is now a distinct
`insecureContext` code, checked **before** anything opens a camera, and
`/face-link` shows the real reason with the fix in it. `/scanner` already knew
this ("requires HTTPS or Localhost") and falls back to a photo input; face auth
deliberately does **not** take that fallback, because a still photo defeats the
liveness check the whole feature rests on.

Three ways to get a secure context, in order of preference:

1. **`npm run dev:https`** (added). `next dev --experimental-https` generates a
   self-signed cert; the phone warns once, choose Advanced and continue.
   **Run it in your own terminal**: it downloads mkcert and then installs a local
   CA, which on Windows raises a UAC prompt. Started from a background process it
   stalled at *"Download response was successful, writing to disk"* and never
   bound the port, because nothing could answer that dialog.
2. **A tunnel** (localtunnel/ngrok/cloudflared) — a real https origin, and works
   off the LAN entirely.
3. **Chrome flag on the phone**, for quick testing:
   `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add the exact
   origin, relaunch. **Verified** with the same flag on desktop Chrome:
   `isSecureContext` became `true`, `navigator.mediaDevices` appeared, and the
   page moved past the guard to "This phone is not paired" — the correct next
   state for a browser holding no device token.

## 3. The QR session churn — real, but not what anyone saw

`FaceLinkQr` had `onDone` and `t` in its effect's dependency list. Both are new
identities on every parent render, so the effect could tear down and recreate the
pairing session, leaving the QR pointing at a session already deleted. Fixed by
reading both through refs — updated **in an effect**, not during render, because
`react-hooks/refs` flags a render-time ref write and is right to: a render can be
discarded and replayed.

It was not the reported symptom. The two sids in the screenshots came from two
separate attempts, not from churn.

## Probe discipline, third and fourth instances this session

- **"QR session survives re-renders" failed against correct code.** React Strict
  Mode mounts, unmounts and remounts every component once in dev, and this one
  creates a session per mount — so the first sid on screen is replaced moments
  later by the second. The test read before that settled. Isolated properly, the
  sid survives an idle wait, a synthetic resize and a real viewport change.
- **The headless face suite could never have caught the blink bug or this one.**
  Chrome's fake camera emits a colour pattern with no face, and it runs on
  `localhost`, which is a secure context. Both failures live exactly where that
  harness cannot look: a real face, and a real LAN origin.

## Verified after the fixes

| check | result |
|---|---|
| LAN http assets | 403 → **no failed resources**, JS hydrates, join returns 200 |
| phone page on LAN http | shows **"Secure connection needed"** with the fix, not a spinner |
| does it still claim "no camera"? | **no** |
| same origin with the Chrome secure-origin flag | `isSecureContext: true`, `mediaDevices` present, reaches "not paired" |
| QR session after settling | stable across idle, synthetic resize, real viewport change |
| a phone scanning the displayed QR | accepted (200) |
| full pairing round trip | **17/17** unchanged |
| `tsc`, `next build`, ESLint | clean / compiles / **161**, unchanged |


# Frontend performance pass — shared bundle and render cost (2026-08-31)

Reported as "sometimes slow / laggy, all pages". It was, and the cause was
mostly **not** the pages: an empty route (`/_not-found`) cost **1,230.7 KB** of
First Load JS, so ~1.2 MB was paid by every route before its own code ran.

## Measure it yourself — the build no longer prints the table

Next 16 + Turbopack emits **no `app-build-manifest.json`** and no First Load JS
summary, so the old "read the build output" habit gives you nothing. The source
of truth is the prerendered HTML: every `/_next/static/chunks/*.js` it
references is a script the browser fetches before the route is interactive.
Union those per route, sum the file sizes. Chunks are minified with no path
comments, so identify them by content — counting Khmer codepoints
(`/[ក-៿]/`) found the dictionary chunk immediately.

## Results

| | before | after |
|---|---|---|
| First Load JS, median route | 1,277.0 KB | **1,127.0 KB** |
| First Load JS, worst (`/scanner`) | 1,730.9 KB | **1,580.9 KB** |
| Layout floor (`/_not-found`, an empty page) | 1,230.7 KB | **1,080.2 KB** |
| Khmer dictionary in the initial load | 111.7 KB chunk, 25,758 chars | **not fetched** |

Measure the dictionary claim by locating the chunk, not by counting Khmer
codepoints in the initial load — that number is **780, not 0**, and always was:
several components carry hardcoded Khmer strings that have nothing to do with
the dictionary. The check that means something is whether the >5,000-char chunk
appears in the route's script set. It does not.

Every route dropped ~151 KB. **All 55 are still over the 300 KB budget** — the
remaining floor is react-dom (~380 KB), framer-motion (133 KB) and the Sidebar
(171 KB), and no amount of lazy-loading reaches those.

## What was wrong

- **Both language dictionaries shipped on every route.** `translations.ts` was
  213 KB of pure string data — it neither minifies nor tree-shakes — statically
  imported by `LanguageProvider`, which the root layout mounts. Every user
  permanently downloaded the language they were not reading. Split into
  `i18n/en.ts` (static, it is the default and the SSR snapshot) and
  `i18n/km.ts` (dynamic `import()`), with a `dictRevision` external store to
  re-render consumers when the Khmer table lands — `t` is memoised on `[lang]`,
  so without it a Khmer user sits on English with the right dictionary already
  in memory. Details in `TestingReact/src/CLAUDE.md`.
- **`qrcode` and the AI panel rode in on the layout.** Both are mounted by
  `app/layout.tsx` and render nothing until opened. Now `next/dynamic`.
- **The ticket table re-rendered every loaded row on every keystroke.** Rows
  were inline JSX inside `items.map` — up to 2,000 rows x 9 cells, including a
  `RenderStatusSelect` each, re-reconciled before the 300ms debounce had even
  fired the request. Extracted to a memoised `ServiceTableRow`.
- **A request waterfall on every uncached list load.** `fetchRepairServices`
  awaited the ticket search and *then* `fetchUserMap()` — ~600ms of cold
  user-map latency stacked on top of search time, at five call sites.
  `reports.ts` already did this pair with `Promise.all`; `api.ts` never got the
  fix.
- **Report pages could hang forever.** All six reads in `reports.ts` used bare
  `fetch`, which has no timeout, so a backend that accepts the connection and
  goes quiet left the spinner turning with Retry unreachable behind it.
- **Every page load re-applied an unchanged theme**, costing a document-wide
  style recalc plus the global 180ms cross-fade — which this repo has already
  measured at ~630ms on `/spareparts` — for a no-op write.
- **A failed refresh DELETED rows, and persisted the deletion.**
  `useInfiniteList`'s `refresh` caught each page fetch into
  `{ items: [], totalCount: 0 }`, making "the request failed" and "this page is
  empty" the same value — then spliced that empty `head` over the first
  `pagesToRefresh * pageSize` rows. So a failed refresh removed exactly the rows
  it could not re-fetch, and because `writeCachedList` then ran on the truncated
  list, the loss was written to `sessionStorage` and **survived a reload**.
  Reachable, not theoretical: `updateServiceStatus` and the SSE handler both
  `invalidateCachePrefix("repairservices")` immediately before refreshing, so
  `cachedFetch` has no stale entry to serve and its 30s backstop rethrows
  (`if (entry) return entry.data; throw err;`). Failures are now
  distinguishable from empty pages, and **any** failure abandons the whole
  refresh, keeping what is on screen.
  - Measured with a differential harness reproducing both implementations over
    a 125-row list scrolled to 5 pages: one failed page lost **25 rows**, two
    lost **50**, all three lost **75** — every one persisted. After the fix,
    zero rows lost in all four failure shapes, and the all-succeed path is
    byte-identical to the old output.
  - A partial merge was considered and rejected: `head` would be missing the
    failed pages while the splice still removed their rows, so rows vanish AND
    everything after them shifts.

## `dynamic(ssr: false)` in the layout needs a gate — this is not optional

Both `AiAssistantPanelHost` and `GlobalCompanionModal` load their payload with
`ssr: false`, and a plain unconditional render of either is a **real, observed**
hydration mismatch: the server emits no markup while the client immediately
renders a `<Suspense>` boundary, so React finds the Toaster's `<div>` where it
expected that boundary and regenerates the whole tree.

`GlobalCompanionModal` is the instructive one. Its `sessionId` comes from
`useState(() => getOrCreateSessionId())`, which returns `""` on the server and a
real id in the browser — a latent mismatch that had been harmless for as long as
the modal produced no DOM either way, and became visible the moment a Suspense
boundary appeared there. **The dynamic import did not introduce the bug; it
revealed one.** Both now gate on a latched flag that is false on the server and
on the first client render. Full reasoning in
`TestingReact/src/components/CLAUDE.md`.

Worth noting for its own sake: the *"Encountered a script tag while rendering
React component"* error was a **symptom** of that mismatch, not a separate
problem — React re-rendering the discarded tree on the client re-ran the
sanctioned `ThemeScript`/`LanguageScript`. It disappeared when hydration was
fixed. If it reappears, look for a hydration mismatch before touching those two
files.

## Deliberately not done

- **The Sidebar's eight style variants (119 KB) still all ship.** The obvious
  per-style module map does **not** match the actual branch structure: branches
  key on style AND open-state (`isEnterprise && isOpen` uses a different
  renderer than a collapsed enterprise sidebar), so a literal split changes
  behaviour. It needs a real refactor of a 2,635-line file, verified across 8
  styles x open/collapsed x 2 themes.
- **`prefetch={true}` on the sidebar links was left alone.** Per
  `node_modules/next/dist/docs/.../link.md`, `auto` (the default) already
  prefetches the *full* route for **static** routes, and all 55 here are
  static — so the prop is a no-op, and `false` would trade away first-click
  speed for nothing.
- `ExcelViewer` still mounts a second full copy of the sheet in fullscreen.
  The cell grid is memoised now, but both copies remain mounted.

## Found by the review, flagged not fixed

Each needs a judgement call rather than a mechanical edit:

1. **`Header`'s profile-photo upload block is orphaned** — `isUploadingPhoto`,
   `photoProgress`, `photoFileInputRef`, `handlePhotoFileSelected` and the
   `Camera`/`Loader2`/`Leaf` imports are unreferenced in the JSX, yet
   `useProfilePhotoUpload()` still runs on every Header mount for a UI that no
   longer exists. Not deleted: §10 says flag rather than remove when something
   may be reserved for near-term work, and this looks like a feature that was
   pulled mid-flight. Either restore the button or remove the hook call.
2. **`withThemeFade` contradicts its own comment.** `theme/ThemeProvider.tsx`
   says the timeout is "50ms longer than the transition" so a class removed at
   exactly the transition length cannot cut the final frame short — but it now
   removes at **190ms** against a **180ms** CSS transition (`globals.css`),
   leaving 10ms. Restore 230ms or correct the comment.
3. **`src/app/loading.tsx` now exists**, which contradicts the documented
   design decision above that the absence of any `loading.tsx` is load-bearing
   (a route-level boundary replaces the outgoing page that `PageTransition` and
   the sidebar's pending bar are built around). Unrelated to this pass; worth a
   deliberate look.
4. `components/CompanionScannerModal.tsx` calls `navigator.clipboard.writeText`
   with no `.catch` — an unhandled rejection in an insecure context, while
   still showing a success toast — and uses a bare `setTimeout` where this repo
   already adopted `useSafeTimeout` elsewhere.
5. `ServiceTable`'s `handleInlineStatusChange` discards the `boolean` that
   `updateServiceStatus` returns, so a server-rejected status change shows as
   applied until `refreshLoaded()` corrects it. (A failed refresh no longer
   deletes rows — see the row-deletion fix above — so the row simply keeps its
   optimistic value until a later refresh succeeds.)

## Conventions to keep

- **Anything mounted by `app/layout.tsx` is on the critical path of all 55
  routes.** Before adding an import there, ask what it costs a route that never
  uses it.
- **A `next/dynamic` component in the root layout needs an error boundary.**
  `next/dynamic` is `React.lazy` + `Suspense`, and a rejected `import()` is
  re-thrown during render. The layout's lazy hosts sit *outside*
  `app/error.tsx`, so the only boundary above them is `app/global-error.tsx` —
  which replaces the whole document. One 404'd chunk after a deploy would
  therefore replace the entire app, discarding open dialogs. Wrap them in
  `components/LazyMountBoundary.tsx`, and give `dynamic()` a `loading`
  component so the click is not a dead one while the chunk downloads.
- **Don't let `refresh`/`loadMore` identities leak into a memoised row's
  props.** `useInfiniteList`'s `refresh` used to depend on `loadedPages`, so it
  changed identity on every appended page — which flowed through
  `handleInlineStatusChange` into every `TicketRow` and re-rendered all loaded
  rows on every scroll batch. The row memo looked like it worked and did not.
  `loadedPages` is read through a ref for exactly this reason.
- **`import type` from `@/i18n/translations` only.** Importing a *value* from
  that barrel pulls both dictionaries into the shared chunk and silently
  reverses the split. It exports exactly one value (`translations`, for the
  server) to keep that trapdoor as narrow as possible; constants live in
  `i18n/languageConfig`.
- **A memoised row is defeated by a closure.** Handlers must take the row as an
  argument and arrive as stable `useCallback` identities; an inline
  `() => doThing(row)` silently restores the unmemoised behaviour and nothing
  looks broken.
- **A no-op write is not free.** `writePrefs` re-applying identical preferences
  cost a full document-wide recalc; guard on equality, do not merely tolerate it.
- **Never let a failed fetch look like an empty result.** `.catch(() => ({
  items: [] }))` is the shape of this bug: downstream code cannot tell "nothing
  came back" from "there is nothing", and anything that then reconciles against
  the empty value destroys data. Keep the failure distinguishable and decide
  explicitly — a read that merely refreshes should abandon, never truncate.
- **Never `.test()` a `g`-flagged regex in a loop.** `lastIndex` persists
  between calls, so results depend on call order. `String.split` with one
  capture group puts matches at odd indices — use the position.

# CAM ID Mobile — real face detection and auto-capture (2026-08-23)

`./CamIdMobile` is the Expo companion app. It had a camera and a three-pose
enrolment HUD and **no face detection of any kind**: the poses advanced on
`setTimeout`, the approval modal approved after a fixed 1,200ms, and the
"biometric descriptor" was `Array(128).fill(1/Math.sqrt(128))`.

## The stack, and why not the one the plan named

`expo-face-detector` is gone from SDK 54, and `expo-camera` has no frame
processor, so nothing could see a frame. Now **VisionCamera + Google ML Kit**.
The obvious versions are the wrong ones:

| | shipped | why not the newest |
|---|---|---|
| `react-native-vision-camera` | **4.7.3** | v5 (Apr 2026) moved to Nitro Modules and its face-detector pair is built against RN 0.85. Expo SDK 54 is RN **0.81.5**. 4.7.3 is the version contemporaneous with this SDK. |
| `react-native-vision-camera-face-detector` | **1.10.2** | v2.x peers `react-native-vision-camera >= 5.0` + `react-native-nitro-modules`. The 1.x line is the VC4-compatible one. |
| `react-native-worklets-core` | **1.6.3** | 2.0.0 is beta-only. |
| `react-native-reanimated` | **not installed** | Expo 54 bundles Reanimated **4**, which uses `react-native-worklets` — a *different* package from `worklets-core`, and two worklet runtimes in one bundle is its own failure. Nothing here needs it: every animation is RN's `Animated`. |

**This needs a development build.** Expo Go cannot load these native modules.
Built on **EAS** (`eas.json` added) because this machine has no Android Studio,
no Android SDK and no JDK — verified, not assumed.

## Two build-time defects that only a real bundle found

`tsc --noEmit` passed throughout and proved neither of these. `npx expo export`
is what caught them, and it is the check worth repeating:

- **`react-native-worklets-core@1.6.3` names three Babel plugins that are not
  installed.** Its plugin runs a nested `transformSync` over every `'worklet'`
  function and asks for `@babel/plugin-proposal-optional-chaining` and
  `@babel/plugin-proposal-nullish-coalescing-operator` — the **deprecated**
  Babel 7 names, renamed to `plugin-transform-*` in Babel 7.20, so Expo 54 no
  longer ships them — plus `@babel/plugin-transform-template-literals`. All
  three are now devDependencies and are documented in `babel.config.js`. They
  look unused and are not: delete one and the bundle dies at the first file
  containing a worklet, which is the face detector itself.
  `plugin-transform-template-literals` must stay on **7.x** — 8.x wants
  `@babel/core@^8`.
- **`lucide-react-native@0.475.0` caps at React 18** and this project is on
  React 19, so `npm install` refused outright. Bumped to `^0.544.0`, the first
  release whose peer range includes 19. All 25 icons the app imports still
  resolve (tsc typechecks those imports, which is the actual proof — a regex
  probe over the package's `.d.ts` said all 25 were *missing* and was wrong).

## The descriptor is a placeholder, and the backend now knows it

ML Kit detects and locates faces; it has **no recognition model**, so it cannot
produce an embedding. The 128 floats the app sends are a fixed unit vector,
identical on every phone, with its value published in this repo — now isolated
in `src/services/faceDescriptor.ts` with the full explanation, instead of
scattered as a literal across five call sites.

**`device/enroll` used to delete the account's existing face templates and
write that constant in their place.** `security.UserFaceTemplates` is shared
with the browser's face second factor, so pairing a phone destroyed the user's
real enrolled face *and* left `login-verify` passable by anyone who posted the
published constant. It cleared `FaceMatcher.IsWellFormed` because its magnitude
is exactly 1. `FaceAuthController.EnrollDeviceCore` now contributes samples
**only when the account has none**; an existing enrolment is left alone, and the
response reports what was actually stored (`SampleCount`, `FaceAlreadyEnrolled`)
rather than what was posted.

Consequence, stated rather than hidden: a user who has a browser-enrolled face
and then pairs a phone will fail `device/login`'s descriptor comparison, because
the placeholder does not match their real face. That is the correct answer — the
phone cannot prove the face — and the push-to-approve path (device token plus
the phone's own biometric) is the one they should use. **Not verified against a
real paired account.**

## What the app actually does now

- `src/hooks/useFacePose.ts` — one place turns frames into a pose, a quality
  verdict and an auto-capture decision; all three face screens read it.
  Auto-capture requires **3 consecutive frames AND 400ms held**, both, because
  frame count alone is device-speed dependent (~12fps to ~30fps) and would fire
  before the user finished moving on a fast phone. Per-frame bookkeeping lives
  in refs and only a *changed* rendered value reaches React — 20-30 setStates a
  second would stutter the preview.
- `ApprovalRequestModal` now needs a real face **and** a real
  `expo-local-authentication` pass before it approves, tracks `failedAttempts`
  properly (the counter existed and was never incremented), reaches the `locked`
  stage that was declared and unreachable, and denies the waiting desktop at
  the limit. Its 20s search timeout is the only timer left, and it gives *up*.
- `FaceScanScreen` advances on real detection instead of its 1,800ms timer.
- Guidance is bilingual and comes from the detector: "move closer", "centre your
  face", "hold still" — `src/i18n/faceGuidance.ts`, typed as a `Record` so a new
  status without a string is a compile error.

## Conventions to keep

- **`expo-camera` and VisionCamera both ship in this app and must never be
  mounted at once.** QR needs the barcode scanner (expo-camera); faces need
  frame processors (VisionCamera). They are in mutually exclusive branches; the
  second one to open a shared camera gets a black preview.
- **`YAW_SIGN` in `useFacePose.ts` is the one value a real device must
  confirm.** ML Kit's yaw sign passes through a mirrored front preview and the
  detector's own `cameraFacing` normalisation. If "turn left" is satisfied by
  turning right, flip that constant — the pose test and the arrow both read it,
  so there is no second place to change.
- **Run `npx expo export` before believing a native change.** `tsc` cannot see
  Babel plugin resolution, worklet transforms or Metro resolution, and all three
  are where this stack breaks.
- A frame-processor callback is built once and invoked for many frames, so
  **anything it reads from component state must be mirrored into a ref**, and
  mirrored *during render* — an effect runs after paint and leaves a window in
  which a capture lands against the previous step.

## Not verified — only a person with the phone can

Everything above is static verification: `tsc --noEmit` clean, `npx expo export`
bundles 2,443 modules to a 4.34MB Hermes bundle, the worklet transform provably
applied (`__initData`/`__workletHash` emitted, no raw `'worklet'` directive
left), `npm ci` lockfile in sync, `expo config` resolves both camera plugins,
and `dotnet build` of `UserManagementAPI` is 0 warnings / 0 errors from an
isolated output directory (the running instance was never touched).

**No frame has been through ML Kit.** Not the yaw sign, not the pose
thresholds, not the 22%-of-window proximity gate, not the auto-capture feel, not
whether a real Android device grants both camera stacks cleanly. The EAS build
itself has not been run. Those need the APK on a phone.

# One report layout for Web and CAM ID (2026-09-02)

The printed Technical Service Report existed **three times**: `ReportDocument.tsx`
(1,926 lines of React) served both the web print path and the Templates Settings
canvas, and `CamIdMobile/src/services/portalTechnicalReportService.ts` was a
separate 887-line hand-written HTML generator for the phone. It is now defined
once, in `TestingReact/src/report-layout/`, mirrored into
`CamIdMobile/src/report-layout/` by `npm run sync:shared`, with a
`--check` drift guard in `npm run typecheck` and `npm run build`. Full notes in
`TestingReact/src/components/CLAUDE.md`.

## Why the printed page was misplaced — three compounding causes, all measured

None of them was the `@page` rule people reach for first. Measured in headless
Chrome under `emulateMedia({media:'print'})` at a 733x1077 A4 content box, the
report landed at `{x:12, y:72, w:709}` instead of `{0,0,733}`:

1. **`.av-page-stage` carries `transform: translateZ(0)`**, which makes it the
   containing block for every `fixed` AND `absolute` descendant. `PrintPreviewSidebar`
   rendered inside it, so its `fixed inset-0` overlay measured the stage's rect,
   and the report's `position:absolute; width:100%` resolved against *that* — the
   72px offset is exactly `<main>`'s 12px padding plus the 60px header band.
   Fixed by portalling the sidebar to `document.body`.
2. **The preview's inline `zoom: 0.85` was never reset for print.**
   `print:transform-none` resets `transform`, not `zoom`, and an inline style
   outranks a non-`!important` rule — so the sheet printed at 85%, leaving ~51mm
   blank at the bottom. The zoom is now a `--rpt-zoom` custom property read
   inside an `@media screen` block, which print cannot see at all.
3. **`overflow: hidden` on the stage and the sidebar shell survived into print**,
   so simply raising the zoom to 100% clipped 46.4px and deleted the signature
   block from the printout. The print stylesheet now resets it on the portal root.

Fixing any one alone makes it worse — removing the zoom without the reparenting
introduces the signature clip; removing the clip without the reparenting leaves
the offset.

**Two duplicate `@media print` blocks are gone.** `globals.css` and
`ReportDocument` each shipped a near-identical block with contradictory `@page`
margins (10mm vs 6mm/8mm), decided only by stylesheet order. The `globals.css`
one was app-global with `!important` and un-hid only `#printable-report-document`
— an id nothing else renders — so **every other print path in the app printed a
blank sheet**. That is fixed as a side effect.

## The phone: it had never received a published template

`fetchPublishedReportTemplate` sent `account.deviceToken` — the 32-byte pairing
secret, not a JWT — as the bearer to an `[Authorize]` endpoint, so every call
401'd into its own catch and returned the mobile default. It now goes through
`portalRequest`, which sends `account.bearerToken` like every other authenticated
call. Combined with the generator reading only 9 of the template's 30 fields,
the phone's printout had been a fixed layout that ignored the designer entirely.

## expo-print cannot set the Android paper size — print a file, not HTML

Read from the installed `expo-print@57.0.1` Kotlin source, not from memory:

- `PrintModule.kt`'s `getAttributesFromOptions` only ever sets
  `MediaSize.UNKNOWN_PORTRAIT` and **never reads `width`/`height`**. The spooler
  cannot match that against a printer's capabilities and falls back to its own
  locale default — US Letter on many devices. There is no option in this version
  that reaches `PrintAttributes.MediaSize.ISO_A4`.
- Worse, `printAsync({ html, ... })` hands the spooler the **WebView's own**
  `PrintDocumentAdapter`, which is re-laid-out at the user-visible paper size, so
  the width/height passed in are discarded entirely. It is functionally identical
  to `printAsync({ html })`.
- `printToFileAsync` **does** honour width/height (it opens a real file
  descriptor and writes after an `onLayout` using them), and `printAsync({ uri })`
  copies the PDF bytes verbatim without re-paginating.

So the phone now renders A4 to a file and prints the file. Keep `595 x 842` —
they are declared `Int` on Android and a fractional `841.89` truncates to 841.

## Verified by measurement

A real `page.pdf({ preferCSSPageSize: true })` taken from inside the running app,
with the portal injected exactly as the component renders it:

| check | result |
|---|---|
| PDF MediaBox | **594.96 x 841.92 pt** — exact A4 |
| pages | 1 |
| sheet rect under print media | `{x:0, y:0, w:794, h:1122.5}` — the whole A4 box |
| `zoom` on the sheet and its wrapper when printing | `1` / `1` |
| horizontal overflow | 0 (`scrollWidth` 794 of 794) |
| signature block | bottom at 1090.5 of 1122.5 — inside the page |
| app shell, sidebar, header, preview toolbar | all hidden |
| on-screen preview at 85% | 674.6 x 954.1 = exactly 0.85 x the A4 box |

One real bug was found only by that measurement and fixed: `box-sizing:
border-box` was applied to `.rpt-sheet *` but not to `.rpt-sheet` itself, so the
print rule `width: 100%` plus the page padding made the sheet exactly two
paddings (64px) wider than the paper.

`npx expo export` bundles 2,561 modules clean, and both projects typecheck.

## What the code review caught, and what it changed

The `code-reviewer` pass (§7) found real defects that measurement had not. Worth
recording because most were invisible to `tsc`:

- **Two unescaped attribute sinks.** `data-rpt-section="${key}"` and
  `data-rpt-sig="${role}"` in `html.ts` were the only interpolations bypassing
  `escapeHtml`, reachable through the published template — a shared
  `AppSettings` row writable by Manager and above. Both escaped.
- **Five raw numbers interpolated into the generated `<style>`.** The template
  blob is `JSON.parse`d with no schema validation on either side, so a field
  typed `number` can hold a string that closes the CSS rule. All numeric sinks
  now go through `cssNumber()`; colours through `cssColor()`; alignments
  through `cssKeyword()`. `escapeHtml` on an inline `style` attribute stops the
  attribute being escaped but **not** a second declaration being injected
  inside it — that was the subtle one.
- **`escapeCss` was a blocklist** stripping `<>{}\;` and letting `'`, `"`, `(`,
  `)`, `/`, `*` through, so a font name of `a', sans-serif /*` commented out the
  stylesheet. Now an allowlist.
- **`safeImageSrc` was bypassable and simultaneously too strict.**
  `/\evil.example/x.png` passed its `startsWith("/") && !startsWith("//")` check
  because browsers treat `\` as `/`. Fixed — and `https:` had to be *allowed*,
  because the uploaded company logo lives on R2 and was being silently replaced
  by the bundled Cam logo.
- **The Templates Settings "Print A4 Report" button printed the whole app**, at
  the preview's inline zoom. Removing the global print block left that path with
  nothing isolating it. Now `components/report/ReportPrintPortal.tsx` — an
  off-screen copy portalled to `<body>` — so every print path is isolated by
  construction rather than by remembering a prop.
- **Ctrl+Z inside the canvas's inline label editor wedged the designer.** The
  studio's shortcut guard tested `HTMLInputElement || HTMLTextAreaElement`; a
  `contentEditable` div is neither, so undo rewrote the template, regenerated the
  sheet, and destroyed the node being edited — its listeners went with it, the
  editing flag stayed set, and click/hover (both of which early-return while
  editing) were dead until remount. Guard now tests `isContentEditable`, and the
  canvas abandons an edit whose element leaves the document.
- Three fields the designer wrote and the renderer ignored — the same class of
  bug as mobile's eleven. `ReportInfoRow.fontFamily` / `valueFontFamily` are now
  rendered; **`componentOffsets` is still written and read by nothing** (see
  open items).

**Verified adversarially, not just structurally.** A hostile template
(`sectionOrder` carrying `"><img onerror=…>`, a `lineHeight` that closes its
rule, a font name that opens a comment, an off-origin logo, a colour with a
second declaration) plus a hostile ticket (`<script>` in `reportNo`,
`</div><img onerror=…>` in `companyName`) rendered with **8/8 vectors escaped**.

**Probe discipline, again.** The first run of that suite reported a leak. It was
the test: it searched for the `alert(1)` payload, which `completeOrder` had
correctly dropped, while the `alert(2)` string it actually found was the ticket
field rendered as properly escaped text. Fifth instance in this repo of a
"failure" that was the measurement.

## Closing pass — what was finished afterwards

- **`componentOffsets` now renders.** `getTargetKey` moved out of the web-only
  template store into `report-layout/design.ts` (typed against `DesignTarget`,
  so adding a variant without a key is now a compile error rather than a silent
  fall-through), and `html.ts` emits the saved nudge as a millimetre
  `translate` on the matching element, in every mode. It is applied by merging
  into each element's existing inline style rather than emitting a second
  `style` attribute, which would have silently dropped a column width or the
  signature grid. The key function existed in **three** places — the store, the
  inspector's own inline `switch`, and nowhere in the renderer; there is one now.
- **ESLint runs again on the web** (`node_modules/eslint/bin/` was missing —
  a broken install, not a config problem; `rm -rf node_modules/eslint && npm i`
  fixed it). Everything written for this work reports **0 errors, 0 warnings**;
  `services/reportTemplate.ts` went to 0 too, by typing the component clipboard
  against `DesignTarget` instead of `any`.
- **ESLint now exists on the mobile project at all** (`npm run lint` →
  `expo lint`, config in `eslint.config.js`). There was none, which is exactly
  why a conditional hook shipped — see below. The mirrored `report-layout/`
  files deliberately no longer carry a blanket `eslint-disable`: they pass
  clean, and a blanket disable would hide a future regression on the one side
  that cannot fix it.
- **83 unit tests** for the shared module, in the mobile project because that is
  the side with a runner (`npm test`). They lock in the invariants that were
  actually wrong at some point: escaping (9 vectors), the px→mm conversion,
  `@page` having no margin, `.rpt-sheet` being inside the border-box rule, zoom
  staying inside `@media screen`, print not clipping, order normalisation,
  `statusDate`, spare-part precedence, and offset rendering.

## The mobile crash, and why it was mine

Opening the report on the phone crashed with **"Rendered more hooks than during
the previous render"**. Converting `previewHtmlContent` to a `useMemo` had put a
hook *below* `if (!visible || !ticket) return null` — so a hidden modal ran fewer
hooks than a visible one. Moved above the early return, with the null ticket
handled inside the memo and the whole thing gated on `visible` so a closed modal
does not build an A4 document it will never show.

Two things follow from it:
- **Adding a `useMemo` is a hook, and hooks have no early return above them.**
  Obvious in isolation, invisible in a 350-line component during a refactor.
- **The mobile project had no linter, so nothing said so.** Adding one caught
  this class immediately — and also found a **pre-existing** conditional
  `useRunOnJS` in `components/FaceDetectionCamera.tsx:191`, the same bug waiting
  in the face scanner.

## Second closing pass — the rest of the report surface

- **`FaceDetectionCamera.tsx`'s conditional hook is fixed.** It read
  `useRunOnJS ? useRunOnJS(...) : (faces) => ...` — a hook behind a ternary, and
  the same crash class that had just hit the report modal. The fallback branch
  was also unreachable: `useRunOnJS` is resolved once at module load,
  `isNativeVisionAvailable` is only set when that succeeded, and the component
  renders only under that flag. Called unconditionally now.
- **Mobile lint is 0 errors across all of `src`** — the three
  `react/no-unescaped-entities` in `LoginScreen` / `SecurityTab` went too.
- **`ExcelReportDesigner.tsx` went from 20 errors to 0**, and removing the
  `any` found a real bug it had been hiding: fortune-sheet's `Cell.ff` is
  `string | number` — a number is a font *index* into its own family list, not a
  name — and it was being assigned straight to exceljs's `font.name`, writing a
  nonsense typeface into every exported workbook. It now uses the library's own
  exported `Sheet` / `Cell` / `CellWithRowAndCol` / `CellMatrix` types rather
  than hand-rolled shapes, so a library upgrade is a compile error instead of a
  silent mismatch. Also deleted a write-only `useRef<any>` and replaced the
  report-change effect (which re-derived state the `useState` initializer
  already derives, a render later) with `key={selectedReport.id}` at the mount
  site.
- **`Date.now()` is gone from both id generators.** `nextInfoRowId` in
  `report-layout/defaults.ts` derives the next id from the rows that exist.
  The clock version collided inside one millisecond (paste, fast double-click)
  and was impure during render.

**Every file in the report surface now reports 0 ESLint errors**:
`report-layout/` (both copies), `ReportSheet`, `ReportDesignerCanvas`,
`ReportPrintPortal`, `PrintPreviewSidebar`, `reportTemplate`,
`PropertyInspector`, `TemplateControls`, `TemplateCatalogGallery`,
`ExcelReportDesigner`, `DesignPopover`, `templates-settings/page`.

## Open items

- **35 ESLint errors remain web-wide, none in the report surface.** They sit in
  16 unrelated files — `services/api.ts` (8), `services/userService.ts` (5), the
  download/profile/settings pages, `CompanionScannerContext`, `scannerBridge`,
  `useRealtimeTickets`. Pre-existing debt in features outside this work;
  rewriting them blind was judged worse than leaving them measured and named.
  (Web-wide went 61 -> 35 errors as a side effect of this pass.)
- **`components/report/DesignPopover.tsx` (416 lines) has zero importers.**
  Already orphaned before this work. **Not deleted on purpose: this tree is not
  a git repository**, so removal would be unrecoverable — it needs an owner's
  decision, not an automated sweep.
- The mobile `WebView` keeps `originWhitelist={["*"]}` and `javaScriptEnabled`.
  Narrowing them changes whether `source={{ html }}` loads at all per platform,
  so it needs a device and was deliberately not changed blind.
- **Nothing has been printed from a physical phone.** The Android paper-size fix
  is reasoned from expo-print's own Kotlin source, the bundle exports clean
  (2,561 modules), and the HTML fed to `printToFileAsync` is the same string
  verified to produce an exact-A4 single-page PDF in Chrome — but no PDF has
  come off a real device.


## Print preview drawer: three defects found by using it (2026-09-02)

Reported after the phone was confirmed working (ISO A4, correct render, no
crash). All three came from portalling the drawer to `<body>`:

1. **The Print button was unreachable.** `Header` is `sticky top-0` and raises
   itself to `z-[2500]` while a modal is open — deliberately ABOVE the modal
   layer. Portalling made the drawer a sibling of that header, so at `z-50` the
   header painted straight over its toolbar. Measured: drawer top 0, header
   bottom 76. The drawer now starts at `--av-header-h` (the height the header
   publishes on `<html>`) at `z-[2400]`, which is the convention the app's other
   dialogs already follow — "a dialog reserves the header, it does not overlap
   it". Measured after: drawer top **76** = header bottom **76**, Print button at
   **92.3**, clickable.
2. **Clicking outside did not close it.** The scrim was a class on the root, not
   an element, so there was nothing to click. It is its own absolutely
   positioned element now, and Escape closes too.
3. **No exit animation.** The drawer returned `null` on close, so it vanished in
   one frame. Now `AnimatePresence` + `motion.div` on `MODAL_SPRING`, using
   `backdropVariants` and `drawerVariants` from `lib/animations.ts` — the latter
   had **zero consumers** and its own comment says "(assistant, print preview)",
   so it was written for exactly this.

**framer writes inline `transform`/`opacity`, which would have followed the sheet
onto paper.** `buildWebPrintIsolationCss()` already sets both to
`none`/`1` with `!important` on `.rpt-print-root` and `.rpt-print-passthrough`,
and `!important` beats inline. Verified under print media: `transform: none`,
`opacity: 1`, `position: static`, `top: auto`.

## Web and phone print the same document — measured, not asserted

The two modules are compiled separately (`TestingReact/src/report-layout` and
the mirrored `CamIdMobile/src/report-layout`) and compared:

| check | result |
|---|---|
| sheet markup identical | **true** |
| stylesheet identical | **true** |
| printed sheet identical | **true** (5,824 bytes both sides) |

And the rendered output, web taken from the running app and mobile from the exact
string handed to `Print.printToFileAsync`:

| | web | phone |
|---|---|---|
| PDF MediaBox | 594.96 x 841.92 pt | 594.96 x 841.92 pt |
| pages | 1 | 1 |
| sheet rect | `{0, 0, 794, 1122.5}` | `{0, 0, 794, 1122.5}` |
| padding | 32.0001px | 32.0001px |
| zoom | 1 | 1 |
| signature block bottom | 1090.5 | 1090.5 |
| horizontal overflow | 0 | 0 |

Forcing expo-print's exact 595x842pt page instead of the document's own `@page`
still yields an A4 MediaBox and one page, so the phone's PDF is A4 either way.

## Android printed on Letter, and the fix is a native patch (2026-09-02)

The phone's print dialog kept opening on **Paper size: Letter**, sometimes A4 —
the inconsistency was the tell. Root cause, read from the installed Kotlin:
`PrintModule.getAttributesFromOptions` sets **only**
`MediaSize.UNKNOWN_PORTRAIT`/`UNKNOWN_LANDSCAPE` and never reads
`options.width`/`height`. `UNKNOWN_*` is a placeholder with no dimensions, so
the print spooler cannot match it against the selected printer's capability
list and substitutes its own locale default — `NA_LETTER` on many devices. The
A4 PDF was then re-fitted onto Letter.

Routing through `printToFileAsync` -> `printAsync({ uri })` fixed the *document*
(the adapter copies PDF bytes verbatim) but not the *dialog*, because the dialog
reads those same attributes. There is no JS option in 57.0.1 that reaches
`ISO_A4`.

**`patches/expo-print+57.0.1.patch`** makes the module derive a real media size
from the width/height the caller already passes: points -> mils, matched against
`ISO_A4 / ISO_A3 / ISO_A5 / NA_LETTER / NA_LEGAL` with a 40-mil tolerance (A4 at
595x842pt is 8264x11694 mils against ISO_A4's declared 8268x11693, so equality
would never match). Anything unrecognised keeps the old `UNKNOWN_*` behaviour,
so this is not an A4 special case. Applied by `patch-package` from a
`postinstall` script, which is what makes it survive `npm install` and an EAS
build. `PortalTechnicalReportModal.handlePrint` now passes `width`/`height` to
`printAsync({ uri, ... })` so the patch has something to resolve.

**This only takes effect in a NEW NATIVE BUILD** (`eas build` or
`expo run:android`). Reloading JS will not pick up a Kotlin change, so a phone
running the previous binary will still show Letter.

Verified: the mapping resolves 595x842 -> ISO_A4, 612x792 -> NA_LETTER,
842x1191 -> ISO_A3, 420x595 -> ISO_A5. `patch-package --error-on-fail` OK,
`npx expo export` 2,561 modules, tests 85/85, mobile lint 0 errors.

**The print dialog IS the device picker on both platforms** — Chrome's
"Destination" on the desktop, Android's printer list on the phone — so one tap
reaches it on each and there is no in-app printer list to build. Android offers
no API to pre-select a printer outside that dialog (`Print.selectPrinterAsync`
is iOS-only). Both primary actions now read "Print Report" with the same
one-line hint underneath.

### iOS side of the same patch

iOS is a different code path and was already closer to correct:
`PrintOptions.toPageSize()` DOES read `width`/`height`, so `printToFileAsync`
already produced a true A4 PDF. What it did not do was state the paper: the
`UIPrintInteractionController` was handed only an orientation, leaving UIKit to
match paper to the printing item implicitly.

The patch adds the documented API for that decision —
`printInteractionController(_:choosePaper:)` on the existing delegate, resolving
through `UIPrintPaper.bestPaper(forPageSize:withPapersFrom:)` against the size
`ExpoPrintWithPrinter` now passes it. Same principle as the Android half: derive
the paper from the page the caller actually rendered, and keep the previous
behaviour for anything unrecognised.

Worth knowing if a future call site omits width/height: `toPageSize()` falls back
to `kLetterPaperSize` (612x792), despite the comment above it claiming A4. Our
call sites always pass the size, so it is latent rather than live.

**iOS is NOT verified.** There is no `ios/` directory in the repo (it has never
been prebuilt) and no macOS here, so the Swift is unbuilt and untested — reasoned
from the installed source and the UIKit API contract only. Android is verified to
the limit of what this machine can do (patch applies, bundle exports, size
mapping proven); the paper dropdown itself still needs a device.

# One set of business rules for Web and CAM ID (2026-09-02, later same day)

Follows the shared report layout above, and takes the same shape: the printed
report had existed three times, and the *validation* turned out to exist twice.
`TestingReact/src/validation/` is now the single copy, mirrored into
`CamIdMobile/src/validation/` by `npm run sync:shared` (the same script, now
looping `SHARED_DIRS = ["report-layout", "validation"]`), with the `--check`
drift guard already wired into the web's `typecheck` and `build`.

## What was actually duplicated

Two whole modules on the phone, both written to "mirror" the web:

- **`CamIdMobile/src/services/portalValidation.ts`** — 7 validators whose own
  header said it "reproduces those rules". It did not reproduce them; it
  *exceeded* them, and neither side knew. The phone refused a spare part with no
  serial number, a negative unit price and a malformed phone number. The desktop
  accepted all three and wrote them to the same rows.
- **`CamIdMobile/src/services/portalStockShortage.ts`** — a byte-identical
  hand copy of the shared `stockShortage.ts`, banner aside.

Plus `transitionGuard`, which existed as a private block inside the web's
`ApproveRepairDialog.handleApprove` **and** as a function in the phone's
`portalDomain.ts` — where it had grown a third rule the desktop never had.

Both modules are deleted. `services/validator.ts` keeps its name (the pairing
and profile screens call it) but is now three lines delegating to
`validation/contact.ts`; `portalDomain.ts` re-exports `transitionGuard`.

## The rules now shared

`stockShortage` · `stockPreflight` · `contact` (phone/email formats, and
`isAbsent`) · `reference` (`isChargeService`) · `forms` (ticket, customer, item
model, spare part, stock in/out, inspection, password change, profile) ·
`transitions`.

- **Messages carry a `code`, not just a sentence.** `ValidationResult` is
  `{ isValid, errors, codes, params }` and `transitionGuard` returns
  `{ code, message } | null`. The phone renders `errors`/`message` directly; the
  web maps the code through `i18n/validationMessage.ts` to one of 19 new
  `validation.*` keys in `en` + `km`. The `Record<ValidationCode,
  TranslationKey>` is exhaustive, so a new rule with no translation is a compile
  error rather than an English string in a Khmer UI.
  - The first version of `ApproveRepairDialog` compared the *rendered Khmer
    sentence* to pick its translation key. That works exactly until someone
    rewords either message, at which point it silently shows the wrong one.
    That is why the guard returns a code.
- **`params` exists for the rules that quote a value back** (`stockOutExceeds`,
  `passwordTooShort`). A platform that renders its own sentence cannot recover
  the number from the English one.
- **A status-name table lived in `reference.ts` briefly and was removed.** No
  call site on either platform ever passed `status` or `serviceType` to
  `validateTicket`, so the branch, its two codes and its four translations were
  unreachable — and the table was a third copy of one the web and the phone each
  already keep for building payloads. `isChargeService` stayed, because the
  transition guard reads it.

## Placeholders are not input — the bug this nearly shipped with

`services/api.ts` and the phone's `portalCustomerApi` both normalise a missing
phone number to an **em dash** so the table has something to draw, and the edit
form loads that row straight back. Reading it as typed input made **every
customer with no phone number permanently unsaveable**, with a format error the
user could only clear by deleting a character they never typed. Verified against
the compiled module before and after.

`contact.ts` now exports `isAbsent`, and every OPTIONAL field's format check
goes through it: `""`, `-`, an em dash, `N/A`, `none` and friends mean "there
isn't one". A REQUIRED field keeps its own `.trim()` test, because `"N/A"` is a
bad company name but it is not a missing one.

The same class of mistake, one screen over: `ServiceDetailModal` was passing
`phoneNumber` to `validateTicket` **for a field that has no input on that form**.
`Services.PhoneNumber` is free text across 3,662 rows — `"012345678 / 077888999"`,
`"Tel: 012..."` — so every one of those tickets became unsaveable, with a message
pointing at nothing on screen. That call site no longer passes it. **Do not
validate a field the form does not expose.**

## The pre-flight the phone never had

`updateServiceStatus` on the web ran a per-line stock check before posting and
showed `StockShortageAlertModal` naming the part, the quantity on hand and the
quantity required. The phone posted straight through and surfaced the SQL
trigger's raised text. Both now call `checkStockShortages` from
`validation/stockPreflight.ts`, each supplying only its own catalogue reader
(`CatalogLookup` is injected precisely so the shared module stays framework-free).

`portalApi.transitionTicketStatus` returns a `TransitionResult` — assignable to
`PortalResult<true>`, so every existing `.ok`/`.error` caller is unaffected —
carrying `shortages[]` when it refuses. `parseStockErrorMessage(err, shortages)`
short-circuits on those rather than round-tripping through a message, and
`shortageErrorMessage` is deliberately written in the SAME shape the trigger
raises so a client-side and a server-side refusal parse through one code path.

**This is a pre-flight, not the authority.** Between the catalogue read and the
POST another user can take the last unit, so the trigger still decides and its
rejection is still handled.

Two things about it are load-bearing and were both wrong in the first version:

- **A lookup that cannot answer is UNKNOWN, not zero.** Only a *thrown* lookup
  was skipped — but neither platform's reader throws; both resolve `null` for
  any non-OK response, which fell through to `Number(… ?? 0)` and was reported
  as a shortage. This repo has **33 ticket lines pointing at parts since deleted
  from the catalogue**, so that invented a shortage for every one of them and
  made those tickets impossible to move from either app; a 401 after a token
  expiry did it to every ticket at once. `null`, `undefined` and an unreadable
  quantity are now all skipped.
- **Lines are summed per part.** Compared line by line, two lines of one passed
  against a stock of one — and the trigger, which deducts both, then refused
  with the raw SQL message the pre-flight exists to prevent.

The per-part lookups are also fanned out with `Promise.all` rather than awaited
in a loop: on the phone `PORTAL_REQUEST_TIMEOUT_MS` is 8s, so a six-part ticket
on a bad link could spend a minute on a spinner before the POST was even
attempted.

## Two more rules, from the second sweep

- **Password change.** The phone tested `if (confirmPassword && newPassword !==
  confirmPassword)` — so leaving the confirmation box **empty skipped the check
  entirely**, and the mismatch it exists to catch went through. It also never
  required the current password. That second difference is legitimate on one
  path only: with a paired device the phone posts to
  `auth/face/device/reset-password`, where the device IS the proof of identity.
  So `requireCurrent` is a parameter, and the phone passes
  `!account?.deviceToken` rather than waiving it on both paths.
- **Profile edit.** Both platforms checked the name and then saved an email and
  a phone number neither had ever looked at. (`app/profile/page.tsx` had no
  `i18n` at all — its messages were hardcoded English against this project's own
  rule — so adopting the shared rules meant adopting `useI18n` there too.)

## The one rule that changed behaviour, and why

`validateTicket` required a fault description. The phone applied it to intake
**and** edit, which meant every ticket booked before the rule existed — they
carry an empty field — was unsaveable: correcting a phone number on an old
ticket meant inventing a fault description first. It now takes
`mode: "create" | "edit"`, defaulting to `"create"`, and only intake requires
it. That fixes a live bug on the phone and is what let the desktop adopt the
rest of the rule without blocking edits to existing rows.

**One rule is genuinely new on the desktop and should be confirmed by the
business**: `cannotSendSparePartsCharge` — parts may not be dispatched from
*Awaiting Sparepart* on a Charge ticket Sales has not confirmed. It came from
the phone. Deleting that block in `validation/transitions.ts` reverts it on both
platforms in one place, which is the point of the file.

## Verified

| check | result |
|---|---|
| web `npm run typecheck` | clean |
| web `npm run build` | succeeds, all routes prerendered |
| web ESLint, whole project | **28 errors** (was 35 — none in the new files) |
| ESLint on `src/validation` + `i18n/validationMessage.ts` | **0 problems** |
| mobile `npx tsc --noEmit` | clean |
| mobile `npm run lint` | **0 errors**, 77 warnings (was 79) |
| mobile `npm test` | **128 / 128** (was 85; 43 new cases) |
| mobile `npx expo export` | 2,567 modules, 5.35 MB Hermes bundle |
| drift guard | 17 mirrored files reported in sync |

The five ESLint errors on the touched surface are all pre-existing and already
documented above: four `react-hooks/set-state-in-effect` and one
`no-explicit-any` in `services/api.ts`.

**The code-reviewer pass (§7) is what found the placeholder and null-lookup
bugs**, both of which the type checker, the linter, 117 passing tests and two
clean builds had all been perfectly happy with. Three of its findings were
blockers; each was reproduced against the compiled module before being fixed,
and each now has a test.

## Conventions to keep

- **A rule reproduced is a rule that will disagree with itself.** Both forks
  here were written carefully, by someone reading the other side, and both had
  already drifted. If a rule has to hold on the phone and the desktop, it goes
  in `src/validation/` and both call it — the same argument the report layout
  settled.
- **Never key presentation off a rendered message.** Return a code. The message
  is the platform's business, the code is the rule's identity.
- **Adopting a stricter shared rule needs a look at the existing rows**, not
  just at the form. Every field the rule requires has to be one that pre-rule
  records already have, or the rule needs a mode — the `customerRequest` case is
  the worked example.
- **A "safe" default written for a table is not safe as input.** The em dash and
  `"N/A"` exist so a column renders; they travel straight back into the form the
  next time someone opens it. Any rule applied to a stored value has to know
  which strings this system uses to mean nothing.
- **Distrust a rule with no caller.** Two branches of `validateTicket`, three
  reference exports and four translations were written, reviewed, tested and
  shipped without a single call site ever passing the fields they judged.
- **`validation/` has the same import ban as `report-layout/`**: no React, no
  Next, no React Native, no DOM, no `window`, no Node built-ins, no import out of
  the folder. Anything the rule needs from the platform is *injected*
  (`CatalogLookup`), never imported.
