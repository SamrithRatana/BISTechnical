using DevExpress.XtraReports.UI;
using ServiceMaintenance.Models;
using System;
using System.Collections.Generic;
using System.Linq;

namespace DXApplication1
{
    public partial class MonthlyReportShow : DevExpress.XtraReports.UI.XtraReport
    {
        private List<Customer> _customers = new List<Customer>();
        public bool HideToDate { get; set; }

        public MonthlyReportShow()
        {
            InitializeComponent();
        }

        public void SetCustomers(List<Customer> customers)
        {
            _customers = customers;
        }

        /// <summary>
        /// ✅ FIXED: Get customer type from RepairServices data (already enriched)
        /// </summary>
        private string GetCustomerType(RepairServices service)
        {
            // ✅ Use CustomerType from service (already enriched in Blazor)
            if (!string.IsNullOrEmpty(service.CustomerType))
            {
                return service.CustomerType;
            }

            // Fallback: Try to get from _customers list
            if (_customers.Any())
            {
                var customer = _customers.FirstOrDefault(c => c.CompanyName == service.CompanyName);
                if (customer != null && !string.IsNullOrEmpty(customer.CustomerType))
                {
                    return customer.CustomerType;
                }
            }

            return "Unknown";
        }

        /// <summary>
        /// ✅ OPTIMIZED: SetDataSource with proper CustomerType handling
        /// </summary>
        public void SetDataSource(List<RepairServices> repairServices, bool hideToDate)
        {
            this.HideToDate = hideToDate;

            Console.WriteLine($"📊 MonthlyReportShow.SetDataSource called with {repairServices.Count} records");

            // ✅ Group by CustomerType from the already-enriched RepairServices data
            var processedServices = repairServices
                .GroupBy(r => GetCustomerType(r)) // Use the service's CustomerType
                .Select(g => new
                {
                    CustomerType = g.Key,
                    CustomerTypeCount = g.Count(r => r.Status == "Finished"),
                    CustomerTypeCustomerReject = g.Count(r => r.Status == "Customer Rejected"),
                    UnrepairableCount = g.Count(r => r.Status == "Unrepairable"),
                    Address = g.First().Address,
                    ContactName = g.First().ContactName,
                    PhoneNumber = g.First().PhoneNumber,
                    ItemName = g.First().itemName,
                    SerialNumber = g.First().serialNumber,
                    ServiceLocation = g.First().ServiceLocation,
                    ServiceType = g.First().ServiceType,
                    Status = g.First().Status,
                    RepairByName = g.First().RepairByName,
                    VerifiedByName = g.First().VerifiedByName,

                    SparePartDescriptionsSum = g.SelectMany(r => r.SparePartItems)
                                        .Where(sp => !string.IsNullOrEmpty(sp.Description))
                                        .Sum(sp => decimal.TryParse(sp.Description, out var value) ? value : 0)
                })
                .OrderBy(x => x.CustomerType) // Sort for consistent display
                .ToList();

            // Log what we're grouping
            Console.WriteLine($"📊 Grouped into {processedServices.Count} customer types:");
            foreach (var group in processedServices)
            {
                Console.WriteLine($"  - {group.CustomerType}: Fixed={group.CustomerTypeCount}, Rejected={group.CustomerTypeCustomerReject}, Unrepairable={group.UnrepairableCount}");
            }

            this.BeforePrint += (sender, e) =>
            {
                var report = sender as MonthlyReportShow;
                if (report != null && report.HideToDate)
                {
                    xrLabel4.Visible = false;
                    xrLabel7.Visible = false;
                }
            };

            this.DataSource = processedServices;

            // Bind data to table cells
            xrTableCell1.DataBindings.Add("Text", null, "CustomerType");
            xrTableCell2.DataBindings.Add("Text", null, "CustomerTypeCount");
            xrTableCell7.DataBindings.Add("Text", null, "CustomerTypeCustomerReject");
            xrTableCell8.DataBindings.Add("Text", null, "UnrepairableCount");

            // Calculate totals
            var totalQuantity = repairServices
                .Where(r => r.Status == "Finished")
                .GroupBy(r => GetCustomerType(r))
                .Sum(g => g.Count());

            this.Parameters["TotalQuantity"].Value = $"{totalQuantity} គ្រឿង";

            var totalRejected = repairServices
                .Count(r => r.Status == "Customer Rejected");
            this.Parameters["TotalCustomerRejected"].Value = $"{totalRejected} គ្រឿង";

            var totalDescriptions = processedServices.Sum(s => s.SparePartDescriptionsSum);
            // this.Parameters["TotalDescriptions"].Value = $"{totalDescriptions} $";

            var totalUnrepairable = repairServices
                .Where(r => r.Status == "Unrepairable")
                .GroupBy(r => GetCustomerType(r))
                .Sum(g => g.Count());

            this.Parameters["TotalUnrepairable"].Value = $"{totalUnrepairable} គ្រឿង";

            Console.WriteLine($"✅ Report data set successfully");
        }
    }
}