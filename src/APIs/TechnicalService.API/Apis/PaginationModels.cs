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
        TotalPages = (int)Math.Ceiling(count / (double)pageSize);
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
    string[]? CompanyNames = null   // ✅ NEW — filter to a specific set of companies
                                    // (used by the monthly report detail-grid,
                                    // to pull only the rows belonging to one
                                    // CustomerType group, server-side + paginated)
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