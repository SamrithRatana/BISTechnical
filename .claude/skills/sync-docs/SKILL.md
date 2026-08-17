---
name: sync-docs
description: Reconcile the hand-maintained CLAUDE.md index files with what is actually on disk — new files missing from an index, renamed or deleted entries, and counted claims that have gone stale. Use after adding or moving files, or when the user asks to update, sync, or check the project docs.
user-invocable: true
---

# sync-docs — keep the CLAUDE.md indexes honest

There are 11 hand-maintained `CLAUDE.md` files. They are indexes: file paths,
exported function signatures, and the reasoning behind decisions. Nothing
regenerates them, and nothing fails when they go stale — so they drift silently
and quietly mislead whoever reads them next, which is usually an agent that
then acts on the wrong picture.

## The files

| File | Scope |
|---|---|
| `CLAUDE.md` | Root: repo layout, how to run, onboarding, rollback, the Aura Velvet redesign record |
| `TestingReact/CLAUDE.md` | One line: `@AGENTS.md` |
| `TestingReact/src/CLAUDE.md` | `hooks/`, `services/`, `i18n/` — per-file, per-export |
| `TestingReact/src/app/CLAUDE.md` | Route index, one section per route |
| `TestingReact/src/components/CLAUDE.md` | Component index, plus the `av/` design-system section |
| `src/Core/CLAUDE.md`, `src/Shared/CLAUDE.md` | Backend domain and shared libs |
| `src/APIs/*/CLAUDE.md` (3), `src/Apps/ServiceMaintenance/CLAUDE.md` | Per-project backend |

**`TestingReact/AGENTS.md` is not yours.** It is written and re-added by
`next dev` (see `node_modules/next/dist/server/lib/generate-agent-files.js`).
Deleting it from a diff only re-creates the uncommitted change — commit it with
your work to keep the tree clean.

## Known drift (verified 2026-08-17)

Start here; these are real and outstanding.

**`TestingReact/src/CLAUDE.md` header counts are wrong, and the body is
incomplete.** It claims *"hooks (4 files), services (5 files), i18n (3 files)"*.
Actual: **7 hooks, 13 services**, 3 i18n. Undocumented:

- Hooks: `useInfiniteList.ts`, `useSearchAction.ts`, `useTicketSeries.ts`
- Services: `activityTracker.ts`, `authSession.ts`, `backendSignal.ts`,
  `excelTemplate.ts`, `internetPing.ts`, `reportShaping.ts`, `reports.ts`

Several are load-bearing and referenced by other docs — `authSession.ts` owns
the whole session/expiry/roles model, `useTicketSeries.ts` is named in the root
`CLAUDE.md` as the sparkline source.

**`TestingReact/src/app/CLAUDE.md` is missing 9 of 25 routes** — every report
screen plus settings: `daily-report`, `monthly-report`, `customer-report`,
`engineer-report`, `repair-report`, `history-report`, `sparepart-usage`,
`sparepart-hold`, `settings`. All nine are in the sidebar via
`config/navigation.ts`, so the route index is the only place they are absent.
The reports share a layout mechanism worth documenting once: each one's columns
and styling come from an `.xlsx` under `public/templates/`, driven by
`services/excelTemplate.ts` — which is itself one of the undocumented services
above.

**Root `CLAUDE.md` claims "3,028 hardcoded palette utilities → 0".** There are
34. See the `preflight` skill for the breakdown.

**Root `CLAUDE.md` opens with `Root: C:\Users\DELL\Desktop\...`** — a path from
a different machine. It is documentation of a checkout location that does not
generalise; either drop the line or make it relative.

## How to reconcile

### 1. Find files the index does not mention

```bash
cd TestingReact
for f in src/hooks/* src/services/* src/i18n/*; do
  grep -q "$(basename "$f")" src/CLAUDE.md || echo "MISSING: $f"
done
for d in src/app/*/; do
  grep -q "$(basename "$d")" src/app/CLAUDE.md || echo "MISSING ROUTE: $d"
done
for f in src/components/*.tsx src/components/av/*.tsx src/components/ai/*.tsx; do
  grep -q "$(basename "$f")" src/components/CLAUDE.md || echo "MISSING COMPONENT: $f"
done
```

### 2. Find entries with no file behind them

Pull the backticked paths out of each index and test each one exists. A renamed
file leaves an entry pointing nowhere, which is worse than an absent entry — it
sends the reader looking for something that was deleted deliberately.

### 3. Re-check counted and absolute claims

Any sentence with a number or the word "every"/"zero"/"none" is a claim with a
shelf life. Grep for digits in each index and verify the ones that assert a
count. The two wrong claims above were both of this shape.

### 4. Write entries in the existing voice

These indexes are not API dumps. Match the surrounding density: what the file
is for, its exported signatures, and — where it exists — the *reason* the code
is shaped that way. The existing entries carry things like "deliberately
uncached (edit form needs live state)" and "no 'inspection' case by design
(that used to destroy inspection text)". That reasoning is the part a reader
cannot recover from the source, so it is the part most worth preserving.

For a services entry:

```markdown
### `TestingReact/src/services/authSession.ts`
One place that answers "is this browser still logged in?" — token storage,
expiry and role claims.
- `hasValidSession()` — token exists **and** is unexpired. Branch on this,
  never on `readToken() !== null`.
- `isTokenExpired(token)` — reads `exp` with a 30s early leeway. A token with
  no readable `exp` is treated as **valid**: some issuers omit it, and the API
  is the authority either way.
- …
```

For a route entry, follow `src/app/CLAUDE.md`'s existing shape: route, file,
client/server, then the exported component and its notable handlers.

## Scope discipline

Two rules that keep this from becoming a rewrite:

- **Do not duplicate across levels.** The root `CLAUDE.md` explicitly defers
  component detail to `src/components/CLAUDE.md` and says so. Add detail at the
  deepest file that covers it, and link rather than repeat.
- **Do not delete a decision record to make an index tidier.** The "Key
  decisions", "Known issues left unresolved" and "Conventions to keep" sections
  in the root file are the most valuable prose in the repo. Update them when a
  fact changes; do not compress them.

When a claim is now wrong, correct it — don't quietly delete it. "Was 3,028,
now 34" tells a reader the migration happened and is unfinished. Silence tells
them nothing.
