using TechnicalService.API.Apis;

namespace TechnicalService.API.Application.Queries;

public interface ITechnicalServiceQueries
{
    // Basic paginated queries
    Task<PagedResult<Service>> GetServicesAsync(int pageNumber, int pageSize);
    Task<PagedResult<Service>> GetAllServicesAsync();
    Task<PagedResult<Item>> GetItemsAsync(int pageNumber, int pageSize);
    Task<PagedResult<string>> GetUniqueItemNamesAsync(int? pageNumber, int? pageSize, string searchTerm);
    Task<PagedResult<string>> GetUniqueItemTypesAsync(int? pageNumber, int? pageSize, string searchTerm); // ⭐ ADD THIS
    Task<List<SparepartWithUsage>> GetSparePartsUsedInServicesAsync();
    Task<PagedResult<RentalItem>> GetRentalItemsAsync(int pageNumber, int pageSize);
    Task<PagedResult<RentalService>> GetRentalServicesAsync(int pageNumber, int pageSize);
    Task<PagedResult<SparepartUsageSummary>> GetSparepartUsageByDateRangeAsync(SparepartUsageQuery query);
    Task<PagedResult<SparepartHoldSummary>> GetSparepartHoldStatusAsync(SparepartHoldQuery query);

    // ── Stock transaction reporting ─────────────────────────────────────────
    // Transaction-level views over SparepartStockAuditLog. The usage report is
    // an aggregate and nets returns against issues; these show the movements
    // themselves, so a return is a line someone can read rather than a number
    // quietly cancelling another one.
    Task<PagedResult<SparepartTransactionRow>> GetSparepartTransactionsAsync(SparepartTransactionQuery query);
    Task<PagedResult<SparepartMovementSummary>> GetSparepartMovementSummaryAsync(SparepartTransactionQuery query);
    Task<PagedResult<SparepartDeadStockRow>> GetSparepartDeadStockAsync(SparepartTransactionQuery query);

    /// <summary>
    /// Detects stock-data inconsistencies: notifications sent for movements the
    /// ledger never recorded, ledgers implying impossible opening balances,
    /// duplicate catalogue names, negative stock, and returns with no matching
    /// issue. Read-only; it reports, it does not repair.
    /// </summary>
    Task<PagedResult<StockHealthIssue>> GetStockHealthAsync(SparepartTransactionQuery query);

    /// <summary>
    /// Explains, for a date range, why the stock-out notification count and the
    /// usage figure disagree: every deduction that was returned, including the
    /// ones that exist only as notifications and never reached the ledger.
    /// </summary>
    Task<StockReconciliationResult> GetStockReconciliationAsync(SparepartTransactionQuery query);

    // Search methods with advanced filtering
    Task<PagedResult<Item>> SearchItemsAsync(ItemSearchQuery query);
    Task<PagedResult<Sparepart>> SearchSparepartsAsync(SparepartSearchQuery query);
    Task<PagedResult<Service>> SearchServicesAsync(ServiceSearchQuery query);

    /// <summary>
    /// Same filters as <see cref="SearchServicesAsync"/>, four columns instead of 40.
    /// </summary>
    Task<PagedResult<ServiceSummary>> SearchServiceSummariesAsync(ServiceSearchQuery query);
    Task<PagedResult<RentalItem>> SearchRentalItemsAsync(RentalItemSearchQuery query);
    Task<PagedResult<RentalService>> SearchRentalServicesAsync(RentalServiceSearchQuery query);
    Task<List<CompanyStatusSummary>> GetMonthlyReportCompanySummaryAsync(
    DateTime fromDate, DateTime toDate, string? serviceLocation);

    // Dashboard
    Task<DashboardStats> GetDashboardStatsAsync();
    // Service metadata
    Task<IEnumerable<ServiceType>> GetServiceTypesAsync();
    Task<IEnumerable<ServicePriority>> GetServicePrioritiesAsync();
    Task<IEnumerable<ServiceStatus>> GetServiceStatusesAsync();

    // Single item queries
    Task<Service> GetServiceAsync(Guid id);
    Task<Item> GetItemAsync(Guid itemId);
    Task<Sparepart> GetSparepartAsync(Guid id);
    Task<RentalItem> GetRentalItemAsync(Guid id);
    Task<RentalService> GetRentalServiceAsync(Guid id);

    // Service workflow queries
    Task<IEnumerable<ReceiveItem>> GetReceiveItemsAsync();
    Task<IEnumerable<Service>> GetInpsectItemsAsync();
    Task<IEnumerable<Service>> GetAwaitingCustomerConfirmsAsync();

    // Rental item details
    Task<RentalItemDetail> GetRentalItemDetailAsync(Guid id);
    Task<IEnumerable<RentalItemDetail>> GetRentalItemsByDateAsync(DateTime? fromDate, DateTime? toDate);
    Task<IEnumerable<RentalItemDetail>> GetRentalItemsBySerialNumberAsync(string serialNo);

    // Annual Technical Performance Matrix
    Task<AnnualTechnicalMatrixDto> GetAnnualTechnicalMatrixAsync(int year);
}