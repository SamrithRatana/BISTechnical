using System;
using System.ComponentModel.DataAnnotations;

namespace ServiceMaintenance.Models
{
    public class RepairServices
    {
        public Guid Id { get; set; } = Guid.Empty;

        [Required(ErrorMessage = "Service Date is required.")]
        public DateTime ServiceDate { get; set; }

        public DateTime? inspectDate { get; set; }
        public DateTime? awaitingCustomerConfirmDate { get; set; }
        public DateTime? awaitingSparepartDate { get; set; }
        public DateTime? customerRejectedDate { get; set; }
        public DateTime? unrepairableDate { get; set; }
        public DateTime? thirdPartyRepairDate { get; set; }
        public string ServiceDateFormatted { get; set; }
        public DateTime? repairDate { get; set; }
        public DateTime? finishedDate { get; set; }
        public DateTime? sentSparepartsDate { get; set; }  // ✅ NEW (matches domain: SentSparepartsDate)

        public Guid createby { get; set; } = Guid.Empty;
        public Guid? inspectBy { get; set; } = Guid.Empty;
        public Guid? setAwaitingCustomerConfirmBy { get; set; } = Guid.Empty;
        public Guid? setAwaitingSparepartBy { get; set; } = Guid.Empty;
        public Guid? thirdPartyRepairBy { get; set; } = Guid.Empty;
        public Guid? setCustomerRejectedBy { get; set; } = Guid.Empty;
        public Guid? setUnrepairableBy { get; set; } = Guid.Empty;
        public Guid? repairBy { get; set; } = Guid.Empty;
        public Guid? verifiedBy { get; set; } = Guid.Empty;
        public Guid? UserId { get; set; }
        public Guid? setSentSparepartsBy { get; set; } = Guid.Empty;  // ✅ NEW (matches domain: SetSentSparepartsBy)

        public string reportNo { get; set; } = null;
        public Guid CustomerId { get; set; } = Guid.Empty;

        [Required(ErrorMessage = "Company Name is required.")]
        [StringLength(100, ErrorMessage = "Company Name cannot exceed 100 characters.")]
        public string CompanyName { get; set; }

        [Required(ErrorMessage = "Address is required.")]
        [StringLength(250, ErrorMessage = "Address cannot exceed 250 characters.")]
        public string Address { get; set; }

        public string ContactName { get; set; }

        [Required(ErrorMessage = "Phone Number is required.")]
        public string PhoneNumber { get; set; }

        [Required(ErrorMessage = "Item is required.")]
        public Guid itemId { get; set; }

        public string itemName { get; set; }
        public int Finish { get; set; } = 0;
        public int Unrepairable { get; set; } = 0;
        public int CustomerReject { get; set; } = 0;
        public int SparePartTotal { get; set; } = 0;

        public string serialNumber { get; set; }

        [StringLength(500, ErrorMessage = "Customer Request cannot exceed 500 characters.")]
        public string CustomerRequest { get; set; }

        [StringLength(500, ErrorMessage = "Inspection cannot exceed 500 characters.")]
        public string Inspection { get; set; }

        [StringLength(500, ErrorMessage = "Solution cannot exceed 500 characters.")]
        public string Solution { get; set; }

        public string RepairByUserName { get; set; }
        public string ServiceLocation { get; set; }
        public Guid? ContactId { get; set; }
        public string ServiceType { get; set; }
        public string ServicePriority { get; set; }
        public string CustomerType { get; set; }
        public string Status { get; set; }
        public int? TelegramMessageId { get; private set; } // ✅ ADDED

        public bool hasContract { get; set; }
        public bool isThirdPartyRepair { get; set; }
        public Guid? inspectingBy { get; set; } = Guid.Empty;
        public DateTime? inspectingDate { get; set; }
        public int? ServiceTypeId { get; set; }
        public int ServicePriorityId { get; set; }
        public int StatusId { get; set; }
        public string RepairByName { get; set; }
        public string VerifiedByName { get; set; }
        public DateTime? saleConfirmedDate { get; set; }
        public Guid? setSaleConfirmedBy { get; set; } = Guid.Empty;
        public string SaleConfirmedFormatted => saleConfirmedDate?.ToString("dd-MMM-yyyy") ?? "";
        public string SentSparepartsFormatted => sentSparepartsDate?.ToString("dd-MMM-yyyy") ?? "";  // ✅ NEW

        public int? DaysTaken => finishedDate.HasValue
     ? (int)(finishedDate.Value.Date - ServiceDate.Date).TotalDays
     : (Status == "Customer Rejected" || Status == "Unrepairable")
         ? null
         : (int)(DateTime.Today - ServiceDate.Date).TotalDays;
        public string DaysTakenDisplay { get; set; }

        public List<SparePartItem> SparePartItems { get; set; } = new List<SparePartItem>();

        public string SparePartSummary
        {
            get
            {
                if (SparePartItems == null || !SparePartItems.Any())
                    return "N/A";
                return string.Join("; ", SparePartItems.Select(sp => $"{sp.ItemName} - {sp.Quantity} - {sp.Description}"));
            }
        }
        public string InspectDateFormatted => inspectDate?.ToString("dd-MMM-yyyy") ?? "";
        public string AwaitingCustomerFormatted => awaitingCustomerConfirmDate?.ToString("dd-MMM-yyyy") ?? "";
        public string AwaitingSparepartFormatted => awaitingSparepartDate?.ToString("dd-MMM-yyyy") ?? "";
        public string RepairDateFormatted => repairDate?.ToString("dd-MMM-yyyy") ?? "";
        public string FinishedDateFormatted => finishedDate?.ToString("dd-MMM-yyyy") ?? "";
        public string CustomerRejectedFormatted => customerRejectedDate?.ToString("dd-MMM-yyyy") ?? "";
        public string UnrepairableFormatted => unrepairableDate?.ToString("dd-MMM-yyyy") ?? "";
        public string ThirdPartyFormatted => thirdPartyRepairDate?.ToString("dd-MMM-yyyy") ?? "";

        public List<InspectItemRequest> InspectItems { get; set; } = new List<InspectItemRequest>();

        public string SparePartExcelSummary
        {
            get
            {
                if (SparePartItems == null || !SparePartItems.Any())
                {
                    Console.WriteLine($"⚠️ No spare parts for {reportNo}");
                    return "N/A";
                }

                var summary = string.Join("; ", SparePartItems.Select(sp =>
                    $"{sp.ItemName ?? "Unknown"} - {sp.Quantity} - {sp.Description ?? ""}"));

                Console.WriteLine($"✅ Spare part summary for {reportNo}: {summary}");
                return summary;
            }
        }

        public string SparePartPrintSummary
        {
            get
            {
                if (SparePartItems == null || !SparePartItems.Any())
                    return "N/A";
                return string.Join(Environment.NewLine, SparePartItems.Select(sp => $"- {sp.ItemName}"));
            }
        }
    }

    public class SparePartItem
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid? SparePartId { get; set; } = null;
        public string ItemName { get; set; }
        public string SerialNumber { get; set; }
        public string Description { get; set; } = null;
        public int Quantity { get; set; } = 0;
        public string Condition { get; set; } = null;
        public string UseFor { get; set; }
        public Guid RepairServiceId { get; set; }
        public int RowNumber { get; set; }
        public bool IsHoldStatus { get; set; } = false;
        public string Remarks { get; set; } = null;
        public DateTime? RemarksUpdatedAt { get; set; } = null;
    }

    public class ServiceType
    {
        public int Id { get; set; }
        public string Name { get; set; }
    }

    public class ServicePriority
    {
        public int Id { get; set; }
        public string Name { get; set; }
    }

    public class ServiceStatus
    {
        public int Id { get; set; }
        public string Name { get; set; }
    }
}