#nullable enable
namespace TechnicalService.API.Apis;

// Pagination models
public record PaginationQuery(int PageNumber = 1, int PageSize = 10);

public record PagedResult<T>
{
    public IEnumerable<T> Items { get; init; }
    public int PageNumber { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages { get; init; }
    public int TotalUsedQuantity { get; set; }
    public int TotalHoldQty { get; set; }   // ← ADD
    public int TotalHoldJobs { get; set; }   // ← ADD
    public int TotalServiceUsedQuantity { get; set; }  // ← ADD
    public int TotalManualUsedQuantity { get; set; }   // ← ADD
    public bool HasPreviousPage => PageNumber > 1;
    public bool HasNextPage => PageNumber < TotalPages;
    public PagedResult(IEnumerable<T> items, int count, int pageNumber, int pageSize)
    {
        Items = items;
        TotalCount = count;
        PageNumber = pageNumber;
        PageSize = pageSize;

        // Backstop for the division: a pageSize of 0 made this Math.Ceiling(x/0.0),
        // i.e. infinity, and the cast to int is unchecked - TotalPages came back
        // as int.MinValue rather than throwing. Callers are clamped by
        // Pagination.Size(), but this type is public and constructed directly.
        TotalPages = pageSize > 0
            ? (int)Math.Ceiling(count / (double)pageSize)
            : 0;
    }
}
// Search query models
public record ItemSearchQuery(
    int PageNumber = 1,
    int PageSize = 10,
    string? SearchTerm = null,
    string? ItemType = null,
    string? SortBy = "ItemName", // ItemName, SerialNumber, ItemType
    bool SortDescending = false);

public record SparepartSearchQuery(
    int PageNumber = 1,
    int PageSize = 10,
    string? SearchTerm = null,
    Guid? LinkItemId = null,
    string? SortBy = "ItemName",
    bool SortDescending = false);
public record CompanyStatusSummary
{
    public string CompanyName { get; init; } = "";
    public int FinishedCount { get; init; }
    public int CustomerRejectedCount { get; init; }
    public int UnrepairableCount { get; init; }
    public int TotalCount { get; init; }
}
/// <summary>
/// The dashboard's stat tiles, in one round trip.
///
/// The UI used to derive these by issuing one full ticket search per tile with
/// <c>pageSize=1</c> and reading <c>TotalCount</c> off each — four filtered
/// scans of Services plus four row projections, to render four integers. This
/// is the same numbers as a single grouped count.
/// </summary>
public record DashboardStats
{
    /// <summary>Tickets whose ServiceDate falls on today's date.</summary>
    public int TodayCount { get; init; }
    /// <summary>Tickets currently in status "Item Recieved" (DB's spelling).</summary>
    public int ReceivedCount { get; init; }
    /// <summary>Tickets currently in status "Awaiting Customer Confirm".</summary>
    public int WaitingCustomerCount { get; init; }
    /// <summary>Tickets currently in status "Awaiting Sparepart".</summary>
    public int WaitingSpareCount { get; init; }
    /// <summary>Tickets currently in status "Finished", all time.</summary>
    public int FinishedCount { get; init; }
    /// <summary>Tickets whose FinishedDate falls in the current calendar month.</summary>
    public int FinishedThisMonthCount { get; init; }
}

/// <summary>
/// The four columns a chart needs off a ticket.
/// </summary>
/// <remarks>
/// A distinct type rather than a sparsely-filled <c>Service</c>, because a DTO
/// carries its key names onto the wire whether or not the values are set:
/// returning a Service with 37 of its 40 properties null still measured 379 KB
/// for 400 rows, against 757 KB for the full row. The names were the payload.
/// </remarks>
public record ServiceSummary(
    Guid Id,
    DateTime ServiceDate,
    DateTime? FinishedDate,
    string Status
);

public record ServiceSearchQuery(
    int PageNumber = 1,
    int PageSize = 10,
    string? SearchTerm = null,
    string? SerialNumber = null,
    string? ServiceLocation = null,
    string? Status = null,
    string? ServiceType = null,
    DateTime? FromDate = null,
    DateTime? ToDate = null,
    bool? HasContract = null,
    string? DateFilter = null,
    string? StatusFilter = null,
    string? SortBy = "ServiceDate",
    bool SortDescending = true,
    bool UseProcessDateFiltering = false,
    string[]? StatusesForProcessFiltering = null,
    string[]? ExcludedStatuses = null,
    Guid[]? UserIds = null,
    string[]? UserFilterStatuses = null,
    bool ForceServiceDateOnly = false,
    // Filter to a specific set of companies: used by the monthly report
    // detail-grid to pull only the rows belonging to one CustomerType group,
    // server-side and paginated.
    string[]? CompanyNames = null,

    /// <summary>
    /// Whether to run the COUNT that fills <c>TotalCount</c>.
    /// </summary>
    /// <remarks>
    /// The UI loads these lists by infinite scroll, so a single filter produces
    /// one request per scroll batch — and each one re-counted the *entire*
    /// filtered set, which does not change between batches. On a status like
    /// "Finished" that is a second pass over 3,200+ rows for a number the
    /// client already has.
    ///
    /// Callers pass false for batches after the first and keep the total they
    /// were given. Default true, so any caller that does not know about this
    /// (Swagger, the AI search route, the old Blazor app) behaves exactly as
    /// before.
    ///
    /// When false, <c>TotalCount</c> comes back as 0 — meaning "not computed",
    /// which the client already treats as "keep the previous value".
    /// </remarks>
    bool IncludeTotalCount = true,

    /// <summary>
    /// Which shape of row to return. <c>null</c> (the default) is the full
    /// 44-field ticket; <c>"summary"</c> is the four fields a chart needs.
    /// </summary>
    /// <remarks>
    /// The dashboard's sparklines sample the 400 most recent tickets and read
    /// exactly three fields off them — status, and the two dates. It was being
    /// served the whole ticket, including every SparepartItem sub-row:
    /// measured against the live API, 901 KB of which 39 KB was ever read, and
    /// 85 KB of it spare-part lines the dashboard does not render.
    ///
    /// Added as an opt-in parameter rather than a new endpoint because the
    /// filtering, paging and sorting are identical — only the projection
    /// differs, and duplicating this method to change one Select is how the
    /// three existing copies of it drifted apart.
    ///
    /// Nullable and last, so every existing caller binds exactly as before.
    /// </remarks>
    string? Projection = null
);
public class MonthlyReportSummaryQuery
{
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public string? ServiceLocation { get; set; }
}


public record RentalItemSearchQuery(
    int PageNumber = 1,
    int PageSize = 10,
    string? SearchTerm = null, // Search in CustomerName, ItemName, SerialNumber
    string? Condition = null,
    string? Location = null,
    Guid? CustomerId = null,
    string? SortBy = "CreatedAt",
    bool SortDescending = true);

public record RentalServiceSearchQuery(
    int PageNumber = 1,
    int PageSize = 10,
    Guid? RentalItemId = null,
    string? Action = null,
    DateTime? FromDate = null,
    DateTime? ToDate = null,
    Guid? UserId = null,
    string? SortBy = "Date",
    bool SortDescending = true);