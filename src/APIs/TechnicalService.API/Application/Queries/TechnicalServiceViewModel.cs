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
    public decimal DefaultPrice { get; init; } // ✅ ADD THIS
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
    public int UsageCount { get; init; }      // ✅ times used in services
    public int TotalQtyUsed { get; init; }    // ✅ total qty consumed
}
public record SparepartItem
{
    public Guid Id { get; init; }           // spare part ITEM id (not sparepart id)
    public Guid SparepartId { get; init; }
    public string Description { get; init; }
    public int Quantity { get; init; }
    public string Condition { get; init; }
    public bool IsHoldStatus { get; init; } = false; // ✅ NEW
    public string Remarks { get; init; } // ✅ NEW
    public DateTime? RemarksUpdatedAt { get; init; } // ✅ NEW


}

public record Service
{
    public Guid Id { get; init; }
    public string ReportNo { get; init; }
    public DateTime ServiceDate { get; init; }
    public string CompanyName { get; init; }
    public string Address { get; init; }
    public string ContactName { get; init; }
    public string PhoneNumber { get; init; }
    public string ItemName { get; init; }
    public string SerialNumber { get; init; }
    public string CustomerRequest { get; init; }
    public string Inspection { get; init; }
    public string Solution { get; init; }
    public string ServiceLocation { get; init; }
    public string ServiceType { get; init; }
    public string ServicePriority { get; init; }
    public string Status { get; init; }
    public bool HasContract { get; init; }
    public Guid? CreateBy { get; init; }
    public DateTime? InspectDate { get; init; }
    public Guid? InspectBy { get; init; }

    // ✅ ADD THESE TWO — InspectingBy/Date are separate from InspectBy/Date
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

    // ✅ ADD THESE TWO
    public DateTime? SaleConfirmedDate { get; init; }
    public Guid? SetSaleConfirmedBy { get; init; }

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
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 15;
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
    public string SearchTerm { get; set; }
    public string Status { get; set; }
    public string SortBy { get; set; } = "usedquantity";
    public bool SortDescending { get; set; } = true;
    public bool IncludeManualStockOut { get; set; } = true;
    public string ServiceType { get; set; }
    public string Condition { get; set; }
    public bool? IsHoldStatus { get; set; }
    public string DateMode { get; set; } = "standard";
    public string SourceFilter { get; set; }   // ← ADD: "Service" | "Manual" | null
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
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 15;
    public string SearchTerm { get; set; }
    public string Status { get; set; }
    public string ServiceType { get; set; }
    public string SortBy { get; set; } = "holdqty";
    public bool SortDescending { get; set; } = true;
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