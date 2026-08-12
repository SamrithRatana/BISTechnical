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
- `PUT /technicalservices/{serviceId:Guid}/status` → **inline lambda, bypasses MediatR** — loads `Service` directly off `TechnicalServiceContext`, switches on `request.StatusId` (10 = Inspecting → `service.SetInspecting(...)`, 2 = Inspection → `service.SetInspection(...)`, else 400). Worth knowing this one endpoint doesn't go through a command/handler.
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
`UpdateServiceStatusRequest(int StatusId)`.

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
- `GetSparepartUsageByDateRangeAsync(SparepartUsageQuery query)` — largest/most complex method; joins `Services` + `SparepartItems` (service-sourced usage) with `SparepartStockAuditLogs` (`OperationType == "STOCK_OUT"`, manual usage), groups by sparepart, supports `DateMode == "alwayscreated"` vs status-driven process-date mode, search, sort, pagination. If a "usage report shows wrong numbers" bug comes in, start here.
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
| `SetUnrepairableCommand(Id, SetUnrepairableBy, UnreparableDate)` | `SetUnrepairableCommand .cs` (**note: filename has a trailing space before `.cs`**) / `SetUnrepairableCommnadHandler.cs` | `service.SetUnrepairableStatus(...)` — handler's `ILogger` is mistyped as `ILogger<SetRepairCommnadHandler>` instead of its own type (copy-paste artifact, functionally harmless) |
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
