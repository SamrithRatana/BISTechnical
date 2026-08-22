# TechnicalService.API — Index

ASP.NET Core minimal-API project that manages the repair/technical-service workflow for a
service-maintenance business: receiving customer items, inspecting them, tracking spare-part
usage/stock, moving a service through its status lifecycle (Inspecting → Inspection → Awaiting
Sparepart/Customer Confirm → Repairing/Third-Party → Finished/Unrepairable/Customer Rejected),
and a separate Rental Item/Rental Service module for tracking rented equipment and its service
history. CQRS via MediatR: commands mutate through the `TechnicalServiceRepository` /
`RentalServiceRepository` (domain aggregates in `TechnicalService.Domain`, external project),
queries read directly off `TechnicalServiceContext` and project to flat view-model records.

Entry point: `src/APIs/TechnicalService.API/Program.cs` — builds app, calls
`AddApplicationServices()` (Extensions/Extensions.cs), maps versioned API group
`app.NewVersionedApi("Repairs").MapRepairsApiV1()`, sets up OpenAPI/Swagger.

## Apis/

### `src/APIs/TechnicalService.API/Apis/TechnicalServiceApi.cs`
Single large file: `MapRepairsApiV1()` route map + every endpoint handler method + request
records. This is the main file to open for "which endpoint calls which command" questions.

**Route table** (all under `api.MapGroup("api")`, i.e. prefix `/api`):

Items:
- `GET /items` → `GetItemsAsync` (paged)
- `GET /items/search` → `SearchItemsAsync` (`[AsParameters] ItemSearchQuery`)
- `GET /items/unique-names` → `GetUniqueItemNamesAsync`
- `GET /items/unique-types` → `GetUniqueItemTypesAsync`
- `GET /items/{itemId:Guid}` → `GetItemAsync`
- `POST /items` → `CreateItemAsync` → sends `CreateItemCommand`
- `PUT /items` → `UpdateItemAsync` → sends `UpdateItemCommand` (bound directly from body)
- `DELETE /items/{itemId:Guid}` → `DeleteItemAsync` → looks up item then sends `DeleteItemCommand`

Spareparts:
- `GET /spareparts` → `GetSparepartsAsync` (paged)
- `GET /spareparts/search` → `SearchSparepartsAsync`
- `GET /spareparts/{sparepartId:Guid}` → `GetSparepartAsync`
- `POST /spareparts` → `CreateSparepartAsync` → sends `CreateSparepartCommand`
- `PUT /spareparts` → `UpdateSparepartAsync` → sends `UpdateSparepartCommand`
- `GET /spareparts/used-in-services` → `GetSparePartsUsedInServicesAsync`
- `GET /spareparts/usage` → `GetSparepartUsageAsync` (`[AsParameters] SparepartUsageQuery`) — usage report, service vs manual stock-out breakdown
- `POST /spareparts/manual-stockout` → `ManualStockOutAsync` → sends `ManualStockOutCommand`
- `GET /spareparts/hold` → `GetSparepartHoldAsync` (`[AsParameters] SparepartHoldQuery`) — spareparts currently on hold status
- `GET /spareparts/transactions` → `GetSparepartTransactionsAsync` (`[AsParameters] SparepartTransactionQuery`) — **transaction-level** stock ledger: one row per movement from `SparepartStockAuditLog`, with running balance (`BalanceBefore`/`BalanceAfter`), the originating ticket, and the trigger's own reason text. Filters: `direction` (In/Out), `source` (Service/Manual/Adjustment), `includeTrackingRows`, `searchTerm`. Serves the `/stock-transactions` and `/stock-adjustments` React pages.
- `GET /spareparts/movement-summary` → `GetSparepartMovementSummaryAsync` — per-part opening balance / in / out / net / closing over a period. Balances are read from the log's own `OldQuantity`/`NewQuantity` (verified `NewQuantity == OldQuantity + QuantityChange` on all 3,226 rows), never recomputed, so this cannot drift from the audit trail.
- `GET /spareparts/dead-stock` → `GetSparepartDeadStockAsync` — parts with `Quantity > 0` and no real movement in `idleDays` (default 90). Carries **no** value column on purpose: `Spareparts.DefaultPrice` is 0.00 on all 666 rows.

- `GET /spareparts/health` → `GetStockHealthAsync` — **stock-data inconsistency detector.** Five checks, reported never repaired: `OrphanNotification` (a `StockNotificationOutbox` row with no matching `SparepartStockAuditLog` row — i.e. a Telegram message was sent for a movement the ledger never recorded), `LedgerMismatch` (`CurrentQuantity - SUM(QuantityChange)` implies a negative opening balance), `DuplicateName` (catalogue rows sharing a trimmed, case-folded `ItemName`), `NegativeStock`, and `OrphanRestore` (a ticket+part that returned more than it ever issued — these render as negative "used" figures). Measured 2026-08-19: **110 issues — 8 / 1 / 91 / 0 / 10**, with 11 of the duplicate-name groups having more than one entry in stock (`Formatter Board` 26 entries/6 in stock, `Fuser Film Sleeve` 28/7).

  Reads `StockNotificationOutbox` through **raw ADO on the context's connection**, not EF: that table has no entity and no configuration — it is written entirely by SQL triggers — and mapping it would put an API-project type into the shared `TechnicalServiceContext`.

  **The outbox/audit divergence is a real, unexplained defect.** Both tables are written by the same triggers, and their `INSERT` statements have byte-identical `WHERE` clauses. Ruled out 2026-08-19: string truncation (audit `Remarks` is `NVARCHAR(MAX)`), CHECK-constraint rejection, non-trigger writers (nothing in `src/` references the table), audit-row deletion, and clock skew (`CreatedAt` defaults to the same `getdate()`). The mechanism needs a reproduction test or a DBA; it was deliberately **not** blind-patched, since the net effect today is 0 units and a wrong guess would corrupt the audit trail.

**`SparepartTransactionQuery` is fully nullable, unlike `SparepartUsageQuery` — do not "tidy" that.** With nullable reference types on, `[AsParameters]` binds a non-nullable member as **required**, and this is true of value types as well as strings: `public int PageNumber { get; set; } = 1;` still throws `BadHttpRequestException` when `pageNumber` is omitted, because the property initializer never runs. The exception handler renders that as a **500, not a 400**, which is why a missing parameter looks like a server fault. That is the whole reason `services/reports.ts`'s `fetchSparepartUsage` must send its complete parameter set on every call. The three endpoints above take `int?`/`bool?`/`string?` and apply their defaults inside the query methods, so a caller can send a date range alone.
- `POST /spareparts/items/{sparepartItemId:Guid}/remarks` → `UpdateSparepartItemRemarksAsync` → sends `UpdateSparepartItemRemarksCommand`

Service metadata:
- `GET /technicalservices/servicetypes` → `GetServiceTypesAsync`
- `GET /technicalservices/servicepriorities` → `GetServicePrioritiesAsync`
- `GET /technicalservices/servicestatuses` → `GetServiceStatusesAsync`

Services (repair jobs):
- `GET /technicalservices` → `GetServicesAsync` (paged if pageNumber/pageSize given, else `GetAllServicesAsync`)
- `GET /technicalservices/search` → `SearchServicesAsync` (`[AsParameters] ServiceSearchQuery` — large filter surface: status, date, process-date, user, company, excluded-status)
- `GET /technicalservices/{serviceId:Guid}` → `GetServiceAsync`
- `PUT /technicalservices` → `UpdateRepairServiceAsync` → sends `UpdateRepairServiceCommand`
- `DELETE /technicalservices/{serviceId:Guid}` → `DeleteTechnicalServiceAsync` → sends `DeleteTechnicalServiceCommand`
- `PUT /technicalservices/{serviceId:Guid}/status` → `UpdateServiceStatusAsync` — **bypasses MediatR** — loads `Service` directly off `TechnicalServiceContext`, switches on `request.StatusId` against the named constants in `ServiceStatusIds` (10 = Inspecting → `service.SetInspecting(...)`, 2 = Inspection → `service.SetInspection(...)`, else 400). Worth knowing this one endpoint doesn't go through a command/handler. It was an inline lambda in the route table until the 2026-08-18 review; the actor is now `request.UpdatedBy` (optional) rather than a hardcoded `Guid.Empty`.
- `GET /technicalservices/monthly-report-summary` → `GetMonthlyReportSummaryAsync` (fromDate, toDate, serviceLocation) → `CompanyStatusSummary` list

Service workflow status-transition endpoints (all `POST`, all send a `Set*Command` via MediatR):
- `/receiveitem` (POST/PUT/DELETE `{serviceId}`) → Create/Update/DeleteReceiveItemCommand
- `/inspecting` → `SetInspectingCommand`
- `/inspectitem` (POST/PUT) → Create/UpdateInspectItemCommand (attaches spare parts used)
- `DELETE /inspectitem/{serviceId}/spareparts/{sparepartItemId}` → `DeleteSparepartItemAsync` → `DeleteSparepartItemCommand`
- `/awaitingcustomerConfirm` → `SetAwaitingCustomerConfirmCommand`
- `/customerrejected` → `SetCustomerRejectedCommand`
- `/awaitingsparepart` → `SetAwaitingSparepartCommand`
- `/saleconfirmed` → `SetSaleConfirmedCommand`
- `/sentspareparts` → `SetSentSparepartsCommand`
- `/repairitem` → `SetRepairCommand`
- `/thirdpartyrepair` → `SetThirdPartyRepairCommand`
- `/finishedrepair` → `SetFinishedStatusCommand`
- `/unrepairable` → `SetUnrepairableCommand`

Rental Items / Rental Services:
- `POST /rentalitem`, `GET /rentalitem` (paged), `GET /rentalitem/search`, `GET /rentalItem/{id:Guid}`
- `POST /rentalservice`, `GET /rentalservice` (paged), `GET /rentalservice/search`, `GET /rentalservice/{id:Guid}`
- `GET /rentalitemdetail/{id:Guid}` — inline lambda → `queries.GetRentalItemDetailAsync(id)`
- `GET /rentalitemdetail` (fromDate/toDate query) — inline lambda → `queries.GetRentalItemsByDateAsync`
- `GET /rentalitemdetail/{serialNo}` — inline lambda → `queries.GetRentalItemsBySerialNumberAsync`
  — **note:** this route has no type constraint on `{serialNo}` while the detail-by-id route above uses `{id:Guid}`; if a non-Guid segment is passed to `/rentalitemdetail/{x}` check routing precedence here first.

Request records defined at bottom of this file: `CreateItemRequest`, `CreateSparepartRequest`,
`ReceiveItemRequest`, `InspectItemRequest`, `UpdateInspectItemRequest`,
`SetAwaitingCustomerConfirmRequest`, `SetCustomerRejectedRequest`, `SetAwaitingSparepartRequest`,
`SetRepairRequest`, `SetThirdPartyRepairRequest`, `SetInspectingRequest`, `SetFinishedRequest`,
`SetUnrepairableRequest`, `ManualStockOutRequest`, `SetSaleConfirmedRequest`,
`SetSentSparepartsRequest`, `UpdateSparepartItemRemarksRequest`, and nested
`UpdateServiceStatusRequest(int StatusId, Guid? UpdatedBy = null)`.

### `src/APIs/TechnicalService.API/Apis/TechnicalServices.cs`
DI-bundle passed as `[AsParameters] TechnicalServices services` into most endpoint handlers.
- `TechnicalServices(IMediator, ITechnicalServiceQueries, ILogger<TechnicalServices>)` — exposes `.Mediator`, `.Queries`, `.Logger`.

### `src/APIs/TechnicalService.API/Apis/PaginationModels.cs`
Pagination + search-query record definitions used by endpoints/queries.
- `PaginationQuery(PageNumber, PageSize)`
- `PagedResult<T>` — `Items`, `TotalCount`, `PageNumber`, `PageSize`, `TotalPages`, plus report-specific extras: `TotalUsedQuantity`, `TotalHoldQty`, `TotalHoldJobs`, `TotalServiceUsedQuantity`, `TotalManualUsedQuantity`
- `ItemSearchQuery`, `SparepartSearchQuery`, `ServiceSearchQuery` (largest — has process-date filtering, user filtering, company-name filtering flags), `RentalItemSearchQuery`, `RentalServiceSearchQuery`
- `CompanyStatusSummary` — monthly report row: `CompanyName`, `FinishedCount`, `CustomerRejectedCount`, `UnrepairableCount`, `TotalCount`
- `MonthlyReportSummaryQuery` — `FromDate`, `ToDate`, `ServiceLocation`

### `src/APIs/TechnicalService.API/Apis/Request/RentalItemRequest.cs`
- `CreateRentalItemRequest(CreatedBy, CustomerId, CustomerName, ItemName, SerialNumber, Condition, Location, Duration)`

### `src/APIs/TechnicalService.API/Apis/Request/RentalServiceRequest.cs`
- `CreateRentalServiceRequest(RentalItemId, Date, Action, Note, UserId, List<SparepartItem> Spareparts)`

## Application/

### DTOs
`src/APIs/TechnicalService.API/Application/DTOs/SparepartItemDTO.cs`
- `SparepartItemDTO` — shared shape for a sparepart line item: `SparepartId`, `Description`, `Quantity`, `Condition`, `IsHoldStatus`, `Remarks`, `RemarksUpdatedAt`. Used by `InspectItemCommand`, `UpdateInspectItemCommand`, `UpdateRepairServiceCommand`.

### Queries
`src/APIs/TechnicalService.API/Application/Queries/ITechnicalServiceQueries.cs`
Interface for all read operations — check here first for the full list of available query methods before adding a new one.

`src/APIs/TechnicalService.API/Application/Queries/TechnicalServiceQueries.cs` (~1940 lines — the biggest file in the project)
Implementation of `ITechnicalServiceQueries`, constructed with `TechnicalServiceContext context`. All methods query EF directly (no repository). Key methods, with DB tables touched:
- `GetServiceTypesAsync/GetServicePrioritiesAsync/GetServiceStatusesAsync()` — reads `ServiceTypes`/`ServicePriorities`/`ServiceStatuses`
- `GetServicesAsync(pageNumber, pageSize)` / `GetAllServicesAsync()` — paged/full `Services` list, projects to `Service` view-model incl. `SparepartItems`
- `GetSparepartUsageByDateRangeAsync(SparepartUsageQuery query)` — largest/most complex method; groups by sparepart, then search, sort, pagination. If a "usage report shows wrong numbers" bug comes in, start here. Two date modes, and **both** read their dates from `SparepartStockAuditLogs` for the service-sourced half as of 2026-08-18:
  - `DateMode == "standard"` (the default, and the only one the React UI sends) is the **transaction ledger**: every row with `ServiceId != null && QuantityChange != 0`, dated by its own `Timestamp` — when the trigger fired, i.e. when stock actually moved. Joined back to `Services` for the display columns and to `SparepartItems` for the condition (left-joined: a stock-in restore fires *because* the SparepartItem was deleted, so there is nothing left to read a condition from). Usage is `-QuantityChange`, so a fit-then-unfit inside one window nets to zero.
  - `DateMode == "alwayscreated"` is unchanged: `Services` × `SparepartItems` dated by `Service.ServiceDate` — "stock impact of that day's intakes", a different and also legitimate question. Reachable only by calling the endpoint directly; the Blazor radio that switched modes is commented out and the React client hardcodes `standard`.
  - Manual stock-outs (`ServiceId == null`, `OperationType == "STOCK_OUT"`, `QuantityChange < 0`) were always read from the audit log's `Timestamp` and were never affected.
  - **What this replaced, and do not reintroduce it:** the standard mode used to synthesise the movement date from the ticket's *current* status (`Finished → FinishedDate`, `Repairing → RepairDate`, …). That made a movement's date **move retroactively** every time the ticket advanced — a part fitted on the 3rd on a ticket finished on the 10th was reported on the 10th, so a report printed last week stopped reconciling with the same report today. It also **dropped rows entirely**: those status date columns are nullable and both date filters required a value, so a ticket in a status whose date column was NULL vanished from every date range.
  - **Keying off `QuantityChange`, not `OperationType`, is deliberate.** The trigger bodies are not in this repo, so the string values are unverifiable from source; `QuantityChange == 0` is the documented marker for a tracking-only row (hold-status / Fix-condition / qty-0) and non-zero is a real movement. `sql/sparepart-stock-ledger.sql` §3 confirms that against live data.
  - Reconciliation and a before/after drift query live in `sql/sparepart-stock-ledger.sql`. That table is **not** under EF migrations (only `InitialCreate` and `AddRentalService` exist), so its schema is managed by hand — do not generate a migration for it.
  - **The table's indexes, CHECK constraints and triggers are all DB-managed too, and `SparepartStockAuditLogEntityTypeConfiguration.cs` declares none of them.** An empty Fluent API config here is not evidence anything is missing — check `sys.indexes` / `sys.check_constraints`. Verified 2026-08-18: `IX_AuditLog_Timestamp`, `IX_AuditLog_SparepartId_Timestamp`, `IX_AuditLog_ServiceId` and `IX_AuditLog_OperationType` already exist and already cover every access path the ledger reports need. Constraints: `CK_AuditLog_OperationType` restricts `OperationType` to `STOCK_ADJUSTED` / `STOCK_OUT` / `STOCK_IN`, and `CK_AuditLog_OldQuantity` / `CK_AuditLog_NewQuantity` require `>= 0`.
  - **The ledger's earliest row is 2026-02-19** — that is when the triggers went in, and there is nothing before it. Measured 2026-08-18 against the live DB: 2025-09 → 2026-02 report **0** under the ledger where the old query reported 55/118/63/122/94/87. `sql/sparepart-stock-ledger-backfill.sql` reconstructs the gap from `Services` × `SparepartItems`, dating each movement by the ticket's `InspectDate` (the stamp `SetInspection` writes in the same unit of work as `AddSparepartItem`, so it is when the trigger *would* have fired). Reconstructed rows use `OperationType = 'STOCK_OUT'` — the CHECK constraint permits nothing else — and are marked by a `BACKFILL:` prefix on `Remarks`, plus zero `OldQuantity`/`NewQuantity` because a past running balance is not recoverable; that is why the script carries its own reconciliation query excluding them. It writes only to the audit log; no trigger exists on that table, so `Spareparts.Quantity` is untouched.
  - Verified 2026-08-18, old vs fixed, same live DB: all-time service usage 2,308 → 738 (the difference is pre-trigger history, now zero until backfilled); July 180 → 152; today's window 15 → 9, where all 15 of the old figure were tickets *closed* that day, four of them on a machine that arrived 2026-06-04.
- `GetSparepartHoldStatusAsync(SparepartHoldQuery query)` — services whose `SparepartItems.IsHoldStatus == true`, grouped by sparepart
- `GetServiceAsync(Guid id)` — single service with all `Include()`s (Item, ItemType, ServiceType, ServicePriority, Status, SparepartItems); throws `KeyNotFoundException` if missing
- `GetItemsAsync/GetItemAsync/GetSparepartsAsync/GetSparepartAsync` — basic CRUD reads off `Items`/`Spareparts`
- `GetReceiveItemsAsync()` — `Services` where `Status == ServiceStatus.ItemReceived`
- `GetInpsectItemsAsync()` — `Services` where `Status == ServiceStatus.Inspection` (note: method name has original typo "Inpsect")
- `GetAwaitingCustomerConfirmsAsync()` — `Services` where `Status == ServiceStatus.AwaitingCustomerConfirm`
- `GetRentalItemsAsync/GetRentalItemAsync/GetRentalServicesAsync/GetRentalServiceAsync` — `RentalItems`/`RentalServices` CRUD reads
- `GetRentalItemDetailAsync(id)` / `GetRentalItemsByDateAsync(fromDate,toDate)` / `GetRentalItemsBySerialNumberAsync(serialNo)` — rental item + its `RentalServices` history combined into `RentalItemDetail`
- `SearchItemsAsync/SearchSparepartsAsync/SearchRentalItemsAsync/SearchRentalServicesAsync` — filter+sort+paginate variants of the above
- `SearchServicesAsync(ServiceSearchQuery query)` — the most complex search: status filter (comma-split multi-status), per-user-per-status filtering (`UserIds`/`UserFilterStatuses` matched against 9 different `*By` columns: `CreateBy`, `InspectBy`, `SetAwaitingCustomerConfirmBy`, `SetAwaitingSparepartBy`, `RepairBy`, `VerifiedBy`, `SetCustomerRejectedBy`, `SetUnrepairableBy`, `ThirdPartyRepairBy`), excluded-statuses, service-location, company-name filter (monthly report drill-down), 3 mutually-exclusive date-filtering modes (`ForceServiceDateOnly` / process-date-per-status / plain `ServiceDate` range), free-text search, sort. **This is the endpoint to check for "search results don't match filters" bugs.**
- `GetMonthlyReportCompanySummaryAsync(fromDate, toDate, serviceLocation)` — groups `Services` by `CompanyName`, counts by `FinishedDate`/`CustomerRejectedDate`/`UnrepairableDate` falling in range (counts by the *event date*, not current status — see in-code comment about a past bug where a since-reopened service was silently dropped)
- `GetUniqueItemNamesAsync/GetUniqueItemTypesAsync` — distinct `Items.ItemName`/`Items.ItemType.Type` lists, paged or full
- `GetSparePartsUsedInServicesAsync()` — spareparts with usage-count/total-qty aggregated from `SparepartItems`

`src/APIs/TechnicalService.API/Application/Queries/TechnicalServiceViewModel.cs`
All the flat read-model records returned by `TechnicalServiceQueries` (these are NOT the EF entities — entities live in `TechnicalService.Domain`, external project):
`Sparepart`, `SparepartWithUsage`, `SparepartItem`, `Service` (full status-history fields:
`InspectDate/By`, `InspectingDate/By`, `UnrepairableDate/SetUnrepairableBy`,
`CustomerRejectedDate/SetCustomerRejectedBy`, `AwaitingCustomerConfirmDate/SetAwaitingCustomerConfirmBy`,
`AwaitingSparepartDate/SetAwaitingSparepartBy`, `RepairDate/RepairBy`,
`ThirdPartyRepairDate/ThirdPartyRepairBy`, `FinishedDate/VerifiedBy`,
`SaleConfirmedDate/SetSaleConfirmedBy`), `SparepartUsageSummary`, `UsageServiceInfo`,
`SparepartUsageQuery`, `SparepartHoldSummary`, `HoldServiceInfo`, `SparepartHoldResult`,
`SparepartHoldQuery`, `Item`, `ReceiveItem`, `ServiceType`, `ServicePriority`, `ServiceStatus`,
`RentalItem`, `RentalService`, `RentalItemDetail`, `ActivityLogQuery`, `ActivityLogDto`.

### Commands (CQRS — MediatR `IRequest<bool>` + matching `IRequestHandler`)
Note: several handler filenames have the original typo "Commnad" instead of "Command" (kept as-is on disk — search by class name, not assumed filename). All handlers except `ManualStockOutCommandHandler` and `UpdateSparepartItemRemarksCommandHandler` go through `ITechnicalServiceRepository`/`IRentalServiceRepository` (external `TechnicalService.Infrastructure` project); those two touch `TechnicalServiceContext` directly.

| Command | File | Handler does |
|---|---|---|
| `CreateItemCommand(ItemName, SerialNumber, ItemType)` | `CreateItemCommand.cs` / `CreateItemCommandHandler.cs` | builds `ItemType` + `Item`, `repo.AddItem()` |
| `CreateRentalItemCommand(CreatedBy, CustomerId, CustomerName, ItemName, SerialNumber, Condition, Location, Duration)` | `CreateRentalItemCommand.cs` / `CreateRentalItemCommandHandler.cs` | builds `RentalItem`, `rentalRepo.AddRentalItem()` |
| `CreateRentalServiceCommand(RentalItemId, Date, Action, Note, UserId, Spareparts)` | `CreateRentalServiceCommand.cs` / `CreateRentalServiceCommnadHandler.cs` | builds `RentalService`, adds each sparepart via `.AddSparepart(...)`, `rentalRepo.CreateRentalService()` |
| `CreateSparepartCommand(ItemName, SerialNumber, Description, UseFor, PictureUrl, LinkItemId, Quantity, DefaultPrice)` | `CreateSparepartCommand.cs` / `CreateSparepartCommandHandler.cs` | builds `Sparepart`, `repo.AddSparepart()` |
| `DeleteItemCommand(ItemId)` | `DeleteItemCommand.cs` / `DeleteItemCommandHandler.cs` | loads item, `repo.DeleteItem()`; returns false if not found |
| `DeleteReceiveItemCommand(ServiceId)` | `DeleteReceiveItemCommand.cs` / `DeleteReceiveItemCommandHandler.cs` | loads service via `repo.GetAsync`, `repo.DeleteService()` |
| `DeleteSparepartItemCommand(ServiceId, SparepartItemId)` | `DeleteSparepartItemCommand.cs` / `DeleteSparepartItemCommandHandler.cs` | loads service, `service.RemoveSparepartItem(id)` — deletion fires SQL trigger `trg_Sparepartitems_AfterDelete_StockIn` to restore stock |
| `DeleteTechnicalServiceCommand(ServiceId)` | `DeleteTechnicalServiceCommand.cs` / `DeleteTechnicalServiceCommandHandler.cs` | loads service, `repo.DeleteService()`, rethrows on exception |
| `InspectItemCommand(Id, InspectBy, InspectDate, Inspection, Solution, ServiceTypeId, Spareparts)` | `InspectItemCommand.cs` / `InspectItemCommnadHandler.cs` | `service.SetInspection(...)`, `service.SetServiceType(...)`, then `service.AddSparepartItem(...)` per part |
| `ManualStockOutCommand(SparepartId, Quantity, Reason, PerformedBy)` | `ManualStockOutCommand.cs` / `ManualStockOutCommandHandler.cs` | validates stock via `context.Spareparts`, inserts a `SparepartManualStockOut` entity directly on `TechnicalServiceContext` (avoids raw SQL); throws `KeyNotFoundException`/`InvalidOperationException` on bad input/insufficient stock |
| `ReceiveItemCommand(CustomerId, CompanyName, Address, ContactName, PhoneNumber, HasContract, ServiceDate, ReportNo, ServiceLocation, ServicePriorityId, ItemId, CustomerRequest, CreateBy)` | `ReceiveItemCommand.cs` / `ReceiveItemCommnadHandler.cs` | builds new `Service` (initial status hardcoded `1`), `repo.ReceiveItem()` |
| `SetAwaitingCustomerConfirmCommand(Id, SetAwaitingCustomerConfirmBy, AwaitingCustomerConfirmDate)` | `SetAwaitingCustomerConfirmCommand.cs` / `SetAwaitingCustomerConfirmCommnadHandler.cs` | `service.SetAwaitingCustomerConfirm(...)` |
| `SetAwaitingSparepartCommand(Id, SetAwaitingSparepartBy, AwaitingSparepartDate)` | `SetAwaitingSparepartCommand.cs` / `SetAwaitingSparepartCommnadHandler.cs` | `service.SetAwaitingSparepart(...)` |
| `SetCustomerRejectedCommand(Id, SetCustomerRejectedBy, CustomerRejectedDate)` | `SetCustomerRejectedCommand.cs` / `SetCustomerRejectedCommnadHandler.cs` | `service.SetCustomerRejected(...)` |
| `SetFinishedStatusCommand(Id, FinishedDate, VerifiedBy)` | `SetFinishedStatusCommand.cs` / `SetFinishedStatusCommnadHandler.cs` | `service.SetFinishedStatus(...)` |
| `SetInspectingCommand(Id, InspectingBy, InspectingDate)` | `SetInspectingCommand.cs` / `SetInspectingCommandHandler.cs` | `service.SetInspecting(...)` |
| `SetRepairCommand(Id, RepairBy, RepairDate)` | `SetRepairCommand.cs` / `SetRepairCommnadHandler.cs` | `service.SetRepairingStatus(...)` |
| `SetSaleConfirmedCommand(Id, SetSaleConfirmedBy, SaleConfirmedDate)` | `SetSaleConfirmedCommand.cs` / `SetSaleConfirmedCommandHandler.cs` | `service.SetSaleConfirmedStatus(...)` |
| `SetSentSparepartsCommand(Id, SentSparepartsDate, SetSentSparepartsBy)` | `SetSentSparepartsCommand.cs` / `SetSentSparepartsCommandHandler.cs` | `service.SetSentSparepartsStatus(...)` |
| `SetThirdPartyRepairCommand(Id, ThirdPartyRepairBy, ThirdPartyRepairDate)` | `SetThirdPartyRepairCommand.cs` / `SetThirdPartyRepairCommnadHandler.cs` | `service.SetThirdPartyRepairingStatus(...)` |
| `SetUnrepairableCommand(Id, SetUnrepairableBy, UnreparableDate)` | `SetUnrepairableCommand .cs` (**note: filename has a trailing space before `.cs`**) / `SetUnrepairableCommnadHandler.cs` | `service.SetUnrepairableStatus(...)` |
| `UpdateInspectItemCommand(Id, InspectBy, Inspection, Solution, ServiceTypeId, Spareparts)` | `UpdateInspectItemCommand.cs` / `UpdateInspectItemCommandHandler.cs` | `service.SetInspection(...)`, `SetServiceType(...)`, then diffs `Spareparts` against existing `SparepartItems` — removes items no longer present, updates changed ones via `.UpdateDetails(...)`, adds new ones via `.AddSparepartItem(...)` |
| `UpdateItemCommand(Id, ItemName, SerialNumber, ItemType)` | `UpdateItemCommand.cs` / `UpdateItemCommandHandler.cs` | `item.UpdateItem(...)` |
| `UpdateReceiveItemCommand(Id, CustomerId, CompanyName, Address, ContactName, PhoneNumber, HasContract, ServiceDate, ReportNo, ServiceLocation, ServicePriorityId, ItemId, CustomerRequest)` | `UpdateReceiveItemCommand.cs` / `UpdateReceiveItemCommandHandler.cs` | `service.UpdateReceiveItemInfo(...)` |
| `UpdateRepairServiceCommand(Id, CustomerId, CompanyName, Address, ContactName, PhoneNumber, ItemId, ReportNo, ServiceDate, CustomerRequest, Inspection, Solution, ServiceLocation, ServiceTypeId, ServicePriorityId, StatusId, HasContract, SparepartItems)` | `UpdateRepairServiceCommand.cs` / `UpdateRepairServiceCommandHandler.cs` | rebuilds `SparepartItem` list, `service.UpdateRepairService(...)` — the general-purpose "edit everything about a service" command, including direct `StatusId` override |
| `UpdateSparepartCommand(Id, ItemName, SerialNumber, Description, UseFor, PictureUrl, LinkItemId, Quantity, DefaultPrice)` | `UpdateSparepartCommand.cs` / `UpdateSparepartCommandHandler.cs` | `sparepart.UpdateSparepart(...)` |
| `UpdateSparepartItemRemarksCommand(SparepartItemId, Remarks)` | `UpdateSparepartItemRemarksCommand.cs` / `UpdateSparepartItemRemarksCommandHandler.cs` | loads `SparepartItem` directly off `TechnicalServiceContext`, `item.UpdateRemarks(...)` — deliberately touches only `Remarks` so the stock-adjust SQL trigger no-ops (see in-code comment) |

## Extensions/

- `src/APIs/TechnicalService.API/Extensions/Extensions.cs` — `internal static class Extensions`: `AddApplicationServices(IHostApplicationBuilder)` — **DI composition root**: registers `TechnicalServiceContext` (SqlServer, connection string `TechnicalServiceConnectionString`), `AddMigration<TechnicalServiceContext, TechnicalServiceContextSeed>`, MediatR (scans `Program` assembly), `ITechnicalServiceQueries → TechnicalServiceQueries`, `ITechnicalServiceRepository → TechnicalServiceRepository`, `IRentalServiceRepository → RentalServiceRepository`.
- `src/APIs/TechnicalService.API/Extensions/OpenApi.Extensions.cs` — `public static partial class Extensions`: `UseDefaultOpenApi(WebApplication)` (Swagger UI + root→swagger redirect), `AddDefaultOpenApi(IHostApplicationBuilder, apiVersioning)` (registers Swashbuckle + `ConfigureSwaggerOptions` + `OpenApiDefaultValues` filter).
- `src/APIs/TechnicalService.API/Extensions/ConfigureSwaggerOptions.cs` — `ConfigureSwaggerOptions : IConfigureOptions<SwaggerGenOptions>` — builds per-API-version `OpenApiInfo`, wires OAuth2 security definition if config has an `Identity` section, nested `AuthorizeCheckOperationFilter`.
- `src/APIs/TechnicalService.API/Extensions/OpenApiDefaultValues.cs` — `OpenApiDefaultValues : IOperationFilter` — fills in parameter defaults/required flags and prunes unsupported response content-types for Swagger docs.
- `src/APIs/TechnicalService.API/Extensions/MigrateDbContextExtensions.cs` — `AddMigration<TContext>` / `AddMigration<TContext, TDbSeeder>` (registers `IDbSeeder<TContext>` + a `MigrationHostedService<TContext>` that runs `context.Database.MigrateAsync()` + seeder on startup); `IDbSeeder<in TContext>` interface defined here too.
- `src/APIs/TechnicalService.API/Extensions/ConfigurationExtensions.cs` — `GetRequiredValue(this IConfiguration, name)` — throws `InvalidOperationException` if config key missing.
- `src/APIs/TechnicalService.API/Extensions/BusinessClock.cs` — `BusinessClock.Now` / `.Today`: the workshop's local wall-clock time (`Asia/Phnom_Penh`, falling back to a fixed +07:00). **Use this, not `DateTime.Now`/`DateTime.UtcNow`/`DateTime.Today`**, for anything a user reads as a date — status stamps, day filters, dashboard tiles. Replaced 13 hardcoded `DateTime.UtcNow.AddHours(7)` call sites.
- `src/APIs/TechnicalService.API/Extensions/Pagination.cs` — `Pagination.Normalize/Page/Size`: clamps caller-supplied paging (`pageNumber` ≥ 1, `pageSize` into [1, 1000]) before it reaches a query. `pageNumber=0` used to produce `Skip(-n)` (a 500) and `pageSize=0` a division by zero in `PagedResult`.
- `src/APIs/TechnicalService.API/Extensions/RequestValidationException.cs` — `RequestValidationException` + `EnumParsing.Parse<TEnum>(value, fieldName)`. **Parse enums off a request body with `EnumParsing.Parse`, never `Enum.Parse`** — the latter threw `ArgumentException` out of the handler and surfaced a client typo as a 500.
- `src/APIs/TechnicalService.API/Extensions/ValidationExceptionHandler.cs` — `IExceptionHandler` mapping `RequestValidationException` → 400 ProblemDetails, the counterpart to `NotFoundExceptionHandler`'s 404. Registered in `Program.cs`.
- `src/APIs/TechnicalService.API/Extensions/ActivityExtensions.cs` — `SetExceptionTags(this Activity, Exception)` — OpenTelemetry exception tagging helper, used by migration error handling.
- `src/APIs/TechnicalService.API/Extensions/SparepartItemExtensions.cs` — `ToSparepartItemsDTO(this IEnumerable<SparepartItem>)`, `ToSparepartItemDTO(this SparepartItem)` — maps view-model `SparepartItem` → `SparepartItemDTO` (used when building `InspectItemCommand`/`UpdateInspectItemCommand`).

## Infrastructure/

- `src/APIs/TechnicalService.API/Infrastructure/TechnicalServiceContextSeed.cs` — `TechnicalServiceContextSeed : IDbSeeder<TechnicalServiceContext>`: `SeedAsync(context)` — seeds `ServiceTypes`/`ServicePriorities`/`ServiceStatuses` from `Enumeration.GetAll<T>()` (domain enumeration classes) if those tables are empty. Runs on startup via `MigrationHostedService`.

## Root files

- `src/APIs/TechnicalService.API/Program.cs` — app bootstrap: `AddApplicationServices()`, `AddApiVersioning()`, `AddDefaultOpenApi()`, `app.NewVersionedApi("Repairs").MapRepairsApiV1()`, `UseDefaultOpenApi()`.
- `src/APIs/TechnicalService.API/GlobalUsings.cs` — global usings: `MediatR`, `Microsoft.EntityFrameworkCore`, `TechnicalService.Infrastructure`, `TechnicalService.Infrastructure.Repositories`, `System.Runtime.Serialization`.

## External dependency: DbContext (not in this project, but central to it)

`src/Shared/TechnicalService.Infrastructure/TechnicalServiceContext.cs` — `TechnicalServiceContext : DbContext, IUnitOfWork`. Injected/used throughout this project (`TechnicalServiceQueries`, `ManualStockOutCommandHandler`, `UpdateSparepartItemRemarksCommandHandler`, the inline `/technicalservices/{id}/status` endpoint). **`DbSet<T>` → table map:**
- `Services` → `Services` table (has SQL trigger `trg_Services_AfterUpdate_StatusToRepairing`)
- `SparepartItems` → `SparepartItems` table (triggers: `trg_Sparepartitems_AfterInsert_StockOut`, `trg_Sparepartitems_AfterUpdate_StockAdjust`, `trg_Sparepartitems_AfterDelete_StockIn` — inserting/deleting/updating a `SparepartItem` adjusts `Spareparts.Quantity` via these triggers, not application code)
- `Spareparts` → `Spareparts`
- `Items` → `Items`
- `ServiceTypes` → `ServiceTypes`
- `ServicePriorities` → `ServicePriorities`
- `ServiceStatuses` → `ServiceStatuses`
- `RentalItems` → `RentalItems`
- `RentalServices` → `RentalServices`
- `RentalSpareparts` → `RentalSpareparts`
- `SparepartManualStockOuts` → `SparepartManualStockOut` table (trigger `trg_SparepartManualStockOut_AfterInsert`)
- `SparepartStockAuditLogs` → `SparepartStockAuditLogs` (read by `GetSparepartUsageByDateRangeAsync` for manual-stockout usage rows; `OperationType`/`QuantityChange`/`ServiceId`/`Timestamp`/`Remarks` columns referenced)

`SaveEntitiesAsync(CancellationToken)` is the `IUnitOfWork` save method called by every command handler (via `repo.UnitOfWork.SaveEntitiesAsync(...)`) instead of `SaveChangesAsync` directly.
