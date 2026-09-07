using Microsoft.AspNetCore.Mvc;
using TechnicalService.Domain.AggregatesModel.RentalAggregate;

namespace TechnicalService.API.Application.Queries;

public record Sparepart
{
    public Guid Id { get; init; }
    public string ItemName { get; init; }
    public string SerialNumber { get; init; }
    public string Description { get; init; }
    public string UseFor { get; init; }
    public string PictureUrl { get; init; }
    public Guid LinkItemId { get; init; }
    public int Quantity { get; init; }
    public decimal DefaultPrice { get; init; }

    // Classification — all null for parts that have not been classified yet.
    // Names and the brand logo are projected alongside the ids so the list
    // can render them without a second lookup per row.
    public Guid? CategoryId { get; init; }
    public string? CategoryName { get; init; }
    public Guid? TypeId { get; init; }
    public string? TypeName { get; init; }
    public Guid? BrandId { get; init; }
    public string? BrandName { get; init; }
    public string? BrandLogoUrl { get; init; }
}
public record SparepartWithUsage
{
    public Guid Id { get; init; }
    public string ItemName { get; init; }
    public string SerialNumber { get; init; }
    public string Description { get; init; }
    public string UseFor { get; init; }
    public string PictureUrl { get; init; }
    public Guid LinkItemId { get; init; }
    public int Quantity { get; init; }
    public int UsageCount { get; init; }      // times used in services
    public int TotalQtyUsed { get; init; }    // total qty consumed
}
public record SparepartItem
{
    public Guid Id { get; init; }           // spare part ITEM id (not sparepart id)
    public Guid SparepartId { get; init; }
    public string Description { get; init; }
    public int Quantity { get; init; }
    public string Condition { get; init; }
    public bool IsHoldStatus { get; init; } = false;
    public string Remarks { get; init; }
    public DateTime? RemarksUpdatedAt { get; init; }

}

public record Service
{
    public Guid Id { get; init; }
    public Guid CustomerId { get; init; }
    public string ReportNo { get; init; }
    public DateTime ServiceDate { get; init; }
    public string CompanyName { get; init; }
    public string Address { get; init; }
    public string ContactName { get; init; }
    public string PhoneNumber { get; init; }
    public Guid? ItemId { get; init; }
    public string ItemName { get; init; }
    public string SerialNumber { get; init; }
    public string CustomerRequest { get; init; }
    public string Inspection { get; init; }
    public string Solution { get; init; }
    public string ServiceLocation { get; init; }
    public string ServiceType { get; init; }
    public int? ServiceTypeId { get; init; }
    public string ServicePriority { get; init; }
    public int? ServicePriorityId { get; init; }
    public string Status { get; init; }
    public int? StatusId { get; init; }
    public bool HasContract { get; init; }
    public Guid? CreateBy { get; init; }
    public DateTime? InspectDate { get; init; }
    public Guid? InspectBy { get; init; }

    public Guid? InspectingBy { get; init; }
    public DateTime? InspectingDate { get; init; }

    public DateTime? UnrepairableDate { get; init; }
    public Guid? SetUnrepairableBy { get; init; }
    public DateTime? CustomerRejectedDate { get; init; }
    public Guid? SetCustomerRejectedBy { get; init; }
    public DateTime? AwaitingCustomerConfirmDate { get; init; }
    public Guid? SetAwaitingCustomerConfirmBy { get; init; }
    public DateTime? AwaitingSparepartDate { get; init; }
    public Guid? SetAwaitingSparepartBy { get; init; }
    public DateTime? RepairDate { get; init; }
    public Guid? RepairBy { get; init; }
    public DateTime? ThirdPartyRepairDate { get; init; }
    public Guid? ThirdPartyRepairBy { get; init; }
    public bool IsThirdPartyRepair { get; init; }
    public DateTime? FinishedDate { get; init; }
    public Guid? VerifiedBy { get; init; }

    public DateTime? SaleConfirmedDate { get; init; }
    public Guid? SetSaleConfirmedBy { get; init; }

    public DateTime? SentSparepartsDate { get; init; }
    public Guid? SetSentSparepartsBy { get; init; }

    public List<SparepartItem> SparepartItems { get; set; }
}
public record SparepartUsageSummary
{
    public Guid SparepartId { get; init; }
    public string ItemName { get; init; }
    public string SerialNumber { get; init; }
    public int StockQuantity { get; init; }
    public int UsedQuantity { get; init; }
    public int ServiceUsedQty { get; init; }       // ← ADD
    public int ManualUsedQty { get; init; }        // ← ADD
    public int UsageCount { get; init; }
    public int ServiceUsageCount { get; init; }
    public int ManualStockOutCount { get; init; }
    public List<string> Conditions { get; init; } = new();
    public List<UsageServiceInfo> Services { get; set; } = new();

}
/// <summary>
/// One row of the stock transaction ledger — a single movement exactly as the
/// trigger recorded it, not an aggregate.
///
/// This is deliberately transaction-level where <see cref="SparepartUsageSummary"/>
/// is part-level. The usage report answers "how much was consumed"; it nets
/// returns against issues, which is correct for consumption but means a return
/// is invisible unless it pushes the total negative. Roughly 100 units came back
/// to stock in the last six months without ever appearing as a line anyone could
/// read. This row type is what makes each of those visible.
/// </summary>
public record SparepartTransactionRow
{
    public Guid Id { get; init; }
    public DateTime Timestamp { get; init; }
    public Guid SparepartId { get; init; }
    public string ItemName { get; init; }
    public string SerialNumber { get; init; }
    public string? PictureUrl { get; init; }

    /// <summary>The trigger's own label: STOCK_IN or STOCK_OUT.</summary>
    public string OperationType { get; init; }

    /// <summary>Signed, as stored: negative left the shelf, positive returned.</summary>
    public int QuantityChange { get; init; }

    /// <summary>Unsigned magnitude, for a column a storekeeper reads at a glance.</summary>
    public int Quantity { get; init; }

    /// <summary>"In" or "Out", derived from the sign.</summary>
    public string Direction { get; init; }

    /// <summary>
    /// "Service" (tied to a repair ticket), "Manual" (a manual stock-out) or
    /// "Adjustment" (a direct edit of the catalogue quantity).
    /// </summary>
    public string Source { get; init; }

    /// <summary>
    /// Stock level immediately after this movement. Verified consistent
    /// (NewQuantity == OldQuantity + QuantityChange) on all 3,226 ledger rows,
    /// so it is a genuine running balance rather than a decorative column.
    /// </summary>
    public int BalanceAfter { get; init; }
    public int BalanceBefore { get; init; }

    public Guid? ServiceId { get; init; }
    public string ReportNo { get; init; }
    public string CompanyName { get; init; }
    public string ServiceStatus { get; init; }
    public string Reason { get; init; }

    /// <summary>
    /// True when this movement was undone by an opposite movement on the same
    /// ticket and part later the same day.
    ///
    /// This is what reconciles the Telegram feed with the usage report. On
    /// 2026-08-18 Telegram showed 12 stock-out messages and the report showed
    /// 9; the difference was exactly three deductions that were reversed within
    /// hours. Telegram cannot retract a message — `StockNotificationOutbox` has
    /// no MessageId column, so the worker has nothing to call deleteMessage
    /// with — and the reversals were posted to the separate "Stock In" topic,
    /// so the Stock Out feed still reads as 12.
    ///
    /// Flagging the pair here means the ledger explains that discrepancy on its
    /// own, instead of it looking like three units of missing stock.
    /// </summary>
    public bool ReversedLater { get; init; }

    /// <summary>True when this movement is itself the reversal of an earlier one.</summary>
    public bool IsReversal { get; init; }
}

/// <summary>
/// One detected inconsistency in the stock data.
///
/// This exists because the failures found by hand on 2026-08-19 were all
/// invisible until someone went looking: 8 Telegram notifications for movements
/// the ledger never recorded, a part whose ledger implies a negative opening
/// balance, and 30 catalogue rows sharing the name "Fuser Film Sleeve" — which
/// is what let a technician pick the wrong one and produce two contradictory
/// stock messages for the same ticket.
///
/// None of those were caught by anything. Turning them into a page someone can
/// open is the actual protection against "lost transactions": not preventing
/// the fault, which needs the trigger bodies, but ensuring it cannot sit
/// undetected for months.
/// </summary>
public record StockHealthIssue
{
    /// <summary>
    /// `OrphanNotification`, `LedgerMismatch`, `DuplicateName`, `NegativeStock`
    /// or `OrphanRestore`.
    /// </summary>
    public string Category { get; init; }

    /// <summary>`high` | `medium` | `low`.</summary>
    public string Severity { get; init; }

    public Guid? SparepartId { get; init; }
    public string ItemName { get; init; }
    public string SerialNumber { get; init; }

    /// <summary>Human-readable statement of what is wrong.</summary>
    public string Detail { get; init; }

    /// <summary>Where relevant: what the number should be, and what it is.</summary>
    public int? Expected { get; init; }
    public int? Actual { get; init; }

    /// <summary>When the offending movement happened, where there is one.</summary>
    public DateTime? OccurredAt { get; init; }
    public string ReportNo { get; init; }
}

/// <summary>
/// One stock movement that was undone — a deduction with a matching return.
///
/// This is the row that explains why a Telegram feed and a usage report can
/// both be correct and still disagree. On 2026-08-18 the outbox sent 12
/// stock-out notifications while the report showed 9 consumed; the gap was
/// exactly three deductions returned within hours. Telegram cannot retract a
/// message (`StockNotificationOutbox` has no MessageId column), and the returns
/// were posted to the separate "Stock In" topic, so the Stock Out feed still
/// reads 12 forever.
/// </summary>
public record StockReconciliationRow
{
    public Guid SparepartId { get; init; }
    public string ItemName { get; init; }
    public string SerialNumber { get; init; }
    public int Quantity { get; init; }

    /// <summary>When the stock left the shelf.</summary>
    public DateTime OutAt { get; init; }

    /// <summary>When it came back.</summary>
    public DateTime ReturnedAt { get; init; }

    /// <summary>Minutes the stock was actually out — usually small for a correction.</summary>
    public int MinutesOut { get; init; }

    /// <summary>Plain-language cause, read from the return's own trigger text.</summary>
    public string Why { get; init; }

    public string ReportNo { get; init; }

    /// <summary>
    /// False when this pair exists only in `StockNotificationOutbox` and never
    /// reached `SparepartStockAuditLog` — a notification was sent for a
    /// movement the ledger has no record of. These are the "lost" ones, and
    /// they are the reason this report reads both tables rather than just the
    /// ledger.
    /// </summary>
    public bool RecordedInLedger { get; init; }
}

/// <summary>
/// The reconciliation answer for a period: the headline counts plus every
/// cancelled-out pair behind them.
/// </summary>
public record StockReconciliationResult
{
    /// <summary>Stock-out notifications sent — what the Telegram feed shows.</summary>
    public int NotificationsSent { get; init; }

    /// <summary>Stock-out movements the ledger recorded.</summary>
    public int LedgerStockOut { get; init; }

    /// <summary>Net units consumed — what the usage report shows.</summary>
    public int ReportedUsage { get; init; }

    /// <summary>Deductions that were returned, and so cancel out.</summary>
    public int ReversedPairs { get; init; }

    /// <summary>Notifications with no ledger row at all.</summary>
    public int UnrecordedMovements { get; init; }

    public List<StockReconciliationRow> Rows { get; init; } = new();
}

/// <summary>
/// Per-part reconciliation over a period: what the shelf held at the start,
/// what moved, and what it should hold at the end.
/// </summary>
public record SparepartMovementSummary
{
    public Guid SparepartId { get; init; }
    public string ItemName { get; init; }
    public string SerialNumber { get; init; }

    /// <summary>Balance immediately before the first movement in the window.</summary>
    public int OpeningBalance { get; init; }
    public int TotalIn { get; init; }
    public int TotalOut { get; init; }
    public int NetChange { get; init; }

    /// <summary>Balance after the last movement in the window.</summary>
    public int ClosingBalance { get; init; }

    /// <summary>Live catalogue quantity, for spotting drift after the window.</summary>
    public int CurrentStock { get; init; }
    public int MovementCount { get; init; }
}

/// <summary>
/// A part holding stock that nothing has touched for a while — capital sitting
/// on a shelf. Deliberately carries no monetary value: `Spareparts.DefaultPrice`
/// is 0.00 on all 666 catalogue rows, so a valuation column would read zero
/// everywhere and imply the stock is worthless rather than unpriced.
/// </summary>
public record SparepartDeadStockRow
{
    public Guid SparepartId { get; init; }
    public string ItemName { get; init; }
    public string SerialNumber { get; init; }
    public int Quantity { get; init; }
    public int HeldQuantity { get; init; }

    /// <summary>Null when the part has NO movement on record at all.</summary>
    public DateTime? LastMovement { get; init; }
    public int? DaysSinceMovement { get; init; }
}

public class UsageServiceInfo
{
    public Guid ServiceId { get; set; }
    public string ReportNo { get; set; }
    public string CompanyName { get; set; }
    public string ServiceStatus { get; set; }
    public int Quantity { get; set; }
    public string Condition { get; set; }
    public string ServiceType { get; set; }
    public DateTime? ProcessDate { get; set; }
    public string Source { get; set; }
    public string Reason { get; set; }
    public string ItemSerialNumber { get; set; }  // sparepart serial (existing)
    public string MachineItemName { get; set; }      // ← ADD: machine/device name
    public string MachineSerialNumber { get; set; }  // ← ADD: machine serial number
}
/// <summary>
/// Query parameters for GET /api/spareparts/usage
/// Add this class to your Queries folder (or wherever SparepartUsageQuery is currently defined).
/// Replace the existing class entirely.
/// </summary>
public class SparepartUsageQuery
{
    public int? PageNumber { get; set; }
    public int? PageSize { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
    public string? SearchTerm { get; set; }
    public string? Status { get; set; }
    public string? SortBy { get; set; }
    public bool? SortDescending { get; set; }
    public bool? IncludeManualStockOut { get; set; }
    public string? ServiceType { get; set; }
    public string? Condition { get; set; }
    public bool? IsHoldStatus { get; set; }
    public string? DateMode { get; set; }
    public string? SourceFilter { get; set; }
}

/// <summary>
/// Query parameters for GET /api/spareparts/transactions, /movement-summary
/// and /dead-stock.
///
/// ── EVERY member here is nullable, and that is not cosmetic ────────────────
///
/// `SparepartUsageQuery` above declares its strings as non-nullable, and with
/// nullable reference types on, minimal APIs bind those as REQUIRED. Omit any
/// one of them and the endpoint throws `BadHttpRequestException`, which the
/// exception handler renders as a **500**, not a 400 — so it reads like a
/// server fault rather than a missing parameter. `services/reports.ts` carries a
/// comment about having to send the full parameter set on every call because of
/// exactly this.
///
/// The trap is wider than strings, which is worth stating plainly because the
/// first version of this class fell into it: `[AsParameters]` binds a
/// non-nullable VALUE type as required as well, and **a property initializer
/// does not exempt it**. `public int PageNumber { get; set; } = 1;` still 500s
/// when the caller omits `pageNumber` — the default never gets a chance to
/// apply. Only `int?` / `bool?` are genuinely optional, so the defaults live in
/// the query methods instead, where they actually run.
/// </summary>
public class SparepartTransactionQuery
{
    public int? PageNumber { get; set; }
    public int? PageSize { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }

    /// <summary>Matches part name, part serial, ticket report no or company.</summary>
    public string? SearchTerm { get; set; }

    /// <summary>"In", "Out", or null/"All".</summary>
    public string? Direction { get; set; }

    /// <summary>"Service", "Manual", "Adjustment", or null/"All".</summary>
    public string? Source { get; set; }

    /// <summary>
    /// Tracking-only rows carry `QuantityChange = 0` and exist for audit
    /// visibility — 2,227 of the 3,226 ledger rows. They are excluded by
    /// default because summing them distorts nothing but reading them as
    /// movements does; the ledger page can opt them back in. Defaults to false
    /// in the query method.
    /// </summary>
    public bool? IncludeTrackingRows { get; set; }

    /// <summary>
    /// Only for the dead-stock report. Days of inactivity to qualify; defaults
    /// to 90 in the query method.
    /// </summary>
    public int? IdleDays { get; set; }

    public string? SortBy { get; set; }

    /// <summary>Defaults to true (newest first) in the query method.</summary>
    public bool? SortDescending { get; set; }
}

public class SparepartHoldSummary
{
    public Guid SparepartId { get; set; }
    public string ItemName { get; set; }
    public string SerialNumber { get; set; }
    public int CurrentStock { get; set; }
    public int TotalHoldQty { get; set; }
    public int HoldCount { get; set; }
    public List<HoldServiceInfo> Services { get; set; } = new();
}

public class HoldServiceInfo
{
    public Guid? ServiceId { get; set; }
    public string ReportNo { get; set; }
    public string CompanyName { get; set; }
    public string ServiceStatus { get; set; }
    public int Quantity { get; set; }
    public string Condition { get; set; }
}

public class SparepartHoldResult
{
    public List<SparepartHoldSummary> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int TotalHoldQty { get; set; }
    public int TotalHoldJobs { get; set; }
    public int PageNumber { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
}
public class SparepartHoldQuery
{
    public int? PageNumber { get; set; } = 1;
    public int? PageSize { get; set; } = 15;
    public string? SearchTerm { get; set; }
    public string? Status { get; set; }
    public string? ServiceType { get; set; }
    public string? SortBy { get; set; } = "holdqty";
    public bool? SortDescending { get; set; } = true;
}

public record Item
{
    public Guid Id { get; init; }
    public string ItemName { get; init; }
    public string SerialNumber { get; init; }
    public string ItemType { get; init; }
}

public record ReceiveItem
{
    public Guid Id { get; init; }
    //public Guid CustomerId { get; init; }
    public string CompanyName { get; init; }
    public string Address { get; init; }
    public string ContactName { get; init; }
    public string PhoneNumber { get; init; }
    public bool HasContract { get; init; }
    public DateTime ServiceDate { get; init; }
    public string ReportNo { get; init; }
    public string ServiceLocation { get; init; }
    //public int ServicePriorityId { get; private set; }
    public string ServicePriority { get; init; }
    //public Guid ItemId { get; private set; }
    public string CustomerRequest { get; init; }
    //public Guid CreateBy { get; private set; }
}

public record ServiceType
{
    public int Id { get; init; }
    public string Name { get; init; }
}

public record ServicePriority(int Id, string Name);

public record ServiceStatus(int Id, string Name);

public record RentalItem
{
    public Guid Id { get; init; }
    public Guid CreateBy { get; init; }
    public Guid CustomerId { get; init; }
    public string CustomerName { get; init; }
    public string ItemName { get; init; }
    public string SerialNumber { get; init; }
    public string Condition { get; init; }
    public string Location { get; init; }
    public int Duration { get; init; }
}

public record RentalService
{
    public Guid Id { get; init; }
    public Guid RentalItemId { get; init; }
    public DateTime Date { get; init; }
    public string Action { get; init; }
    public string Note { get; init; }
    public Guid UserId { get; init; }
    public List<SparepartItem> Spareparts { get; init; }
}

public record RentalItemDetail
{     
    public Guid Id { get; init; }
    public Guid CreateBy { get; init; }
    public string CustomerName { get; init; }
    public string ItemName { get; init; }
    public string SerialNumber { get; init; }
    public string Condition { get; init; }
    public string Location { get; init; }
    public int Duration { get; init; }
    public List<RentalService> RentalServices { get; init; }
}
public record ActivityLogQuery(
    int PageNumber = 1,
    int PageSize = 20,
    DateTime? FromDate = null,
    DateTime? ToDate = null,
    string? EntityType = null,
    string? Action = null,
    string? SearchTerm = null);

public class ActivityLogDto
{
    public string Action { get; set; } = "";
    public string EntityType { get; set; } = "";
    public Guid? EntityId { get; set; }
    public string? DocumentNo { get; set; }
    public string? Details { get; set; }
    public Guid? UserId { get; set; }
    public string? UserName { get; set; }
    public DateTime Timestamp { get; set; }
}

public record AnnualTechnicalMatrixDto(
    int[] MachineIn,
    int[] MachineOut,
    int[] Unrepairable,
    int[] AwaitingConfirm,
    int[] OnsiteService
);