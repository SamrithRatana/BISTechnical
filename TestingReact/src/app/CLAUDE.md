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
- Files: `login/page.tsx`, `login/layout.tsx`
- Client component.
- `LoginLayout({ children })` (layout.tsx, server) — sets page metadata only, no auth guard override.
- `LoginPage()` — form with username/password; `handleLogin(e)` calls `loginUser()` from `@/services/api`, stores `jwt_token` + `user_info` in localStorage, redirects to `/` via `useRouter().push`.

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

## `api/` — Next.js backend routes (proxy + auth + realtime)

### `POST /api/auth/login`

- File: `api/auth/login/route.ts`
- `POST(req)` — forwards credentials to C# Identity Auth API (`JWT_API_BASE=/api/auth/login`), then enriches the response by looking up the user in `/api/UserManagement` to attach id/email/roles/profile picture. Returns `{isSuccess, token, refreshToken, user}` or 401 on failure.

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
