using ServiceMaintenance.Models;
using ServiceMaintenance.Pages.Reports;
using ServiceMaintenance.Services.BISServices;
using ServiceMaintenance.Services.JWT;

namespace ServiceMaintenance.Services.AsyncServices
{
    public class PrintPreviewService
    {
        private readonly ServiceSparePart _sparePartService;
        private readonly GlobalUserService _globalUserCache;

        public PrintPreviewService(ServiceSparePart sparePartService, GlobalUserService globalUserCache)
        {
            _sparePartService = sparePartService;
            _globalUserCache = globalUserCache;
        }

        public async Task<string> GenerateReportBase64Async(
            RepairServices selectedRepairService,
            Func<Guid?, string> getUserNameById)
        {
            var report = new Report2();

            string repairByUser = getUserNameById(selectedRepairService.inspectBy);
            string verifiedByUser = getUserNameById(Guid.Parse("94b0772a-0588-4b37-b31d-51b1e0ea22e5"));

            string repairByPhone = await _globalUserCache.GetUserPhoneNumberByIdAsync(selectedRepairService.inspectBy, autoLoad: true);
            string verifiedByPhone = await _globalUserCache.GetUserPhoneNumberByIdAsync(Guid.Parse("94b0772a-0588-4b37-b31d-51b1e0ea22e5"), autoLoad: true);

            // Fetch spare part details
            if (selectedRepairService.SparePartItems != null && selectedRepairService.SparePartItems.Any())
            {
                foreach (var item in selectedRepairService.SparePartItems)
                {
                    if (!item.SparePartId.HasValue || item.SparePartId.Value == Guid.Empty)
                        continue;

                    try
                    {
                        var sparePartDetails = await _sparePartService.GetSparePartByIdAsync(item.SparePartId.Value);
                        if (sparePartDetails != null)
                        {
                            item.ItemName = sparePartDetails.ItemName;
                            item.SerialNumber = sparePartDetails.SerialNumber;
                            item.UseFor = sparePartDetails.UseFor;
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"❌ Error fetching spare part {item.SparePartId}: {ex.Message}");
                    }
                }
            }

            report.SetParameters(
                selectedRepairService,
                selectedRepairService.ServiceLocation,
                selectedRepairService.SparePartItems,
                selectedRepairService.hasContract,
                repairByUser,
                verifiedByUser,
                repairByPhone,
                verifiedByPhone
            );

            // Hide all parameters
            foreach (var key in new[]
            {
                "Id", "ReportNumber", "CompanyName", "ContactName", "PhoneNumber",
                "Address", "ItemName", "SerialNumber", "CustomerRequest", "inspection",
                "Solution", "CompanyServiceChecked", "OnSiteChecked", "HasContract",
                "Datestart", "Datefinish", "RepairBy", "VerifiedBy", "RepairByPhone", "VerifiedByPhone"
            })
            {
                report.Parameters[key].Visible = false;
            }

            using var ms = new MemoryStream();
            report.ExportToPdf(ms);
            return Convert.ToBase64String(ms.ToArray());
        }
    }
}
