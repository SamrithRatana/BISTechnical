namespace ServiceMaintenance.Models
{
    // ServiceMaintenance/Models/SparepartUsageSummary.cs
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
        public string MachineItemName { get; set; }    // ← ADD: machine/device name
        public string MachineSerialNumber { get; set; } // ← ADD: machine serial number
    }
}