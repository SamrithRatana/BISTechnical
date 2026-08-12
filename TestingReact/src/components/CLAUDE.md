# TestingReact/src/components

Shared/reusable React components used across the `app/` pages (dashboard, ticket workflow queues, spare parts, customers). Flat directory, no subfolders. All files are `"use client"`.

## Components (alphabetical)

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

- `TestingReact/src/components/Header.tsx` — App header bar: sidebar toggle, refresh, `GlobalSearch`, language button (static), dark-mode toggle (persists `localStorage["theme"]`), notifications icon, JWT user profile dropdown (reads `localStorage["user_info"]`, refreshed via `fetchUserMap()`), logout (clears `jwt_token`/`user_info`, routes to `/login`).
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
  - Props: `title: string`, `subtitle?: string`, `children: React.ReactNode`.
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

- `TestingReact/src/components/Sidebar.tsx` — Left nav sidebar; static `navGroups` config (Inventory Items, Customer Information, Technical, Stock, Sale, Rejected Service Tracker), active-link highlighting via `usePathname()`, collapses to icon-only width.
  - Props: `isOpen: boolean`, `setIsOpen: (val: boolean) => void`.
  - Used by: `PageWrapper.tsx`.

- `TestingReact/src/components/SparePartSpecModal.tsx` — Read-only spare-part spec view (image, part number, use-for, stock badge, price, description). Portaled to `document.body` (root-level sibling) so its z-index isn't capped by an ancestor's stacking context.
  - Props (`SparePartSpecModalProps`): `part: SparePartItem`, `onClose: () => void`.
  - Internal helpers: `getImageUrl`, `stockBadge`.
  - Used by: `InspectItemDialog.tsx` (opened from the eye icon in search results / added-parts table).

- `TestingReact/src/components/StatCards.tsx` — Dashboard's 4 top stat tiles (Today's Report, Received Item, Waiting Customer, Finished) with hardcoded counts; click sets the active filter.
  - Props (`StatCardsProps`): `selectedFilter: string`, `setSelectedFilter: (id: string) => void`.
  - Used by: `app/page.tsx` (dashboard).

- `TestingReact/src/components/StatusTabMenu.tsx` — Horizontal pill-tab strip with count badges, matches old `StatusTabMenu.razor`.
  - Props (`StatusTabMenuProps`): `tabs: TabItem[]` (`{key, label, count?, color?}`), `activeKey: string`, `onTabChange: (key: string) => void`, `loading?: boolean`.
  - Exports: default `StatusTabMenu`; type `TabItem`.
  - Used by: pages that pass `tabs`/`onTabChange` into `ServiceTable`.

- `TestingReact/src/components/StatusUpdateDropdown.tsx` — Custom styled status-change control replacing native `<select>` for `ServiceTable`'s Status column (button + floating portaled panel via `useFloatingPanel`).
  - Props (`StatusUpdateDropdownProps`): `currentLabel: string`, `options: StatusOption[]` (`{value,label}`), `color: StatusDropdownColor` ("slate"|"blue"|"amber"|"cyan"|"emerald"|"purple"), `onSelect: (value: string) => void`.
  - Exports: default `StatusUpdateDropdown`; type `StatusDropdownColor`.
  - Used by: `ServiceTable.tsx` (`RenderStatusSelect`).

## Notes

- Floating/portaled dropdowns (`ModernSelect`, `StatusUpdateDropdown`, `GlobalSearch`, `SparePartSpecModal`) share the `useFloatingPanel` hook at `TestingReact/src/hooks/useFloatingPanel.ts` for positioning — check there first for portal/z-index/positioning bugs.
- `RepairServiceItem`, `SparePartItem`, and API fetch functions (`fetchRepairServices`, `updateServiceStatus`, etc.) come from `TestingReact/src/services/api.ts`.
