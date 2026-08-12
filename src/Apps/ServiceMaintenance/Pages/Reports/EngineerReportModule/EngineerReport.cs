using DevExpress.XtraReports.UI;
using ServiceMaintenance.Models;
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;

namespace DXApplication1
{
    public partial class EngineerReport : DevExpress.XtraReports.UI.XtraReport
    {
        public EngineerReport()
        {
            InitializeComponent();
        }

        public void SetDataSource(List<RepairServices> repairServices, List<string> repairByUsers, List<string> verifiedByUsers, string currentUserName, Dictionary<string, string> userMap)
        {
            this.DataSource = repairServices;

            var statusTranslation = new Dictionary<string, string>
            {
                { "Item Recieved", "ទទួលម៉ាស៊ីន" },
                { "Finished", "ជួសជុលរួចរាល់" },
                { "Inspection", "កំពុងវិនិច្ឆ័យ" },
                { "Awaiting Customer Confirm", "រង់ចាំ Confirm ពីភ្ញៀវ" },
                { "Awaiting Sparepart", "កំពុងរង់ចាំគ្រឿងបន្លាស់" },
                { "Repairing", "កំពុងជួសជុល" },
                { "Customer Rejected", "គេមិនធ្វើ" },
                { "Unrepairable", "ជួសជុលមិនបាន" }
            };

            var statusUserMapping = new Dictionary<string, Func<RepairServices, Guid?>>
            {
                { "ទទួលម៉ាស៊ីន", service => service.createby != Guid.Empty ? service.createby : (Guid?)null },
                { "កំពុងវិនិច្ឆ័យ", service => service.inspectBy },
                { "រង់ចាំ Confirm ពីភ្ញៀវ", service => service.setAwaitingCustomerConfirmBy },
                { "កំពុងរង់ចាំគ្រឿងបន្លាស់", service => service.setAwaitingSparepartBy },
                { "កំពុងជួសជុល", service => service.repairBy },
                { "ជួសជុលរួចរាល់", service => service.verifiedBy },
                { "គេមិនធ្វើ", service => service.setCustomerRejectedBy },
                { "ជួសជុលមិនបាន", service => service.setUnrepairableBy }
            };

            // Update status and user names
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
                    if (statusUserMapping.ContainsKey(service.Status))
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
                    // You can add similar logic for verifiedBy if needed
                    verifiedByName = "N/A";
                }

                service.VerifiedByName = verifiedByName;
            }

            // Set parameters
            this.Parameters["CompanyName"].Value = "[CompanyName]";
            this.Parameters["ItemName"].Value = "[ItemName]";
            this.Parameters["SerialNumber"].Value = "[SerialNumber]";
            this.Parameters["Status"].Value = "[Status]";

            // Set Engineer parameter with status-based fallback logic
            string engineerValue = "[RepairByName]";

            // Check if we need to use status-based fallback for Engineer parameter
            var firstService = repairServices.FirstOrDefault();
            if (firstService != null && (string.IsNullOrEmpty(firstService.RepairByName) || firstService.RepairByName == "None" || firstService.RepairByName == "N/A"))
            {
                // Use status-based user mapping for Engineer parameter
                if (statusUserMapping.ContainsKey(firstService.Status))
                {
                    var userId = statusUserMapping[firstService.Status](firstService);
                    if (userId.HasValue && userMap.ContainsKey(userId.Value.ToString()))
                    {
                        engineerValue = userMap[userId.Value.ToString()];
                    }
                    else
                    {
                        engineerValue = "N/A";
                    }
                }
                else
                {
                    engineerValue = "N/A";
                }
            }

            this.Parameters["Engineer"].Value = engineerValue;
            this.Parameters["ServiceLocation"].Value = "[ServiceLocation]";
            this.Parameters["GeneratedBy"].Value = currentUserName;

            int rowCount = repairServices.Count;
            this.Parameters["TotalQuantity"].Value = $"{rowCount} គ្រឿង";

            // ✅ FIXED: Spare part summary logic - Sum quantities instead of counting entries
            var allSpareParts = repairServices
                .Where(s => s.SparePartItems != null)
                .SelectMany(s => s.SparePartItems)
                .GroupBy(sp => sp.ItemName)
                .Select(g => $"{g.Key} – {g.Sum(sp => sp.Quantity)} គ្រាប់")  // ✅ Changed from g.Count() to g.Sum(sp => sp.Quantity)
                .ToList();

            string condensedSummary = string.Join(Environment.NewLine, allSpareParts);
            this.Parameters["SparePartSummary"].Value = condensedSummary;

            // ✅ FIXED: Total spare parts count - Sum quantities instead of counting entries
            int totalSpareParts = repairServices
                .Where(s => s.SparePartItems != null)
                .SelectMany(s => s.SparePartItems)
                .Sum(sp => sp.Quantity);  // ✅ Changed from .Count() to .Sum(sp => sp.Quantity)

            this.Parameters["SparePartSum"].Value = $"{totalSpareParts} គ្រាប់";
        }

        // Helper method to get user name by ID with fallback
        private string GetUserNameWithFallback(Guid? userId, Dictionary<string, string> userMap, string fallback = "N/A")
        {
            if (userId.HasValue && userMap.ContainsKey(userId.Value.ToString()))
            {
                return userMap[userId.Value.ToString()];
            }
            return fallback;
        }
    }
}