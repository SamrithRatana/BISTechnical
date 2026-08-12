# src/Core — Domain/Model Libraries Index

Three class libraries referenced by the API projects (src/APIs) and the old Blazor app (src/Apps): two are plain POCO/DTO bags (`EmployeeManagement.Models`, `ServiceMaintenance.Models`), one (`TechnicalService.Domain`) is a DDD-style domain model with aggregate roots, entities, value objects, and a `SeedWork` base-class layer. This file is a terse index for jumping straight to a class/member — read the source file for full detail, don't guess from here.

## EmployeeManagement.Models

9 files, namespace `EmployeeManagement.Models`. EF-style POCOs for the old Employee/Department/Customer admin area plus generic paging helpers.

`src/Core/EmployeeManagement.Models/Customer.cs` — Customer record (separate from ServiceMaintenance.Models.Customer / TechnicalService.Domain Customer aggregate).
- `Id` (Guid, PK), `CustomerTypeListId` (int?, FK-like → CustomerType.ListId), `CustomerType` (nav property)

`src/Core/EmployeeManagement.Models/CustomerType.cs` — lookup table for customer categories.
- `ListId` (int, PK), `ParentListId` (int?, self-referencing FK)

`src/Core/EmployeeManagement.Models/Department.cs` — simple department lookup (`DepartmentId`, `DepartmentName`).

`src/Core/EmployeeManagement.Models/EmailDomainValidator.cs` — `ValidationAttribute` enforcing an email's domain matches `AllowedDomain`.
- `IsValid(object, ValidationContext)` — splits on `@`, compares domain case-insensitively.

`src/Core/EmployeeManagement.Models/Employee.cs` — Employee entity.
- `DepartmentId` (int, FK → Department), `Department` (nav property)
- `Email` decorated with `[EmailDomainValidator(AllowedDomain = "ratana.com")]`

`src/Core/EmployeeManagement.Models/Gender.cs` — enum `Male | Female | Other`.

`src/Core/EmployeeManagement.Models/PagedResponse.cs` — generic paging wrapper `PagedResponse<T>`.
- `HasPrevious`, `HasNext` (computed bools), `TotalPages` computed in ctor via `Math.Ceiling`.

`src/Core/EmployeeManagement.Models/PaginationParameters.cs` — paging request; `PageSize` setter clamps to `maxPageSize = 100`.

`src/Core/EmployeeManagement.Models/User.cs` — ASP.NET Identity-shaped user POCO (Id as string, PasswordHash, SecurityStamp, lockout fields, ProfilePicture byte[]). Distinct from `ServiceMaintenance.Models.User` (same shape, different namespace).

## ServiceMaintenance.Models

37 files (36 excluding generated `obj/`), namespace `ServiceMaintenance.Models`. Request/response DTOs and view models consumed by the Blazor UI and/or API clients for the repair-service workflow. Not DDD — plain mutable POCOs, many mirroring `TechnicalService.Domain` aggregate state machine (Service/Repairs) 1:1 for serialization.

`src/Core/ServiceMaintenance.Models/ActivityLogModels.cs` — `ActivityLogQuery` (paged filter: FromDate/ToDate/EntityType/Action/SearchTerm), `ActivityLogDto` (Action/EntityType/EntityId/DocumentNo/Details/UserId/Timestamp), `PagedResult<T>` (generic paging wrapper, computes `TotalPages` in ctor — check for duplicate `PagedResult<T>`/`PagedResponse<T>` definitions elsewhere before adding another).

`src/Core/ServiceMaintenance.Models/Article.cs` — news/bulletin article (`ArticleHeading`, `ArticleContent`, `Username`, `Timestamp` UTC, `IsRead`, `IsActionVisible`).

`src/Core/ServiceMaintenance.Models/ContactInfo.cs` — engineer contact (`EngineerName`, `Tel`).

`src/Core/ServiceMaintenance.Models/Customer.cs` — Customer DTO with `[JsonPropertyName]` camelCase mapping for API responses; `CustomerType` here is a `string` (not FK id) — must match API JSON field name `customerType`.

`src/Core/ServiceMaintenance.Models/Issue.cs` — generic issue/ticket record (`IssueID`, `CustomerId`, `ItemId`, `IssueType`, `Date`, `SolveDate`, `Status`).

`src/Core/ServiceMaintenance.Models/ItemUpdateMessage.cs` — SignalR/pubsub payload; `AffectedStatuses` (string[]) — statuses touched by an update.

`src/Core/ServiceMaintenance.Models/LoginApiRequest.cs`, `LoginViewModel.cs` — login DTOs (UserName/Password/RememberMe); ViewModel variant adds `[Required]` validation.

`src/Core/ServiceMaintenance.Models/ManualStockOutObject.cs` — manual sparepart stock-out request (`SparepartId`, `Quantity`, `Reason`, `PerformedBy`, `CreatedAt`).

`src/Core/ServiceMaintenance.Models/Manufacturer.cs` — manufacturer lookup (`ManufacturerID` PK, `Type`, `Name`, `Logo` path).

`src/Core/ServiceMaintenance.Models/PersonalInfoTable.cs` — unused-looking scratch entity (`ID`, `Name`, `Address`, `Age`).

`src/Core/ServiceMaintenance.Models/PrinterModel.cs` — printer model lookup (`PrinterModelID` PK, `ModelName`, `Photo`).

`src/Core/ServiceMaintenance.Models/ReceiveItemRequest.cs` — "receive item" intake request (maps to `Service` aggregate ctor / `UpdateReceiveItemInfo`).
- `CustomerId`, `ItemId` (FKs), `ServicePriorityId` (int, FK-like → ServicePriority)

`src/Core/ServiceMaintenance.Models/RentalItem.cs` — rental item DTO (`Id`, `CreatedBy`, `CustomerId` FK, `ItemName`, `SerialNumber`, `Condition`, `Location`, `Duration`).

`src/Core/ServiceMaintenance.Models/RentalItemDetailModels.cs` — API request/response wrappers for rental item detail, with domain↔DTO converters:
- `RentalItemDetailResponse.ToRentalItem()` — parses string Guids, maps to `RentalItem`.
- `RentalServiceResponse.ToRentalServices()` — maps nested spareparts, parses Date string.
- `SparePartResponse.ToSparePartOb()` — maps to `SparePartOb`.
- `RentalItemDetailRequest.FromRentalItem(RentalItem)` (static) — builds request from domain model.
- `RentalServiceRequest.FromRentalServices(RentalServices)` (static) — formats Date as ISO string.
- `SparePartRequest.FromSparePartOb(SparePartOb)` (static).

`src/Core/ServiceMaintenance.Models/RentalServices.cs` — `RentalServices` (RentalItemId FK, Date, Action, Note, UserId, `SpareParts: List<SparePartOb>`); `SparePartOb` (nested spare part line); enums `ActionType` (PreCheck/Install/Check/Repair), `SparePartCondition` (Fix/Replace) — duplicates of `TechnicalService.Domain.AggregatesModel.RentalAggregate.ActionType`/`SparepartCondition`, keep in sync manually.

`src/Core/ServiceMaintenance.Models/RepairItemRequest.cs`, `AwaitingCustomerConfirmRequest.cs`, `AwaitingSparePartRequest.cs`, `CustomerRejectedRequest.cs`, `SentSparepartsRequest.cs`, `SetInspectingRequest.cs`, `SetSaleConfirmedRequest.cs`, `ThirdPartyRepairRequest.cs`, `UnrepairableRequest.cs` — one-shot state-transition request DTOs, each just `{ Id (Guid, the Service/RepairService id), <ActorField>By (Guid, user performing the action) }`. These map 1:1 to the `Service` aggregate's `Set*`/`SetRepairingStatus`/etc. methods in `TechnicalService.Domain` — see that section for the actual state machine.

`src/Core/ServiceMaintenance.Models/FinishItemRequest.cs` — like the above but adds `FinishedDate` (DateTime?, optional — null lets backend use server time for CompanyService; populated for OnSite).

`src/Core/ServiceMaintenance.Models/InspectItemRequest.cs` — inspection submission: `InspectBy`, `Inspection`, `Solution` (required), `ServiceTypeId`, `SpareParts: List<SparePart>` (nested class in same file: SparePartId, Quantity, Condition, ServiceId, IsHoldStatus, Remarks).

`src/Core/ServiceMaintenance.Models/RepairServices.cs` — largest/most central view-model in this project; flattened read model for a repair service row (mirrors every state field on `TechnicalService.Domain.AggregatesModel.TechnicalAggregate.Service`: inspectDate, awaitingCustomerConfirmDate, awaitingSparepartDate, customerRejectedDate, unrepairableDate, thirdPartyRepairDate, repairDate, finishedDate, sentSparepartsDate, plus matching `*By` Guid actor fields).
- Computed display properties: `SaleConfirmedFormatted`, `SentSparepartsFormatted`, `InspectDateFormatted`, `AwaitingCustomerFormatted`, `AwaitingSparepartFormatted`, `RepairDateFormatted`, `FinishedDateFormatted`, `CustomerRejectedFormatted`, `UnrepairableFormatted`, `ThirdPartyFormatted` — all `dd-MMM-yyyy` or `""`.
- `DaysTaken` (int?, get-only) — days between ServiceDate and FinishedDate/Today; null if status is Customer Rejected/Unrepairable.
- `SparePartSummary`, `SparePartExcelSummary`, `SparePartPrintSummary` (string, get-only) — join `SparePartItems` for display/export; `SparePartExcelSummary` has `Console.WriteLine` debug logging.
- Also in this file: `SparePartItem` (line item: SparepartId, ItemName, Quantity, Condition, RepairServiceId FK, IsHoldStatus, Remarks, RemarksUpdatedAt), `ServiceType`/`ServicePriority`/`ServiceStatus` (simple Id/Name lookup DTOs — distinct from the domain `Enumeration` subclasses of the same names in `TechnicalService.Domain`).

`src/Core/ServiceMaintenance.Models/Repairs.cs` — minimal create-item shape (`ItemName`, `SerialNumber`, `ItemType`, all `[Required]` with Khmer error messages).

`src/Core/ServiceMaintenance.Models/RequiredWithCustomMessageAttribute.cs` — top-level (no namespace) custom `ValidationAttribute`; fixed Khmer message "Serial Number is required."
- `IsValid(object, ValidationContext)` — null/whitespace check.

`src/Core/ServiceMaintenance.Models/ServiceReportData.cs` — printable service report DTO (Code, ReportID, CompanyName, Attention, Address, Mobile/OfficeTel with `[Phone]`, ProductName, Instrument, SerialNumber, Datestart/DateFinish, Engineer, Verify, Customer) — heavy `[Required]` usage for report form validation.

`src/Core/ServiceMaintenance.Models/SparePartObject.cs` — sparepart catalog DTO (`Id`, `ItemName`, `SerialNumber`, `LinkItemId`, `UsageCount`, `TotalQtyUsed`, `DefaultPrice`).

`src/Core/ServiceMaintenance.Models/SparepartHoldResult.cs` / `SparepartHoldSummary.cs` / `HoldServiceInfo.cs` — sparepart "on hold" reporting chain: `SparepartHoldResult` (paged list of `SparepartHoldSummary`, totals) → `SparepartHoldSummary` (per-sparepart: CurrentStock, TotalHoldQty, `Services: List<HoldServiceInfo>`) → `HoldServiceInfo` (per-service hold line: ServiceId, ReportNo, CompanyName, Quantity, Condition).

`src/Core/ServiceMaintenance.Models/SparepartUsageSummary.cs` — usage reporting: `SparepartUsageSummary` (record; StockQuantity, UsedQuantity split into ServiceUsedQty/ManualUsedQty, UsageCount split into ServiceUsageCount/ManualStockOutCount, `Services: List<UsageServiceInfo>`); `UsageServiceInfo` (per-usage-event line: ServiceId, Source, Reason, MachineItemName/MachineSerialNumber).

`src/Core/ServiceMaintenance.Models/User.cs` — same shape as `EmployeeManagement.Models.User` (Identity-style), different namespace.

## TechnicalService.Domain

29 files, namespaces `TechnicalService.Domain.AggregatesModel.{CustomerAggregate,RentalAggregate,TechnicalAggregate}`, `.SeedWork`, `.Exceptions`. DDD-style domain: aggregate roots enforce invariants via private setters + behavior methods, not property bags. Global usings (`GlobalUsings.cs`) pull in `MediatR`, `System.Text.Json.Serialization`, `TechnicalService.Domain.Exceptions`, `TechnicalService.Domain.SeedWork` project-wide.

### SeedWork

Base classes/interfaces every aggregate builds on — read these first when tracing equality/identity/domain-event bugs.

`src/Core/TechnicalService.Domain/SeedWork/Entity.cs` — abstract base for Guid-keyed entities.
- `Id` (Guid, `protected set`), `DomainEvents` (IReadOnlyCollection<INotification>)
- `AddDomainEvent(INotification)`, `RemoveDomainEvent(INotification)`, `ClearDomainEvents()`
- `IsTransient()` — true if `Id == default`.
- `Equals`/`GetHashCode`/`==`/`!=` overridden — identity-based equality (type + Id, transient entities never equal).

`src/Core/TechnicalService.Domain/SeedWork/SmallEntity.cs` — identical to `Entity` but `Id` is `int` not `Guid` (for small lookup-style entities).

`src/Core/TechnicalService.Domain/SeedWork/Enumeration.cs` — Java-style typesafe enum base (used by `ServiceType`, `ServicePriority`, `ServiceStatus`).
- `GetAll<T>()` — reflection over public static fields.
- `FromValue<T>(int)`, `FromDisplayName<T>(string)` — throws `InvalidOperationException` if not found.
- `AbsoluteDifference(Enumeration, Enumeration)`, `CompareTo(object)`.

`src/Core/TechnicalService.Domain/SeedWork/ValueObject.cs` — abstract base for value objects (used by `ItemType`).
- `GetEqualityComponents()` (abstract) — subclass yields fields for structural equality.
- `Equals`/`GetHashCode` derived from components; `GetCopy()` — shallow `MemberwiseClone`.

`src/Core/TechnicalService.Domain/SeedWork/IAggregateRoot.cs` — marker interface, no members.

`src/Core/TechnicalService.Domain/SeedWork/IRepository.cs` — `IRepository<T> where T : IAggregateRoot` — just exposes `UnitOfWork`.

`src/Core/TechnicalService.Domain/SeedWork/IUnitOfWork.cs` — `SaveChangesAsync(CancellationToken)`, `SaveEntitiesAsync(CancellationToken)`.

### Exceptions

`src/Core/TechnicalService.Domain/Exceptions/TechnicalServiceDomainException.cs` — domain-rule violation exception, thrown by aggregate methods (e.g. negative quantity in `SparepartItem`, `RentalSparepart`).

### AggregatesModel

#### CustomerAggregate

`src/Core/TechnicalService.Domain/AggregatesModel/CustomerAggregate/Customer.cs` — aggregate root (`Entity, IAggregateRoot`).
- `IdentityGuid`, `CompanyName`, `Category` — all `private set`, required non-empty in ctor (throws `ArgumentNullException` if blank).
- Distinct from `ServiceMaintenance.Models.Customer` / `EmployeeManagement.Models.Customer` (different namespace, immutable-by-construction).

#### RentalAggregate

`src/Core/TechnicalService.Domain/AggregatesModel/RentalAggregate/RentalItem.cs` — entity (not aggregate root itself; root is `RentalService`).
- `CustomerId` (FK), `CreatedBy`, `ItemName`, `SerialNumber`, `Condition`, `Location`, `Duration` — all `private set`, set once via ctor.

`src/Core/TechnicalService.Domain/AggregatesModel/RentalAggregate/RentalService.cs` — aggregate root (`Entity, IAggregateRoot`).
- `RentalItemId` (FK), `RentalItem` (nav, get-only — not populated by ctor), `Action` (ActionType), `UserId`, `_spareparts` (private list) → `Spareparts` (IReadOnlyList<RentalSparepart>)
- `AddSparepart(Guid sparepartId, string description, int quantity, SparepartCondition condition)` — constructs and appends a `RentalSparepart`.
- `Update(Guid id)` — reassigns `Id` (used for update-in-place scenarios).

`src/Core/TechnicalService.Domain/AggregatesModel/RentalAggregate/RentalSparepart.cs` — entity, child of `RentalService`.
- `SparepartId` (FK), `Quantity`, `Condition` (SparepartCondition)
- Ctor throws `TechnicalServiceDomainException` if `quantity <= 0`.
- `Update(Guid id)` — reassigns Id.

`src/Core/TechnicalService.Domain/AggregatesModel/RentalAggregate/IRentalServiceRepository.cs` — `IRepository<RentalService>`.
- `GetRentalItemAsync(Guid)`, `AddRentalItem(RentalItem)`, `UpdateRentalItem(RentalItem)`, `DeleteRentalItem(RentalItem)`, `CreateRentalService(RentalService)`.
- Several commented-out Sparepart/Service methods (dead code, leftover from copy-paste off `ITechnicalServiceRepository`).

`src/Core/TechnicalService.Domain/AggregatesModel/RentalAggregate/ActionType.cs` — enum `PreCheck=1, Install=2, Check=3, Repair=4` (JSON string-serialized). Duplicate of `ServiceMaintenance.Models.RentalServices.ActionType` — keep values in sync.

`src/Core/TechnicalService.Domain/AggregatesModel/RentalAggregate/SparepartCondition.cs` — enum `Replace=0, Fix=1, Free=2` (JSON string-serialized). Note: differs in numbering from `ServiceMaintenance.Models` version (`Fix=1, Replace=2`, no Free) — potential source of value-mismatch bugs if compared/cast across namespaces.

#### TechnicalAggregate

Largest subfolder — the core repair-service workflow/state machine plus sparepart inventory.

`src/Core/TechnicalService.Domain/AggregatesModel/TechnicalAggregate/Service.cs` — **the** aggregate root (`Entity, IAggregateRoot`) for a repair job; backs `ServiceMaintenance.Models.RepairServices`/`ReceiveItemRequest`/all the `*Request` DTOs. Very large — start here for any repair-workflow bug.
- Identity/FKs: `CustomerId`, `ItemId` (Guid?), `Item` (nav, get-only).
- Private backing fields `_serviceTypeId`, `_servicePriorityId`, `_serviceStatusId` drive `ServiceType`/`ServicePriority`/`Status` (not directly settable — set via numeric id through behavior methods).
- `_sparepartItems` (private list) → `SparepartItems` (IReadOnlyCollection<SparepartItem>).
- Ctor `Service(customerId, companyName, address, contactName, phoneNumber, hasContract, serviceDate, reportNo, serviceLocation, serviceTypeId, servicePriorityId, itemId, customerRequest, createBy)` — sets initial status: `_serviceStatusId = itemId == null ? 6 : 1` (Finished if no item, else ItemReceived).
- `UpdateReceiveItemInfo(...)` — updates intake fields without touching status.
- `UpdateRepairService(...)` — bulk update incl. rebuilding `_sparepartItems` from a passed list.
- `ClearSparepartItems()`, `AddSparepartItem(sparepartId, description, quantity, condition, isHoldStatus=false)`, `RemoveSparepartItem(Guid sparepartItemId)`.
- State-transition methods (each sets the matching `*By`/`*Date` fields and `_serviceStatusId` — this **is** the status state machine, cross-reference against `ServiceStatus` ids below):
  - `SetInspection(inspectBy, inspectDate, inspection, solution)` → status 2 (Inspection)
  - `SetInspecting(inspectingBy, inspectingDate)` → status 10 (Inspecting)
  - `SetAwaitingCustomerConfirm(by, date)` → status 3
  - `SetCustomerRejected(by, date)` → status 7
  - `SetAwaitingSparepart(by, date)` → status 4
  - `SetRepairingStatus(repairBy, repairDate)` → status 5
  - `SetThirdPartyRepairingStatus(by, date)` → status 9
  - `SetFinishedStatus(finishedDate, verifiedBy)` → status 6
  - `SetUnrepairableStatus(date, by)` → status 8
  - `SetSaleConfirmedStatus(date, by)` → status 11
  - `SetSentSparepartsStatus(date, by)` → status 12
  - `SetServiceType(serviceTypeId)` — updates `_serviceTypeId` only.

`src/Core/TechnicalService.Domain/AggregatesModel/TechnicalAggregate/ServiceStatus.cs` — `Enumeration` subclass; the canonical status id→name map (cross-reference for `Service`'s `_serviceStatusId` literals above): 1 ItemReceived, 2 Inspection, 3 AwaitingCustomerConfirm, 4 AwaitingSparepart, 5 Repairing, 6 Finished, 7 CustomerRejected, 8 Unrepairable, 9 RepairByThirdParty, 10 Inspecting, 11 SaleConfirmed, 12 SentSpareparts.

`src/Core/TechnicalService.Domain/AggregatesModel/TechnicalAggregate/ServiceType.cs` — `Enumeration`: `Free=1, Charge=2`.

`src/Core/TechnicalService.Domain/AggregatesModel/TechnicalAggregate/ServicePriority.cs` — `Enumeration`: `Low=1, Normal=2, High=3`.

`src/Core/TechnicalService.Domain/AggregatesModel/TechnicalAggregate/ServiceLocation.cs` — plain enum (JSON string-serialized): `CompanyService=0, OnSite=1`.

`src/Core/TechnicalService.Domain/AggregatesModel/TechnicalAggregate/Item.cs` — entity (machine/device being serviced).
- `ItemName`, `SerialNumber`, `ItemType` (ValueObject).
- `UpdateItem(itemName, serialNumber, itemType: string)` — rebuilds `ItemType` value object; defaults to `"Toner"` if `itemType` is null.

`src/Core/TechnicalService.Domain/AggregatesModel/TechnicalAggregate/ItemType.cs` — `ValueObject`; single component `Type` (string), structural equality via `GetEqualityComponents()`.

`src/Core/TechnicalService.Domain/AggregatesModel/TechnicalAggregate/Sparepart.cs` — entity, inventory catalog item.
- `ItemName`, `SerialNumber`, `LinkItemId`, `Quantity`, `DefaultPrice` (all clamped ≥0 in ctor/setters).
- `UpdateSparepart(itemName, serialNumber, description, useFor, pictureUrl, linkItemId, quantity, defaultPrice=0)` — full update.
- `UpdateQuantity(int newQuantity)` — throws `ArgumentException` if negative.
- `AddStock(int amount)` — throws if `amount <= 0`; increments Quantity.
- `RemoveStock(int amount)` — throws if `amount <= 0`; returns `false` (no-op) if insufficient stock, else decrements and returns `true`. **Note:** stock decrement bugs likely live here or in callers ignoring the `bool` return.

`src/Core/TechnicalService.Domain/AggregatesModel/TechnicalAggregate/SparepartItem.cs` — entity, child line item of `Service.SparepartItems`.
- `SparepartId` (FK), `ServiceId` (FK), `Quantity`, `Condition`, `IsHoldStatus`, `Remarks`, `RemarksUpdatedAt`.
- Ctor throws `TechnicalServiceDomainException` if `quantity < 0`; sets `RemarksUpdatedAt` to Cambodia time (`UtcNow.AddHours(7)`) only if `remarks != null`.
- `Update(Guid id)` — reassigns Id.
- `UpdateDetails(description, quantity, condition, isHoldStatus=false)` — throws if quantity negative.
- `UpdateRemarks(string remarks)` — always stamps `RemarksUpdatedAt` to Cambodia time (UTC+7).

`src/Core/TechnicalService.Domain/AggregatesModel/TechnicalAggregate/SparepartCondition.cs` — enum (JSON string-serialized): `Replace=0, Fix=1, Free=2`. (Same numbering as RentalAggregate's version, unlike ServiceMaintenance.Models' `SparePartCondition`.)

`src/Core/TechnicalService.Domain/AggregatesModel/TechnicalAggregate/SparepartManualStockOut.cs` — entity, audit record for manual stock-out (`SparepartId`, `Quantity`, `Reason`, `PerformedBy`, `CreatedAt`) — immutable after construction (no update methods).

`src/Core/TechnicalService.Domain/AggregatesModel/TechnicalAggregate/SparepartStockAuditLog.cs` — plain data class (not `Entity`-derived, all public setters) — audit trail row: `SparepartId`, `ServiceId?`, `OperationType`, `QuantityChange`, `OldQuantity`, `NewQuantity`, `PerformedBy`, `Remarks`. Likely EF-mapped read/write log table, not a true DDD entity.

`src/Core/TechnicalService.Domain/AggregatesModel/TechnicalAggregate/ITechnicalServiceRepository.cs` — `IRepository<Service>`, the main repository contract.
- `GetItemAsync(Guid)`, `AddItem(Item)`, `UpdateItem(Item)`, `DeleteItem(Item)`
- `GetSparepartAsync(Guid)`, `AddSparepart(Sparepart)`
- `GetServiceAsync(Guid)`, `ReceiveItem(Service)`, `UpdateRepairService(Service)`, `DeleteRepairService(Service)`
- `GetAsync(Guid)`, `DeleteService(Service)` — near-duplicate of `GetServiceAsync`/`DeleteRepairService`, check which is actually used before adding new repo methods.
