# src/Shared — Index

"Shared" here means cross-cutting libraries referenced by multiple projects under `src/APIs` and `src/Apps` (the old .NET/Blazor stack) — Blazor UI component libraries, EF Core data access/repositories for the `TechnicalService` domain, and caching/messaging infrastructure. Nothing under `src/Shared` is a leaf application; everything here is a `ProjectReference` target. 4 projects, ~29 source files total (excluding `bin/`/`obj/`).

## BlazorClassLibrary.Components
Generic/example Blazor RCL, referenced as a template component library. 1 non-trivial .cs file.

- `src/Shared/BlazorClassLibrary.Components/ExampleJsInterop.cs` — JS-interop wrapper, lazy-loads `exampleJsInterop.js`.
  - `Prompt(string message)` — invokes JS `showPrompt`, returns the JS-side result.
  - `DisposeAsync()` — disposes the loaded JS module if it was created.
- `Component1.razor` / `Component1.razor.css` / `_Imports.razor` — trivial scaffold component, not documented further.
- `wwwroot/` — static assets: `background.png`, `exampleJsInterop.js` (the module `ExampleJsInterop.cs` loads).

## EmployeeManagement.Components
Blazor RCL used by the Employee Management UI (old Blazor app). 2 non-trivial .cs files.

- `src/Shared/EmployeeManagement.Components/ExampleJsInterop.cs` — same JS-interop pattern as `BlazorClassLibrary.Components`, loads `exampleJsInterop.js` from this project's own `wwwroot`.
  - `Prompt(string message)` — invokes JS `showPrompt`.
  - `DisposeAsync()` — disposes JS module.
- `src/Shared/EmployeeManagement.Components/Confirm.razor.cs` — code-behind for a reusable delete-confirmation dialog component (`Confirm.razor`).
  - `Show()` — sets `ShowConfirmation = true` and re-renders.
  - `OnConfirmationChange(bool value)` — closes the dialog and raises `ConfirmationChanged` with the user's choice.
  - Parameters: `ConfirmationTitle` (default `"Confirm Delete"`), `ConfirmationMessage`, `ConfirmationChanged` (`EventCallback<bool>`).
- `wwwroot/` — static assets: `background.png`, `exampleJsInterop.js`.

## ServiceMaintenance.Infrastructure.Shared
Redis-backed caching + a messaging-helper stub, used by API/App layers for read-through caching, invalidation, idempotency, and event fan-out. 5 files across `Caching/` and `Messaging/`.

**Caching mechanism**: Redis via `StackExchange.Redis`, pointed at a managed **Upstash** instance (see `src/Apps/ServiceMaintenance/appsettings.json` → `Redis:ConnectionString`, host `*.upstash.io`, TLS). Connection is lazy (`Lazy<Task<IConnectionMultiplexer>>`), fails open (never throws on Redis being down — logs a warning and treats reads as "miss", writes as no-op, `SetIfNotExistsAsync` as "claimed"). Default TTL is 24h; freshness is driven primarily by explicit invalidation on mutation, not TTL expiry.

- `src/Shared/ServiceMaintenance.Infrastructure.Shared/Caching/RedisService.cs` — low-level Redis wrapper, implements `IRedisService`.
  - `SetAsync(string key, string value, TimeSpan? expiry, CancellationToken)` — `StringSetAsync`, no-op if Redis unreachable.
  - `SetIfNotExistsAsync(string key, string value, TimeSpan? expiry, CancellationToken)` — atomic `SET NX EX` (via `When.NotExists`); returns whether this call set the key. Used for idempotency claims.
  - `GetAsync(string key, CancellationToken)` — `StringGetAsync`, returns null on miss or Redis-down.
  - `DeleteAsync(string key, CancellationToken)` — `KeyDeleteAsync`.
  - `DeleteByPrefixAsync(string prefix, CancellationToken)` — `SCAN`-based bulk delete across master endpoints, batched (page size 250, delete batch 500).
  - `ExistsAsync(string key, CancellationToken)` / `IsHealthyAsync(CancellationToken)` (pings DB) — health/existence checks, fail-safe (`false`) on error.
- `src/Shared/ServiceMaintenance.Infrastructure.Shared/Caching/CacheHelper.cs` — high-level read-through cache built on `IRedisService`.
  - `GetOrSetAsync<T>(string key, Func<Task<T?>> fetchFunc, TimeSpan? expiry, CancellationToken)` — cache-aside with per-key `SemaphoreSlim` stampede protection (double-checked locking); does NOT cache null results from `fetchFunc`.
  - `InvalidateAsync(string key, CancellationToken)` / `InvalidateManyAsync(params string[])` / `InvalidateManyAsync(CancellationToken, params string[])` — delete one or many keys.
  - `InvalidateByPrefixAsync(string prefix, CancellationToken)` — delegates to `RedisService.DeleteByPrefixAsync`.
  - `ExistsAsync(string key, CancellationToken)` — existence check, fail-safe.
- `src/Shared/ServiceMaintenance.Infrastructure.Shared/Caching/IdempotencyHelper.cs` — message-processing dedup on top of `IRedisService`, key format `idempotent:{queue}:{messageId}`, 24h TTL.
  - `IsAlreadyProcessedAsync(string queue, Guid messageId)` — check-only (non-atomic; racy under concurrency), fails open (returns false / "allow") if Redis errors.
  - `MarkAsProcessedAsync(string queue, Guid messageId)` — call after successful processing (two-step pattern, pairs with `IsAlreadyProcessedAsync`).
  - `TryClaimAsync(string queue, Guid messageId)` — preferred atomic claim (`SETNX`+TTL in one round-trip); true only for first caller.
  - `ReleaseAsync(string queue, Guid messageId)` — undo a claim after a failed processing attempt so retries aren't blocked for the full 24h.
- `src/Shared/ServiceMaintenance.Infrastructure.Shared/Caching/CacheKeys.cs` — static key-builder catalog (const prefixes + `static string` builder methods) for every cached feature area: dashboard stats/grid, monthly report, per-status item queues (receive/inspect/repair/await-customer/await-sparepart/finish-repair/customer-reject/unrepairable/third-party/sparepart/item-module/rental-inventory/rental-logbook/sent-spareparts/sale-confirmed), report lookups (service statuses/types, customer types, users map, customers/spareparts first-page), customer center (customers + customer types), monthly/customer report keys. **Search here first when hunting "what cache key does X use."**

**Messaging pattern**: not a real queue integration — `MessageQueueHelper` is a **stub/no-op publisher**. All `Publish*Async` methods take loosely-typed `object?` params and immediately `return Task.CompletedTask` without doing anything. Real queue names live in the nested `Queues` static class (`receive-item`, `await-customer`, `await-spare-part`, `inspect-item`, `inspection-item`, `repair-item`, `finish-item`, `spare-part`, `item-module`, `order`).

- `src/Shared/ServiceMaintenance.Infrastructure.Shared/Messaging/MessageQueueHelper.cs`
  - `QueueAction` enum — `Create`, `Update`, `Delete`, `StatusChange`.
  - `QueueMessage` class — `MessageId`, `EntityId`, `ReportNo`, `Status`, `Action`, `CreatedAt` (all no-op DTO fields; not currently serialized/sent anywhere).
  - `MessageQueueHelper.Queues` — const queue-name strings (see above).
  - `PublishCreateAsync(...)` / `PublishUpdateAsync(...)` / `PublishDeleteAsync(...)` / `PublishStatusChangeAsync(...)` / `PublishAsync(...)` — all currently no-ops (`Task.CompletedTask`); look here if "we published an event but nothing happened downstream" — this is why.

## TechnicalService.Infrastructure
EF Core (SQL Server) data-access layer for the Technical Service / Rental domain: `DbContext`, entity type configurations (Fluent API), repositories, and migrations. 21 files.

- `src/Shared/TechnicalService.Infrastructure/TechnicalServiceContext.cs` — the `DbContext` (also implements `IUnitOfWork`). **DbSet<T> properties** (search target for "where is table X used"):
  - `Services` (Service)
  - `SparepartItems` (SparepartItem)
  - `Spareparts` (Sparepart)
  - `Items` (Item)
  - `ServiceTypes` (ServiceType)
  - `ServicePriorities` (ServicePriority)
  - `ServiceStatuses` (ServiceStatus)
  - `RentalItems` (RentalItem)
  - `RentalServices` (RentalService)
  - `RentalSpareparts` (RentalSparepart)
  - `SparepartManualStockOuts` (SparepartManualStockOut)
  - `SparepartStockAuditLogs` (SparepartStockAuditLog)
  - `OnModelCreating` applies all 10 `EntityConfigurations` below, plus inline config for 3 tables with **DB triggers**: `Services` (`trg_Services_AfterUpdate_StatusToRepairing`), `SparepartItems` (`trg_Sparepartitems_AfterInsert_StockOut`, `trg_Sparepartitems_AfterUpdate_StockAdjust`, `trg_Sparepartitems_AfterDelete_StockIn`), `SparepartManualStockOut` (`trg_SparepartManualStockOut_AfterInsert`) — stock quantity is partly maintained by SQL triggers, not just app code.
  - `SaveEntitiesAsync(CancellationToken)` — `IUnitOfWork` implementation, calls `SaveChangesAsync`.

- `src/Shared/TechnicalService.Infrastructure/Repositories/TechnicalServiceRepository.cs` — implements `ITechnicalServiceRepository`; wraps `TechnicalServiceContext` for the core service-ticket workflow.
  - `GetItemAsync(Guid itemId)` / `AddItem(Item)` / `UpdateItem(Item)` / `DeleteItem(Item)` — Item CRUD.
  - `ReceiveItem(Service service)` — adds a new `Service` (intake).
  - `GetSparepartAsync(Guid sparepartId)` / `AddSparepart(Sparepart)` — Sparepart lookups/create.
  - `GetAsync(Guid id)` — loads `Service` with `Item`, `ServiceType`, `ServicePriority`, `Status`, `SparepartItems` included.
  - `GetServiceAsync(Guid id)` — loads `Service` with only `SparepartItems` included.
  - `DeleteService(Service)` / `UpdateRepairService(Service)` / `DeleteRepairService(Service)` — Service update/delete (note: two differently-named delete methods, `DeleteService` and `DeleteRepairService`, both just `Remove` — check callers if consolidating).

- `src/Shared/TechnicalService.Infrastructure/Repositories/RentalServiceRepository.cs` — implements `IRentalServiceRepository`; wraps `TechnicalServiceContext` for the rental workflow.
  - `GetRentalItemAsync(Guid itemId)` / `AddRentalItem(RentalItem)` / `UpdateRentalItem(RentalItem)` / `DeleteRentalItem(RentalItem)` — RentalItem CRUD.
  - `GetSparepartAsync(Guid sparepartId)` — Sparepart lookup (duplicated from `TechnicalServiceRepository`).
  - `CreateRentalService(RentalService rentalService)` — adds a new `RentalService`.
  - `GetServiceAsync(Guid id)` / `UpdateRepairService(Service)` / `DeleteRepairService(Service)` — same `Service`-touching methods as `TechnicalServiceRepository` (duplicated logic across both repos — check both when changing Service update/delete behavior).

- `src/Shared/TechnicalService.Infrastructure/EntityConfigurations/` — one `IEntityTypeConfiguration<T>` per entity, all Fluent-API table/column/index/relationship setup (no business logic). Table name mapping and notable constraints:
  - `ServiceEntityTypeConfiguration.cs` → table `Services`; configures shadow FKs `_serviceTypeId`/`_servicePriorityId`/`_serviceStatusId`, `HasOne` for `ServiceType`/`ServicePriority`/`Status`/`Item`, `HasMany("_sparepartItems")` backing field.
  - `SparepartItemEntityTypeConfiguration.cs` → table `SparepartItems`; FK `ServiceId`/`SparepartId` (`HasOne<Service>`), indexes on both, plus `Description`/`Quantity`/`Condition`/`IsHoldStatus` columns.
  - `SparepartEntityTypeConfiguration.cs` → table `Spareparts`.
  - `ItemEntityTypeConfiguration.cs` → table `Items`.
  - `ServiceTypeEntityTypeConfiguration.cs` → table `ServiceTypes`; `Id`/`Name` columns.
  - `ServicePriorityEntityTypeConfiguration.cs` → table `ServicePriorities`; `Id`/`Name`.
  - `ServiceStatusEntityTypeConfiguration.cs` → table `ServiceStatuses`; `Id`/`Name`.
  - `RentalItemEntityTypeConfiguration.cs` → table `RentalItems`; `CustomerId`, `CustomerName`, `ItemName`, `SerialNumber`, `Condition`, `Location` columns.
  - `RentalServiceEntityTypeConfiguration.cs` → table `RentalServices`; `Action` column, `HasOne(r => r.RentalItem)`.
  - `RentalSparepartEntityTypeConfiguration.cs` → table `RentalSpareparts`; `Condition` column.
  - `CustomerEntityTypeConfiguration.cs` → table `Customers`; `IdentityGuid` column + index (note: this configuration exists here but `Customer` is not a `DbSet` on `TechnicalServiceContext` — check which context actually owns `Customers`).
  - `SparepartStockAuditLogEntityTypeConfiguration.cs` → table `SparepartStockAuditLog`; `OperationType` (maxlen 50), `Remarks` (nvarchar(max)).

- `src/Shared/TechnicalService.Infrastructure/Migrations/` — EF Core migrations, apply in order:
  - `20250710130932_InitialCreate.cs` (+ `.Designer.cs`) — initial schema (222 lines).
  - `20250808034052_AddRentalService.cs` (+ `.Designer.cs`) — adds `RentalServices` (102 lines).
  - `TechnicalServiceContextModelSnapshot.cs` — current EF model snapshot; regenerate via `dotnet ef migrations add`, don't hand-edit.

- `src/Shared/TechnicalService.Infrastructure/GlobalUsings.cs` — implicit usings: `MediatR`, `Microsoft.EntityFrameworkCore(.Metadata.Builders)`, `TechnicalService.Domain.AggregatesModel.{CustomerAggregate,RentalAggregate,TechnicalAggregate}`, `TechnicalService.Domain.SeedWork`.

**Dependencies**: `TechnicalService.Infrastructure` → `TechnicalService.Domain` (Core) + EF Core SQL Server. `ServiceMaintenance.Infrastructure.Shared` → `TechnicalService.Domain` + `TechnicalService.Infrastructure` + `StackExchange.Redis`.
