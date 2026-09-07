# src/hooks, src/services, src/i18n and src/validation index

Index of `TestingReact/src/hooks` (4 files), `TestingReact/src/services` (5 files), `TestingReact/src/i18n` (4 files) and `TestingReact/src/validation` (7 files). `src/app` and `src/components` each have their own CLAUDE.md — not duplicated here.

## i18n

The whole UI is English/Khmer. Khmer wording is inherited from the legacy Blazor app's `src/Apps/ServiceMaintenance/Resources/App.km-KH.resx` so terminology matches what staff already read.

### `TestingReact/src/i18n/en.ts` and `TestingReact/src/i18n/km.ts`
The dictionaries, one language per file. **Add new UI strings to both**; never
hardcode display text in a component.
- `en.ts` exports `en` and derives `export type TranslationKey = keyof typeof en`.
- `km.ts` exports `km`, typed `Record<TranslationKey, string>` — so a missing or
  misspelled key on either side is still a **compile error**, not a silent
  English fallback.
- They were one 213 KB file until 2026-08-31. Split because `LanguageProvider`
  is mounted by the root layout, so a static import of both dictionaries sat in
  the chunk all 55 routes downloaded before first paint — every user
  permanently carrying the language they were not reading. Verified after the
  split: `km` lives in its own **111.7 KB chunk (25,758 Khmer chars)** which is
  **not in any route's initial script set**. Note the initial load still counts
  ~780 Khmer characters — hardcoded strings in a few components, unrelated to
  the dictionary — so check for the *chunk*, not for Khmer codepoints.

### `TestingReact/src/i18n/translations.ts`
Now a **barrel**, not the dictionary. Re-exports `en`, `km`, `translations`,
`TranslationKey`, and the four language constants.
- `translations: Record<Language, Record<TranslationKey, string>>` needs both
  languages, so **importing a value from here pulls both**. That is correct for
  `app/api/ai-search` (server-side; nothing it imports reaches the browser) and
  wrong for any client component.
- **Client components must not import a value from this module.** `import type`
  is fine — types are erased. For the language constants use `./languageConfig`.

### `TestingReact/src/i18n/languageConfig.ts`
The client-safe constants module, with no dictionary behind it: `LANGUAGES`,
`Language`, `LANGUAGE_LABELS`, `LANGUAGE_SHORT`, `STORAGE_KEY`,
`DEFAULT_LANGUAGE`. `Header` and `download/DownloadHeader` import the labels
from here rather than from `translations.ts`, which is what keeps their imports
costing what they look like they cost.

### `TestingReact/src/i18n/LanguageProvider.tsx`
Context + provider, persisted in `localStorage["lang"]` (default `"en"`).
- **Only English ships in the shared bundle.** `en` is imported statically
  because it must be: it is `DEFAULT_LANGUAGE`, the value `getServerSnapshot`
  returns, and the fallback `t()` reaches for on a missing key. `km` is fetched
  through a dynamic `import("./km")` the first time the resolved language is
  Khmer — kicked off at module evaluation (not in an effect) so the request is
  already in flight before the first render.
- A module-scope `dictRevision`, exposed through a **second**
  `useSyncExternalStore`, is what re-renders consumers when the Khmer table
  lands. Without it `t` stays memoised on `[lang]` alone and a Khmer user sits
  on English forever with the right dictionary already in memory.
- A failed chunk load is not fatal: `t()` keeps returning English and the
  in-flight promise is cleared so a later toggle retries.
- Khmer text therefore appears a beat later than it used to. The server HTML
  was *always* English (`getServerSnapshot`), so a Khmer session has always
  started English and swapped — this moves the swap from hydration to
  chunk-arrival. The Khmer **font** is unaffected: `LanguageScript` stamps
  `data-lang` pre-paint and does not go through this module.
- `LanguageProvider`, `useI18n(): { lang, setLang, toggleLang, t }`, and re-exports of `STORAGE_KEY`, `DEFAULT_LANGUAGE` (defined in `languageConfig.ts`).
- `t(key, vars?)` interpolates `{placeholder}` markers, e.g. `t("approve.success", { ref: "SVC-1024" })`.
- Reads the preference through `useSyncExternalStore` (not an on-mount effect) so SSR/hydration see `DEFAULT_LANGUAGE` with no mismatch, and `storage` events sync the choice across tabs.
- `LanguageScript` **lives in its own file, `i18n/LanguageScript.tsx`, and is a SERVER component** — it stamps `lang`/`data-lang` on `<html>` before first paint so Khmer users get no flash of Latin-font English. It used to be exported from `LanguageProvider.tsx`, which begins with `"use client"`, and that was a real bug: a `<script>` rendered by a client component is created through the DOM API and **never executes**, so the pre-paint stamp silently did not happen, React 19 logged "Encountered a script tag while rendering React component", and the element mismatched during hydration — which made React discard the server HTML and re-render the whole tree through all eight of the layout's providers. `ThemeScript.tsx` is a server component for exactly this reason. **Do not add `"use client"` to either file, and do not move `LanguageScript` back into the provider.** Constants it shares with the provider live in `i18n/languageConfig.ts` so a server component can read them without crossing the client boundary.
- `globals.css` swaps in the Battambang font via `html[data-lang="km"]`.

### `TestingReact/src/i18n/statusLabel.ts`
Translates backend enum-ish values at render time only — the raw English strings stay in state and on the wire, because the app compares and posts them as identity.
- `statusTranslationKey(status)`, `translateStatus(status, t)`, `translatePriority(p, t)`, `translateServiceType(s, t)`, `translateServiceLocation(l, t)`.
- Lookups are normalised (lowercase, whitespace-collapsed) because the same status arrives spelled several ways — notably the DB's long-standing misspelling `"Item Recieved"` vs the filters' `"Received"`.

## Hooks

### `TestingReact/src/hooks/useRealtimeTickets.ts`
Subscribes a page to the SSE ticket event stream and calls a refresh callback when a relevant event arrives.
- `useRealtimeTickets(filter: string, onUpdate: () => void, options?: { disabled?: boolean }): void`
- Subscribes to ONE shared `EventSource("/api/events")` per tab, multiplexed at module scope — the first subscriber opens it, the last to unmount closes it. Previously each call site opened its own connection, so the dashboard alone held two: one per subscriber wastes the browser's ~6-connection budget and holds a separate `ServerResponse` + heartbeat open server-side. Each subscriber filters the shared firehose locally by `resource` and event type, debounces `onUpdate` by 400ms, and falls back to a 30s visible-tab poll. Reconnect back-off (1s → 30s cap) is shared, so a restarting server sees one retry rather than N. Verified: 1 server-held connection for the dashboard, stable across navigation, 0 after the tab closes.

### `TestingReact/src/hooks/useDebouncedValue.ts`
Debounces a value so a search input doesn't fire one API call per keystroke.
- `useDebouncedValue<T>(value: T, delayMs = 300): T`
- Returns state that updates via `setTimeout(delayMs)` after `value` stops changing; clears the timer on each new change.

### `TestingReact/src/hooks/useSearchQueryParam.ts`
Applies a `?q=` URL param to a page's local search box on arrival from the header's global search.
- `useSearchQueryParam(apply: (value: string) => void): void`
- On mount only (empty dep array), reads `window.location.search` via `URLSearchParams`, calls `apply(q)` if present. Avoids `next/navigation`'s `useSearchParams` (which forces a Suspense boundary) and avoids seeding state directly from `window` (hydration mismatch).

### `TestingReact/src/hooks/usePasskeySupport.ts`
Whether this browser can do WebAuthn — safe to call during render on a server-rendered page.
- `usePasskeySupport(): boolean`
- Uses `useSyncExternalStore` with a no-op `subscribe` (a browser does not gain WebAuthn support
  part-way through a page's life) and a `false` server snapshot, so nothing passkey-shaped is ever
  in the server HTML. The `useState(false)` + effect version costs an extra render and trips
  `react-hooks/set-state-in-effect`, which this project already carries four unresolved instances
  of.

### `TestingReact/src/hooks/useFloatingPanel.ts`
Shared positioning logic for portaled dropdown/popover panels anchored to a trigger element (e.g. StatusUpdateDropdown, spare-part search dropdown in InspectItemDialog).
- `useFloatingPanel<TAnchor, TPanel>({ open, onClose, width, estimatedHeight, align? }): { anchorRef, panelRef, coords }`
- Computes `fixed` coordinates from the anchor's `getBoundingClientRect()` in `useLayoutEffect` (pre-paint), clamps horizontally to viewport, flips above the trigger when space below < `estimatedHeight`. Closes on outside click, Escape, or scroll/resize (except scroll inside the panel itself).

## Services

### `TestingReact/src/services/sparepartTaxonomyApi.ts`
Typed client for the spare-part Category / Type / Brand lookups
(`/api/proxy/spareparts/{categories|types|brands}[/{id}]`, backend added 2026-09-05).
Its own module because `api.ts` is already over 2,000 lines; it imports `cachedFetch`,
`getAuthHeaders` and `invalidateCachePrefix` from there so the plumbing is identical.
- `fetchSparePartCategories()` / `fetchSparePartTypes()` / `fetchSparePartBrands()` —
  cached under the `sparepart-taxonomy` prefix (60s backstop TTL). Types come back whole and are
  narrowed per category on the client (the API's `?categoryId` filter has no web caller yet). **No mock fallback on purpose** — an empty dropdown is the truthful offline state.
- `create/update/deleteSparePart{Category,Type,Brand}` — return `ApiWriteResult`, never a
  boolean; the API's 409 carries `code` (`duplicate` | `inUse`) and `count`, and a screen keys its
  message off the code. Writes invalidate `sparepart-taxonomy` **and** `spareparts` (the list
  shows these names; the lookups carry `partCount`), before and after the request.
- Brand names are upper-cased client-side as well as server-side.

### `TestingReact/src/services/apiWriteResult.ts`
`readWriteResult(res)` turns a write response into `ApiWriteResult` (ProblemDetails `code` /
`detail` / `count`, the legacy bare-string `BadRequest`, the proxy's `{ error }`), and
`networkFailure()` is the result for a request that never got a response. Used by the spare-part
writes in `api.ts` and by `sparepartTaxonomyApi.ts`.

### `TestingReact/src/services/api.ts`
Central API client — auth headers, SWR cache layer, and all `fetch` calls to backend endpoints (via the `/api/proxy/*` Next.js route handlers). Re-exports types from `./types` and mock fallbacks from `./mockData`.
- No axios instance / base URL is configured in this file — all calls use relative `/api/proxy/...` or `/api/auth/...` paths. The actual backend base URLs (`NEXT_PUBLIC_TECHNICAL_API_URL`, `NEXT_PUBLIC_CUSTOMER_API_URL`, `NEXT_PUBLIC_JWT_API_URL`, `NEXT_PUBLIC_API_VERSION`) are read in `TestingReact/src/app/api/proxy/[...path]/route.ts` (and a couple of dedicated proxy routes like `.../inspectitem/route.ts`, `.../finishedrepair/route.ts`) — documented under `src/app`'s own CLAUDE.md.
- `getCached<T>(key)` — reads a cache entry from memory, falling back to `sessionStorage`.
- `setCached<T>(key, data, ttlMs?)` — writes memory + `sessionStorage` cache entry (3-min default TTL), triggers LRU eviction past 200 entries, notifies subscribers.
- `invalidateCache(...keys)` — deletes exact cache keys from memory + `sessionStorage`.
- `invalidateCachePrefix(prefix)` — deletes all cache keys starting with `prefix`.
- `getDbStatusMapping(filter)` — maps a UI filter string (e.g. "Received") to `{ id, name }` matching the `ServiceStatuses` DB table.
- `loginUser(userName, password)` — `POST /api/auth/login`; returns `LoginResponse`.
- `updateServiceStatus(item, newStatus)` — routes to a dedicated BIS endpoint per status via `buildStatusRequest` (internal): `POST /api/proxy/inspecting`, `/awaitingcustomerConfirm`, `/awaitingsparepart`, `/customerrejected`, `/saleconfirmed`, `/sentspareparts`, `/unrepairable`, `/repairitem`, `/thirdpartyrepair`, `/finishedrepair`; falls back to `PUT /api/proxy/technicalservices` for unmapped statuses. Invalidates `repairservices`/`dashboard` cache prefixes. Note: no "inspection" case by design (see comment — that used to destroy inspection text).
- `deleteTechnicalService(id)` — tries `DELETE /api/proxy/receiveitem/{id}`, falls back to `DELETE /api/proxy/technicalservices/{id}`.
- `fetchItemsInventory(pageNumber?, pageSize?, searchTerm?)` — `GET /api/proxy/items` or `/items/search`; cached; falls back to `MOCK_ITEM_MODELS` on error.
- `fetchSparePartById(id)` — `GET /api/proxy/spareparts/{id}`; resolves catalog fields not present on a ticket's spare-part sub-rows.
- `fetchSparePartsInventory(pageNumber?, pageSize?, searchTerm?)` — `GET /api/proxy/spareparts` or `/spareparts/search`; cached; falls back to `MOCK_SPARE_PARTS`.
- `createSparePart(part)` — `POST /api/proxy/spareparts`.
- `updateSparePart(part, performedBy?)` — `PUT /api/proxy/spareparts`.
- `deleteSparePart(id)` — `DELETE /api/proxy/spareparts/{id}`.
- `insertManualStockOut(sparepartId, quantity, reason, performedBy?)` — `POST /api/proxy/spareparts/manual-stockout`.
- `fetchCustomerCenter(pageNumber?, pageSize?, searchTerm?)` — `GET /api/proxy/Customer?service=customer`; cached; falls back to `MOCK_CUSTOMERS`.
- `createCustomer(customer)` — `POST /api/proxy/Customer?service=customer`.
- `updateCustomer(id, customer)` — `PUT /api/proxy/Customer/{id}?service=customer`.
- `deleteCustomer(id)` — `DELETE /api/proxy/Customer/{id}?service=customer`.
- `fetchRepairServices(pageNumber?, pageSize?, filter?, searchTerm?)` — `GET /api/proxy/technicalservices/search`; for filter `"Repairing"`/`"Approve Repairing"` merges 3 statuses ("Sent Spareparts", "Inspection", "Sale Confirmed") via parallel fetches + dedup; enriches results with `enrichTicketUsers`/`fetchUserMap`; cached; falls back to filtered `MOCK_SERVICE_TICKETS`.
- `fetchServiceById(id)` — `GET /api/proxy/technicalservices/{id}`; deliberately uncached (edit form needs live state); enriches user names.
- `fetchDashboardStats()` — `GET /api/proxy/technicalservices/dashboard-stats`; cached with 1-min TTL; falls back to hardcoded stub stats.
- `createInspectItem(payload)` — `POST /api/proxy/inspectitem`; invalidates `repairservices` cache prefix.
- `deleteInspectItemSparePart(serviceId, sparepartItemId)` — `DELETE /api/proxy/inspectitem/{serviceId}/spareparts/{sparepartItemId}`.
- `setFinishedRepair(payload)` — `POST /api/proxy/finishedrepair`; invalidates `repairservices`/`dashboard` cache prefixes.
- `searchCustomers(searchTerm)` — `GET /api/proxy/customercenter/customers?service=customer&searchTerm=`.
- `createItem(itemName, serialNumber?)` — `POST /api/proxy/items`, then re-fetches via `fetchItemsInventory` by serial number to recover the server-assigned id (create endpoint doesn't return the row).
- `searchItems(searchTerm)` — `GET /api/proxy/items?searchTerm=`.

### `TestingReact/src/services/userService.ts`
Fetches users from the JWT User Management API and resolves user GUIDs (createBy, inspectBy, repairBy, verifiedBy, etc.) to display names/phone numbers.
- `fetchUserMap()` — `GET /api/proxy/UserManagement?service=jwt&page={n}&pageSize=100`, paginates until `data.Pagination.HasNext` is false (max 10 pages); returns/caches a `Map<lowercaseIdOrUsername, UserDto>` module-level (`cachedUserMap`), with inflight dedup via `userMapPromise`.
- `formatUserName(user?)` — `"{firstName} {lastName}"` trimmed, falls back to `userName`.
- `resolveUserNameSync(userId?)` — synchronous lookup against `cachedUserMap` (empty string if not yet populated or GUID is all-zeros).
- `resolveUserPhoneSync(userId?)` — same, for `phoneNumber`.
- `enrichTicketUsers(item, userMap)` — fills all `*ByName`/`*ByPhone` fields on a `RepairServiceItem` from GUID fields, and computes `daysTaken` via `calculateDaysTaken` (from `./types`) if not already set.
- `getCurrentUserGuid()` — reads logged-in user's GUID from `localStorage.user_info`, else decodes it from the `jwt_token` JWT payload claims.

### `TestingReact/src/services/webauthn.ts`
Typed client for passkey ("Face Login") sign-in and device management. Talks to
`app/api/auth/webauthn/[...path]/route.ts`, which forwards to the User Management API's
`api/auth/webauthn/*`.
- `loginWithPasskey(userName?)` — runs the assertion ceremony and returns a **`LoginResponse`**, the
  same shape `loginUser` returns, so the login page runs one pipeline for both. `userName` is
  usually omitted: with no username the browser offers whichever passkeys the device holds and the
  account is resolved from the credential itself.
- `listPasskeys()` / `addPasskey(deviceName?)` / `removePasskey(id)` — device management, all
  requiring the bearer token.
- Normalises the API's **PascalCase** into the app's camelCase in one place. That casing is not a
  quirk to fix: `Program.cs` sets `PropertyNamingPolicy = null` API-wide, and the passkey proxy
  route forwards bodies verbatim rather than re-serialising them.

### `TestingReact/src/services/faceAuth.ts`
Typed client for face verification — the second factor. Talks to
`app/api/auth/face/[...path]/route.ts`.
- `faceLoginStart(userName, password)` — returns a **discriminated union**: `session` (a complete
  `LoginResponse`, for accounts with no face enrolled), `faceRequired` (a `faceToken` and nothing
  else), or `failed`. A union rather than optional fields on one object, because flattening them is
  exactly how a caller ends up treating "face required" as a successful sign-in.
- `faceLoginVerify(faceToken, descriptor)` — throws `FaceVerifyError` carrying `attemptsLeft` and
  an `expired` flag.
- `getFaceStatus()` / `enrollFace(samples)` / `removeFace()` — all require the bearer token.
- `listFaceDevices()` / `revokeFaceDevice(id)` — paired phones. There is deliberately **no** client
  function for pairing one: that happens on the phone, through `api/auth/face-link/submit`, using a
  bearer token the desktop never hands over.

### `TestingReact/src/services/eventBus.ts`
Module-level (Node process scope) pub/sub bus that broadcasts ticket mutation events to active SSE connections. Note: single-process only — comment flags Redis Pub/Sub as the swap-in for multi-instance deployments.
- `broadcast(event: TicketEvent): void` — snapshots the subscriber `Set` before iterating, so a subscriber unsubscribing mid-broadcast is safe; per-subscriber errors don't abort the broadcast.
- `subscribe(fn: Subscriber): () => void` — adds a subscriber, returns a cleanup/unsubscribe function.
- `subscriberCount(): number` — current active subscriber count, for observability.
- `TicketEventType` = `"ticket_created" | "ticket_updated" | "ticket_deleted" | "status_changed"`; consumed by `useRealtimeTickets`.

### `TestingReact/src/services/types.ts`
Shared TypeScript interfaces/constants for the whole app (API request/response shapes, status/priority reference data). No fetch calls.
- `calculateDaysTaken(item?)` — mirrors the C# `RepairServices.DaysTaken` computed property: null for Customer Rejected/Unrepairable (statusId 7/8), else finishedDate−serviceDate or today−serviceDate in days.
- `getActionUserForStatus(item)` — resolves which user's name to show for a ticket's current status (status-specific field first, falls back through several `*ByName`/GUID pairs, then a generic fallback chain).
- `formatTime24HourWithAmPm(date)` — formats as `"HH:MM AM/PM"` (24-hour digits + AM/PM label, matches app's non-standard display convention).
- `getServicePriorityId(name?)` — resolves a priority name (any casing) to its backend id via `SERVICE_PRIORITIES` (note: ids are not severity-ordered — Low=1, Normal=2, High=3).
- `normaliseServicePriority(name?)` — normalises a priority name (any casing) to the backend's canonical spelling; defaults to `"Normal"`.
- `toBackendLocalDateTime(date?)` — formats a `Date` as unmarked local Phnom Penh wall-clock (`YYYY-MM-DDTHH:MM:SS`, no timezone suffix) to match how the backend stores/reads DateTimes (UTC+7 with no tz marker) — use this instead of `toISOString()` when sending times.
- Key exported types: `RepairServiceItem`, `SparePartItem`, `SparePartItemDetail`, `CustomerItem`, `ItemModel`, `PaginatedResult<T>`, `DashboardStats`, `LoginResponse`, `ServiceStatusDbItem`.
- Key constants: `SERVICE_STATUSES_DB` (12 statuses with DB ids), `SERVICE_PRIORITIES`, `SERVICE_LOCATIONS` (`"CompanyService" | "OnSite"`).

### `TestingReact/src/services/smartQuery.ts`
Shared shape of an "Ask AI" result, plus the offline fallback. The interpretation itself happens server-side in `app/api/ai-search` — see `src/app`'s CLAUDE.md.
- `SmartQueryResult` — `answer` (grounded, written after the model queried the system), `category` (`tickets`/`spareParts`/`customers`/`items`/`users`/`general`), `searchTerm`, `status`, `listStatus`, date bounds, `staffName`, `extras` (a `ServiceSearchExtras` with staff GUIDs already resolved), `navigateTo`, `actions`, `grounded`.
- `SmartQueryAction` — one interface step the assistant performs: `id` (an id from `@/config/actions`), `recordRef`, and `values` (field name → value, to be typed into the form that action opens). `AiAssistantProvider` hands the whole `actions` list to the action bus. Every id resolves to a handler that opens or fills a dialog and stops — nothing in this path submits, so save/edit/delete stay with the user.
- `parseSmartQuery(question)` — used only when `/api/ai-search` is unreachable; returns a plain keyword search with `grounded: false` and no answer text.
- `category: "general"` means a conversational reply with **no** record list — `GlobalSearch` skips every fetch for it.

### `TestingReact/src/services/mockData.ts`
Offline/fallback datasets (`MOCK_ITEM_MODELS`, `MOCK_SERVICE_TICKETS`, `MOCK_SPARE_PARTS`, `MOCK_CUSTOMERS`) used only inside `api.ts`'s `catch` blocks when the backend is unreachable. No exported functions — plain data arrays. Not for production logic.

## `src/validation/` — the ONE set of business rules

Sibling of `src/report-layout/` and governed by the same rule: defined once
here, **mirrored verbatim into `CamIdMobile/src/validation/`** by
`npm run sync:shared`, with a `--check` drift guard in `npm run typecheck` and
`npm run build`, so editing one side and not the other is a build failure rather
than a silent fork.

It exists because there *was* a silent fork. The phone carried
`services/portalValidation.ts` (7 validators) and `services/portalStockShortage.ts`
(a byte-identical hand copy of `stockShortage.ts`), and the web carried a private
copy of the approve-repair guard inside `ApproveRepairDialog`. Both phone modules
are deleted; both platforms now call these functions.

- **Plain TypeScript, no framework imports, ever.** No React, no Next, no React
  Native, no DOM, no `window`, no Node built-ins, and no import out of the
  folder — the same ban `report-layout/` lives under, for the same reason (Metro
  has to bundle these files). Anything platform-specific is **injected**:
  `checkStockShortages` takes a `CatalogLookup`, so the web passes
  `fetchSparePartById` from `services/api` and the phone passes its own.
- **Files:** `stockShortage` (parses the SQL trigger's rejection) ·
  `stockPreflight` (`checkStockShortages`, `isStockDeductingStatus`, the
  Fix/qty≤0/null-GUID skips that mirror the trigger) · `contact`
  (`isValidPhone`, `isValidEmail`, `isAbsent`) · `reference`
  (`isChargeService`) · `forms` (ticket, customer, item model, spare part,
  stock in/out, inspection, password change, profile) · `transitions`
  (`transitionGuard`).
- **Every failure carries a stable `code`, not just a sentence.**
  `ValidationResult` is `{ isValid, errors, codes, params }`;
  `transitionGuard` returns `{ code, message } | null`. The phone renders the
  message; the web translates the code through `i18n/validationMessage.ts`.
  **Never key presentation off a rendered message** — the first version compared
  the Khmer sentence to pick a translation key, which breaks silently the first
  time anyone rewords it.
- **Optional fields test `isAbsent`, not `.trim()`.** Both platforms store a
  missing phone number as an **em dash** so the table has something to draw, and
  load that row straight back into the edit form. Reading it as typed input made
  every customer with no phone number permanently unsaveable. A REQUIRED field
  keeps its own `.trim()` test — `"N/A"` is a bad company name but not a missing
  one.
- **A lookup that cannot answer is UNKNOWN, not zero.** `checkStockShortages`
  skips `null`, `undefined` and an unreadable quantity as well as a throw. Both
  platforms' catalogue readers resolve `null` for any non-OK response, and this
  system has 33 ticket lines pointing at deleted parts — reading that as "zero on
  hand" made those tickets impossible to move from either app.
- **Only rules with a caller live here.** A status-name table and
  `validateTicket`'s `status`/`serviceType` branches were removed: no call site
  on either platform ever passed those fields, so the branches, their codes and
  their translations were all unreachable.
- **Adopting a stricter rule needs a look at existing ROWS, not just the form.**
  `validateTicket` requires a fault description, and the phone applied it to
  edits too — which made every ticket booked before the rule existed
  unsaveable. Hence `mode: "create" | "edit"`, defaulting to the stricter one.
- **Web call sites:** `services/api.ts` (`updateServiceStatus` pre-flight —
  deep-imported, not through the barrel, because that module is on every route's
  critical path), `app/spareparts`, `app/customers`, `app/received-inventory`,
  `app/profile`, `components/InspectItemDialog`, `components/ServiceDetailModal`,
  `components/ApproveRepairDialog`, `components/StockShortageAlertModal`.
- **Do not validate a field the form does not expose.** `ServiceDetailModal` was
  passing `phoneNumber` for an input that is not on that screen, against 3,662
  rows of free text — every one of those tickets became unsaveable with a message
  pointing at nothing.
- **128 unit tests** cover this module and the report layout, in the CamID
  project (`npm test`) because that is the side with a runner. They run against
  the *mirrored* copy, which the drift guard proves identical — so they hold for
  the desktop too.

### `TestingReact/src/i18n/validationMessage.ts`
Turns a shared `ValidationCode` into a translated sentence. The rules cannot
import this project's `i18n` (see the ban above), so this is the one place the
mapping lives.
- `validationMessage(result, field, t)` — the message for one field, or `null`.
- `firstValidationMessage(result, t)` — for a form that reports through a single
  toast; field order is rule order, so the most fundamental failure surfaces first.
- The `Record<ValidationCode, TranslationKey>` is **exhaustive**: a new rule in
  `validation/forms.ts` with no translation is a compile error here, not an
  English string in front of a Khmer user.
