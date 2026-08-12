using DevExpress.XtraReports.UI;
using ServiceMaintenance.Models;
using System;
using System.Collections.Generic;
using System.Linq;

namespace ServiceMaintenance.Pages.Reports
{
    public partial class DailyReport : XtraReport
    {
        public DailyReport()
        {
            InitializeComponent();
        }

        // Method to set the data source and configure parameters
        public void SetDataSource(List<RepairServices> repairServices, List<string> repairByUsers, List<string> verifiedByUsers, string currentUserName, Dictionary<string, string> userMap = null)
        {
            this.DataSource = repairServices;

            // Define a dictionary for status translation
            var statusTranslation = new Dictionary<string, string>
            {
                { "Item Recieved", "ទទួលម៉ាស៊ីន" },
                { "Finished", "ជួសជុលរួចរាល់" },
                { "Inspection", "កំពុងវិនិច្ឆ័យ" },
                { "Awaiting Customer Confirm", "រង់ចាំ Confirm ពីភ្ញៀវ" },
                { "Awaiting Sparepart", "កំពុងរង់ចាំគ្រឿងបន្លាស់" },
                { "Repairing", "កំពុងជួសជុល" },
                { "Customer Rejected", "គេមិនធ្វើ" },
                { "Unrepairable", "ជួសជុលមិនបាន" },
                { "Repair by Third-Party", "ជួសជុលដោយភាគីទីបី" }
            };

            // Status-based user mapping for fallback
            var statusUserMapping = new Dictionary<string, Func<RepairServices, Guid?>>
            {
                { "ទទួលម៉ាស៊ីន", service => service.createby != Guid.Empty ? service.createby : (Guid?)null },
                { "កំពុងវិនិច្ឆ័យ", service => service.inspectBy },
                { "រង់ចាំ Confirm ពីភ្ញៀវ", service => service.setAwaitingCustomerConfirmBy },
                { "កំពុងរង់ចាំគ្រឿងបន្លាស់", service => service.setAwaitingSparepartBy },
                { "កំពុងជួសជុល", service => service.repairBy },
                { "ជួសជុលរួចរាល់", service => service.verifiedBy },
                { "គេមិនធ្វើ", service => service.setCustomerRejectedBy },
                { "ជួសជុលមិនបាន", service => service.setUnrepairableBy },
                { "ជួសជុលដោយភាគីទីបី", service => service.thirdPartyRepairBy }
            };

            // Loop through the repair services and update the Status property
            for (int i = 0; i < repairServices.Count; i++)
            {
                var service = repairServices[i];

                // Translate status
                if (statusTranslation.ContainsKey(service.Status))
                {
                    service.Status = statusTranslation[service.Status];
                }

                // Set RepairByName with fallback logic
                string repairByName = repairByUsers[i];

                // If RepairByName is null, empty, or "None", try to get it based on status
                if (string.IsNullOrEmpty(repairByName) || repairByName == "None")
                {
                    if (userMap != null && statusUserMapping.ContainsKey(service.Status))
                    {
                        var userId = statusUserMapping[service.Status](service);
                        if (userId.HasValue && userMap.ContainsKey(userId.Value.ToString()))
                        {
                            repairByName = userMap[userId.Value.ToString()];
                        }
                    }

                    // Final fallback if still no name found
                    if (string.IsNullOrEmpty(repairByName) || repairByName == "None")
                    {
                        repairByName = "N/A";
                    }
                }

                service.RepairByName = repairByName;

                // Set VerifiedByName with similar logic if needed
                string verifiedByName = verifiedByUsers[i];
                if (string.IsNullOrEmpty(verifiedByName) || verifiedByName == "None")
                {
                    verifiedByName = "N/A";
                }

                service.VerifiedByName = verifiedByName;

                // Format service date
                if (service.ServiceDate != default(DateTime))
                {
                    service.ServiceDateFormatted = service.ServiceDate.ToString("dd-MM-yyyy");
                }
            }

            // Set report parameters
            this.Parameters["CompanyName"].Value = "[CompanyName]";
            this.Parameters["ItemName"].Value = "[ItemName]";
            this.Parameters["SerialNumber"].Value = "[SerialNumber]";
            this.Parameters["Status"].Value = "[Status]";
            this.Parameters["Engineer"].Value = "[RepairByName]";
            this.Parameters["ServiceDate"].Value = "[ServiceDateFormatted]";
            this.Parameters["GeneratedBy"].Value = currentUserName;

            // Calculate total quantity
            int rowCount = repairServices.Count;
            this.Parameters["TotalQuantity"].Value = $"{rowCount} គ្រឿង";

            // Generate User Summary (simple format: Name: Count)
            var userSummary = GenerateUserSummary(repairServices);
            this.Parameters["UserSummary"].Value = userSummary;

            
        }

        // Generate simple user summary: "Vun Navin: 4"
        private string GenerateUserSummary(List<RepairServices> repairServices)
        {
            var userCounts = repairServices
                .Where(s => !string.IsNullOrEmpty(s.RepairByName) && 
                           s.RepairByName != "N/A" && 
                           s.RepairByName != "None")
                .GroupBy(s => s.RepairByName.ToLower()) // Group by lowercase to avoid case sensitivity
                .Select(g => new { 
                    Name = g.First().RepairByName, 
                    Count = g.Count() 
                })
                .OrderByDescending(x => x.Count) // Sort by count (highest first)
                .Select(x => $"{x.Name}: {x.Count}")
                .ToList();

            return userCounts.Any() ? 
                   string.Join(Environment.NewLine, userCounts) : 
                   "មិនមានទិន្នន័យ";
        }

        
    }
}