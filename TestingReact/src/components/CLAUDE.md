# TestingReact/src/components

Shared/reusable React components used across the `app/` pages (dashboard, ticket workflow queues, spare parts, customers). One subfolder, `ai/`, for the assistant. All files are `"use client"`.

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
  - Used by: `ServiceTable.tsx`, `InspectItemDialog.tsx`.

- `TestingReact/src/components/InspectItemDialog.tsx` — Diagnostic inspection dialog (matches Blazor `InspectItemList.razor` DialogEdit): Inspection/Solution text fields, Service Type (Free/Charge) via `ModernSelect`, spare-parts list (search via `fetchSparePartsInventory`, add/remove, quantity, condition), spec view via `SparePartSpecModal`. Portaled to `document.body`.
  - Props (`InspectItemDialogProps`): `item: RepairServiceItem`, `onClose: () => void`, `onSave: (payload: InspectPayload) => Promise<boolean>`.
  - Exports: default `InspectItemDialog`; type `InspectPayload` (`serviceId, inspection, solution, serviceTypeId, spareParts[]`); internal `SparePartLine` type; `CONDITIONS = ["Fix","Replace","Free"]`.
  - Used by: `app/inspect-item/page.tsx`.
  - 617 lines — read in sections if hunting a specific bug (spare-part search/add logic vs. form/save logic).

- `TestingReact/src/components/ModernSelect.tsx` — Generic styled replacement for native `<select>` (floating portaled option list via `useFloatingPanel`). Used for simple value-picker selects (priority, service location, customer type, item type, service type, spare-part condition) — NOT the richer spare-part search/pick widget.
  - Props (`ModernSelectProps`): `value: string`, `options: ModernSelectOption[]` (`{value,label}`), `onChange: (value: string) => void`, `placeholder?: string`, `className?: string`, `dense?: boolean`.
  - Exports: default `ModernSelect`; type `ModernSelectOption`.
  - Used by: `ServiceDetailModal.tsx`, `InspectItemDialog.tsx`.

- `TestingReact/src/components/PageWrapper.tsx` — Standard page shell: `Sidebar` + `Header` + title/subtitle + content area. Manages `sidebarOpen` state locally.
  - Props: `titleKey: TranslationKey`, `subtitleKey?: TranslationKey`, `children: React.ReactNode`. Takes i18n keys, not finished strings — it resolves them via `useI18n()` so pages stay plain markup.
  - Used by: 13 pages under `app/*` (e.g. `inspect-item`, `approve-verify`, `customers`, `received-inventory`, `spareparts`, `approve-repair`, `confirmed-sale`, `spare-request`, `inspection`, `waiting-confirm`, `unrepairable`, `rejected`, `receive-item`).

- `TestingReact/src/components/PrintPreviewSidebar.tsx` — Pixel-replica of the old DevExpress "Report2" printable ticket report. Fetches full ticket detail + enriches spare-part rows against inventory (`fetchSparePartsInventory`, per-id fallback fetch), renders an A4-styled printable document, `window.print()` on demand.
  - Props: `isOpen: boolean`, `onClose: () => void`, `item: RepairServiceItem | null`.
  - Internal helpers: `fetchSparePartById`, `formatReportDate`, `formatStatus`.
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

## Notes

- Floating/portaled dropdowns (`ModernSelect`, `StatusUpdateDropdown`, `GlobalSearch`, `SparePartSpecModal`) share the `useFloatingPanel` hook at `TestingReact/src/hooks/useFloatingPanel.ts` for positioning — check there first for portal/z-index/positioning bugs.
- **All user-visible text is translated (English/Khmer).** Never hardcode a display string: add a key to `TestingReact/src/i18n/translations.ts` and read it via `const { t } = useI18n()`. Backend values (ticket `status`, `condition`, `serviceLocation`, priority names) must stay in their English spelling in state and on the wire — translate them only at render, via the helpers in `TestingReact/src/i18n/statusLabel.ts`. `PrintPreviewSidebar` is deliberately excluded: it is a pixel-replica of the legacy DevExpress report.
- Watch for `t` shadowing: `GlobalSearch` and `InspectItemDialog` previously used `t` as a `.map()` parameter name; those are now `ticket`/`type`.
- `RepairServiceItem`, `SparePartItem`, and API fetch functions (`fetchRepairServices`, `updateServiceStatus`, etc.) come from `TestingReact/src/services/api.ts`.
