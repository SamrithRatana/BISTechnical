namespace ServiceMaintenance.Models;

// ══════════════════════════════════════════════════════════════════════════
// 📁 PROJECT: ServiceMaintenance.Models (or wherever Repairs.cs / RepairServices.cs
//             already live on the Blazor side — this mirrors the API's
//             ActivityLogQuery / ActivityLogDto records shape so JSON deserializes
//             cleanly through HttpClient).
// ══════════════════════════════════════════════════════════════════════════

public class ActivityLogQuery
{
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
    public string? EntityType { get; set; }
    public string? Action { get; set; }
    public string? SearchTerm { get; set; }
}

public class ActivityLogDto
{
    public string Action { get; set; } = "";
    public string EntityType { get; set; } = "";
    public Guid EntityId { get; set; }
    public string? DocumentNo { get; set; }
    public string? Details { get; set; }
    public Guid UserId { get; set; }
    public string? UserName { get; set; }
    public DateTime Timestamp { get; set; }
}

// ══════════════════════════════════════════════════════════════════════════
// ⚠️ Only add this if ServiceMaintenance.Models does NOT already define a
// PagedResult<T> somewhere (it almost certainly does already, since
// RepairItemService.SearchRepairServicesAsync() already returns one that
// ReceiveItemList.razor consumes via result.Items / .TotalPages / .TotalCount).
//
// If it already exists — DELETE this class and just add:
//   using <that namespace>;
// to ActivityLogService.cs instead. Do NOT add a project reference to
// TechnicalService.API from the Blazor client to "fix" the missing type —
// that pulls EF Core / MediatR / ASP.NET Core hosting into the client
// unnecessarily and breaks Blazor WASM entirely if this is WASM.
// ══════════════════════════════════════════════════════════════════════════
public class PagedResult<T>
{
    public PagedResult(List<T> items, int totalCount, int pageNumber, int pageSize)
    {
        Items = items;
        TotalCount = totalCount;
        PageNumber = pageNumber;
        PageSize = pageSize;
        TotalPages = pageSize > 0 ? (int)Math.Ceiling(totalCount / (double)pageSize) : 0;
    }

    public List<T> Items { get; set; }
    public int TotalCount { get; set; }
    public int PageNumber { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
}