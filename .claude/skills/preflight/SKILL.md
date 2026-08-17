---
name: preflight
description: Run the project's convention checks before committing frontend work — design-token violations, missing Khmer translations, TypeScript errors and ESLint. Use when the user says "preflight", "check my changes", "ready to commit?", or after finishing a batch of edits under TestingReact/.
user-invocable: true
allowed-tools:
  - Bash
  - Grep
  - Read
  - Edit
---

# preflight — enforce the conventions mechanically

The root `CLAUDE.md` states four hard conventions for `TestingReact/`. They are
prose, so they get broken silently. This runs them as commands.

Run every check, then report. **Do not stop at the first failure** — the user
wants the whole picture, not one error at a time.

All commands run from `TestingReact/`.

---

## 1. Raw palette utilities

Convention: *"Never write a raw palette utility. No `bg-slate-50`,
`text-violet-600`."*

```bash
grep -rInE '\b(bg|text|border|ring|from|to|via|fill|stroke|divide|outline|shadow|accent|decoration|placeholder)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)\b' src --include=*.tsx --include=*.ts
```

**Baseline: 34 pre-existing hits (verified 2026-08-17).** The root `CLAUDE.md`
claims zero; that is wrong. Your job is *not to add more* — compare against the
baseline and report only what the current diff introduced.

The 34 survivors cluster in three shapes the original migration's regex missed,
which is also how new ones get introduced:

- **Coloured shadow tints paired with a migrated background.** e.g.
  `bg-accent … shadow-indigo-500/20`, `bg-success … shadow-emerald-500/20`.
  The background was converted, the shadow beside it was not, so a green button
  still casts an indigo glow. Map to the token: `shadow-accent-glow`, or drop
  the tint.
- **`divide-slate-100` / `divide-slate-200`** on `<tbody>` — 8 of them. Should
  be `divide-subtle`.
- **`placeholder-slate-400` / `-500`** on inputs — should be
  `placeholder-ink-muted`.

`accent-purple-600` in `ExcelViewer.tsx` is a documented exception — it renders
the spreadsheet's own colours. Leave it.

### Related smell, same cause

`hover:bg-success` next to `bg-success` is a no-op hover — the mechanical
migration collapsed `emerald-600`/`emerald-700` to the same token. If you touch
a line that has one, use `hover:bg-success-fg` or the appropriate `-hover`
token. Don't sweep them all as a side quest.

## 2. Hardcoded hex

Convention: *"Colour lives in `globals.css` only. No component hardcodes a hex."*

```bash
grep -rInE '#[0-9a-fA-F]{6}\b' src/components src/app --include=*.tsx \
  | grep -vE 'ExcelViewer|PrintPreviewSidebar|global-error|RobotMascot'
```

Documented exceptions are `ExcelViewer` (renders the spreadsheet's colours),
`PrintPreviewSidebar` (legacy print replica) and `global-error.tsx` (renders
when the stylesheet may be unavailable). `RobotMascot.tsx` is a fourth in
practice — it is an SVG illustration asset, and its hexes are highlight/outline
shades of the accent, not UI surface colour. **This check should come back
clean** apart from those; anything else is a real violation.

## 3. `bg-white` (warning, not a blocker)

111 occurrences. It is a palette literal — the tokens are `bg-surface` (a card
on the app background) and `bg-elevated` (popovers). Flag it only when the diff
*adds* one; do not open a 111-site migration unless asked.

```bash
grep -rIn 'bg-white' src --include=*.tsx | wc -l
```

## 4. i18n — both languages, no hardcoded display text

Convention: *"All user-visible text goes through i18n in BOTH `en` and `km`."*

`km` is typed as `Record<TranslationKey, string>`, so a **missing** key is
already a compile error caught by check 5. What `tsc` cannot catch is text that
never entered the dictionary at all. Scan the diff for JSX text nodes and
user-facing string props:

```bash
git diff --name-only -- 'TestingReact/src/**/*.tsx'
```

For each changed file, look for:
- literal text between JSX tags (`>Save changes<`)
- `placeholder="…"`, `title="…"`, `aria-label="…"`, `alt="…"` with English text
- toast calls: `toast.success("…")`, `toast.error("…")`

Each should be `t("namespace.key")`. Keys are namespaced (`nav.`, `status.`,
`action.`, `sub.`, `tab.`, `toast.`) — match the surrounding convention in
`src/i18n/translations.ts`.

When adding a key: add to `en` **and** `km`. Khmer wording is inherited from the
legacy Blazor `App.km-KH.resx` vocabulary — reuse existing terminology
(គ្រឿងបន្លាស់ = spare part, វិនិច្ឆ័យ = inspection, ម៉ាស៊ីន = machine) rather than
inventing a new word for a concept the dictionary already covers. If you cannot
determine the right Khmer, say so and ask — do not ship a machine translation.

## 5. TypeScript

```bash
npx tsc --noEmit
```

Must be clean. This is also what enforces the `km` dictionary completeness.

## 6. ESLint

```bash
npm run lint
```

**Baseline: 47 pre-existing problems**, itemised in the root `CLAUDE.md`. Report
the delta, not the total. Specifically do **not** "fix" these:

- **Unused variables (11)** — not safe to bulk-delete. e.g.
  `const ok = await deleteTechnicalService(item.id)` has an unused binding, but
  the call performs the deletion. Removing the binding is fine; removing the
  statement deletes a feature.
- **`react-hooks/set-state-in-effect` (4)** — real cascading-render smells in
  `ServiceDetailModal`, `PrintPreviewSidebar`, `AiLauncher`, `users/page`. Each
  needs a genuine refactor. Not a preflight job.

## 7. Animation properties

Convention: *"Animate transform/opacity only. Never width/height/top/left."*

```bash
git diff -U0 -- 'TestingReact/src/**/*.tsx' 'TestingReact/src/app/globals.css' \
  | grep -E '^\+' | grep -E 'transition-(all|\[?(width|height|top|left))|animate-'
```

`transition-all` is the common offender: it will animate layout properties by
accident. Narrow it to `transition-colors`, `transition-transform`, or
`transition-opacity`.

Route animations additionally need `key={pathname}` — a CSS animation does not
replay on a reused DOM node.

---

## Reporting

Give the user a short per-check verdict, then the findings that belong to
*their* diff. Format:

```
tsc          clean
lint         47 problems (= baseline, no new)
palette      1 NEW: src/app/foo/page.tsx:42  shadow-rose-500/20
hex          clean
i18n         1 NEW: hardcoded "Export CSV" at src/app/foo/page.tsx:88
animation    clean
bg-white     no change (111)
```

Then offer to fix the new ones. Fix only what the diff introduced unless the
user asks for a wider sweep.
