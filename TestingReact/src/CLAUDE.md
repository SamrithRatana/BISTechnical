# src/hooks, src/services and src/i18n index

Index of `TestingReact/src/hooks` (4 files), `TestingReact/src/services` (5 files) and `TestingReact/src/i18n` (3 files). `src/app` and `src/components` each have their own CLAUDE.md — not duplicated here.

## i18n

The whole UI is English/Khmer. Khmer wording is inherited from the legacy Blazor app's `src/Apps/ServiceMaintenance/Resources/App.km-KH.resx` so terminology matches what staff already read.

### `TestingReact/src/i18n/translations.ts`
The dictionary — one namespaced key per string, both languages side by side.
- `LANGUAGES`, `LANGUAGE_LABELS`, `LANGUAGE_SHORT`; types `Language` (`"en" | "km"`) and `TranslationKey`.
- `translations: Record<Language, Record<TranslationKey, string>>`. `km` is typed against `TranslationKey`, so a missing or misspelled key on either side is a **compile error**, not a silent English fallback.
- Add new UI strings here first; never hardcode display text in a component.

### `TestingReact/src/i18n/LanguageProvider.tsx`
Context + provider, persisted in `localStorage["lang"]` (default `"en"`).
- `LanguageProvider`, `useI18n(): { lang, setLang, toggleLang, t }`, `LanguageScript`, `STORAGE_KEY`, `DEFAULT_LANGUAGE`.
- `t(key, vars?)` interpolates `{placeholder}` markers, e.g. `t("approve.success", { ref: "SVC-1024" })`.
- Reads the preference through `useSyncExternalStore` (not an on-mount effect) so SSR/hydration see `DEFAULT_LANGUAGE` with no mismatch, and `storage` events sync the choice across tabs.
- `LanguageScript` is a blocking `<head>` script that stamps `lang`/`data-lang` on `<html>` before first paint, so Khmer users get no flash of Latin-font English. Mounted in `app/layout.tsx`, which also wraps the tree in `LanguageProvider`.
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

### `TestingReact/src/hooks/useFloatingPanel.ts`
Shared positioning logic for portaled dropdown/popover panels anchored to a trigger element (e.g. StatusUpdateDropdown, spare-part search dropdown in InspectItemDialog).
- `useFloatingPanel<TAnchor, TPanel>({ open, onClose, width, estimatedHeight, align? }): { anchorRef, panelRef, coords }`
- Computes `fixed` coordinates from the anchor's `getBoundingClientRect()` in `useLayoutEffect` (pre-paint), clamps horizontally to viewport, flips above the trigger when space below < `estimatedHeight`. Closes on outside click, Escape, or scroll/resize (except scroll inside the panel itself).

## Services

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
