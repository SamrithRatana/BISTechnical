using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Drawing;
using System.Linq;
using DevExpress.XtraReports.Parameters;
using DevExpress.XtraReports.UI;
using ServiceMaintenance.Models;

namespace ServiceMaintenance.Pages.Reports
{
    public partial class RentalReport : DevExpress.XtraReports.UI.XtraReport
    {
        public RentalReport()
        {
            InitializeComponent();
        }

        // Enhanced method to set parameters and data source for the rental report
        public void SetParameters(
            string rentalItemId,
            string itemType,
            string serialNumber,
            string itemName,
            string condition,
            string customerName,
            string duration,
            string location,
            List<RentalReportData> serviceHistory,
            string generatedBy,
            DateTime generatedDate)
        {
            try
            {
                Console.WriteLine($"Setting report parameters for rental item: {rentalItemId}");
                Console.WriteLine($"Service history count: {serviceHistory?.Count ?? 0}");

                // Set equipment information parameters with null checking
                SetParameterValue("pType", itemType);
                SetParameterValue("pSerialNumber", serialNumber);
                SetParameterValue("pItemName", itemName);
                SetParameterValue("pCondition", condition);
                SetParameterValue("pCompanyName", customerName);
                SetParameterValue("pDuration", duration);
                SetParameterValue("pAddress", location);
                SetParameterValue("pRentalItemId", rentalItemId);
                SetParameterValue("pGeneratedDate", generatedDate.ToString("dd/MM/yyyy"));
                SetParameterValue("pUser", generatedBy);

                // Debug: Log the service history data
                if (serviceHistory != null && serviceHistory.Any())
                {
                    Console.WriteLine("Service History Data:");
                    foreach (var service in serviceHistory)
                    {
                        Console.WriteLine($"  Row {service.RowNumber}: {service.Date} - {service.Action} - {service.SparePart} - {service.Note} - {service.Technician}");
                    }
                }
                else
                {
                    Console.WriteLine("WARNING: No service history data provided!");
                }

                // Set the data source for the service history
                this.DataSource = serviceHistory ?? new List<RentalReportData>();

                // If no data, create a dummy record to show the structure
                if (serviceHistory == null || !serviceHistory.Any())
                {
                    Console.WriteLine("Creating dummy service record for display");
                    this.DataSource = new List<RentalReportData>
                    {
                        new RentalReportData
                        {
                            RowNumber = 1,
                            Date = "No Data",
                            Action = "No Data",
                            SparePart = "No Data",
                            Note = "No service records found",
                            Technician = "N/A"
                        }
                    };
                }

                // Hide parameters from the print preview
                HideParameters();

                Console.WriteLine("Report parameters set successfully");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error setting report parameters: {ex.Message}");
                Console.WriteLine($"Stack trace: {ex.StackTrace}");
                throw;
            }
        }

        // Helper method to safely set parameter values
        private void SetParameterValue(string parameterName, string value)
        {
            try
            {
                if (this.Parameters[parameterName] != null)
                {
                    this.Parameters[parameterName].Value = value ?? "N/A";
                    Console.WriteLine($"Set parameter {parameterName} = {value ?? "N/A"}");
                }
                else
                {
                    Console.WriteLine($"WARNING: Parameter {parameterName} not found in report");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error setting parameter {parameterName}: {ex.Message}");
            }
        }

        // Enhanced method for easier parameter passing from service data
        public void SetRentalReportData(
            RentalItem rentalItem,
            List<RentalServices> services,
            string currentUserName,
            Dictionary<string, string> userMap,
            Dictionary<Guid, string> sparePartMap)
        {
            try
            {
                Console.WriteLine($"Processing rental report data for item: {rentalItem?.ItemName}");
                Console.WriteLine($"Services count: {services?.Count ?? 0}");
                Console.WriteLine($"User map count: {userMap?.Count ?? 0}");
                Console.WriteLine($"Spare part map count: {sparePartMap?.Count ?? 0}");

                // Prepare service history data with enhanced spare part formatting
                var serviceHistory = new List<RentalReportData>();
                int rowNumber = 1;

                if (services != null && services.Any())
                {
                    foreach (var service in services.OrderBy(s => s.Date))
                    {
                        var sparePartsText = FormatSparePartsText(service.SpareParts, sparePartMap);
                        var technicianName = GetTechnicianName(service.UserId, userMap);

                        var reportData = new RentalReportData
                        {
                            RowNumber = rowNumber,
                            Date = service.Date.ToString("dd/MM/yyyy"),
                            Action = service.Action ?? "N/A",
                            SparePart = sparePartsText,
                            Note = service.Note ?? string.Empty,
                            Technician = technicianName
                        };

                        serviceHistory.Add(reportData);
                        Console.WriteLine($"Added service record {rowNumber}: {reportData.Date} - {reportData.Action} - Parts: {reportData.SparePart}");
                        rowNumber++;
                    }
                }

                // Call the main SetParameters method
                SetParameters(
                    rentalItem?.Id.ToString() ?? "N/A",
                    GetItemType(rentalItem?.ItemName),
                    rentalItem?.SerialNumber ?? "N/A",
                    rentalItem?.ItemName ?? "N/A",
                    rentalItem?.Condition ?? "N/A",
                    rentalItem?.CustomerName ?? "N/A",
                    FormatDuration(rentalItem?.Duration),
                    rentalItem?.Location ?? "N/A",
                    serviceHistory,
                    currentUserName,
                    DateTime.Now
                );
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error setting rental report data: {ex.Message}");
                Console.WriteLine($"Stack trace: {ex.StackTrace}");
                throw;
            }
        }

        // Enhanced spare parts formatting to match your expected format: ItemName=Quantity(Condition)
        private string FormatSparePartsText(List<SparePartOb> spareParts, Dictionary<Guid, string> sparePartMap)
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

                    if (part.SparePartId.HasValue && sparePartMap != null && sparePartMap.ContainsKey(part.SparePartId.Value))
                    {
                        partName = sparePartMap[part.SparePartId.Value];
                    }
                    else if (!string.IsNullOrWhiteSpace(part.Description))
                    {
                        partName = part.Description;
                    }

                    // Format: ItemName=Quantity(Condition) - each part on new line
                    var formattedPart = $"{partName}={part.Quantity}({part.Condition ?? "N/A"})";
                    formattedParts.Add(formattedPart);

                    Console.WriteLine($"Formatted spare part: {formattedPart}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error formatting spare part {part.SparePartId}: {ex.Message}");
                    formattedParts.Add($"Unknown Part={part.Quantity}({part.Condition ?? "N/A"})");
                }
            }

            // Join with Environment.NewLine for proper line breaks in reports
            return string.Join(Environment.NewLine, formattedParts);
        }


        // Helper method to get technician name
        private string GetTechnicianName(string userId, Dictionary<string, string> userMap)
        {
            if (string.IsNullOrWhiteSpace(userId))
            {
                return "Unknown User";
            }

            if (userMap != null && userMap.ContainsKey(userId))
            {
                // The userMap now already contains only last names due to the modification above
                return userMap[userId];
            }

            return "Unknown User";
        }

        // Helper method to format duration
        private string FormatDuration(int? duration)
        {
            if (!duration.HasValue || duration.Value <= 0)
            {
                return "N/A";
            }

            return $"{duration.Value} month{(duration.Value != 1 ? "s" : "")}";
        }

        // Enhanced item type detection
        private string GetItemType(string itemName)
        {
            if (string.IsNullOrWhiteSpace(itemName))
                return "Unknown Type";

            itemName = itemName.ToLower();

            if (itemName.Contains("printer") || itemName.Contains("fuji") || itemName.Contains("ecotank"))
                return "Printer";
            else if (itemName.Contains("scanner"))
                return "Scanner";
            else if (itemName.Contains("computer") || itemName.Contains("pc"))
                return "Computer";
            else if (itemName.Contains("laptop"))
                return "Laptop";
            else if (itemName.Contains("copier") || itemName.Contains("copy"))
                return "Copier";
            else
                return "Equipment";
        }

        // Method to hide parameters from print preview
        private void HideParameters()
        {
            try
            {
                foreach (Parameter param in this.Parameters)
                {
                    param.Visible = false;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error hiding parameters: {ex.Message}");
            }
        }

        // Method to show specific parameters (for debugging)
        public void ShowParameters(params string[] parameterNames)
        {
            try
            {
                foreach (string paramName in parameterNames)
                {
                    if (this.Parameters[paramName] != null)
                    {
                        this.Parameters[paramName].Visible = true;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error showing parameters: {ex.Message}");
            }
        }

        // Method to validate report setup (for debugging)
        public void ValidateReportSetup()
        {
            try
            {
                Console.WriteLine("=== Report Validation ===");
                Console.WriteLine($"Data source type: {this.DataSource?.GetType().Name ?? "NULL"}");

                if (this.DataSource is List<RentalReportData> data)
                {
                    Console.WriteLine($"Data source count: {data.Count}");
                    foreach (var item in data.Take(3)) // Show first 3 items
                    {
                        Console.WriteLine($"  Item: {item.RowNumber} - {item.Date} - {item.Action} - {item.SparePart}");
                    }
                }

                Console.WriteLine($"Parameters count: {this.Parameters.Count}");
                foreach (Parameter param in this.Parameters)
                {
                    Console.WriteLine($"  {param.Name} = {param.Value ?? "NULL"}");
                }
                Console.WriteLine("=== End Validation ===");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error validating report: {ex.Message}");
            }
        }
    }

    // Enhanced data class for rental report
    public class RentalReportData
    {
        public int RowNumber { get; set; }
        public string Date { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public string SparePart { get; set; } = string.Empty;
        public string Note { get; set; } = string.Empty;
        public string Technician { get; set; } = string.Empty;

        // Override ToString for easier debugging
        public override string ToString()
        {
            return $"Row {RowNumber}: {Date} - {Action} - {SparePart} - {Note} - {Technician}";
        }
    }
}