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
   - `TestingReact/.env.local.example` -> `TestingReact/.env.local`
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
- **New component library** at `src/components/av/`: Card, Badge, ProgressBar,
  ToggleGroup, Sparkline, KpiCard, ChartPanel, AreaChart.
- **Route-change animation** — `PageTransition` keyed on pathname.
- **Shared SSE connection** — `useRealtimeTickets` multiplexes one EventSource
  per tab instead of one per call site.
- **Responsive drawer** — sidebar is off-canvas below `lg`, icon rail above.

## Key decisions (and why)

- **Light-only. Dark mode removed at the source**, not just the palette —
  `ThemeScript` used to stamp `.dark` on <html> by the clock, and with the dark
  palette gone the app would have rendered half-broken every evening. The `dark`
  Tailwind custom-variant is deliberately KEPT so any stray `dark:` utility
  stays inert rather than reactivating via `prefers-color-scheme`.
- **`useTheme()` now carries ergonomics only** — radius, density, font scale,
  motion. No colour. The `ui.theme.*` assistant actions were removed with it.
- **Status colours were MAPPED, not collapsed** — emerald→success,
  rose→danger, amber→warning, blue/teal/cyan→info. They encode ticket state;
  making everything accent-green would have destroyed meaning. `teal`→`info`
  on purpose: beside an emerald accent, a teal "done" chip and a green
  "selected" row stop being distinguishable.
- **No fabricated metrics.** The old KPI cards showed hardcoded `"+100%"` /
  `"23.5% vs last month"` that never changed with the data. Trends/sparklines
  are now computed from real ticket dates, and are OMITTED when the comparison
  window is empty (a rise from zero has no percentage).
- **CSS transitions, not framer-motion** — matches the transform/opacity-only
  performance requirement and adds no dependency.
- **View Transitions API: tried, reverted.** `<ViewTransition>` exists in the
  canary React that Next 16.3 vendors and the bundled docs say it works with no
  config, but the router never activates it — `onEnter`/`onExit`/`onShare`/
  `onUpdate` never fire and `document.startViewTransition` is never called;
  `experimental.viewTransition` is not a valid key in this release. Re-check on
  a future Next upgrade; `PageTransition` is the single file to change.

## Known issues left unresolved

- **47 ESLint problems, all pre-existing** (was 77): 20 `no-explicit-any`,
  11 unused *variables*, 8 `<img>` instead of `next/image`, 4
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
  icon, list virtualization.
- `MaxListenersExceededWarning` in the dev log is **noise, not a leak** — it
  only ever reports 11 (Node warns once per emitter past its default of 10),
  never climbing.

## Conventions to keep

- **Never write a raw palette utility.** No `bg-slate-50`, `text-violet-600`.
  There are currently ZERO in `src/` — keep it that way. Use the semantic
  names, or add a token if one is genuinely missing.
- **Colour lives in `globals.css` only.** No component hardcodes a hex.
  Exceptions that must stay hardcoded: `ExcelViewer` (renders the
  spreadsheet's own colours), `PrintPreviewSidebar` (legacy print replica),
  `global-error.tsx` (renders when the stylesheet may be unavailable).
- **Animate transform/opacity only.** Never width/height/top/left. Route
  animations need `key={pathname}` — a CSS animation does NOT replay on a
  reused DOM node, which is what made the old page transitions silently do
  nothing.
- **All user-visible text goes through i18n** in BOTH `en` and `km`
  (`km` is typed against `TranslationKey`, so a missing key is a compile error).
- **Verify in a real browser, not by assertion.** Playwright driving the system
  Chrome (`channel: "chrome"`) works here; AuthGuard only checks for a
  `jwt_token` in localStorage, so an init script gets you past login. Watch out
  for measurement artifacts: sampling `getAnimations()` at a fixed delay misses
  dev-mode route compilation — listen for `animationstart` instead; and
  counting SSE requests client-side over-reports, so read the server's own
  `activeSessions` from `/api/system-activity`.
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
