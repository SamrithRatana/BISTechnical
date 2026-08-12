using ServiceMaintenance.Models;
using ServiceMaintenance.Configuration;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;

namespace ServiceMaintenance.Services.BISServices
{
    public class MonthlyReportService
    {
        private readonly HttpClient _httpClient;

        public MonthlyReportService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        /// <summary>
        /// Get monthly report data grouped by engineer with date range and status filter
        /// </summary>
        public async Task<MonthlyReportResult> GetMonthlyReportAsync(
            DateTime fromDate,
            DateTime toDate,
            string status = null)
        {
            try
            {
                // Build query parameters
                var queryParams = new List<string>
                {
                    $"fromDate={fromDate:yyyy-MM-dd}",
                    $"toDate={toDate:yyyy-MM-dd}",
                    "pageSize=1000" // Get all records
                };

                if (!string.IsNullOrEmpty(status))
                    queryParams.Add($"status={Uri.EscapeDataString(status)}");

                var queryString = $"&{string.Join("&", queryParams)}";
                var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl($"/api/technicalservices/search{queryString}");

                Console.WriteLine($"Fetching monthly report: {fullUrl}");

                var response = await _httpClient.GetAsync(fullUrl);
                response.EnsureSuccessStatusCode();

                var responseContent = await response.Content.ReadAsStringAsync();

                // Parse response
                List<RepairServices> allServices = new List<RepairServices>();

                if (responseContent.Contains("\"items\"") && responseContent.Contains("\"totalCount\""))
                {
                    var paginatedResponse = JsonSerializer.Deserialize<PaginatedApiResponse>(responseContent,
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    allServices = paginatedResponse?.Items ?? new List<RepairServices>();
                }
                else
                {
                    allServices = JsonSerializer.Deserialize<List<RepairServices>>(responseContent,
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new List<RepairServices>();
                }

                // Adjust dates
                foreach (var service in allServices)
                {
                    AdjustServiceDates(service);
                }

                // Group by engineer and month
                var reportResult = new MonthlyReportResult
                {
                    FromDate = fromDate,
                    ToDate = toDate,
                    Status = status,
                    EngineerReports = new List<EngineerMonthlyReport>()
                };

                // Get the date to use based on status
                var servicesWithDates = allServices
                    .Select(s => new
                    {
                        Service = s,
                        Date = GetDateByStatus(s, status),
                        EngineerName = GetEngineerName(s, status)
                    })
                    .Where(x => x.Date.HasValue && !string.IsNullOrEmpty(x.EngineerName))
                    .ToList();

                // Group by engineer
                var engineerGroups = servicesWithDates
                    .GroupBy(x => x.EngineerName)
                    .OrderBy(g => g.Key);

                foreach (var engineerGroup in engineerGroups)
                {
                    var engineerReport = new EngineerMonthlyReport
                    {
                        EngineerName = engineerGroup.Key,
                        MonthlyData = new List<MonthlyData>()
                    };

                    // Group by month
                    var monthGroups = engineerGroup
                        .GroupBy(x => new { x.Date.Value.Year, x.Date.Value.Month })
                        .OrderBy(g => g.Key.Year)
                        .ThenBy(g => g.Key.Month);

                    foreach (var monthGroup in monthGroups)
                    {
                        var monthlyData = new MonthlyData
                        {
                            Year = monthGroup.Key.Year,
                            Month = monthGroup.Key.Month,
                            MonthName = new DateTime(monthGroup.Key.Year, monthGroup.Key.Month, 1).ToString("MMMM yyyy"),
                            Count = monthGroup.Count(),
                            Services = monthGroup.Select(x => x.Service).ToList()
                        };

                        engineerReport.MonthlyData.Add(monthlyData);
                    }

                    engineerReport.TotalCount = engineerReport.MonthlyData.Sum(m => m.Count);
                    reportResult.EngineerReports.Add(engineerReport);
                }

                reportResult.TotalServices = servicesWithDates.Count;

                return reportResult;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in GetMonthlyReportAsync: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// Get the appropriate date based on status
        /// </summary>
        private DateTime? GetDateByStatus(RepairServices service, string status)
        {
            if (string.IsNullOrEmpty(status))
                return service.ServiceDate;

            return status switch
            {
                "Inspection" => service.inspectDate,
                "Awaiting Customer Confirm" => service.awaitingCustomerConfirmDate,
                "Awaiting Sparepart" => service.awaitingSparepartDate,
                "Repairing" => service.repairDate,
                "Finished" => service.finishedDate,
                "Customer Rejected" => service.customerRejectedDate,
                "Unrepairable" => service.unrepairableDate,
                "Repair by Third-Party" => service.thirdPartyRepairDate,
                _ => service.ServiceDate
            };
        }

        /// <summary>
        /// Get the engineer name based on status
        /// </summary>
        private string GetEngineerName(RepairServices service, string status)
        {
            if (string.IsNullOrEmpty(status))
                return service.RepairByName ?? "Unassigned";

            // Return the appropriate engineer based on status
            return status switch
            {
                "Repairing" or "Finished" => service.RepairByName ?? "Unassigned",
                _ => service.RepairByName ?? "Unassigned"
            };
        }

        /// <summary>
        /// Helper method to adjust dates by adding 7 hours
        /// </summary>
        private void AdjustServiceDates(RepairServices service)
        {
            if (service.inspectDate.HasValue)
                service.inspectDate = service.inspectDate.Value.AddHours(7);

            if (service.awaitingCustomerConfirmDate.HasValue)
                service.awaitingCustomerConfirmDate = service.awaitingCustomerConfirmDate.Value.AddHours(7);

            if (service.awaitingSparepartDate.HasValue)
                service.awaitingSparepartDate = service.awaitingSparepartDate.Value.AddHours(7);

            if (service.repairDate.HasValue)
                service.repairDate = service.repairDate.Value.AddHours(7);

            if (service.finishedDate.HasValue)
                service.finishedDate = service.finishedDate.Value.AddHours(7);

            if (service.customerRejectedDate.HasValue)
                service.customerRejectedDate = service.customerRejectedDate.Value.AddHours(7);

            if (service.unrepairableDate.HasValue)
                service.unrepairableDate = service.unrepairableDate.Value.AddHours(7);

            if (service.thirdPartyRepairDate.HasValue)
                service.thirdPartyRepairDate = service.thirdPartyRepairDate.Value.AddHours(7);
        }
    }

    // Result models
    public class MonthlyReportResult
    {
        public DateTime FromDate { get; set; }
        public DateTime ToDate { get; set; }
        public string Status { get; set; }
        public int TotalServices { get; set; }
        public List<EngineerMonthlyReport> EngineerReports { get; set; }
    }

    public class EngineerMonthlyReport
    {
        public string EngineerName { get; set; }
        public int TotalCount { get; set; }
        public List<MonthlyData> MonthlyData { get; set; }
    }

    public class MonthlyData
    {
        public int Year { get; set; }
        public int Month { get; set; }
        public string MonthName { get; set; }
        public int Count { get; set; }
        public List<RepairServices> Services { get; set; }
    }
}