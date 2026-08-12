using System.Net.Http.Json;
using System.Web;
using ServiceMaintenance.Models;
namespace ServiceMaintenance.Services;
// ══════════════════════════════════════════════════════════════════════════
// 📁 PROJECT: ServiceMaintenance (Blazor) — put in Services/BISServices/,
//             next to ReceiveItemService.cs / ItemService.cs
//
// Register in Program.cs like your other typed HttpClients, e.g.:
//   builder.Services.AddHttpClient<ActivityLogService>(client =>
//       client.BaseAddress = new Uri(apiBaseUrl));
// ══════════════════════════════════════════════════════════════════════════
public class ActivityLogService
{
    private readonly HttpClient _httpClient;
    public ActivityLogService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }
    public async Task<PagedResult<ActivityLogDto>> SearchActivityLogsAsync(ActivityLogQuery query)
    {
        var qs = HttpUtility.ParseQueryString(string.Empty);
        qs["pageNumber"] = query.PageNumber.ToString();
        qs["pageSize"] = query.PageSize.ToString();
        if (query.FromDate.HasValue) qs["fromDate"] = query.FromDate.Value.ToString("yyyy-MM-dd");
        if (query.ToDate.HasValue) qs["toDate"] = query.ToDate.Value.ToString("yyyy-MM-dd");
        if (!string.IsNullOrWhiteSpace(query.EntityType)) qs["entityType"] = query.EntityType;
        if (!string.IsNullOrWhiteSpace(query.Action)) qs["action"] = query.Action;
        if (!string.IsNullOrWhiteSpace(query.SearchTerm)) qs["searchTerm"] = query.SearchTerm;
        qs["api-version"] = ServiceMaintenance.Configuration.ApiConfiguration.ApiVersion; // ✅ ADDED — this API uses versioned endpoints (NewVersionedApi), every request needs this or it 400s
        var response = await _httpClient.GetFromJsonAsync<PagedResult<ActivityLogDto>>(
            $"api/activitylogs?{qs}");
        return response ?? new PagedResult<ActivityLogDto>(new List<ActivityLogDto>(), 0, query.PageNumber, query.PageSize);
    }
}