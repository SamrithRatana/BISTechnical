namespace ServiceMaintenance.Infrastructure.Shared.Caching;
public static class CacheKeys
{
    // ── Dashboard ──────────────────────────────────
    public const string DashboardStats = "dashboard:statistics";
    public const string PrefixDashboardGrid = "dashboard:grid:";
    public static string DashboardGrid(string filter, int page, int size)
        => $"{PrefixDashboardGrid}{filter}:page{page}:size{size}";
    public static string DashboardGridPrefixForFilter(string filter)
        => $"{PrefixDashboardGrid}{filter}:";

    public const string PrefixMonthlyReport = "monthly-report:";

    // ── Prefix constants ──
    public const string PrefixReceiveItem = "receiveitem:";
    public const string PrefixInspectItem = "inspectitem:";
    public const string PrefixInspectionItem = "inspectionitem:";
    public const string PrefixRepairItem = "repairitem:";
    public const string PrefixAwaitCustomer = "awaitcustomer:";
    public const string PrefixAwaitSparePart = "awaitspare:";
    public const string PrefixFinishRepair = "finishrepair:";
    public const string PrefixCustomerReject = "customerreject:";
    public const string PrefixUnRepairable = "unrepairable:";
    public const string PrefixThirdParty = "thirdparty:";
    public const string PrefixSparePart = "sparepart:";
    public const string PrefixItemModule = "itemmodule:";
    public const string PrefixRentalInventory = "rentalinventory:";
    public const string PrefixRentalLogBook = "rentallogbook:";
    public const string PrefixSaleConfirmed = "saleconfirmed:";

    public const string PrefixSentSpareparts = "sentspareparts:";
    public const string PrefixCustomerReport = "customer-report:";

    public const string PrefixReportLookup = "report-lookup:";

    public const string ServiceStatuses = $"{PrefixReportLookup}service-statuses";
    public const string ServiceTypes = $"{PrefixReportLookup}service-types";
    public const string CustomerTypesAll = $"{PrefixReportLookup}customer-types";
    public const string AllUsersMap = $"{PrefixReportLookup}all-users";

    public const string CompanyNameToCustomerTypeMap = $"{PrefixReportLookup}company-to-customertype-map";

    public static string CustomersFirstPage(int pageSize)
        => $"{PrefixReportLookup}customers:page1:size{pageSize}";

    public static string SparePartsFirstPage(int pageSize)
        => $"{PrefixReportLookup}spareparts:page1:size{pageSize}";

    public const string MonthlyReportUsersMap = $"{PrefixReportLookup}monthly-users-lastname";
    public const string MonthlyReportCustomerTypesDefault = $"{PrefixReportLookup}monthly-customer-types";

    // ── Customer Center (customers + customer types) ──────────────
    public const string PrefixCustomerCenter = "customercenter:";
    public const string PrefixCustomerCenterCustomers = "customercenter:customers:";
    public const string PrefixCustomerCenterTypes = "customercenter:types:";
    public const string CustomerCenterAllTypes = $"{PrefixCustomerCenterTypes}all-active";

    public static string CustomerList() => $"{PrefixReportLookup}customers:list:top50";
    public static string ItemList() => $"{PrefixReportLookup}items:list:top50";

    // ── Per-page keys ──
    public static string ReceiveItem(int page, int size) => $"receiveitem:page{page}:size{size}";
    public static string InspectItem(int page, int size) => $"inspectitem:page{page}:size{size}";
    public static string InspectionItem(int page, int size) => $"inspectionitem:page{page}:size{size}";
    public static string RepairItem(int page, int size) => $"repairitem:page{page}:size{size}";
    public static string AwaitCustomer(int page, int size) => $"awaitcustomer:page{page}:size{size}";
    public static string AwaitSparePart(int page, int size) => $"awaitspare:page{page}:size{size}";
    public static string FinishRepair(int page, int size) => $"finishrepair:page{page}:size{size}";
    public static string CustomerReject(int page, int size) => $"customerreject:page{page}:size{size}";
    public static string UnRepairable(int page, int size) => $"unrepairable:page{page}:size{size}";
    public static string ThirdParty(int page, int size) => $"thirdparty:page{page}:size{size}";
    public static string SparePart(int page, int size) => $"sparepart:page{page}:size{size}";
    public static string ItemModule(int page, int size) => $"itemmodule:page{page}:size{size}";
    public static string RentalInventory(int page, int size) => $"rentalinventory:page{page}:size{size}";
    public static string RentalLogBook(int page, int size) => $"rentallogbook:page{page}:size{size}";
    public static string SentSpareparts(int page, int size) => $"{PrefixSentSpareparts}page{page}:size{size}";
    public static string SaleConfirmed(int page, int size) => $"{PrefixSaleConfirmed}page{page}:size{size}";
    public static string SparePartById(Guid id) => $"{PrefixSparePart}byid:{id}";

    // ✅ UPDATED — missingTypeOnly added as a distinct key segment so
    // toggling the "Missing Type Only" checkbox on/off never collides
    // with the non-filtered cache entry.
    public static string CustomerCenterPage(int page, int size, string searchTerm, bool? isActive, bool? missingTypeOnly = null)
        => $"{PrefixCustomerCenterCustomers}page{page}:size{size}:search{(string.IsNullOrEmpty(searchTerm) ? "none" : searchTerm.ToLowerInvariant())}:active{(isActive.HasValue ? isActive.Value.ToString() : "all")}:missing{(missingTypeOnly.HasValue ? missingTypeOnly.Value.ToString() : "all")}";

    public static string CustomerCenterTypesPage(int page, int size, string searchTerm, bool? isActive)
        => $"{PrefixCustomerCenterTypes}page{page}:size{size}:search{(string.IsNullOrEmpty(searchTerm) ? "none" : searchTerm.ToLowerInvariant())}:active{(isActive.HasValue ? isActive.Value.ToString() : "all")}";

    public static string MonthlyReport(DateTime from, DateTime to, string serviceLocation, string customerType)
        => $"{PrefixMonthlyReport}{from:yyyyMMdd}:{to:yyyyMMdd}:{serviceLocation}:{customerType}";

    public static string CustomerReport(string company, string serial, string status, string fromDate, string toDate, bool exactMatch)
        => $"{PrefixCustomerReport}company{company}:serial{serial}:status{status}:from{fromDate}:to{toDate}:exact{exactMatch}";
}