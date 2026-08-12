using System;
using System.Collections;
using System.ComponentModel;
using System.Drawing;
using DevExpress.XtraReports.UI;
using ServiceMaintenance.Models;

namespace ServiceMaintenance.Pages.Reports
{
    public partial class EngineerReport2 : DevExpress.XtraReports.UI.XtraReport
    {
        public EngineerReport2()
        {
            InitializeComponent();
        }

        // ✅ FIXED: Expanded to handle ALL statuses, not just Unrepairable and Customer Rejected
        private string GetGroupingUserName(RepairServices service, string status, Dictionary<string, string> userMap)
        {
            // Always prioritize RepairByName first for all statuses if it exists and is not "None"
            if (!string.IsNullOrEmpty(service.RepairByName) &&
                !service.RepairByName.Equals("None", StringComparison.OrdinalIgnoreCase))
            {
                return service.RepairByName;
            }

            // ✅ EXPANDED: Handle ALL status types to properly group spare parts
            switch (status)
            {
                case "ជួសជុលរួចរាល់": // Finished
                    if (service.verifiedBy.HasValue && service.verifiedBy.Value != Guid.Empty)
                    {
                        var userId = service.verifiedBy.Value.ToString();
                        return userMap.ContainsKey(userId) ? userMap[userId] : "None";
                    }
                    break;

                case "កំពុងជួសជុល": // Repairing
                    if (service.repairBy.HasValue && service.repairBy.Value != Guid.Empty)
                    {
                        var userId = service.repairBy.Value.ToString();
                        return userMap.ContainsKey(userId) ? userMap[userId] : "None";
                    }
                    break;

                case "ជួសជុលមិនបាន": // Unrepairable
                    if (service.setUnrepairableBy.HasValue && service.setUnrepairableBy.Value != Guid.Empty)
                    {
                        var userId = service.setUnrepairableBy.Value.ToString();
                        return userMap.ContainsKey(userId) ? userMap[userId] : "None";
                    }
                    break;

                case "គេមិនធ្វើ": // Customer Rejected
                    if (service.setCustomerRejectedBy.HasValue && service.setCustomerRejectedBy.Value != Guid.Empty)
                    {
                        var userId = service.setCustomerRejectedBy.Value.ToString();
                        return userMap.ContainsKey(userId) ? userMap[userId] : "None";
                    }
                    break;

                case "កំពុងវិនិច្ឆ័យ": // Inspection
                    if (service.inspectBy.HasValue && service.inspectBy.Value != Guid.Empty)
                    {
                        var userId = service.inspectBy.Value.ToString();
                        return userMap.ContainsKey(userId) ? userMap[userId] : "None";
                    }
                    break;

                case "រង់ចាំ Confirm ពីភ្ញៀវ": // Awaiting Customer Confirm
                    if (service.setAwaitingCustomerConfirmBy.HasValue && service.setAwaitingCustomerConfirmBy.Value != Guid.Empty)
                    {
                        var userId = service.setAwaitingCustomerConfirmBy.Value.ToString();
                        return userMap.ContainsKey(userId) ? userMap[userId] : "None";
                    }
                    break;

                case "កំពុងរង់ចាំគ្រឿងបន្លាស់": // Awaiting Sparepart
                    if (service.setAwaitingSparepartBy.HasValue && service.setAwaitingSparepartBy.Value != Guid.Empty)
                    {
                        var userId = service.setAwaitingSparepartBy.Value.ToString();
                        return userMap.ContainsKey(userId) ? userMap[userId] : "None";
                    }
                    break;

                case "ជួសជុលខាងក្រៅ": // Third-Party Repair
                    if (service.thirdPartyRepairBy.HasValue && service.thirdPartyRepairBy.Value != Guid.Empty)
                    {
                        var userId = service.thirdPartyRepairBy.Value.ToString();
                        return userMap.ContainsKey(userId) ? userMap[userId] : "None";
                    }
                    break;

                case "ទទួលម៉ាស៊ីន": // Item Received
                    if (service.createby != Guid.Empty)
                    {
                        var userId = service.createby.ToString();
                        return userMap.ContainsKey(userId) ? userMap[userId] : "None";
                    }
                    break;
            }

            return "None"; // Default fallback
        }

        public void SetDataSource(
    List<RepairServices> repairServices,
    List<string> repairByUsers,
    List<string> verifiedByUsers,
    string currentUserName,
    Dictionary<string, string> userMap,
    List<string> selectedStatuses = null)
        {
            // Status translation dictionary
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
        { "Repair by Third-Party", "ជួសជុលខាងក្រៅ" }
    };

            // Update status and user names
            for (int i = 0; i < repairServices.Count; i++)
            {
                var service = repairServices[i];
                if (statusTranslation.ContainsKey(service.Status))
                {
                    service.Status = statusTranslation[service.Status];
                }
                service.RepairByName = repairByUsers[i];
                service.VerifiedByName = verifiedByUsers[i];
            }

            // Translate selected statuses to Khmer if provided
            var translatedSelectedStatuses = selectedStatuses?
                .Select(s => statusTranslation.ContainsKey(s) ? statusTranslation[s] : s)
                .ToList();

            // ✅ UPDATED: Dynamic grouping for "Finish" count based on selected statuses
            List<RepairServices> finishedServices;

            if (translatedSelectedStatuses != null && translatedSelectedStatuses.Any())
            {
                // Count services matching the selected statuses
                finishedServices = repairServices
                    .Where(s => translatedSelectedStatuses.Contains(s.Status))
                    .ToList();
            }
            else
            {
                // Default: only count "Finished" status
                finishedServices = repairServices
                    .Where(s => s.Status == "ជួសជុលរួចរាល់")
                    .ToList();
            }

            var finishedCountByEngineer = new Dictionary<string, int>();
            foreach (var service in finishedServices)
            {
                var groupKey = GetGroupingUserName(service, service.Status, userMap);
                if (!string.IsNullOrEmpty(groupKey) && groupKey != "None")
                {
                    finishedCountByEngineer[groupKey] = finishedCountByEngineer.GetValueOrDefault(groupKey, 0) + 1;
                }
            }

            // ✅ Spare part counting with proper filtering and summing
            var sparePartTotalByEngineer = new Dictionary<string, int>();

            foreach (var service in repairServices)
            {
                var groupKey = GetGroupingUserName(service, service.Status, userMap);

                if (!string.IsNullOrEmpty(groupKey) && service.SparePartItems != null && service.SparePartItems.Any())
                {
                    var sparePartQuantity = service.SparePartItems.Sum(sp => sp.Quantity);

                    if (groupKey != "None")
                    {
                        sparePartTotalByEngineer[groupKey] = sparePartTotalByEngineer.GetValueOrDefault(groupKey, 0) + sparePartQuantity;
                    }
                }
            }

            // Get all unique engineers from both dictionaries
            var allEngineers = finishedCountByEngineer.Keys
                .Union(sparePartTotalByEngineer.Keys)
                .Where(key => !string.IsNullOrEmpty(key) && key != "None")
                .Distinct()
                .ToList();

            // Create unique list of engineers with their counts
            var uniqueEngineers = allEngineers
                .Select(engineerName =>
                {
                    var representativeService = repairServices
                        .FirstOrDefault(s => GetGroupingUserName(s, s.Status, userMap) == engineerName);

                    return new RepairServices
                    {
                        RepairByName = engineerName,
                        Finish = finishedCountByEngineer.GetValueOrDefault(engineerName, 0),
                        SparePartTotal = sparePartTotalByEngineer.GetValueOrDefault(engineerName, 0),
                        ServiceLocation = representativeService?.ServiceLocation ?? "Unknown",
                        VerifiedByName = representativeService?.VerifiedByName ?? "Unknown"
                    };
                })
                .ToList();

            // Set the unique grouped data as the data source
            this.DataSource = uniqueEngineers;

            // Set parameters - ONLY Finish and SparePartTotal
            this.Parameters["Engineer"].Value = "[RepairByName]";
            this.Parameters["ServiceLocation"].Value = "[ServiceLocation]";
            this.Parameters["GeneratedBy"].Value = currentUserName;
            this.Parameters["Count"].Value = "[Finish]";
            this.Parameters["SparePartTotal"].Value = "[SparePartTotal]";
        }
    }
}