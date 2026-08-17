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
