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
    Task<PagedResult<Sparepart>> GetSparepartsAsync(int pageNumber, int pageSize);
    Task<List<SparepartWithUsage>> GetSparePartsUsedInServicesAsync();
    Task<PagedResult<RentalItem>> GetRentalItemsAsync(int pageNumber, int pageSize);
    Task<PagedResult<RentalService>> GetRentalServicesAsync(int pageNumber, int pageSize);
    Task<PagedResult<SparepartUsageSummary>> GetSparepartUsageByDateRangeAsync(SparepartUsageQuery query);
    Task<PagedResult<SparepartHoldSummary>> GetSparepartHoldStatusAsync(SparepartHoldQuery query);

    // Search methods with advanced filtering
    Task<PagedResult<Item>> SearchItemsAsync(ItemSearchQuery query);
    Task<PagedResult<Sparepart>> SearchSparepartsAsync(SparepartSearchQuery query);
    Task<PagedResult<Service>> SearchServicesAsync(ServiceSearchQuery query);
    Task<PagedResult<RentalItem>> SearchRentalItemsAsync(RentalItemSearchQuery query);
    Task<PagedResult<RentalService>> SearchRentalServicesAsync(RentalServiceSearchQuery query);
    Task<List<CompanyStatusSummary>> GetMonthlyReportCompanySummaryAsync(
    DateTime fromDate, DateTime toDate, string? serviceLocation);
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

}