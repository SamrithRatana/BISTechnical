# TestingReact/src/components

Shared/reusable React components used across the `app/` pages (dashboard, ticket workflow queues, spare parts, customers). Subfolders: `ai/` for the assistant, `av/` for the design system, `download/` for the public `/download` landing page (24 files — hooks, 3D phone rig, platform cards, mobile install timeline; indexed in `src/app/CLAUDE.md` under `/download`, since nothing outside that page consumes them), `login/` for the `/login` sign-in stage (20 files — tilt rig, parallax backdrop, card atmosphere, pipeline overlay, curtain + feature spotlight, auth hooks; indexed in `src/app/CLAUDE.md` under `/login`, same nothing-else-consumes-them rule), and `docs/` for the public `/docs` manual (15 components/hooks plus a `content/` subfolder of bilingual catalogue modules — 3D atlas rig, lifecycle rail, chapter reading path, three-column reader with an "on this page" rail and scroll spy; indexed in `src/app/CLAUDE.md` under `/docs`). All files are `"use client"` except where noted — in `docs/` the type, icon-map, accent and content modules are deliberately plain data with no `"use client"` and no React, so a content edit never needs a component import.

**`docs/content/` is the one place in `src/` where user-visible copy does NOT go through `i18n`.** That is deliberate and explained in `docs/content/articleTypes.ts`: `LanguageProvider` imports `en.ts` statically, so anything added there ships to all 50+ routes, and the manual is several hundred long-form strings read by one public page. It carries both languages inline instead and `useDocsText()` reads the side matching `useI18n().lang`. Do not "fix" this by moving it into the dictionary, and do not copy the pattern for ordinary UI strings.

## `av/` — the Aura Velvet design system (OS 3.2)

The reusable primitives everything else composes from. **No component in this
folder hardcodes a colour** — they read `--av-*` tokens from `app/globals.css`,
which is the single place the design system is defined.

- `av/Card.tsx` — surface primitive. `variant`: `surface` (card on the app
  background) / `sunken` (tinted well for sub-panels) / `elevated` (popovers).
  `hover` is opt-in: only cards you can act on should lift. Exports `Card`,
  `CardHeader`.
- `av/Badge.tsx` — pills and status chips. `tone` is a **meaning**
  (`success`/`warning`/`danger`/`info`/`accent`/`neutral`), never a colour
  name, so the queues' status encoding lives in one map. `dot`+`pulse` gives
  the live indicator.
- `av/ProgressBar.tsx` — animates `transform: scaleX()`, not `width`, so a bar
  never forces layout. Value is clamped 0–100.
- `av/ToggleGroup.tsx` — segmented control (the 1H/24H/7D/30D range picker).
  One sliding pill, full WAI-ARIA radiogroup keyboard support.
- `av/Sparkline.tsx` — inline mini-chart for KPI cards. Hand-rolled SVG cubic
  Bézier; `useId` scopes the gradient id so several on one page don't collide.
- `av/KpiCard.tsx` — label, icon badge, value, optional trend + sparkline.
  `trendIsGood` exists because the *sign* of a change and its *desirability*
  differ: rising throughput is good, rising unrepairable count is not.
- `av/ChartPanel.tsx` — the large chart frame: title, legend, tinted mini-stat
  row, chart as `children`.
- `av/AreaChart.tsx` — the main plot. **Not exported from the barrel on
  purpose**: pages load it via `next/dynamic` so it stays in its own chunk.
  Geometry is memoised on `data`, and hover hit-testing is arithmetic (one
  `pointermove` → nearest index), not N DOM listeners.

Design-system notes:
- **Dark mode is back**, as `.dark` token overrides in `globals.css` and
  nothing else — no component changed colour, because none names one. *(This
  section previously said "Light only"; that was true only for the window
  between the old palette being deleted and the rebuild. See the root
  `CLAUDE.md` for why the clock-driven `auto` mode is the one piece that must
  not come back.)*
- `useTheme()` carries ergonomics **and** colour: radius, density, font scale,
  motion, plus `mode`, a resolved `isDark`, `accentColor` and `surfaceStyle`.
  *(It carried ergonomics only, briefly.)*
- **`prefs.lite`** is the newest member — Lite Mode, stamped as
  `html[data-lite]` and consumed by one block in `globals.css`. It is
  deliberately NOT the same switch as `motion`: that one collapses animation,
  this one drops `backdrop-filter`, layered shadows and 3D transforms, which
  cost on every paint whether anything is moving or not. Read it through
  `usePerformance().isLiteMode` (which also folds in the OS reduced-motion
  setting), never `prefs.lite` directly.
- Use the semantic utilities (`bg-surface`, `text-ink-secondary`,
  `border-subtle`, `bg-success-soft`, …) rather than raw palette numbers.
  There are currently **zero** `bg-slate-*`-style utilities left in `src/`;
  keep it that way.
- **Shadow tokens are `--av-shadow-{sm,md,lg,xl,inner,cushion,cushion-hover}`.**
  There is no `--av-shadow-soft-*` — `shadow-soft-sm` is the *Tailwind utility*,
  mapped through `@theme inline` to `var(--av-shadow-sm)`. Overriding the
  `--av-*` token is what reaches all 22 utility call sites; inventing a
  `--av-shadow-soft-*` name silently does nothing.

> **This file is partially stale.** It predates `av/ModalWrapper`,
> `av/Skeleton`, `av/EmptyState`, `av/ErrorState`, `av/ConfirmDialog`,
> `av/AreaChart`, `MotionPreference`, `PageTransition`, `PerformanceProvider`,
> `LiteModePrompt`, `ThemeToggle`, `SystemStatus`, `ReportFilterBar`,
> `TemplateReportView`, `ExcelViewer`, `MediaLightbox`, `RequireRole`,
> `InfiniteScrollStatus`, `DashboardChart` and the `ai/` subfolder. Line counts
> quoted below have drifted too. Trust the source over this index.

## Components (alphabetical)

- `TestingReact/src/components/ActionBus.tsx` — Lets one part of the app trigger a UI action owned by another. A component registers a handler for an action id from `@/config/actions` (`useActionHandler(id, handler, readyKey)`); anything holding the bus requests it by id (`useActionBus().request`). The AI assistant is the current caller.
  - Requests are **queued**, not a single slot, so one instruction can be several steps. A request carries `recordRef` (which record) and `values` (an `ActionValues` field map to prefill the form the action opens).
  - A handler returns `false` for "not yet" (usually its rows haven't loaded); the bus re-offers the request whenever `readyKey` changes, and drops it after `PENDING_TTL_MS` (20s).
  - **One handler per id per mounted tree** — two registrations for the same id both fire against one pending entry. Page-scoped ids (`ui.refresh`, `ui.search`, `export.csv`) are registered once per page, which holds because only one page mounts at a time.
  - Nothing here submits. Handlers open dialogs and fill fields; save/edit/delete stay with the user.
  - Exports: `ActionBusProvider`, `useActionBus`, `useActionHandler`, types `ActionRequest`, `ActionValues`.
  - Registered in: `Sidebar` (`ui.sidebar.*`), `Header` (`ui.language.*`), `GlobalSearch` (`ui.globalSearch`), `ai/AiAssistantProvider` (`ui.assistant.close`), `ServiceTable` + the CRUD pages (record and page-level ids).

- `TestingReact/src/components/ApproveRepairDialog.tsx` — Confirmation dialog for the "Approve Repairing" action (stamps repairDate/repairBy, moves ticket to Repairing). Blocks approval if a "Sale Confirmed" ticket already has spare parts attached, or if a "Charge" ticket is still in "Inspection". Calls `updateServiceStatus(item, "Repairing")`.
  - Props: `item: RepairServiceItem`, `onClose: () => void`, `onApproved: () => void`.
  - Used by: `ServiceTable.tsx` (rendered when `requireApproval` is set).

- `TestingReact/src/components/AuthGuard.tsx` — Route guard checking `localStorage["jwt_token"]`; redirects to `/login` if missing, shows a loading state while checking, renders `/login` immediately without waiting.
  - Props: `children: React.ReactNode`.
  - Used by: `app/layout.tsx` (wraps the whole app).

- `TestingReact/src/components/GlobalSearch.tsx` — Header ticket search box (debounced 300ms) hitting `fetchRepairServices` across all statuses; selecting a result navigates to the page owning that ticket's status (`STATUS_ROUTES` map) with `?q=<reportNo>`.
  - Props: none (self-contained).
  - Exports: default `GlobalSearch`. Internal maps: `STATUS_ROUTES`, `STATUS_BADGE`, `MAX_RESULTS = 8`.
  - Used by: `Header.tsx`.

- `TestingReact/src/components/Header.tsx` — App header bar: sidebar toggle, refresh, `GlobalSearch`, language button (static), notifications icon, JWT user profile dropdown (reads `localStorage["user_info"]`, refreshed via `fetchUserMap()`), logout (clears `jwt_token`/`user_info`, routes to `/login`).
  - Props: `sidebarOpen: boolean`, `setSidebarOpen: (open: boolean) => void`.
  - Used by: `PageWrapper.tsx`.

- `TestingReact/src/components/HighlightText.tsx` — Wraps substrings of `text` matching `query` in a `<mark>`. Used across table cells (Ref No, Company Name, Item Name, Serial Number, Phone, etc.).
  - Props: `text?: string | null`, `query?: string`, `className?: string`.
  - Used by: `ServiceTableRow.tsx`, `InspectItemDialog.tsx`.
  - `React.memo`'d, and the split is `useMemo`'d — it renders ~5x per ticket row
    across 9 columns, so it is one of the hottest components in the app.
  - **Matches are identified by position, not by re-testing the regex.**
    `String.split` with one capture group always yields
    `[text, capture, text, capture, …]`, so an odd index IS the match.
    The old `regex.test(part)` on a `g`-flagged regex *looked* like the classic
    `lastIndex` bug but provably was not — a non-capture chunk can never match,
    and `.test` resets `lastIndex` to 0 on failure. A 300,000-case randomised
    differential run found zero divergences between the two. This was a
    performance and clarity change, **not** a correctness fix.

- `TestingReact/src/components/ServiceTableRow.tsx` — One ticket row (`TicketRow`),
  plus the per-row controls only it uses: `RenderStatusSelect`, `getStatusBadge`,
  `getPriorityBadge`. Split out of `ServiceTable` so the row could be `React.memo`'d.
  - Props (`TicketRowProps`): `row`, `query` (the **debounced** search term),
    `effectiveFilter`, `requireApproval?`, and the handlers `onView`, `onEdit`,
    `onPrint`, `onDelete`, `onApprove`, `onStatusChange`.
  - **Every handler takes the row as an argument and must arrive as a stable
    `useCallback`.** An inline `() => doThing(row)` prop creates a new function
    per render and silently turns this back into the unmemoised version — the
    same rule the spare-parts `PartRow` documents.
  - Why: rows were inline JSX inside `items.map`, so one keystroke in the search
    box re-rendered every loaded row (up to `useInfiniteList`'s 2,000-row cap)
    across nine cells each, including a `RenderStatusSelect` per row.
  - Used by: `ServiceTable.tsx`.

- `TestingReact/src/components/InspectItemDialog.tsx` — Diagnostic inspection dialog (matches Blazor `InspectItemList.razor` DialogEdit): Inspection/Solution text fields, Service Type (Free/Charge) via `ModernSelect`, spare-parts list (search via `fetchSparePartsInventory`, add/remove, quantity, condition), spec view via `SparePartSpecModal`. Portaled to `document.body`.
  - Props (`InspectItemDialogProps`): `item: RepairServiceItem`, `onClose: () => void`, `onSave: (payload: InspectPayload) => Promise<boolean>`.
  - Exports: default `InspectItemDialog`; type `InspectPayload` (`serviceId, inspection, solution, serviceTypeId, spareParts[]`); internal `SparePartLine` type; `CONDITIONS = ["Fix","Replace","Free"]`.
  - Used by: `app/inspect-item/page.tsx`.
  - 617 lines — read in sections if hunting a specific bug (spare-part search/add logic vs. form/save logic).

- `TestingReact/src/components/LazyMountBoundary.tsx` — Class error boundary that
  renders `null` when its child fails, so a rejected `next/dynamic` chunk cannot
  reach `app/global-error.tsx` and take the whole app down. See the
  "Keeping weight out of the shared layout chunk" section above for why the
  layout's lazy hosts specifically need this.
  - Props: `children`, `label` (named in the console warning, so a failure says
    which chunk died).
  - Used by: `GlobalCompanionModal.tsx`, `ai/AiAssistantPanelHost.tsx`.

- `TestingReact/src/components/ModernSelect.tsx` — Generic styled replacement for native `<select>` (floating portaled option list via `useFloatingPanel`). Used for simple value-picker selects (priority, service location, customer type, item type, service type, spare-part condition) — NOT the richer spare-part search/pick widget.
  - Props (`ModernSelectProps`): `value: string`, `options: ModernSelectOption[]` (`{value,label}`), `onChange: (value: string) => void`, `placeholder?: string`, `className?: string`, `dense?: boolean`.
  - Exports: default `ModernSelect`; type `ModernSelectOption`.
  - Used by: `ServiceDetailModal.tsx`, `InspectItemDialog.tsx`.

- `TestingReact/src/components/PageWrapper.tsx` — Standard page shell: `Sidebar` + `Header` + title/subtitle + content area. Manages `sidebarOpen` state locally.
  - Props: `titleKey: TranslationKey`, `subtitleKey?: TranslationKey`, `children: React.ReactNode`. Takes i18n keys, not finished strings — it resolves them via `useI18n()` so pages stay plain markup.
  - Used by: 13 pages under `app/*` (e.g. `inspect-item`, `approve-verify`, `customers`, `received-inventory`, `spareparts`, `approve-repair`, `confirmed-sale`, `spare-request`, `inspection`, `waiting-confirm`, `unrepairable`, `rejected`, `receive-item`).

- `TestingReact/src/components/FaceCapture.tsx` — the camera step. Opens the front camera, waits
  for exactly one face, requires a blink, then captures descriptors. One component for both
  enrolment (3 samples) and sign-in (1), because they differ only in the count.
  - Props: `mode: "enroll" | "verify"`, `onComplete(descriptors)`, `onCancel`, `busy?`.
  - **The blink is asked for BEFORE any capture**, not after: it is what separates a person from a
    photo held to the lens, and capturing first would mean the descriptor that gets sent was taken
    while that was still unknown.
  - More than one face in frame is **refused**, not resolved by picking the largest — on a shared
    machine the second face is a colleague standing behind you.
  - Releases the camera on unmount *and* when unmounted mid-permission-prompt; without the latter
    the light stays on with no UI attached.

- `TestingReact/src/components/FaceLinkQr.tsx` — the DESKTOP half of phone face pairing: draws
  the QR, holds the session's SSE stream, hands the result to its parent. One component for both
  `enroll` (Settings) and `login` (login page).
  - Props: `mode: "enroll" | "login"`, `onDone(payload)`, `onCancel()`.
  - **The QR carries the session id only.** The `secret` that lets this browser read the stream is
    returned by the create call and never displayed — on the login path the stream delivers a real
    session token, so photographing the screen must not be enough to collect it.
  - The QR points at the LAN IP from `/api/scanner/network-ip`, not localhost: the phone is on the
    same Wi-Fi, not on this machine. Same approach the barcode scanner takes.

- `TestingReact/src/components/FaceVerificationManager.tsx` — the Settings panel: turn face
  verification on, re-capture, or delete everything stored. Rendered by `app/settings/page.tsx`.
  - Props: none. Enrolment is `[Authorize]`-gated server-side; this is the matching shape in the UI.
  - "Turn off" is one click plus a confirm, with nothing that can fail on the way.

- `TestingReact/src/components/PasskeyManager.tsx` — Settings panel for face / passkey sign-in:
  lists the devices enrolled against the account, adds the current one, removes one. Rendered by
  `app/settings/page.tsx` inside a `<Section titleKey="passkey.sectionTitle">`.
  - Props: none.
  - **Enrolment lives here, not on the login screen**, and that is the security model rather than a
    layout choice: adding a passkey binds a new device to an account, so it has to be authorised by
    an existing session. `WebAuthnController.RegisterOptions` is `[Authorize]` for the same reason.
  - A cancelled browser prompt is deliberately **silent** — dismissing it is a decision, not a
    fault, and a red toast there reads as a malfunction.
  - Shows whether each passkey `isBackedUp`, because that answers the question people actually
    have: "if I lose this phone, am I locked out?"

- `TestingReact/src/components/PrintPreviewSidebar.tsx` — Print preview for one ticket. Fetches full ticket detail + enriches spare-part rows against inventory (`fetchSparePartsInventory`, per-id fallback fetch), then renders `report/ReportSheet`; `window.print()` on demand.
  - **It does NOT contain the layout.** The A4 sheet comes from `src/report-layout/`, which is mirrored into the CamID phone app so both platforms print one document. See the `report-layout` note at the bottom of this file.
  - **Portalled to `document.body`, and that is load-bearing.** `.av-page-stage` carries `transform: translateZ(0)`, which makes it the containing block for every `fixed`/`absolute` descendant, and `overflow: hidden`, which clips them. Rendered inside it the printed report measured `{x:12, y:72, w:709}` on a 733px-wide A4 content box instead of `{0,0,733}` — inset from the top-left with a blank band down the right — and the signature block was cropped off the bottom. The portal is also what lets the print stylesheet hide the rest of the app with `body > *:not(.rpt-print-root)`.
  - Props: `isOpen: boolean`, `onClose: () => void`, `item: RepairServiceItem | null`.
  - Internal helper: `fetchSparePartById` (the per-id fallback when the bulk inventory page missed a part). Date and status formatting live in `report-layout/format.ts`, shared with the phone.
  - Used by: `ServiceTable.tsx`.

- `TestingReact/src/components/ServiceDetailModal.tsx` — Large ticket detail modal with VIEW mode (read-only audit timeline + spare parts table, matches `RepairServiceViewDialog.razor`) and EDIT mode (form: service date, customer/item autocomplete, priority, location, contract flags — matches `RepairServiceDetailDialog.razor`). Handles create (`POST /api/proxy/receiveitem`) and update (`PUT /api/proxy/technicalservices`) plus delete confirmation.
  - Props (`ModalProps`): `item: RepairServiceItem | null`, `onClose: () => void`, `mode?: "view" | "edit"` (default view), `onSave?: (updatedItem: RepairServiceItem) => void`.
  - Internal sub-components (not exported): `TimelineRow`, `SectionHeader`, `InfoRow`, `ViewContent`, `HighlightMatchText`, `EditContent`.
  - Used by: `ServiceTable.tsx`.
  - 1216 lines — the biggest file here. `ViewContent` (~line 216) vs `EditContent` (~line 455) vs submit/save logic (`handleSubmit`, ~line 897) are distinct regions.

- `TestingReact/src/components/ServiceTable.tsx` — Core paginated ticket table used by every workflow queue page. Search (debounced, seeded from `?q=`), status-specific dropdown actions (`RenderStatusSelect`, one branch per status/tab), print preview, approve-repair flow, view/edit modal, delete. Realtime updates via `useRealtimeTickets`.
  - Props (`ServiceTableProps`): `activeFilter: string`, `tabs?: TabItem[]`, `onTabChange?: (key: string) => void`, `activeTabKey?: string`, `requireApproval?: boolean` (renders `ApproveRepairDialog` action instead of generic status dropdown).
  - Internal: `RenderStatusSelect` (per-status dropdown options), `getStatusBadge`, `getPriorityBadge`.
  - Used by: `app/page.tsx` (dashboard), `receive-item`, `inspection`, `waiting-confirm`, `confirmed-sale`, `spare-request`, `approve-repair`, `rejected`, `unrepairable` pages.
  - 662 lines — `RenderStatusSelect` (~line 64) holds all the per-status dropdown-option logic if hunting a status-transition bug.

- `TestingReact/src/components/Sidebar.tsx` — Left nav sidebar; active-link highlighting via `usePathname()`, collapses to icon-only width.
  - **The menu itself lives in `TestingReact/src/config/navigation.ts`**, not here — the AI assistant's `describe_application` tool reads the same config, so a page added there appears in both the sidebar and the assistant's answers. This component only maps `href` → lucide icon (local `ICONS` record) and renders; keeping the shared config React-free is what lets the `api/ai-search` route handler import it server-side.
  - Props: `isOpen: boolean`, `setIsOpen: (val: boolean) => void`.
  - Used by: `PageWrapper.tsx`.

- `TestingReact/src/components/SparePartSpecModal.tsx` — Read-only spare-part spec view (image, part number, use-for, stock badge, price, description). Portaled to `document.body` (root-level sibling) so its z-index isn't capped by an ancestor's stacking context.
  - Props (`SparePartSpecModalProps`): `part: SparePartItem`, `onClose: () => void`.
  - Internal helpers: `getImageUrl`, `stockBadge`.
  - Used by: `InspectItemDialog.tsx` (opened from the eye icon in search results / added-parts table).

- `TestingReact/src/components/StatCards.tsx` — Dashboard's 4 top KPI tiles (Today's Report, Received Item, Waiting Customer, Finished), built on `av/KpiCard`; counts come from `fetchDashboardStats()`; click sets the active filter. Shows no trend/sparkline: `DashboardStats` returns running totals with no historical series, so there is nothing to compute one from (the old fixed "+100%" strings were removed).
  - Props (`StatCardsProps`): `selectedFilter: string`, `setSelectedFilter: (id: string) => void`.
  - Used by: `app/page.tsx` (dashboard).

- `TestingReact/src/components/StatusTabMenu.tsx` — Horizontal pill-tab strip with count badges, matches old `StatusTabMenu.razor`.
  - Props (`StatusTabMenuProps`): `tabs: TabItem[]` (`{key, labelKey, count?, color?}`), `activeKey: string`, `onTabChange: (key: string) => void`, `loading?: boolean`. `key` is the backend status (identity, never translated); `labelKey` is an i18n key this component resolves itself.
  - Exports: default `StatusTabMenu`; type `TabItem`.
  - Used by: pages that pass `tabs`/`onTabChange` into `ServiceTable`.

- `TestingReact/src/components/StatusUpdateDropdown.tsx` — Custom styled status-change control replacing native `<select>` for `ServiceTable`'s Status column (button + floating portaled panel via `useFloatingPanel`).
  - Props (`StatusUpdateDropdownProps`): `currentLabel: string`, `options: StatusOption[]` (`{value,label}`), `color: StatusDropdownColor` ("slate"|"blue"|"amber"|"cyan"|"emerald"|"purple"), `onSelect: (value: string) => void`.
  - Exports: default `StatusUpdateDropdown`; type `StatusDropdownColor`.
  - Used by: `ServiceTable.tsx` (`RenderStatusSelect`).

## Keeping weight out of the shared layout chunk

`app/layout.tsx` mounts `GlobalCompanionModal`, `AiLauncher` and
`AiAssistantPanelHost`, so **anything they import statically lands in the chunk
every one of the 55 routes downloads before it can paint**. Two of them
therefore load their payload through `next/dynamic` with `ssr: false`:

- `ai/AiAssistantPanelHost.tsx` — mount point for `AiAssistantPanel` (~490
  lines plus its lucide set and `react-hot-toast`), which renders nothing until
  the assistant is opened.
- `GlobalCompanionModal.tsx` — loads `CompanionScannerModal`, which reaches the
  `qrcode` package through `QRCodeSvg`, for a pairing dialog most sessions
  never open.

**Both are wrapped in `LazyMountBoundary.tsx`, and that is not optional
either.** `next/dynamic` is `React.lazy` + `Suspense`, so a rejected `import()`
is re-thrown during render — and these two are rendered by `app/layout.tsx` as
siblings of `<AuthGuard>`, which puts them *outside* `app/error.tsx`. The only
boundary above them is `app/global-error.tsx`, which replaces `<html>` and
`<body>` wholesale. So without the boundary, a single chunk that 404s after a
deploy replaces the whole application with the global error page and discards
whatever the user had open in a ticket dialog — on an app explicitly built for
week-long sessions (§14). The boundary renders `null` instead, and
`AiAssistantPanelHost` also passes a `loading` component to `dynamic()` so the
launcher click is not a dead one while the chunk downloads.

**Both also gate the dynamic component behind a latched `hasOpened` flag, and
that gate is load-bearing rather than an optimisation.** `ssr: false` makes the
server emit no markup while the client immediately renders a `<Suspense>`
boundary; React then finds the next sibling where it expected that boundary and
reports *"Hydration failed because the server rendered HTML didn't match the
client"*, throwing away and re-rendering the whole tree. That was reproduced in
a browser against both files. `GlobalCompanionModal` is the worse case because
`sessionId` comes from `useState(() => getOrCreateSessionId())`, which returns
`""` on the server and a real id in the browser — a latent mismatch that only
became visible once a Suspense boundary appeared there.

Gating on a flag that is `false` on the server AND on the first client render
makes the two agree by construction. The flag **latches** (rather than tracking
`open`) so closing does not unmount and discard a half-typed message, or cut
off `ModalWrapper`'s exit animation. It is set during render — React's
documented pattern for deriving from a changing input — deliberately not in an
effect, which would cost a second render pass and trip this project's
`set-state-in-effect` rule.

## Notes

- Floating/portaled dropdowns (`ModernSelect`, `StatusUpdateDropdown`, `GlobalSearch`, `SparePartSpecModal`) share the `useFloatingPanel` hook at `TestingReact/src/hooks/useFloatingPanel.ts` for positioning — check there first for portal/z-index/positioning bugs.
- **All user-visible text is translated (English/Khmer).** Never hardcode a display string: add a key to `TestingReact/src/i18n/translations.ts` and read it via `const { t } = useI18n()`. Backend values (ticket `status`, `condition`, `serviceLocation`, priority names) must stay in their English spelling in state and on the wire — translate them only at render, via the helpers in `TestingReact/src/i18n/statusLabel.ts`. The printed report (`src/report-layout/`) is deliberately excluded: its wording is user-editable data from the Templates Settings page, stored in the published template, not UI chrome.
- Watch for `t` shadowing: `GlobalSearch` and `InspectItemDialog` previously used `t` as a `.map()` parameter name; those are now `ticket`/`type`.
- `RepairServiceItem`, `SparePartItem`, and API fetch functions (`fetchRepairServices`, `updateServiceStatus`, etc.) come from `TestingReact/src/services/api.ts`.


## `src/report-layout/` — the ONE report layout

The printed Technical Service Report is defined once, in `TestingReact/src/report-layout/`,
and **mirrored verbatim into `CamIdMobile/src/report-layout/`** by
`npm run sync:shared`. `npm run typecheck` and `npm run build` both run
`--check` first, so an edit to one side and not the other is a build failure
rather than a silent fork.

It used to exist three times: `ReportDocument.tsx` (1,926 lines of React) for the
web canvas and print, and an 887-line hand-written HTML generator on the phone.
They drifted exactly as you would expect — the mobile generator read 9 of the
template's 30 fields and hardcoded the rest, so eleven things the designer edits
published fine on the web and did nothing on the phone.

- **Plain TypeScript, no framework imports, ever.** No React, no Next, no DOM,
  no `window`, no Node built-ins, and no import out of the folder. That is what
  lets the same files run inside the Expo/Metro bundle. A single `@/services/...`
  import here breaks the phone build.
- **Consumers:** `report/ReportSheet.tsx` (mounts it in the web app),
  `report/ReportDesignerCanvas.tsx` (Templates Settings, an overlay on top of
  the same HTML), `PrintPreviewSidebar.tsx`, and the phone's
  `services/portalTechnicalReportService.ts`.
- **Every px design token is converted to millimetres** (`pxToMm`). CSS defines
  `1mm` as exactly `96/25.4` px, so this is lossless on the web — 32px is still
  32px on screen — and it pins the phone, whose WebView maps CSS px to the PDF
  at a different rate. Without it a `padding: 32px` printed 8.5mm on the desktop
  and 11.3mm on the phone from the same code.
- **`@page` carries no margin.** The page box is the whole A4 sheet and all
  whitespace is `.rpt-sheet`'s own padding, so the preview and the printout are
  the same box with the same margins on all four edges. Splitting the whitespace
  between an `@page margin` and a sheet padding is what previously produced
  uneven edges.
- **`.rpt-sheet` must stay in the `box-sizing: border-box` selector**, not just
  `.rpt-sheet *`. The print rule is `width: 100%` plus that padding, so without
  it the sheet is exactly two paddings wider than the page and the right edge of
  every line runs off the paper.
- **The preview zoom lives inside `@media screen`.** An inline `zoom` on the
  preview wrapper used to survive into print — `print:transform-none` resets
  `transform`, not `zoom` — and printed the whole page at 85%, anchored
  top-left. Declaring it in a screen-only block means print cannot see it at all.
- **Every interpolated value goes through `escapeHtml`.** The report prints
  customer names, addresses and free-text complaints straight from the database
  into a string handed to `dangerouslySetInnerHTML` and to a WebView. There is
  no trusted caller that may skip it.
- **`componentOffsets` reaches the page.** `getTargetKey` (in `design.ts`) is the
  one key function the inspector writes with and the renderer reads with; the
  offset is emitted as a millimetre `translate`, merged into whatever inline
  style the element already had.
- **Printing from a screen that shows the report *inside* the layout needs
  `ReportPrintPortal`.** The print stylesheet isolates with
  `body > *:not(.rpt-print-root)`, so the printed element has to be a direct
  child of `<body>`. The preview sidebar portals its whole overlay and needs
  nothing extra; the Templates Settings preview tab mounts the portal alongside.
- **83 unit tests** cover this module, in the CamID project (`npm test`) because
  that is the side with a runner. They assert the escaping, the px→mm
  conversion, `@page` having no margin, `.rpt-sheet` being in the border-box
  rule, zoom staying screen-only, print not clipping, order normalisation,
  `statusDate`, spare-part precedence and offset rendering.
- Verified by measurement, not assertion: a real `page.pdf()` from inside the
  running app reports MediaBox `594.96 x 841.92pt` (exact A4), 1 page, sheet at
  `{x:0, y:0, w:794, h:1122.5}`, `zoom: 1`, zero horizontal overflow, signature
  block inside the page, and app chrome fully hidden. A hostile template and a
  hostile ticket render with all 9 injection vectors escaped.

## `sparepart-taxonomy/` — the spare-part Category / Type / Brand screens (2026-09-05)

Everything the three lookup pages (`app/spareparts/{categories,types,brands}`) share; each
page holds only its fields and columns.

- `TaxonomyPage.tsx` — page frame: search + optional toolbar extra + Add, table with
  `SkeletonRows` / `ErrorState` (Retry) / `EmptyState` (distinguishes "nothing yet" from
  "no match"), footer count. Generic over the row type; the page supplies `columns` and
  `renderRow`.
- `TaxonomyFormModal.tsx` — add/edit dialog shell on `av/ModalWrapper` (pinned header,
  scrolling fields, pinned actions; `labelledBy` from `useId`; undismissable while `busy`).
  Exports `TaxonomyField` — a `<label htmlFor>` bound to the child through a render-prop
  `(id) => …` — and `TAXONOMY_INPUT_CLASS`.
- `BrandLogoField.tsx` — optional logo: R2 upload through `services/upload.ts` with an
  `AbortController` aborted on unmount (the dialog unmounts its children on close), or a
  pasted URL. Callers must use the functional `setForm((prev) => …)` — the upload resolves
  seconds after it was started.
- `useTaxonomyList.ts` — whole-list load (the lookups are small; no paging) guarded by a
  generation counter so a stale or post-unmount response is dropped; refreshed by the
  `sparepart` SSE resource — that path calls `invalidateTaxonomyCache()` first, because the 60s client cache is per tab and would otherwise answer a colleague's write from the stale local copy. A failed *refresh* keeps the rows on screen (§12); only an
  empty list shows the error state. The effect only starts the load — every state write is
  in the promise continuation (`react-hooks/set-state-in-effect`).
- `useTaxonomyCrud.ts` — add/edit/delete state machine: form, busy flag, delete target
  (kept through the confirm's exit animation), and the result → toast mapping. `inUse`
  keeps the confirm open so the count is read against the row's name.
- `taxonomyFeedback.ts` — `ApiWriteResult` failure → sentence, keyed off the API's stable
  `code` (`duplicate` / `inUse` / network), never off its English `detail`.

## `spareparts/` — classification controls for the catalogue page (2026-09-05)

Used only by `app/spareparts/page.tsx`; extracted so that 1,800-line page did not grow the
whole feature inline.

- `SparePartFilterBar.tsx` — Category → Type → Brand on `ModernSelect`, plus Clear. Type is
  disabled (a real `disabled` on `ModernSelect`, placeholder says why) until a category is
  chosen, and a category change drops the type. Empty string = "all" — the API treats an
  absent parameter as no filter.
- `SparePartClassificationFields.tsx` — the same three selects for the add/edit form with a
  "None" option (→ `null` on the wire). Changing the category clears the type so the API's
  "type must be inside its category" 400 is never reachable from this form.
- `useSparePartTaxonomyOptions.ts` — the three lookup lists as `ModernSelectOption[]` plus
  `typeOptionsFor(categoryId)`; three `useTaxonomyList`s, so the lists refresh on the
  `sparepart` SSE resource like the taxonomy pages.
- `useSparePartFilterParams.ts` — `?categoryId&typeId&brandId` ↔ state. Read once on mount
  through `apply` (GUID-validated, never seeded into `useState` — hydration), written with
  `replaceState` (no history stacking, other params such as `?q=` preserved). The write
  effect skips its first run: on mount the state is still `{}` while the read has only just
  scheduled the seed, and writing then would strip the URL a frame early.
