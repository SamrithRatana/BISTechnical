# app/ — Route Index

Next.js App Router tree for a repair/service-item workflow tracker (item intake, technical inspection, spare-parts requisition, customer sale approval, repair, QA verification, and inventory/customer management). Most workflow pages are thin wrappers around the shared `ServiceTable` component filtered by ticket `status`; a few pages (spareparts, received-inventory, customers) are full CRUD screens with their own tables/modals. Backend calls go through Next.js API routes in `api/` that proxy to external ASP.NET services (TechnicalServices API, Customer API, JWT/User API).

## Root layout / shared providers

- Route: `/` (layout applies to all routes)
- File: `layout.tsx`
- `RootLayout({ children })` — server component. Sets up Geist fonts, Google Fonts preconnect, wraps `children` in `<AuthGuard>` (auth gate, see `@/components/AuthGuard`), and mounts `<Toaster position="top-right">` (react-hot-toast) globally.
- `not-found.tsx` — client component `NotFound()`, custom 404 page with link back to `/`.

## `/` — Home Dashboard

- File: `page.tsx`
- Client component (`"use client"`).
- `Home()` — renders `Sidebar` + `Header` + `StatCards` + `ServiceTable` (activeFilter driven by `selectedFilter` state, default `"Today"`). Main landing dashboard.

## `/login` and `/login` layout

- Route: `/login`
- Files: `login/page.tsx` (thin orchestrator), `login/layout.tsx`
- Client component. Public dark marketing look, deliberately NOT on the `--av-*`
  token system — same zone as `/download`.
- `LoginLayout({ children })` (layout.tsx, server) — sets page metadata only, no auth guard override.
- `LoginPage()` — orchestration only: mode state (sign-in vs method selector),
  credentials state, and composition. Everything else lives in
  `src/components/login/` (23 files, each < 300 lines — this page was a
  1,700-line monolith before 2026-08-30): **"Prismwell"** design (2026-08-30,
  replacing "Depth Stage"'s look while keeping its architecture) — one
  user accent split into a hue-shifted triad (`color.ts`, chroma-guarded for
  gray accents) drives every chromatic surface. Pointer tilt rig
  (`useLoginTilt`, frozen while a QR/camera is on screen), triad backdrop
  with three parallax depth rings + tiered particles (`LoginBackdrop`,
  memoised; ONE aurora drift — the right orb is deliberately static, and a
  `frozen` prop pauses ambient loops behind a live camera), translateZ
  strata on the rig (`LoginStage`: echo plane −160px, lagging glow plane
  −90px, two front glass shards +56/+96px that extrude on load),
  pointer-steered chromatic card rim (`CardRim`: two pre-painted conic
  underlays crossfading opacity from the tilt springs — rotating rim light
  with zero repaint, symmetric ring at rest so the frozen state is designed),
  dual-lobe interference interior (`CardAtmosphere`: two companion-hue lobes
  counter-roaming; rim beam gated off while frozen — v1 swept it over live
  QRs), CSS-only input focus chrome (`FocusChrome`: gradient rim +
  target-lock corner ticks + pre-painted elevation shadow, all
  `group-focus-within` + `motion-reduce:transition-none`), and the signature
  **prismatic shear**: three triad-hued blades riding the curtain sweep's
  leading edge with relative x-offsets (`ShowcaseCurtain` — children of the
  translating panel must NOT re-animate its keyframes or they
  double-translate), converging into the resting light seam, plus a one-shot
  rim refraction flash on settle. The curtain hinge projects through
  `[perspective:1200px]` on the sliding body (without it rotateY renders
  orthographic). Spotlight tab dock glides a `layoutId` pill; its
  auto-advance interval keys on `active` so a manual click resets bar and
  timer together.
- Auth logic: `useLoginPipeline` (the five-stage handshake overlay + storage
  writes + soft `router.push("/")`) and `useAuthFlows` (password via
  `faceLoginStart` with the face second-factor branch, passkey, phone-QR).
  Both ported unchanged from v1; only presentation moved. The mobile
  header's "Switch Method" toggle must open via `openSelector()` — it
  releases an active face-capture camera; a bare `setMode` leaves the
  camera light on behind `display:none` (fixed 2026-08-30).
- `PipelineOverlay` takes the `holo` triad and delays its entrance
  `OVERLAY_SUMMON_DELAY` (120ms) behind the submit button's pulse, so the
  overlay reads as summoned by the press; it fully collapses in static mode
  (framer's `useReducedMotion` does NOT cover Lite Mode alone).
- Motion collapses to a static composition under reduced-motion / Lite Mode
  via `useLoginMotionMode` (same merge as `useDownloadMotionMode`).
- The remembered auth-method tab is a hydration-safe `useSyncExternalStore`
  sessionStorage store (`components/login/authMethodStore.ts`).

## `/receive-item` — Received Items queue

- File: `receive-item/page.tsx`
- Client component.
- `ReceiveItemPage()` — `PageWrapper` + `ServiceTable activeFilter="Received"`. No local state/logic.

## `/inspect-item` — Inspecting queue (Accept & diagnose)

- File: `inspect-item/page.tsx`
- Client component.
- `InspectItemPage()` — table of tickets with status `Inspecting`; row click/"View" opens `ServiceDetailModal`; "Accept" opens `InspectItemDialog`.
- `handleAcceptSave(payload)` — PUT `/api/proxy/inspectitem` (note: PUT reconciles spare-parts list against saved state; POST would just append/duplicate — use PUT here).
- `handleExportCSV()` — client-side CSV export of current page.
- `fmtDate(d)` — date/time formatter helper.
- Uses `useRealtimeTickets("Inspecting", ...)` for SSE-driven auto-refresh and `useSearchQueryParam` to seed search from `?q=`.

## `/inspection` — Inspection records (tabbed)

- File: `inspection/page.tsx`
- Client component.
- `InspectionPage()` — `ServiceTable activeFilter="Inspection"` with `INSPECTION_TABS` (Inspection / Awaiting Sparepart / Awaiting Customer Confirm / Sale Confirmed / Sent Spareparts), Khmer tab labels.

## `/spare-request` — Spare parts requisition queue

- File: `spare-request/page.tsx`
- Client component.
- `SpareRequestPage()` — `ServiceTable activeFilter="Awaiting Sparepart"` with `SPARE_REQUEST_TABS` (Inspection / Awaiting Sparepart).

## `/waiting-confirm` — Awaiting customer confirmation (tabbed)

- File: `waiting-confirm/page.tsx`
- Client component.
- `WaitingConfirmPage()` — `ServiceTable activeFilter="Awaiting Customer Confirm"` with `WAITING_CONFIRM_TABS` (Item Received → Inspection → Awaiting Sparepart → Awaiting Customer Confirm → Sale Confirmed → Sent Spareparts).

## `/confirmed-sale` — Confirmed repair sale (tabbed)

- File: `confirmed-sale/page.tsx`
- Client component.
- `ConfirmedSalePage()` — `ServiceTable activeFilter="Sale Confirmed"` with `CONFIRMED_SALE_TABS` (Awaiting Customer Confirm / Sale Confirmed / Sent Spareparts).

## `/approve-repair` — Active repair queue (tabbed, requires approval)

- File: `approve-repair/page.tsx`
- Client component.
- `ApproveRepairPage()` — `ServiceTable activeFilter="Repairing" requireApproval` with `APPROVE_REPAIR_TABS` (Repairing / Sent Spareparts / Inspection / Sale Confirmed).

## `/approve-verify` — Final QA verification queue

- File: `approve-verify/page.tsx`
- Client component.
- `ApproveVerifyPage()` — lists tickets with status `Finished`; "Verify" button finalizes a ticket.
- `handleVerify(row)` — POST `/api/proxy/finishedrepair` with `{serviceId, id, verifiedBy, finishedDate}`, then calls `updateServiceStatus(row, "Finished")`; falls back to status update alone if the POST fails.
- `handleExportCSV()` — CSV export.
- `fmtDate(d)` — date formatter.
- Uses `useRealtimeTickets("Finished", ...)` for SSE auto-refresh, `ServiceDetailModal` for view, `PrintPreviewSidebar` for print.

## `/rejected` — Customer rejected tickets

- File: `rejected/page.tsx`
- Client component.
- `RejectedPage()` — `ServiceTable activeFilter="Customer Rejected"`.

## `/unrepairable` — Set unrepairable

- File: `unrepairable/page.tsx`
- Client component.
- `UnrepairablePage()` — `ServiceTable activeFilter="Unrepairable"`.

## `/spareparts` — Spare parts inventory (full CRUD)

- File: `spareparts/page.tsx`
- Client component. Standalone table (not `ServiceTable`) with Add/Edit/Delete/Stock-In/Stock-Out modals; matches legacy `SparePartList.razor`.
- `BarcodeSvg({ value })` — renders a synthetic Code128-style SVG barcode from a string.
- `SparePartsPage()` — main component.
  - `loadData()` — `fetchSparePartsInventory(page, pageSize, search)` from `@/services/api` (server-side search via `useDebouncedValue`).
  - `handleCreateOrUpdate(e)` — `createSparePart()` / `updateSparePart()`, with optimistic local fallback on API failure.
  - `handleDelete()` — `deleteSparePart(id)`, optimistic fallback.
  - `handleStockInSubmit()` — increments quantity via `updateSparePart()`.
  - `handleStockOutSubmit()` — `insertManualStockOut(id, qty, reason)`.
  - `getImageUrl(url)` — normalizes relative/absolute picture URLs.

## `/received-inventory` — Item Models Inventory (full CRUD)

- File: `received-inventory/page.tsx`
- Client component. Matches legacy `ItemModelList.razor`. Columns: Item Name, SerialNumber, Item Type, Actions.
- `getAuthHeaders()` — builds headers with `Authorization: Bearer <jwt_token>` from localStorage.
- `ReceivedInventoryPage()` — main component.
  - `loadData()` — `fetchItemsInventory(page, pageSize, search)`.
  - `handleCreateOrUpdate(e)` — POST/PUT `/api/proxy/items` directly via `fetch`, then `invalidateCachePrefix("items")`.
  - `handleDelete()` — DELETE `/api/proxy/items/:id`.
  - `handleExportCSV()` — CSV export.
  - View/Edit/Delete modals; `ModernSelect` for item type.

## `/customers` — Customer Center (full CRUD)

- File: `customers/page.tsx`
- Client component. Matches legacy `CustomerList.razor`.
- `CustomerCenterPage()` — main component.
  - `loadData()` — `fetchCustomerCenter(page, pageSize, search)`.
  - `handleOpenAdd()` / `handleOpenEdit(customer)` / `handleOpenDelete(customer)` — modal openers.
  - `handleSubmitForm(e)` — `createCustomer()` / `updateCustomer()`, optimistic fallback.
  - `handleDeleteConfirm()` — `deleteCustomer(id)`, optimistic fallback.

## `/download` — public CAM ID mobile download hub ("Aperture Stage")

- Files: `download/page.tsx` (thin orchestrator), plus `download/android/page.tsx` and
  `download/ios/page.tsx` (dedicated per-OS install pages the QR codes point at).
- Public (AuthGuard + AppShell both allowlist `/download`), standalone dark marketing look —
  deliberately NOT on the `--av-*` token system, same zone as `/login`.
- Every section, hook and constant lives in `src/components/download/` (24 files, each < 300
  lines — this page was a 1,060-line monolith before 2026-08-29). The page only holds device
  branching, the lifted per-platform QR-open state, and section order.
- Desktop: 3D phone hero with a one-shot scan sequence → statement divider → Android/iOS
  platform duet (in-place QR reveal, details accordion, copy link) → proof pipeline → closing
  CTA. Phones: guided 3-step install timeline with sticky action bar.
- QR codes resolve the LAN host from `/api/scanner/network-ip` when viewed on localhost
  (the old hardcoded `172.25.222.22` fallback is gone).
- All copy is `download.*` keys in `i18n/translations.ts` (en + km), except sanctioned
  English-only telemetry micro-labels (see `components/download/ScanScreen.tsx` header note).
- Motion collapses to a static premium layout under reduced-motion / Lite Mode via
  `useDownloadMotionMode()`; 3D-transform safety rules live in `PhoneRig.tsx`'s header comment.

## `/docs` — public documentation hub ("Codex Atlas")

- Files: `docs/page.tsx` (thin orchestrator), `docs/layout.tsx` (metadata only).
- Public (AuthGuard, AppShell and AiLauncher all allowlist `/docs`), standalone dark look —
  deliberately NOT on the `--av-*` token system, same zone as `/login` and `/download`.
- Every section, hook and string lives in `src/components/docs/` (20 components/hooks + 21
  content modules, each < 300 lines). The page holds only the search term, the scroll-spy
  wiring and section order.
- Layout: 3D "Atlas" hero (an exploded stack of five chapter planes on Z, pointer tilt, orbit
  chips) → the repair **lifecycle rail** (all 11 statuses end to end, horizontally scrollable,
  each stop clickable through to its topic) → five chapters of expandable topic cards beside a
  sticky scroll-spy chapter nav → footer.
- **The copy is NOT in `i18n/en.ts` / `km.ts`.** It carries both languages inline in
  `components/docs/content/` and travels in this route's own chunk. `LanguageProvider` imports
  `en.ts` statically, so every key there lands in the chunk all 50+ routes download before they
  can paint — several hundred strings of long-form manual, read by one public page, would be a
  bundle regression against §4 for no one's benefit. `useDocsText()` picks the side to render
  from `useI18n().lang`, so the language toggle still drives it; only the payload is local.
  See `components/docs/docsTypes.ts` for the full reasoning.
- The catalogue is plain data (no React, no icons) for the same reason `config/navigation.ts`
  is: `docsIcons.ts` maps icon *names* to lucide components on the rendering side.
  `config/navigation.ts` is the source the page purposes were written from, so the manual and
  the sidebar cannot drift.
- **Topic ids mirror route slugs** (`/receive-item` → `receive-item`) — that is what lets a
  click on the lifecycle rail land on the instructions, and what makes `/docs#stock-health` a
  working deep link. The open topic lives in the URL (`useDocsHash`, a `useSyncExternalStore`
  over `location.hash`), not in page state, so links are shareable. Writes use `replaceState`,
  deliberately: opening topics does not stack history, so Back leaves the page instead of
  stepping back through every card the reader opened.
- Search (`useDocsSearch`) is entirely client-side over a memoised haystack built ONCE per
  catalogue, and indexes **both** languages plus the route — a Khmer reader finds a screen by
  typing `/spare-request`, an English one finds it by typing "ស្តុក". Matching is
  whitespace-tokenised AND. `/` focuses the box from anywhere.
- Motion collapses to a static premium composition under reduced-motion / Lite Mode via
  `useDocsMotionMode()` (same merge as `useDownloadMotionMode`). Lite Mode forces
  `transform-style: flat`, which collapses the atlas's Z separation — `STATIC_PLANE_SPREAD`
  fans the planes further apart in that mode so the static version stays legible rather than
  becoming one card with four shadows behind it.
- **The forever-loops stop when nobody is looking**, which is where this page departs from
  `/download`: `useAmbientMotion` gates the atlas float, the yaw drift, the orbit chips, the
  scroll cue and the lifecycle pulse on `useInView` **and** `usePageInView`. A manual is read
  for minutes and left open for hours, so a loop driving a hero ten screens up — or a
  backgrounded tab — is pure cost (§14). Measured: the rig produces 14 distinct transforms
  over 14 samples while on screen and **1** while scrolled away or while the tab is hidden,
  resuming on return. The one-shot load choreography still answers to `mode` alone; it is over
  before any of this can matter.
- `content/index.ts` runs a **dev-only integrity check** (dead-code-eliminated in production):
  duplicate topic ids, and lifecycle stages whose `topicId` matches no topic. Both failures are
  otherwise silent — a duplicate id sends every deep link to whichever card rendered first, and
  an orphaned stage turns its stop on the rail into a dead click. There is no test runner in
  this project (§15), so this is the substitute for the test that would otherwise catch them.
- 3D-transform safety rules are inherited verbatim from `download/PhoneRig.tsx` and restated in
  `AtlasCore.tsx`'s header: no `backdrop-filter`, no `filter`, no `overflow-hidden` on any
  `preserve-3d` ancestor. The atlas spine and floor grid are `lg:`-only because they are taller
  than the rig and would otherwise escape a stacked mobile hero — the hero cannot clip them
  without flattening the whole subtree.
- Entry points: the **centred Docs pill** in `/login`'s top bar (`login/LoginChrome.tsx`), and
  cross-links in both `/download`'s header and its footer (`download.docsLink`, en + km). The
  three public pages point at each other: `/docs`'s own header carries the mirror-image link
  back to `/download`.

## `api/` — Next.js backend routes (proxy + auth + realtime)

### `POST /api/auth/login`

- File: `api/auth/login/route.ts`
- `POST(req)` — forwards credentials to C# Identity Auth API (`JWT_API_BASE=/api/auth/login`), then enriches the response by looking up the user in `/api/UserManagement` to attach id/email/roles/profile picture. Returns `{isSuccess, token, refreshToken, user}` or 401 on failure.

### `GET/POST /api/ai-search` — "Ask AI" assistant

- Files: `api/ai-search/route.ts`, `api/ai-search/tools.ts`, `api/ai-search/backend.ts`, `api/ai-search/image.ts`
- `runtime = "nodejs"`, `maxDuration = 60`.
- `GET` — reports `{enabled}` so `GlobalSearch` can hide the toggle when no key is set.
- `POST({query})` — runs an agent loop: the model is given read-only tools
  (`search_tickets`, `count_tickets`, `search_spare_parts`, `search_customers`,
  `search_items`, `find_users`, `get_dashboard_stats`, `describe_application`),
  the route executes those against the real backends, and the model finishes
  with `present_results` carrying its answer plus the filters the header
  dropdown re-runs. Returns `{filters}` shaped as `SmartQueryResult` (see
  `services/smartQuery.ts`).
- `present_results` also carries `navigateTo` and an `actions` list — the UI
  steps to perform, validated here against `@/config/actions` (unknown or
  unwired ids dropped, field names filtered by `sanitizeActionValues`) and
  dispatched client-side through the action bus. Actions cover dialogs
  (`ticket.edit`, `sparePart.stockOut`, `customer.create`, …), the shell
  (`ui.sidebar.*`, `ui.language.*`, `ui.tab`, `ui.search`,
  `ui.globalSearch`, `ui.refresh`), and can carry `values` that fill a form in.
  **Nothing in this path submits** — every id resolves to a handler that opens
  or fills and stops, so save/edit/delete remain the user's click. `MAX_ACTIONS`
  caps one reply at 6 steps.
- **Requires a signed-in caller.** `POST` without an `Authorization: Bearer`
  header returns **401** with `degraded: "notSignedIn"` and no data. It reads
  every row with the caller's own token, so there is nothing to answer with
  otherwise — see the `backend.ts` note below for what this replaced.
- Provider: Gemini (`GEMINI_API_KEY`) first, falling through `GEMINI_MODELS` on
  429/503/404; Anthropic (`ANTHROPIC_API_KEY`) if no Gemini key. With neither,
  and past the `AGENT_BUDGET_MS` wall-clock budget, it degrades to a plain
  keyword search (`grounded: false`) instead of erroring.
- `GEMINI_MODELS` is ordered strongest-first and is **free-tier only** —
  `gemini-3.7-flash` leads, `gemini-3.6-flash` is last (measured 21–45s per
  round). Both Pro entries were removed: Pro has no free tier at all and
  answered 429 every time. `generationConfig` sets
  `thinkingLevel: "low"` — the single biggest speed lever here (6.7s → 1.8s on
  `gemini-3.5-flash`). Verify a model with a live probe before adding it; the
  header comment in `route.ts` carries the current measurements.
- **Image generation** (`image.ts`): a message asking for a picture
  ("generate an image of…", "draw a logo for…", "ជួយបង្កើតរូបភាព…") is detected
  by keyword in `POST` and answered by Google's Nano Banana models **instead of**
  the tool loop — there is nothing in the workshop's data to look up. The reply
  travels in the normal envelope (`filters` with `category: "general"`) plus an
  `image` field carrying a base64 **data URL**, which `AiAssistantProvider`
  stores on the `ChatMessage` and `AiAssistantPanel` renders with a download
  link. Images are never sent back up in `history`.
  - Detection needs a making verb **plus** a picture noun, so "show me the image
    on that spare part" stays an ordinary lookup. A subject-bearing noun (logo,
    icon, poster…) is kept in the prompt; a generic one (image, picture, photo)
    is dropped — see `GENERIC_PICTURE_NOUNS`.
  - Its own model list, cooldown map and quota bucket, kept out of
    `GEMINI_MODELS` so an image model never enters the text rotation or the
    model picker.
  - **Provider chain, best first**: Nano Banana (Gemini) → Pollinations keyed
    (`gen.pollinations.ai`) → Pollinations anonymous
    (`image.pollinations.ai`). Only the last one needs no credentials, and it is
    what actually answers today.
  - Nano Banana **needs billing**: every image model reports free-tier
    `limit: 0`, so an unbilled Gemini key refuses instantly. The keyed
    Pollinations endpoint needs a **prepaid `pollen` balance** and returns 402
    at zero; that result is cached for 30 minutes so it costs one probe, not a
    wasted round-trip per picture.
  - **Latency**: the anonymous endpoint serves the first request from an IP in
    ~2.5s, then throttles to ~45s each. `IMAGE_BUDGET_MS` is 55s for that
    reason — a 45s budget aborted requests a second before they succeeded.
    Keep it under the route's `maxDuration` of 60s.
  - `degraded.reason` is `"imageQuotaExceeded"` (a real wait, counts down),
    `"imageNotOnFreeTier"` (Gemini billing — diagnostic only; the user-facing
    text is generic because reaching it means the free fallback failed too), or
    `"imageUnavailable"`.
  - Env: `POLLINATIONS_API_KEY`, `POLLINATIONS_MODEL` (default `zimage`),
    `AI_IMAGE_POLLINATIONS=off` to disable the fallback. Prompts leave the
    system to a third party — no ticket/customer data, but worth knowing.
- `backend.ts` calls `TECHNICAL/CUSTOMER/JWT_API_BASE` **directly**, not via
  `/api/proxy/*` — a relative URL has no meaning in a route handler. The
  caller's `Authorization` header is forwarded to every read, so the assistant
  can only surface rows that user could already open. Read-only by design.
  - That guarantee is new. `getJson` used to fall back to `getSystemAdminToken()`
    — a hardcoded `admin` login **committed to git** — whenever the caller had
    no token or a backend answered 401, so an unauthenticated question was
    answered from admin-scoped rows. Both the fallback and the credential are
    gone; a missing token now throws before the fetch, and `runTool` hands the
    model "this lookup failed" rather than an empty page that reads as "there
    is nothing there". **The password is still in git history — rotate it.**
  - Likewise `activeUser` no longer falls back to the `admin` account (or
    `users[0]`) when the token's claims match nobody. An unidentifiable caller
    gets an explicit "identity unknown" instruction in the system prompt, so
    "who am I?" answers *I can't tell* instead of naming a stranger.

### `GET /api/events` — Server-Sent Events stream

- File: `api/events/route.ts`
- `export const dynamic = "force-dynamic"`, `runtime = "nodejs"`.
- `GET(req)` — opens a `ReadableStream` (`text/event-stream`); subscribes to `@/services/eventBus` (`subscribe`) so any ticket create/update/delete broadcast from the proxy route is pushed to this client; sends a heartbeat every 25s (`HEARTBEAT_INTERVAL_MS`); cleans up subscriber on `cancel()`/abort. This is what `useRealtimeTickets` consumes for live table refresh.

### `GET/POST/PUT/DELETE /api/proxy/[...path]` — universal backend proxy

- File: `api/proxy/[...path]/route.ts`
- Forwards to `TECHNICAL_API_BASE` / `CUSTOMER_API_BASE` / `JWT_API_BASE` based on `?service=technical|customer|jwt` query param (default technical); appends `api-version`.
- `getTargetUrl(req, pathString)` — builds the outbound URL from query params.
- `inferStatusFromPath(pathString)` — maps a path fragment (e.g. `inspectitem`, `finishedrepair`, `saleconfirmed`, `unrepairable`) to a human ticket status string, used for the SSE broadcast payload.
- `GET` — read-only passthrough, no broadcast.
- `POST` — passthrough, then `broadcast({type: "ticket_created"|"status_changed", status, at})` on success.
- `PUT` — passthrough, then `broadcast({type: "ticket_updated", status, at})` on success.
- `DELETE` — passthrough, then `broadcast({type: "ticket_deleted", at})` on success.
- All mutation broadcasts go through `@/services/eventBus` and are picked up by `/api/events` SSE subscribers.

### `POST/PUT /api/proxy/inspectitem`

- File: `api/proxy/inspectitem/route.ts`
- `POST` — creates a new inspection record (`BASE/api/inspectitem`).
- `PUT` — updates an existing inspection record (reconciles spare-parts list; see `/inspect-item` page notes).

### `POST /api/proxy/finishedrepair`

- File: `api/proxy/finishedrepair/route.ts`
- `POST` — marks a service ticket as finished/verified (`BASE/api/finishedrepair`). Used by `/approve-verify`'s `handleVerify`.

### `GET /api/technicalservices/[...path]`

- File: `api/technicalservices/[...path]/route.ts`
- `GET` — simpler read-only proxy directly to `TECHNICAL_API_BASE/api/technicalservices/:path`, forwards `Authorization` header. Distinct from the generic `/api/proxy/[...path]` route (no service switching, no broadcast).

## Route → status filter quick reference

| Route | `ServiceTable activeFilter` |
|---|---|
| `/receive-item` | `Received` |
| `/inspect-item` | `Inspecting` |
| `/inspection` | `Inspection` |
| `/spare-request` | `Awaiting Sparepart` |
| `/waiting-confirm` | `Awaiting Customer Confirm` |
| `/confirmed-sale` | `Sale Confirmed` |
| `/approve-repair` | `Repairing` (requires approval) |
| `/approve-verify` | `Finished` |
| `/rejected` | `Customer Rejected` |
| `/unrepairable` | `Unrepairable` |
