using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Drawing;
using System.Linq;
using DevExpress.XtraReports.UI;
using ServiceMaintenance.Models;
using ServiceMaintenance.ViewModel;

namespace ServiceMaintenance.Pages.Reports
{
    public partial class RentalAll : DevExpress.XtraReports.UI.XtraReport
    {
        public RentalAll()
        {
            InitializeComponent();
        }

        public void SetDataSource(
            List<RentalServices> rentalServices,
            Dictionary<string, RentalItem> rentalItemLookup = null,
            Dictionary<string, UserViewModel> userLookup = null,
            Dictionary<Guid, SparePartObject> sparePartLookup = null,
            DateTime? startDate = null,
            DateTime? endDate = null,
            string selectedUserId = null,
            string currentUserName = null)
        {
            var reportData = new List<RentalAllReportData>();
            int rowNumber = 1;

            foreach (var service in rentalServices.OrderByDescending(s => s.Date))
            {
                var rentalItem = rentalItemLookup?.ContainsKey(service.RentalItemId) == true
                    ? rentalItemLookup[service.RentalItemId]
                    : null;

                var user = userLookup?.ContainsKey(service.UserId) == true
                    ? userLookup[service.UserId]
                    : null;

                var sparePartsText = FormatSparePartsText(service.SpareParts, sparePartLookup);

                var reportItem = new RentalAllReportData
                {
                    No = rowNumber.ToString(),
                    Date = service.Date.ToString("dd/MM/yyyy HH:mm"),
                    CustomerName = rentalItem?.CustomerName ?? "Unknown Customer",
                    RentalItem = rentalItem?.ItemName ?? service.RentalItemId,
                    Action = service.Action ?? string.Empty,
                    Note = service.Note ?? string.Empty,
                    User = user?.LastName ?? service.UserId,
                    SpareParts = sparePartsText
                };

                reportData.Add(reportItem);
                rowNumber++;
            }

            // Set the data source
            this.DataSource = reportData;

            // Set field bindings for the report
            this.Parameters["action"].Value = "[Action]";
            this.Parameters["CustomerName"].Value = "[CustomerName]";
            this.Parameters["Date"].Value = "[Date]";
            this.Parameters["Note"].Value = "[Note]";
            this.Parameters["RentalItem"].Value = "[RentalItem]";
            this.Parameters["SparePart"].Value = "[SpareParts]";
            this.Parameters["User"].Value = "[User]";

            // Set filter information parameters
            SetFilterParameters(startDate, endDate, selectedUserId, currentUserName, rentalServices.Count);
        }

        private void SetFilterParameters(DateTime? startDate, DateTime? endDate, string selectedUserId, string currentUserName, int totalCount)
        {
            // Set date range parameter
            string dateRange;
            if (startDate.HasValue && endDate.HasValue)
            {
                dateRange = $"{startDate:dd/MM/yyyy} - {endDate:dd/MM/yyyy}";
            }
            else if (startDate.HasValue)
            {
                dateRange = $"From {startDate:dd/MM/yyyy}";
            }
            else if (endDate.HasValue)
            {
                dateRange = $"Until {endDate:dd/MM/yyyy}";
            }
            else
            {
                dateRange = "All Dates";
            }

            // Set user filter parameter
            string userFilter = string.IsNullOrEmpty(selectedUserId) ? "All Users" : selectedUserId;

            // Set summary parameters if they exist in your report
            try
            {
                if (this.Parameters["DateRange"] != null)
                    this.Parameters["DateRange"].Value = dateRange;

                if (this.Parameters["UserFilter"] != null)
                    this.Parameters["UserFilter"].Value = userFilter;

                if (this.Parameters["TotalCount"] != null)
                    this.Parameters["TotalCount"].Value = totalCount.ToString();

                if (this.Parameters["GeneratedBy"] != null)
                    this.Parameters["GeneratedBy"].Value = currentUserName ?? "System User";

                if (this.Parameters["GeneratedDate"] != null)
                    this.Parameters["GeneratedDate"].Value = DateTime.Now.ToString("dd/MM/yyyy HH:mm");
            }
            catch (Exception ex)
            {
                // Parameters might not exist in report design, continue anyway
                Console.WriteLine($"Warning: Some parameters not found in report: {ex.Message}");
            }
        }

        // Format spare parts text for display
        private string FormatSparePartsText(List<SparePartOb> spareParts, Dictionary<Guid, SparePartObject> sparePartLookup)
        {
            if (spareParts == null || !spareParts.Any())
            {
                return string.Empty;
            }

            var formattedParts = new List<string>();

            foreach (var part in spareParts)
            {
                try
                {
                    string partName = "Unknown Part";

                    if (part.SparePartId.HasValue && sparePartLookup != null && sparePartLookup.ContainsKey(part.SparePartId.Value))
                    {
                        partName = sparePartLookup[part.SparePartId.Value].ItemName ?? "Unknown Part";
                    }
                    else if (!string.IsNullOrWhiteSpace(part.Description))
                    {
                        partName = part.Description;
                    }

                    // Format: ItemName=Quantity(Condition)
                    var formattedPart = $"{partName}={part.Quantity}({part.Condition ?? "N/A"})";
                    formattedParts.Add(formattedPart);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error formatting spare part {part.SparePartId}: {ex.Message}");
                    formattedParts.Add($"Unknown Part={part.Quantity}({part.Condition ?? "N/A"})");
                }
            }

            // Join with semicolons for better display in table format
            return string.Join("; ", formattedParts);
        }

        // Overload method for easier calling from Blazor page
        public void SetDataSource(
            IEnumerable<RentalServices> filteredServices,
            Dictionary<string, RentalItem> rentalItemLookup,
            Dictionary<string, UserViewModel> userLookup,
            Dictionary<Guid, SparePartObject> sparePartLookup,
            DateTime? startDate,
            DateTime? endDate,
            string filterUserId,
            string currentUserName)
        {
            var servicesList = filteredServices?.ToList() ?? new List<RentalServices>();

            SetDataSource(
                servicesList,
                rentalItemLookup,
                userLookup,
                sparePartLookup,
                startDate,
                endDate,
                filterUserId,
                currentUserName
            );
        }
    }

    public class RentalAllReportData
    {
        public string No { get; set; } = string.Empty;
        public string Date { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public string RentalItem { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public string Note { get; set; } = string.Empty;
        public string User { get; set; } = string.Empty;
        public string SpareParts { get; set; } = string.Empty;
    }
}