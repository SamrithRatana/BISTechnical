using Microsoft.AspNetCore.Http.HttpResults;
using TechnicalService.API.Apis;
using TechnicalService.Domain.AggregatesModel.RentalAggregate;

namespace TechnicalService.API.Application.Queries;

public class TechnicalServiceQueries(TechnicalServiceContext context)
    : ITechnicalServiceQueries
{
    public async Task<IEnumerable<ServiceType>> GetServiceTypesAsync() =>
        await context.ServiceTypes.Select(c => new ServiceType { Id = c.Id, Name = c.Name }).ToListAsync();

    public async Task<IEnumerable<ServicePriority>> GetServicePrioritiesAsync() =>
        await context.ServicePriorities.Select(c => new ServicePriority(c.Id, c.Name)).ToListAsync();

    public async Task<IEnumerable<ServiceStatus>> GetServiceStatusesAsync() =>
        await context.ServiceStatuses.Select(c => new ServiceStatus(c.Id, c.Name)).ToListAsync();

    /// <summary>
    /// Every dashboard stat tile in one query.
    ///
    /// Conditional COUNTs inside a single aggregate rather than one query per
    /// tile: SQL Server reads Services once and the API makes one round trip to
    /// a database that is on the other side of the internet, which is where the
    /// latency actually lives.
    ///
    /// Date boundaries are half-open (>= start, &lt; end) rather than
    /// `.Date ==` — casting the column to date in the predicate would rule out
    /// the IX_Services_ServiceDate seek, the same reasoning as in
    /// SearchServicesAsync.
    /// </summary>
    public async Task<DashboardStats> GetDashboardStatsAsync()
    {
        var today = DateTime.Today;
        var tomorrow = today.AddDays(1);
        var monthStart = new DateTime(today.Year, today.Month, 1);
        var nextMonthStart = monthStart.AddMonths(1);

        return await context.Services
            .AsNoTracking()
            .GroupBy(_ => 1)
            .Select(g => new DashboardStats
            {
                TodayCount = g.Count(s => s.ServiceDate >= today && s.ServiceDate < tomorrow),
                ReceivedCount = g.Count(s => s.Status.Name == "Item Recieved"),
                WaitingCustomerCount = g.Count(s => s.Status.Name == "Awaiting Customer Confirm"),
                WaitingSpareCount = g.Count(s => s.Status.Name == "Awaiting Sparepart"),
                FinishedCount = g.Count(s => s.Status.Name == "Finished"),
                FinishedThisMonthCount = g.Count(s =>
                    s.FinishedDate.HasValue &&
                    s.FinishedDate.Value >= monthStart &&
                    s.FinishedDate.Value < nextMonthStart),
            })
            // An empty Services table produces no group at all, and the tiles
            // should read 0 rather than the endpoint returning null.
            .FirstOrDefaultAsync() ?? new DashboardStats();
    }

    // UPDATED: Now returns PagedResult<Service>
    public async Task<PagedResult<Service>> GetServicesAsync(int pageNumber, int pageSize)
    {
        var query = context.Services.AsQueryable();
        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(s => s.ServiceDate)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(s => new Service
            {
                Id = s.Id,
                ReportNo = s.ReportNo,
                ServiceDate = s.ServiceDate,
                CompanyName = s.CompanyName,
                Address = s.Address,
                ContactName = s.ContactName,
                PhoneNumber = s.PhoneNumber,
                ItemName = s.Item.ItemName,
                SerialNumber = s.Item.SerialNumber,
                CustomerRequest = s.CustomerRequest,
                Inspection = s.Inspection,
                Solution = s.Solution,
                ServiceLocation = s.ServiceLocation.ToString(),
                ServiceType = s.ServiceType.Name,
                ServicePriority = s.ServicePriority.ToString(),
                Status = s.Status.ToString(),
                HasContract = s.HasContract,
                CreateBy = s.CreateBy,
                InspectDate = s.InspectDate,
                InspectBy = s.InspectBy,
                InspectingBy = s.InspectingBy,
                InspectingDate = s.InspectingDate,
                UnrepairableDate = s.UnrepairableDate,
                SetUnrepairableBy = s.SetUnrepairableBy,
                CustomerRejectedDate = s.CustomerRejectedDate,
                SetCustomerRejectedBy = s.SetCustomerRejectedBy,
                AwaitingCustomerConfirmDate = s.AwaitingCustomerConfirmDate,
                SetAwaitingCustomerConfirmBy = s.SetAwaitingCustomerConfirmBy,
                AwaitingSparepartDate = s.AwaitingSparepartDate,
                SetAwaitingSparepartBy = s.SetAwaitingSparepartBy,
                RepairDate = s.RepairDate,
                RepairBy = s.RepairBy,
                ThirdPartyRepairDate = s.ThirdPartyRepairDate,
                ThirdPartyRepairBy = s.ThirdPartyRepairBy,
                IsThirdPartyRepair = s.ThirdPartyRepairDate != null || s.ThirdPartyRepairBy != null,
                FinishedDate = s.FinishedDate,
                VerifiedBy = s.VerifiedBy,
                SaleConfirmedDate = s.SaleConfirmedDate,
                SetSaleConfirmedBy = s.SetSaleConfirmedBy,
                SparepartItems = s.SparepartItems.Select(si => new SparepartItem
                {
                    Id = si.Id,
                    SparepartId = si.SparepartId,
                    Description = si.Description,
                    Quantity = si.Quantity,
                    Condition = si.Condition.ToString(),
                    Remarks = si.Remarks,
                    RemarksUpdatedAt = si.RemarksUpdatedAt // ✅ NEW

                }).ToList()
            }).ToListAsync();

        return new PagedResult<Service>(items, totalCount, pageNumber, pageSize);
    }
    // ══════════════════════════════════════════════════════════════════
    // Replace ONLY the GetSparepartUsageByDateRangeAsync method in
    // TechnicalServiceQueries.cs with this version.
    // ══════════════════════════════════════════════════════════════════

    public async Task<PagedResult<SparepartUsageSummary>> GetSparepartUsageByDateRangeAsync(
     SparepartUsageQuery query)
    {
        bool conditionFilterActive = !string.IsNullOrWhiteSpace(query.Condition);
        bool serviceTypeFilterActive = !string.IsNullOrWhiteSpace(query.ServiceType);
        bool wantServiceOnly = query.SourceFilter == "Service";
        bool wantManualOnly = query.SourceFilter == "Manual";

        bool conditionEnumParsed = false;
        Domain.AggregatesModel.TechnicalAggregate.SparepartCondition conditionEnumValue = default;

        if (conditionFilterActive &&
            Enum.TryParse<Domain.AggregatesModel.TechnicalAggregate.SparepartCondition>(
                query.Condition, out var parsedCondition))
        {
            conditionEnumParsed = true;
            conditionEnumValue = parsedCondition;
        }

        var serviceLogs = new List<(Guid SparepartId, int Qty, string Condition, string Source)>();
        var serviceLogDetails = new List<(Guid SparepartId, UsageServiceInfo Detail)>();

        if (!wantManualOnly)
        {
            if (query.DateMode == "alwayscreated")
            {
                var rawCreated =
                    from svc in context.Services
                        .AsNoTracking()
                        .Include(s => s.ServiceType)
                        .Include(s => s.Status)
                        .Include(s => s.Item)
                    join si in context.SparepartItems.AsNoTracking()
                        on svc.Id equals si.ServiceId
                    where
                        si.IsHoldStatus == false &&
                        si.SparepartId != Guid.Empty &&
                        si.Quantity > 0 &&
                        (!serviceTypeFilterActive || svc.ServiceType.Name == query.ServiceType) &&
                        (!conditionFilterActive || !conditionEnumParsed || si.Condition == conditionEnumValue) &&
                        (!string.IsNullOrWhiteSpace(query.Status)
                            ? svc.Status.Name == query.Status
                            : true)
                    select new
                    {
                        si.SparepartId,
                        Qty = si.Quantity,
                        ConditionEnum = si.Condition,
                        Source = "Service",
                        ServiceId = svc.Id,
                        svc.ReportNo,
                        svc.CompanyName,
                        ServiceStatus = svc.Status.Name,
                        ServiceTypeName = svc.ServiceType.Name,
                        MachineItemName = svc.Item != null ? svc.Item.ItemName : "",
                        MachineSerialNumber = svc.Item != null ? svc.Item.SerialNumber : "",
                        ProcessDate = (DateTime?)svc.ServiceDate
                    };

                if (query.FromDate.HasValue)
                    rawCreated = rawCreated.Where(x =>
                        x.ProcessDate.HasValue &&
                        x.ProcessDate.Value.Date >= query.FromDate.Value.Date);

                if (query.ToDate.HasValue)
                    rawCreated = rawCreated.Where(x =>
                        x.ProcessDate.HasValue &&
                        x.ProcessDate.Value.Date <= query.ToDate.Value.Date);

                var fetchedCreated = await rawCreated.ToListAsync();

                serviceLogs = fetchedCreated
                    .Select(x => (x.SparepartId, x.Qty, x.ConditionEnum.ToString(), x.Source))
                    .ToList();

                serviceLogDetails = fetchedCreated
                    .Select(x => (
                        x.SparepartId,
                        Detail: new UsageServiceInfo
                        {
                            ServiceId = x.ServiceId,
                            ReportNo = x.ReportNo ?? "",
                            CompanyName = x.CompanyName ?? "",
                            ServiceStatus = x.ServiceStatus ?? "",
                            Quantity = x.Qty,
                            Condition = x.ConditionEnum.ToString(),
                            ServiceType = x.ServiceTypeName ?? "",
                            ProcessDate = x.ProcessDate,
                            Source = "Service",
                            Reason = null,
                            ItemSerialNumber = "",
                            MachineItemName = x.MachineItemName ?? "",
                            MachineSerialNumber = x.MachineSerialNumber ?? ""
                        }
                    )).ToList();
            }
            else
            {
                var rawServiceQuery =
                    from svc in context.Services
                        .AsNoTracking()
                        .Include(s => s.ServiceType)
                        .Include(s => s.Status)
                        .Include(s => s.Item)
                    join si in context.SparepartItems.AsNoTracking()
                        on svc.Id equals si.ServiceId
                    where
                        si.IsHoldStatus == false &&
                        si.SparepartId != Guid.Empty &&
                        si.Quantity > 0 &&
                        (!serviceTypeFilterActive || svc.ServiceType.Name == query.ServiceType) &&
                        (!conditionFilterActive || !conditionEnumParsed || si.Condition == conditionEnumValue)
                    select new
                    {
                        si.SparepartId,
                        Qty = si.Quantity,
                        ConditionEnum = si.Condition,
                        Source = "Service",
                        ServiceId = svc.Id,
                        svc.ReportNo,
                        svc.CompanyName,
                        ServiceStatus = svc.Status.Name,
                        ServiceTypeName = svc.ServiceType.Name,
                        MachineItemName = svc.Item != null ? svc.Item.ItemName : "",
                        MachineSerialNumber = svc.Item != null ? svc.Item.SerialNumber : "",
                        ProcessDate = (DateTime?)(
                            svc.Status.Name == "Finished"
                                ? svc.FinishedDate :
                            svc.Status.Name == "Repairing"
                                ? svc.RepairDate :
                            svc.Status.Name == "Repair by Third-Party"
                                ? svc.ThirdPartyRepairDate :
                            svc.Status.Name == "Unrepairable"
                                ? svc.UnrepairableDate :
                            svc.Status.Name == "Customer Rejected"
                                ? svc.CustomerRejectedDate :
                            svc.Status.Name == "Awaiting Customer Confirm"
                                ? svc.AwaitingCustomerConfirmDate :
                            svc.Status.Name == "Awaiting Sparepart"
                                ? svc.AwaitingSparepartDate :
                            svc.Status.Name == "Inspection"
                                ? svc.InspectDate :
                            (DateTime?)svc.ServiceDate)
                    };

                if (!string.IsNullOrWhiteSpace(query.Status))
                    rawServiceQuery = rawServiceQuery
                        .Where(x => x.ServiceStatus == query.Status);

                if (query.FromDate.HasValue)
                    rawServiceQuery = rawServiceQuery.Where(x =>
                        x.ProcessDate.HasValue &&
                        x.ProcessDate.Value.Date >= query.FromDate.Value.Date);

                if (query.ToDate.HasValue)
                    rawServiceQuery = rawServiceQuery.Where(x =>
                        x.ProcessDate.HasValue &&
                        x.ProcessDate.Value.Date <= query.ToDate.Value.Date);

                var fetched = await rawServiceQuery.ToListAsync();

                serviceLogs = fetched
                    .Select(x => (x.SparepartId, x.Qty, x.ConditionEnum.ToString(), x.Source))
                    .ToList();

                serviceLogDetails = fetched
                    .Select(x => (
                        x.SparepartId,
                        Detail: new UsageServiceInfo
                        {
                            ServiceId = x.ServiceId,
                            ReportNo = x.ReportNo ?? "",
                            CompanyName = x.CompanyName ?? "",
                            ServiceStatus = x.ServiceStatus ?? "",
                            Quantity = x.Qty,
                            Condition = x.ConditionEnum.ToString(),
                            ServiceType = x.ServiceTypeName ?? "",
                            ProcessDate = x.ProcessDate,
                            Source = "Service",
                            Reason = null,
                            ItemSerialNumber = "",
                            MachineItemName = x.MachineItemName ?? "",
                            MachineSerialNumber = x.MachineSerialNumber ?? ""
                        }
                    )).ToList();
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // PART 3: Manual logs
        // ─────────────────────────────────────────────────────────────────────
        var manualLogs = new List<(Guid SparepartId, int Qty, string Source)>();
        var manualLogDetails = new List<(Guid SparepartId, UsageServiceInfo Detail)>();

        bool wantManual = query.IncludeManualStockOut
                       && !conditionFilterActive
                       && !serviceTypeFilterActive
                       && !wantServiceOnly;

        if (wantManual)
        {
            var manualQuery = context.SparepartStockAuditLogs
                .AsNoTracking()
                .Where(log =>
                    log.OperationType == "STOCK_OUT" &&
                    log.QuantityChange < 0 &&
                    log.ServiceId == null);

            if (query.FromDate.HasValue)
                manualQuery = manualQuery.Where(log =>
                    log.Timestamp.Date >= query.FromDate.Value.Date);

            if (query.ToDate.HasValue)
                manualQuery = manualQuery.Where(log =>
                    log.Timestamp.Date <= query.ToDate.Value.Date);

            var fetched = await manualQuery
                .Select(log => new
                {
                    log.SparepartId,
                    Qty = Math.Abs(log.QuantityChange),
                    log.Remarks,
                    log.Timestamp
                })
                .ToListAsync();

            manualLogs = fetched
                .Select(x => (x.SparepartId, x.Qty, Source: "Manual"))
                .ToList();

            manualLogDetails = fetched
                .Select(x => (
                    x.SparepartId,
                    Detail: new UsageServiceInfo
                    {
                        ServiceId = Guid.Empty,
                        ReportNo = "—",
                        CompanyName = "Manual Stock Out",
                        ServiceStatus = "—",
                        Quantity = x.Qty,
                        Condition = "—",
                        ServiceType = "—",
                        ProcessDate = x.Timestamp,
                        Source = "Manual",
                        Reason = x.Remarks ?? "—",
                        ItemSerialNumber = "",
                        MachineItemName = "",
                        MachineSerialNumber = ""
                    }
                )).ToList();
        }

        // ─────────────────────────────────────────────────────────────────────
        // PART 4: Merge + Group
        // ─────────────────────────────────────────────────────────────────────
        var allItems = serviceLogs
            .Select(x => new { x.SparepartId, x.Qty, x.Condition, x.Source })
            .Concat(manualLogs.Select(x => new
            {
                x.SparepartId,
                x.Qty,
                Condition = (string)null,
                x.Source
            }))
            .ToList();

        var grouped = allItems
            .GroupBy(x => x.SparepartId)
            .Select(g => new
            {
                SparepartId = g.Key,
                TotalQuantity = g.Sum(x => x.Qty),
                ServiceUsedQty = g.Where(x => x.Source == "Service").Sum(x => x.Qty),
                ManualUsedQty = g.Where(x => x.Source == "Manual").Sum(x => x.Qty),
                UsageCount = g.Count(),
                ServiceUsageCount = g.Count(x => x.Source == "Service"),
                ManualStockOutCount = g.Count(x => x.Source == "Manual"),
                Conditions = g
                    .Where(x => x.Condition != null)
                    .Select(x => x.Condition)
                    .Distinct()
                    .ToList(),
                Services = serviceLogDetails
                    .Where(d => d.SparepartId == g.Key)
                    .Select(d => d.Detail)
                    .Concat(manualLogDetails
                        .Where(d => d.SparepartId == g.Key)
                        .Select(d => d.Detail))
                    .OrderByDescending(d => d.ProcessDate)
                    .ToList()
            })
            .ToList();

        // ─────────────────────────────────────────────────────────────────────
        // PART 5: Lookup Spareparts
        // ─────────────────────────────────────────────────────────────────────
        var ids = grouped.Select(g => g.SparepartId).ToList();

        var spareparts = await context.Spareparts
            .AsNoTracking()
            .Where(sp => ids.Contains(sp.Id))
            .Select(sp => new
            {
                sp.Id,
                sp.ItemName,
                sp.SerialNumber,
                sp.Quantity
            })
            .ToListAsync();

        var results = grouped
            .Join(
                spareparts,
                g => g.SparepartId,
                sp => sp.Id,
                (g, sp) => new SparepartUsageSummary
                {
                    SparepartId = g.SparepartId,
                    ItemName = sp.ItemName,
                    SerialNumber = sp.SerialNumber,
                    StockQuantity = sp.Quantity,
                    UsedQuantity = g.TotalQuantity,
                    ServiceUsedQty = g.ServiceUsedQty,
                    ManualUsedQty = g.ManualUsedQty,
                    UsageCount = g.UsageCount,
                    ServiceUsageCount = g.ServiceUsageCount,
                    ManualStockOutCount = g.ManualStockOutCount,
                    Conditions = g.Conditions,
                    Services = g.Services
                })
            .AsQueryable();

        // ─────────────────────────────────────────────────────────────────────
        // PART 6: Search
        // ─────────────────────────────────────────────────────────────────────
        if (!string.IsNullOrWhiteSpace(query.SearchTerm))
        {
            var s = query.SearchTerm.ToLower().Trim();
            results = results.Where(r =>
                r.ItemName.ToLower().Contains(s) ||
                (r.SerialNumber != null && r.SerialNumber.ToLower().Contains(s)) ||
                r.Services.Any(svc =>
                    !string.IsNullOrEmpty(svc.ReportNo) &&
                    svc.ReportNo.ToLower().Contains(s)) ||
                r.Services.Any(svc =>
                    !string.IsNullOrEmpty(svc.MachineSerialNumber) &&
                    svc.MachineSerialNumber.ToLower().Contains(s)) ||
                r.Services.Any(svc =>
                    !string.IsNullOrEmpty(svc.MachineItemName) &&
                    svc.MachineItemName.ToLower().Contains(s))
            );
        }

        // ─────────────────────────────────────────────────────────────────────
        // PART 7: Sort
        // ─────────────────────────────────────────────────────────────────────
        results = query.SortBy?.ToLower() switch
        {
            "itemname" => query.SortDescending
                ? results.OrderByDescending(r => r.ItemName)
                : results.OrderBy(r => r.ItemName),
            "usedquantity" => query.SortDescending
                ? results.OrderByDescending(r => r.UsedQuantity)
                : results.OrderBy(r => r.UsedQuantity),
            "usagecount" => query.SortDescending
                ? results.OrderByDescending(r => r.UsageCount)
                : results.OrderBy(r => r.UsageCount),
            _ => results.OrderByDescending(r => r.UsedQuantity)
        };

        // ─────────────────────────────────────────────────────────────────────
        // PART 8: Count + Totals BEFORE paginate
        // ─────────────────────────────────────────────────────────────────────
        var totalCount = results.Count();
        var totalUsedQuantity = results.Sum(r => r.UsedQuantity);
        var totalServiceUsedQty = results.Sum(r => r.ServiceUsedQty);
        var totalManualUsedQty = results.Sum(r => r.ManualUsedQty);

        var paged = results
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToList();

        var pageResult = new PagedResult<SparepartUsageSummary>(
            paged, totalCount, query.PageNumber, query.PageSize);

        pageResult.TotalUsedQuantity = totalUsedQuantity;
        pageResult.TotalServiceUsedQuantity = totalServiceUsedQty;
        pageResult.TotalManualUsedQuantity = totalManualUsedQty;

        return pageResult;
    }
    public async Task<PagedResult<SparepartHoldSummary>> GetSparepartHoldStatusAsync(
      SparepartHoldQuery query)
    {
        // ── STEP 1: Query Services ដែលមាន SparepartItems IsHoldStatus=true ──
        // ✅ FIX: Join ពី Services → SparepartItems (navigation property)
        //         ជំនួស join ពី SparepartItems → Services
        //         ព្រោះ SparepartItem entity មិនមាន ServiceId property
        var servicesQuery = context.Services
            .AsNoTracking()
            .Include(s => s.Status)
            .Include(s => s.ServiceType)
            .Include(s => s.SparepartItems)
            .Where(s => s.SparepartItems.Any(si =>
                si.IsHoldStatus == true &&
                si.SparepartId != Guid.Empty &&
                si.Quantity > 0))
            .AsQueryable();

        // Filter by Status
        if (!string.IsNullOrEmpty(query.Status))
            servicesQuery = servicesQuery.Where(s => s.Status.Name == query.Status);

        // Filter by ServiceType
        if (!string.IsNullOrEmpty(query.ServiceType))
            servicesQuery = servicesQuery.Where(s => s.ServiceType.Name == query.ServiceType);

        var services = await servicesQuery.ToListAsync();

        // ── STEP 2: Flatten SparepartItems from each Service ─────────────
        // ✅ ដឹង ServiceId ពី s.Id (parent Service)
        var rawData = services
            .SelectMany(s => s.SparepartItems
                .Where(si =>
                    si.IsHoldStatus == true &&
                    si.SparepartId != Guid.Empty &&
                    si.Quantity > 0)
                .Select(si => new
                {
                    si.SparepartId,
                    si.Quantity,
                    Condition = si.Condition.ToString(),
                    ServiceId = s.Id,
                    ServiceStatus = s.Status.Name,
                    ServiceType = s.ServiceType.Name,
                    ReportNo = s.ReportNo,
                    CompanyName = s.CompanyName,
                }))
            .ToList();

        // ── STEP 3: Group by SparepartId ─────────────────────────────────
        var grouped = rawData
            .GroupBy(x => x.SparepartId)
            .Select(g => new
            {
                SparepartId = g.Key,
                TotalHoldQty = g.Sum(x => x.Quantity),
                HoldCount = g.Count(),
                Services = g.Select(x => new HoldServiceInfo
                {
                    ServiceId = x.ServiceId,
                    ReportNo = x.ReportNo,
                    CompanyName = x.CompanyName,
                    ServiceStatus = x.ServiceStatus,
                    Quantity = x.Quantity,
                    Condition = x.Condition
                }).ToList()
            }).ToList();

        // ── STEP 4: Lookup Sparepart details ─────────────────────────────
        var ids = grouped.Select(g => g.SparepartId).ToList();

        var spareparts = await context.Spareparts
            .AsNoTracking()
            .Where(sp => ids.Contains(sp.Id))
            .Select(sp => new
            {
                sp.Id,
                sp.ItemName,
                sp.SerialNumber,
                sp.Quantity
            })
            .ToListAsync();

        var results = grouped
            .Join(spareparts,
                  g => g.SparepartId,
                  sp => sp.Id,
                  (g, sp) => new SparepartHoldSummary
                  {
                      SparepartId = g.SparepartId,
                      ItemName = sp.ItemName,
                      SerialNumber = sp.SerialNumber,
                      CurrentStock = sp.Quantity,
                      TotalHoldQty = g.TotalHoldQty,
                      HoldCount = g.HoldCount,
                      Services = g.Services
                  })
            .AsQueryable();

        // ── STEP 5: Search ────────────────────────────────────────────────
        if (!string.IsNullOrWhiteSpace(query.SearchTerm))
        {
            var s = query.SearchTerm.ToLower();
            results = results.Where(r =>
                r.ItemName.ToLower().Contains(s) ||
                (r.SerialNumber != null && r.SerialNumber.ToLower().Contains(s)));
        }

        // ── STEP 6: Sort ──────────────────────────────────────────────────
        results = query.SortBy?.ToLower() switch
        {
            "itemname" => query.SortDescending
                            ? results.OrderByDescending(r => r.ItemName)
                            : results.OrderBy(r => r.ItemName),
            "holdcount" => query.SortDescending
                            ? results.OrderByDescending(r => r.HoldCount)
                            : results.OrderBy(r => r.HoldCount),
            _ => query.SortDescending
                            ? results.OrderByDescending(r => r.TotalHoldQty)
                            : results.OrderBy(r => r.TotalHoldQty)
        };

        // ── STEP 7: Totals + Paginate ─────────────────────────────────────
        var totalCount = results.Count();
        var totalHoldQty = results.Sum(r => r.TotalHoldQty);
        var totalHoldJobs = results.Sum(r => r.HoldCount);

        var paged = results
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToList();

        var pageResult = new PagedResult<SparepartHoldSummary>(
            paged, totalCount, query.PageNumber, query.PageSize);

        pageResult.TotalHoldQty = totalHoldQty;
        pageResult.TotalHoldJobs = totalHoldJobs;

        return pageResult;
    }



    // ══════════════════════════════════════════════════════════════════
    // Also add TotalUsedQuantity to your backend PagedResult<T> class:
    //
    //   public class PagedResult<T>
    //   {
    //       public PagedResult(List<T> items, int totalCount, int pageNumber, int pageSize) { ... }
    //       public List<T> Items { get; set; }
    //       public int TotalCount { get; set; }
    //       public int PageNumber { get; set; }
    //       public int PageSize { get; set; }
    //       public int TotalPages { get; set; }
    //       public int TotalUsedQuantity { get; set; }  // ✅ ADD THIS
    //   }
    // ══════════════════════════════════════════════════════════════════

    public async Task<Service> GetServiceAsync(Guid id)
    {
        var repairService = await context.Services
            .Include(r => r.Item)
            .Include(r => r.Item.ItemType)
            .Include(r => r.ServiceType)
            .Include(r => r.ServicePriority)
            .Include(r => r.Status)
            .Include(r => r.SparepartItems)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (repairService is null)
            throw new KeyNotFoundException();

        return new Service
        {
            Id = repairService.Id,
            ReportNo = repairService.ReportNo,
            ServiceDate = repairService.ServiceDate,
            CompanyName = repairService.CompanyName,
            Address = repairService.Address,
            ContactName = repairService.ContactName,
            PhoneNumber = repairService.PhoneNumber,
            ItemName = repairService.Item.ItemName,
            SerialNumber = repairService.Item.SerialNumber,
            CustomerRequest = repairService.CustomerRequest,
            Inspection = repairService.Inspection,
            Solution = repairService.Solution,
            ServiceLocation = repairService.ServiceLocation.ToString(),
            ServiceType = repairService.ServiceType.Name,
            ServicePriority = repairService.ServicePriority.Name,
            Status = repairService.Status.Name,
            HasContract = repairService.HasContract,
            CreateBy = repairService.CreateBy,
            InspectDate = repairService.InspectDate,
            InspectBy = repairService.InspectBy,
            InspectingBy = repairService.InspectingBy,
            InspectingDate = repairService.InspectingDate,
            UnrepairableDate = repairService.UnrepairableDate,
            SetUnrepairableBy = repairService.SetUnrepairableBy,
            CustomerRejectedDate = repairService.CustomerRejectedDate,
            SetCustomerRejectedBy = repairService.SetCustomerRejectedBy,
            AwaitingCustomerConfirmDate = repairService.AwaitingCustomerConfirmDate,
            SetAwaitingCustomerConfirmBy = repairService.SetAwaitingCustomerConfirmBy,
            AwaitingSparepartDate = repairService.AwaitingSparepartDate,
            SetAwaitingSparepartBy = repairService.SetAwaitingSparepartBy,
            RepairDate = repairService.RepairDate,
            RepairBy = repairService.RepairBy,
            ThirdPartyRepairDate = repairService.ThirdPartyRepairDate,
            ThirdPartyRepairBy = repairService.ThirdPartyRepairBy,
            IsThirdPartyRepair = repairService.ThirdPartyRepairDate != null || repairService.ThirdPartyRepairBy != null,
            FinishedDate = repairService.FinishedDate,
            VerifiedBy = repairService.VerifiedBy,
            SaleConfirmedDate = repairService.SaleConfirmedDate,
            SetSaleConfirmedBy = repairService.SetSaleConfirmedBy,
            SparepartItems = repairService.SparepartItems.Select(si => new SparepartItem
            {
                Id = si.Id,
                SparepartId = si.SparepartId,
                Description = si.Description,
                Quantity = si.Quantity,
                Condition = si.Condition.ToString(),
                Remarks = si.Remarks,
                 RemarksUpdatedAt = si.RemarksUpdatedAt // ✅ NEW
            }).ToList()
        };
    }
    // UPDATED: Now returns PagedResult<Item>
    public async Task<PagedResult<Item>> GetItemsAsync(int pageNumber, int pageSize)
    {
        var query = context.Items.AsQueryable();
        var totalCount = await query.CountAsync();

        var items = await query
            .OrderBy(i => i.ItemName)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new Item
            {
                Id = p.Id,
                ItemName = p.ItemName,
                SerialNumber = p.SerialNumber,
                ItemType = p.ItemType.Type
            }).ToListAsync();

        return new PagedResult<Item>(items, totalCount, pageNumber, pageSize);
    }

    public async Task<Item> GetItemAsync(Guid id)
    {
        var item = await context.Items
            .FirstOrDefaultAsync(i => i.Id == id);

        if (item is null)
            throw new KeyNotFoundException();

        return new Item
        {
            Id = item.Id,
            ItemName = item.ItemName,
            SerialNumber = item.SerialNumber,
            ItemType = item.ItemType.Type
        };
    }

    public async Task<PagedResult<Sparepart>> GetSparepartsAsync(int pageNumber, int pageSize)
    {
        var query = context.Spareparts.AsQueryable();
        var totalCount = await query.CountAsync();

        var items = await query
            .OrderBy(s => s.ItemName)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new Sparepart
            {
                Id = p.Id,
                ItemName = p.ItemName,
                SerialNumber = p.SerialNumber,
                Description = p.Description,
                UseFor = p.UserFor,
                PictureUrl = p.PictureUrl,
                LinkItemId = p.LinkItemId,
                Quantity = p.Quantity,// ✅ ADD THIS LINE
                    DefaultPrice = p.DefaultPrice // ✅ ADD

            }).ToListAsync();

        return new PagedResult<Sparepart>(items, totalCount, pageNumber, pageSize);
    }

    public async Task<IEnumerable<ReceiveItem>> GetReceiveItemsAsync()
    {
        return await context.Services.Where(s => s.Status == Domain.AggregatesModel.TechnicalAggregate.ServiceStatus.ItemReceived)
            .Select(s =>
                new ReceiveItem
                {
                    Id = s.Id,
                    CompanyName = s.CompanyName,
                    Address = s.Address,
                    ContactName = s.ContactName,
                    PhoneNumber = s.PhoneNumber,
                    HasContract = s.HasContract,
                    ServiceDate = s.ServiceDate,
                    ReportNo = s.ReportNo,
                    ServiceLocation = s.ServiceLocation.ToString(),
                    ServicePriority = s.ServicePriority.ToString(),
                    CustomerRequest = s.CustomerRequest
                }).ToListAsync();
    }

    public async Task<IEnumerable<Service>> GetInpsectItemsAsync()
    {
        return await context.Services.Where(s => s.Status == Domain.AggregatesModel.TechnicalAggregate.ServiceStatus.Inspection)
            .Select(s =>
                new Service
                {
                    Id = s.Id,
                    CompanyName = s.CompanyName,
                    Address = s.Address,
                    ContactName = s.ContactName,
                    PhoneNumber = s.PhoneNumber,
                    HasContract = s.HasContract,
                    ServiceDate = s.ServiceDate,
                    ReportNo = s.ReportNo,
                    ServiceLocation = s.ServiceLocation.ToString(),
                    ServicePriority = s.ServicePriority.ToString(),
                    CustomerRequest = s.CustomerRequest,
                    Inspection = s.Inspection,
                    Solution = s.Solution,
                    SparepartItems = s.SparepartItems.Select(si => new SparepartItem
                    {
                        Id = si.Id,  // ✅ ADD THIS
                        SparepartId = si.SparepartId,
                        Description = si.Description,
                        Quantity = si.Quantity,
                        Remarks = si.Remarks,
                        RemarksUpdatedAt = si.RemarksUpdatedAt // ✅ NEW
                    }).ToList()
                }).ToListAsync();
    }

    public async Task<IEnumerable<Service>> GetAwaitingCustomerConfirmsAsync()
    {
        return await context.Services.Where(s => s.Status == Domain.AggregatesModel.TechnicalAggregate.ServiceStatus.AwaitingCustomerConfirm)
            .Select(s =>
                new Service
                {
                    Id = s.Id,
                    CompanyName = s.CompanyName,
                    Address = s.Address,
                    ContactName = s.ContactName,
                    PhoneNumber = s.PhoneNumber,
                    HasContract = s.HasContract,
                    ServiceDate = s.ServiceDate,
                    ReportNo = s.ReportNo,
                    ServiceLocation = s.ServiceLocation.ToString(),
                    ServicePriority = s.ServicePriority.ToString(),
                    CustomerRequest = s.CustomerRequest,
                    Inspection = s.Inspection,
                    Solution = s.Solution,
                    SparepartItems = s.SparepartItems.Select(si => new SparepartItem
                    {
                        Id = si.Id,  // ✅ ADD THIS
                        SparepartId = si.SparepartId,
                        Description = si.Description,
                        Quantity = si.Quantity,
                        Remarks = si.Remarks,
                        RemarksUpdatedAt = si.RemarksUpdatedAt // ✅ NEW

                    }).ToList()
                }).ToListAsync();
    }

    // UPDATED: Now returns PagedResult<RentalItem>
    public async Task<PagedResult<RentalItem>> GetRentalItemsAsync(int pageNumber, int pageSize)
    {
        var query = context.RentalItems.AsQueryable();
        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(i => i.CreatedAt)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(i => new RentalItem
            {
                Id = i.Id,
                CreateBy = i.CreatedBy,
                CustomerId = i.CustomerId,
                CustomerName = i.CustomerName,
                ItemName = i.ItemName,
                SerialNumber = i.SerialNumber,
                Condition = i.Condition,
                Location = i.Location,
                Duration = i.Duration
            }).ToListAsync();

        return new PagedResult<RentalItem>(items, totalCount, pageNumber, pageSize);
    }

    public async Task<RentalItem> GetRentalItemAsync(Guid id)
    {
        var rentalItem = await context.RentalItems
            .FirstOrDefaultAsync(i => i.Id == id);

        if (rentalItem is null)
            throw new KeyNotFoundException();

        return new RentalItem
        {
            Id = rentalItem.Id,
            CreateBy = rentalItem.CreatedBy,
            CustomerId = rentalItem.CustomerId,
            CustomerName = rentalItem.CustomerName,
            ItemName = rentalItem.ItemName,
            SerialNumber = rentalItem.SerialNumber,
            Condition = rentalItem.Condition,
            Location = rentalItem.Location,
            Duration = rentalItem.Duration
        };
    }

    // UPDATED: Now returns PagedResult<RentalService>
    public async Task<PagedResult<RentalService>> GetRentalServicesAsync(int pageNumber, int pageSize)
    {
        var query = context.RentalServices.AsQueryable();
        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(r => r.Date)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new RentalService
            {
                Id = r.Id,
                RentalItemId = r.RentalItemId,
                Date = r.Date,
                Action = r.Action.ToString(),
                Note = r.Note,
                UserId = r.UserId,
                Spareparts = r.Spareparts.Select(si => new SparepartItem
                {
                    Id = si.Id,
                    SparepartId = si.SparepartId,
                    Description = si.Description,
                    Quantity = si.Quantity,
                    Condition = si.Condition.ToString(),

                }).ToList()
            }).ToListAsync();

        return new PagedResult<RentalService>(items, totalCount, pageNumber, pageSize);
    }

    public async Task<RentalService> GetRentalServiceAsync(Guid id)
    {
        var rentalService = await context.RentalServices
            .FirstOrDefaultAsync(i => i.Id == id);

        if (rentalService is null)
            throw new KeyNotFoundException();

        return new RentalService
        {
            Id = rentalService.Id,
            RentalItemId = rentalService.RentalItemId,
            Date = rentalService.Date,
            Action = rentalService.Action.ToString(),
            Note = rentalService.Note,
            UserId = rentalService.UserId,
            Spareparts = rentalService.Spareparts.Select(si => new SparepartItem
            {
                SparepartId = si.SparepartId,
                Description = si.Description,
                Quantity = si.Quantity,
                Condition = si.Condition.ToString()
            }).ToList()
        };
    }

    public async Task<RentalItemDetail> GetRentalItemDetailAsync(Guid id)
    {
        var rentalItem = await context.RentalItems
            .FirstOrDefaultAsync(i => i.Id == id);

        var rentalServices = await context.RentalServices
            .Where(rs => rs.RentalItemId == id)
            .Select(rs => new RentalService
            {
                Id = rs.Id,
                RentalItemId = rs.RentalItemId,
                Date = rs.Date,
                Action = rs.Action.ToString(),
                Note = rs.Note,
                UserId = rs.UserId,
                Spareparts = rs.Spareparts.Select(si => new SparepartItem
                {
                    SparepartId = si.SparepartId,
                    Description = si.Description,
                    Quantity = si.Quantity,
                    Condition = si.Condition.ToString()
                }).ToList()
            }).ToListAsync();

        if (rentalItem is null)
            throw new KeyNotFoundException();

        return new RentalItemDetail
        {
            Id = rentalItem.Id,
            CreateBy = rentalItem.CreatedBy,
            CustomerName = rentalItem.CustomerName,
            ItemName = rentalItem.ItemName,
            SerialNumber = rentalItem.SerialNumber,
            Condition = rentalItem.Condition,
            Location = rentalItem.Location,
            Duration = rentalItem.Duration,
            RentalServices = rentalServices
        };
    }

    public async Task<IEnumerable<RentalItemDetail>> GetRentalItemsByDateAsync(DateTime? fromDate, DateTime? toDate)
    {
        var startDate = fromDate ?? DateTime.MinValue;
        var endDate = toDate ?? DateTime.Now;

        var items = await context.RentalItems.Where(i => i.CreatedAt >= startDate && i.CreatedAt <= endDate)
            .Select(i => new RentalItemDetail
            {
                Id = i.Id,
                CreateBy = i.CreatedBy,
                CustomerName = i.CustomerName,
                ItemName = i.ItemName,
                SerialNumber = i.SerialNumber,
                Condition = i.Condition,
                Location = i.Location,
                Duration = i.Duration,
                RentalServices = context.RentalServices
                    .Where(rs => rs.RentalItemId == i.Id)
                    .Select(rs => new RentalService
                    {
                        Id = rs.Id,
                        RentalItemId = rs.RentalItemId,
                        Date = rs.Date,
                        Action = rs.Action.ToString(),
                        Note = rs.Note,
                        UserId = rs.UserId,
                        Spareparts = rs.Spareparts.Select(si => new SparepartItem
                        {
                            SparepartId = si.SparepartId,
                            Description = si.Description,
                            Quantity = si.Quantity,
                            Condition = si.Condition.ToString()
                        }).ToList()
                    }).ToList()
            }
        ).ToListAsync();

        return items;
    }

    public async Task<IEnumerable<RentalItemDetail>> GetRentalItemsBySerialNumberAsync(string serialNo)
    {
        var items = await context.RentalItems
            .Where(i => i.SerialNumber.Contains(serialNo))
            .Select(i => new RentalItemDetail
            {
                Id = i.Id,
                CreateBy = i.CreatedBy,
                CustomerName = i.CustomerName,
                ItemName = i.ItemName,
                SerialNumber = i.SerialNumber,
                Condition = i.Condition,
                Location = i.Location,
                Duration = i.Duration,
                RentalServices = context.RentalServices
                    .Where(rs => rs.RentalItemId == i.Id)
                    .Select(rs => new RentalService
                    {
                        Id = rs.Id,
                        RentalItemId = rs.RentalItemId,
                        Date = rs.Date,
                        Action = rs.Action.ToString(),
                        Note = rs.Note,
                        UserId = rs.UserId,
                        Spareparts = rs.Spareparts.Select(si => new SparepartItem
                        {
                            SparepartId = si.SparepartId,
                            Description = si.Description,
                            Quantity = si.Quantity,
                            Condition = si.Condition.ToString()
                        }).ToList()
                    }).ToList()
            }
        ).ToListAsync();
        return items;
    }
    // OPTIMIZED: Search Items with filtering and sorting
    public async Task<PagedResult<Item>> SearchItemsAsync(ItemSearchQuery query)
    {
        var items = context.Items.AsNoTracking().AsQueryable();

        // Apply search filter — see SearchServicesAsync for why the column is
        // compared directly instead of via ToLower().
        if (!string.IsNullOrWhiteSpace(query.SearchTerm))
        {
            var search = query.SearchTerm.Trim();
            items = items.Where(i =>
                i.ItemName.Contains(search) ||
                i.SerialNumber.Contains(search));
        }

        // Apply item type filter
        if (!string.IsNullOrWhiteSpace(query.ItemType))
        {
            items = items.Where(i => i.ItemType.Type == query.ItemType);
        }

        // Apply sorting
        items = query.SortBy?.ToLower() switch
        {
            "serialnumber" => query.SortDescending
                ? items.OrderByDescending(i => i.SerialNumber)
                : items.OrderBy(i => i.SerialNumber),
            "itemtype" => query.SortDescending
                ? items.OrderByDescending(i => i.ItemType.Type)
                : items.OrderBy(i => i.ItemType.Type),
            _ => query.SortDescending
                ? items.OrderByDescending(i => i.ItemName)
                : items.OrderBy(i => i.ItemName)
        };

        var totalCount = await items.CountAsync();

        var results = await items
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(p => new Item
            {
                Id = p.Id,
                ItemName = p.ItemName,
                SerialNumber = p.SerialNumber,
                ItemType = p.ItemType.Type
            })
            .ToListAsync();

        return new PagedResult<Item>(results, totalCount, query.PageNumber, query.PageSize);
    }

    // OPTIMIZED: Search Spareparts with filtering
    public async Task<PagedResult<Sparepart>> SearchSparepartsAsync(SparepartSearchQuery query)
    {
        var spareparts = context.Spareparts.AsNoTracking().AsQueryable();

        // Apply search filter — see SearchServicesAsync for why the column is
        // compared directly instead of via ToLower().
        if (!string.IsNullOrWhiteSpace(query.SearchTerm))
        {
            var search = query.SearchTerm.Trim();
            spareparts = spareparts.Where(s =>
                s.ItemName.Contains(search) ||
                s.SerialNumber.Contains(search) ||
                s.Description.Contains(search) ||
                s.UserFor.Contains(search));
        }

        // Apply LinkItemId filter
        if (query.LinkItemId.HasValue)
        {
            spareparts = spareparts.Where(s => s.LinkItemId == query.LinkItemId.Value);
        }

        // Apply sorting
        spareparts = query.SortBy?.ToLower() switch
        {
            "serialnumber" => query.SortDescending
                ? spareparts.OrderByDescending(s => s.SerialNumber)
                : spareparts.OrderBy(s => s.SerialNumber),
            "description" => query.SortDescending
                ? spareparts.OrderByDescending(s => s.Description)
                : spareparts.OrderBy(s => s.Description),
            "quantity" => query.SortDescending
                ? spareparts.OrderByDescending(s => s.Quantity)
                : spareparts.OrderBy(s => s.Quantity),
            _ => query.SortDescending
                ? spareparts.OrderByDescending(s => s.ItemName)
                : spareparts.OrderBy(s => s.ItemName)
        };

        var totalCount = await spareparts.CountAsync();

        var results = await spareparts
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(p => new Sparepart
            {
                Id = p.Id,
                ItemName = p.ItemName,
                SerialNumber = p.SerialNumber,
                Description = p.Description,
                UseFor = p.UserFor,
                PictureUrl = p.PictureUrl,
                LinkItemId = p.LinkItemId,
                Quantity = p.Quantity,
                DefaultPrice = p.DefaultPrice
            })
            .ToListAsync();

        return new PagedResult<Sparepart>(results, totalCount, query.PageNumber, query.PageSize);
    }

    public async Task<PagedResult<Service>> SearchServicesAsync(ServiceSearchQuery query)
    {
        // No Include() calls: this method ends in a Select() projection, so EF
        // builds exactly the joins the projection needs and ignores Include
        // anyway. Listing them only implied the whole graph was being
        // materialised, including every SparepartItem row.
        var services = context.Services
            .AsNoTracking()
            .AsQueryable();

        bool isProcessFiltering = query.UseProcessDateFiltering &&
                                  query.FromDate.HasValue &&
                                  query.ToDate.HasValue &&
                                  query.StatusesForProcessFiltering != null &&
                                  query.StatusesForProcessFiltering.Any();

        bool isStatusFiltering = !query.UseProcessDateFiltering &&
                                 !string.IsNullOrWhiteSpace(query.Status) &&
                                 query.Status != "All";

        bool hasUserActionFilter = query.UserIds != null && query.UserIds.Any();

        // STEP 1: Apply Status filter (Only apply current status filter if NOT filtering by user action history)
        if (isStatusFiltering && !hasUserActionFilter)
        {
            var statuses = query.Status.Split(',').Select(s => s.Trim()).ToArray();
            services = services.Where(s => statuses.Contains(s.Status.Name));
        }

        // STEP 2: Apply user filtering
        if (query.UserIds != null && query.UserIds.Any())
        {
            if (query.UserFilterStatuses != null && query.UserFilterStatuses.Any())
            {
                services = services.Where(s =>
                    (query.UserFilterStatuses.Contains("Item Recieved") &&
                     s.CreateBy.HasValue && query.UserIds.Contains(s.CreateBy.Value)) ||
                    (query.UserFilterStatuses.Contains("Inspection") &&
                     s.InspectBy.HasValue && query.UserIds.Contains(s.InspectBy.Value)) ||
                    (query.UserFilterStatuses.Contains("Inspecting") &&
                     s.InspectingBy.HasValue && query.UserIds.Contains(s.InspectingBy.Value)) ||
                    (query.UserFilterStatuses.Contains("Sale Confirmed") &&
                     s.SetSaleConfirmedBy.HasValue && query.UserIds.Contains(s.SetSaleConfirmedBy.Value)) ||
                    (query.UserFilterStatuses.Contains("Awaiting Customer Confirm") &&
                     s.SetAwaitingCustomerConfirmBy.HasValue && query.UserIds.Contains(s.SetAwaitingCustomerConfirmBy.Value)) ||
                    (query.UserFilterStatuses.Contains("Awaiting Sparepart") &&
                     s.SetAwaitingSparepartBy.HasValue && query.UserIds.Contains(s.SetAwaitingSparepartBy.Value)) ||
                    (query.UserFilterStatuses.Contains("Sent Spareparts") &&
                     s.SetSentSparepartsBy.HasValue && query.UserIds.Contains(s.SetSentSparepartsBy.Value)) ||
                    (query.UserFilterStatuses.Contains("Repairing") &&
                     s.RepairBy.HasValue && query.UserIds.Contains(s.RepairBy.Value)) ||
                    (query.UserFilterStatuses.Contains("Finished") &&
                     s.VerifiedBy.HasValue && query.UserIds.Contains(s.VerifiedBy.Value)) ||
                    (query.UserFilterStatuses.Contains("Customer Rejected") &&
                     s.SetCustomerRejectedBy.HasValue && query.UserIds.Contains(s.SetCustomerRejectedBy.Value)) ||
                    (query.UserFilterStatuses.Contains("Unrepairable") &&
                     s.SetUnrepairableBy.HasValue && query.UserIds.Contains(s.SetUnrepairableBy.Value)) ||
                    (query.UserFilterStatuses.Contains("Repair by Third-Party") &&
                     s.ThirdPartyRepairBy.HasValue && query.UserIds.Contains(s.ThirdPartyRepairBy.Value))
                );
            }
            else
            {
                services = services.Where(s =>
                    (s.CreateBy.HasValue && query.UserIds.Contains(s.CreateBy.Value)) ||
                    (s.InspectBy.HasValue && query.UserIds.Contains(s.InspectBy.Value)) ||
                    (s.InspectingBy.HasValue && query.UserIds.Contains(s.InspectingBy.Value)) ||
                    (s.SetSaleConfirmedBy.HasValue && query.UserIds.Contains(s.SetSaleConfirmedBy.Value)) ||
                    (s.SetAwaitingCustomerConfirmBy.HasValue && query.UserIds.Contains(s.SetAwaitingCustomerConfirmBy.Value)) ||
                    (s.SetAwaitingSparepartBy.HasValue && query.UserIds.Contains(s.SetAwaitingSparepartBy.Value)) ||
                    (s.SetSentSparepartsBy.HasValue && query.UserIds.Contains(s.SetSentSparepartsBy.Value)) ||
                    (s.RepairBy.HasValue && query.UserIds.Contains(s.RepairBy.Value)) ||
                    (s.VerifiedBy.HasValue && query.UserIds.Contains(s.VerifiedBy.Value)) ||
                    (s.SetCustomerRejectedBy.HasValue && query.UserIds.Contains(s.SetCustomerRejectedBy.Value)) ||
                    (s.SetUnrepairableBy.HasValue && query.UserIds.Contains(s.SetUnrepairableBy.Value)) ||
                    (s.ThirdPartyRepairBy.HasValue && query.UserIds.Contains(s.ThirdPartyRepairBy.Value))
                );
            }
        }

        // STEP 3: Apply excluded statuses
        if (query.ExcludedStatuses != null && query.ExcludedStatuses.Any())
        {
            services = services.Where(s => !query.ExcludedStatuses.Contains(s.Status.Name));
        }

        // STEP 4: Service Location filtering
        if (!string.IsNullOrWhiteSpace(query.ServiceLocation) && query.ServiceLocation != "All")
        {
            if (Enum.TryParse<Domain.AggregatesModel.TechnicalAggregate.ServiceLocation>(
                query.ServiceLocation, out var serviceLocationEnum))
            {
                services = services.Where(s => s.ServiceLocation == serviceLocationEnum);
            }
        }

        // STEP 4b: Company name filter (used by monthly report detail grid)
        if (query.CompanyNames != null && query.CompanyNames.Length > 0)
        {
            services = services.Where(s => query.CompanyNames.Contains(s.CompanyName));
        }

        // STEP 5: Date filtering
        if (query.ForceServiceDateOnly)
        {
            // ✅ Always Created mode: ALWAYS filter by ServiceDate only, regardless of status
            //
            // Half-open range instead of `.Date >=` / `.Date <=`: comparing
            // ServiceDate.Date emits CAST(ServiceDate AS date), and a function
            // over the column blocks index seeks. `>= from && < to+1day` covers
            // exactly the same calendar days while staying sargable.
            if (query.FromDate.HasValue)
            {
                var fromDate = query.FromDate.Value.Date;
                services = services.Where(s => s.ServiceDate >= fromDate);
            }
            if (query.ToDate.HasValue)
            {
                var dayAfterTo = query.ToDate.Value.Date.AddDays(1);
                services = services.Where(s => s.ServiceDate < dayAfterTo);
            }
        }
        else if (isProcessFiltering)
        {
            var fromDate = query.FromDate.Value.Date;
            var toDate = query.ToDate.Value.Date;

            services = services.Where(s =>
                (query.StatusesForProcessFiltering.Contains("Item Recieved") &&
                    s.ServiceDate.Date >= fromDate && s.ServiceDate.Date <= toDate) ||
                (query.StatusesForProcessFiltering.Contains("Inspection") &&
                    s.InspectDate.HasValue && s.InspectDate.Value.Date >= fromDate && s.InspectDate.Value.Date <= toDate) ||
                (query.StatusesForProcessFiltering.Contains("Inspecting") &&
                    s.InspectingDate.HasValue && s.InspectingDate.Value.Date >= fromDate && s.InspectingDate.Value.Date <= toDate) ||
                (query.StatusesForProcessFiltering.Contains("Sale Confirmed") &&
                    s.SaleConfirmedDate.HasValue && s.SaleConfirmedDate.Value.Date >= fromDate && s.SaleConfirmedDate.Value.Date <= toDate) ||
                (query.StatusesForProcessFiltering.Contains("Awaiting Customer Confirm") &&
                    s.AwaitingCustomerConfirmDate.HasValue && s.AwaitingCustomerConfirmDate.Value.Date >= fromDate && s.AwaitingCustomerConfirmDate.Value.Date <= toDate) ||
                (query.StatusesForProcessFiltering.Contains("Awaiting Sparepart") &&
                    s.AwaitingSparepartDate.HasValue && s.AwaitingSparepartDate.Value.Date >= fromDate && s.AwaitingSparepartDate.Value.Date <= toDate) ||
                (query.StatusesForProcessFiltering.Contains("Sent Spareparts") &&
                    s.SentSparepartsDate.HasValue && s.SentSparepartsDate.Value.Date >= fromDate && s.SentSparepartsDate.Value.Date <= toDate) ||
                (query.StatusesForProcessFiltering.Contains("Repairing") &&
                    s.RepairDate.HasValue && s.RepairDate.Value.Date >= fromDate && s.RepairDate.Value.Date <= toDate) ||
                (query.StatusesForProcessFiltering.Contains("Finished") &&
                    s.FinishedDate.HasValue && s.FinishedDate.Value.Date >= fromDate && s.FinishedDate.Value.Date <= toDate) ||
                (query.StatusesForProcessFiltering.Contains("Customer Rejected") &&
                    s.CustomerRejectedDate.HasValue && s.CustomerRejectedDate.Value.Date >= fromDate && s.CustomerRejectedDate.Value.Date <= toDate) ||
                (query.StatusesForProcessFiltering.Contains("Unrepairable") &&
                    s.UnrepairableDate.HasValue && s.UnrepairableDate.Value.Date >= fromDate && s.UnrepairableDate.Value.Date <= toDate) ||
                (query.StatusesForProcessFiltering.Contains("Repair by Third-Party") &&
                    s.ThirdPartyRepairDate.HasValue && s.ThirdPartyRepairDate.Value.Date >= fromDate && s.ThirdPartyRepairDate.Value.Date <= toDate)
            );
        }
        else if (isStatusFiltering)
        {
            if (query.FromDate.HasValue && query.ToDate.HasValue)
            {
                var fromDate = query.FromDate.Value.Date;
                var toDate = query.ToDate.Value.Date;
                var statuses = query.Status.Split(',').Select(s => s.Trim()).ToArray();

                services = services.Where(s =>
                    (statuses.Contains("Item Recieved") && s.Status.Name == "Item Recieved" &&
                        s.ServiceDate.Date >= fromDate && s.ServiceDate.Date <= toDate) ||
                    (statuses.Contains("Inspection") && s.Status.Name == "Inspection" &&
                        s.InspectDate.HasValue && s.InspectDate.Value.Date >= fromDate && s.InspectDate.Value.Date <= toDate) ||
                    (statuses.Contains("Awaiting Customer Confirm") && s.Status.Name == "Awaiting Customer Confirm" &&
                        s.AwaitingCustomerConfirmDate.HasValue && s.AwaitingCustomerConfirmDate.Value.Date >= fromDate && s.AwaitingCustomerConfirmDate.Value.Date <= toDate) ||
                    (statuses.Contains("Awaiting Sparepart") && s.Status.Name == "Awaiting Sparepart" &&
                        s.AwaitingSparepartDate.HasValue && s.AwaitingSparepartDate.Value.Date >= fromDate && s.AwaitingSparepartDate.Value.Date <= toDate) ||
                    (statuses.Contains("Repairing") && s.Status.Name == "Repairing" &&
                        s.RepairDate.HasValue && s.RepairDate.Value.Date >= fromDate && s.RepairDate.Value.Date <= toDate) ||
                    (statuses.Contains("Finished") && s.Status.Name == "Finished" &&
                        s.FinishedDate.HasValue && s.FinishedDate.Value.Date >= fromDate && s.FinishedDate.Value.Date <= toDate) ||
                    (statuses.Contains("Customer Rejected") && s.Status.Name == "Customer Rejected" &&
                        s.CustomerRejectedDate.HasValue && s.CustomerRejectedDate.Value.Date >= fromDate && s.CustomerRejectedDate.Value.Date <= toDate) ||
                    (statuses.Contains("Unrepairable") && s.Status.Name == "Unrepairable" &&
                        s.UnrepairableDate.HasValue && s.UnrepairableDate.Value.Date >= fromDate && s.UnrepairableDate.Value.Date <= toDate) ||
                    (statuses.Contains("Repair by Third-Party") && s.Status.Name == "Repair by Third-Party" &&
                        s.ThirdPartyRepairDate.HasValue && s.ThirdPartyRepairDate.Value.Date >= fromDate && s.ThirdPartyRepairDate.Value.Date <= toDate)
                );
            }
            else if (query.FromDate.HasValue)
            {
                var fromDate = query.FromDate.Value.Date;
                var statuses = query.Status.Split(',').Select(s => s.Trim()).ToArray();
                services = services.Where(s =>
                    (statuses.Contains("Finished") && s.Status.Name == "Finished" &&
                        s.FinishedDate.HasValue && s.FinishedDate.Value.Date >= fromDate) ||
                    (!statuses.Contains("Finished") && s.ServiceDate.Date >= fromDate)
                );
            }
            else if (query.ToDate.HasValue)
            {
                var toDate = query.ToDate.Value.Date;
                var statuses = query.Status.Split(',').Select(s => s.Trim()).ToArray();
                services = services.Where(s =>
                    (statuses.Contains("Finished") && s.Status.Name == "Finished" &&
                        s.FinishedDate.HasValue && s.FinishedDate.Value.Date <= toDate) ||
                    (!statuses.Contains("Finished") && s.ServiceDate.Date <= toDate)
                );
            }
        }
        else
        {
            if (query.DateFilter != null && !string.IsNullOrWhiteSpace(query.DateFilter))
            {
                // Half-open ranges rather than `.Date ==` / `.Date >=`, so these
                // stay sargable against the ServiceDate index.
                var today = DateTime.Today;
                var tomorrow = today.AddDays(1);
                var yesterday = today.AddDays(-1);
                var weekAgo = today.AddDays(-7);
                var monthAgo = today.AddMonths(-1);

                services = query.DateFilter switch
                {
                    "Today" => services.Where(s => s.ServiceDate >= today && s.ServiceDate < tomorrow),
                    "Yesterday" => services.Where(s => s.ServiceDate >= yesterday && s.ServiceDate < today),
                    "LastWeek" => services.Where(s => s.ServiceDate >= weekAgo && s.ServiceDate < today),
                    "LastMonth" => services.Where(s => s.ServiceDate >= monthAgo && s.ServiceDate < today),
                    _ => services
                };
            }

            if (query.StatusFilter != null && !string.IsNullOrWhiteSpace(query.StatusFilter))
            {
                if (query.StatusFilter == "Draft")
                    services = services.Where(s => s.Status.Name != "Finished");
                else if (query.StatusFilter == "Complete")
                    services = services.Where(s => s.Status.Name == "Finished");
            }

            // Half-open range keeps the ServiceDate index usable — see the
            // ForceServiceDateOnly branch above.
            if (query.FromDate.HasValue)
            {
                var fromDate = query.FromDate.Value.Date;
                services = services.Where(s => s.ServiceDate >= fromDate);
            }

            if (query.ToDate.HasValue)
            {
                var dayAfterTo = query.ToDate.Value.Date.AddDays(1);
                services = services.Where(s => s.ServiceDate < dayAfterTo);
            }
        }

        // STEP 6: Apply search filter
        //
        // Deliberately NOT lower-cased. `x.ToLower().Contains(t)` translates to
        // LOWER([x]) LIKE '%t%', and wrapping the column in a function forces
        // SQL Server to evaluate it row by row, ruling out any index use.
        // Comparing the column directly lets the database match using its own
        // collation, which is case-insensitive by default (CI in
        // SQL_Latin1_General_CP1_CI_AS) — so results are unchanged.
        if (!string.IsNullOrWhiteSpace(query.SearchTerm))
        {
            var search = query.SearchTerm.Trim();
            services = services.Where(s =>
                s.CompanyName.Contains(search) ||
                s.ContactName.Contains(search) ||
                s.ReportNo.Contains(search) ||
                s.Item.ItemName.Contains(search) ||
                s.Item.SerialNumber.Contains(search) ||
                (s.CustomerRequest != null && s.CustomerRequest.Contains(search)));
        }

        if (!string.IsNullOrWhiteSpace(query.SerialNumber))
        {
            var serialNumber = query.SerialNumber.Trim();
            services = services.Where(s => s.Item.SerialNumber.Contains(serialNumber));
        }

        if (!string.IsNullOrWhiteSpace(query.ServiceType))
            services = services.Where(s => s.ServiceType.Name == query.ServiceType);

        if (query.HasContract.HasValue)
            services = services.Where(s => s.HasContract == query.HasContract.Value);

        // STEP 7: Apply sorting
        services = query.SortBy?.ToLower() switch
        {
            "companyname" => query.SortDescending
                ? services.OrderByDescending(s => s.CompanyName)
                : services.OrderBy(s => s.CompanyName),
            "reportno" => query.SortDescending
                ? services.OrderByDescending(s => s.ReportNo)
                : services.OrderBy(s => s.ReportNo),
            "status" => query.SortDescending
                ? services.OrderByDescending(s => s.Status.Name)
                : services.OrderBy(s => s.Status.Name),
            _ => query.SortDescending
                ? services.OrderByDescending(s => s.ServiceDate)
                : services.OrderBy(s => s.ServiceDate)
        };

        // STEP 8: Count AFTER all filtering.
        //
        // Skipped for infinite-scroll batches after the first: the total does
        // not change between batches, so re-counting the whole filtered set on
        // every scroll was a second full pass for a number the caller already
        // holds. With a free-text search — which scans rather than seeks — that
        // second pass costs as much as the page itself.
        var totalCount = query.IncludeTotalCount
            ? await services.CountAsync()
            : 0;

        // STEP 9: Apply pagination and project to DTO
        var results = await services
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(s => new Service
            {
                Id = s.Id,
                ReportNo = s.ReportNo,
                ServiceDate = s.ServiceDate,
                CompanyName = s.CompanyName,
                Address = s.Address,
                ContactName = s.ContactName,
                PhoneNumber = s.PhoneNumber,
                ItemName = s.Item.ItemName,
                SerialNumber = s.Item.SerialNumber,
                CustomerRequest = s.CustomerRequest,
                Inspection = s.Inspection,
                Solution = s.Solution,
                ServiceLocation = s.ServiceLocation.ToString(),
                ServiceType = s.ServiceType.Name,
                ServicePriority = s.ServicePriority.ToString(),
                Status = s.Status.ToString(),
                HasContract = s.HasContract,
                CreateBy = s.CreateBy,
                InspectDate = s.InspectDate,
                InspectBy = s.InspectBy,
                InspectingBy = s.InspectingBy,
                InspectingDate = s.InspectingDate,
                UnrepairableDate = s.UnrepairableDate,
                SetUnrepairableBy = s.SetUnrepairableBy,
                CustomerRejectedDate = s.CustomerRejectedDate,
                SetCustomerRejectedBy = s.SetCustomerRejectedBy,
                AwaitingCustomerConfirmDate = s.AwaitingCustomerConfirmDate,
                SetAwaitingCustomerConfirmBy = s.SetAwaitingCustomerConfirmBy,
                AwaitingSparepartDate = s.AwaitingSparepartDate,
                SetAwaitingSparepartBy = s.SetAwaitingSparepartBy,
                RepairDate = s.RepairDate,
                RepairBy = s.RepairBy,
                ThirdPartyRepairDate = s.ThirdPartyRepairDate,
                ThirdPartyRepairBy = s.ThirdPartyRepairBy,
                IsThirdPartyRepair = s.ThirdPartyRepairDate != null || s.ThirdPartyRepairBy != null,
                FinishedDate = s.FinishedDate,
                VerifiedBy = s.VerifiedBy,
                SaleConfirmedDate = s.SaleConfirmedDate,
                SetSaleConfirmedBy = s.SetSaleConfirmedBy,
                SparepartItems = s.SparepartItems.Select(si => new SparepartItem
                {
                    Id = si.Id,
                    SparepartId = si.SparepartId,
                    Description = si.Description,
                    Quantity = si.Quantity,
                    Condition = si.Condition.ToString(),
                    Remarks = si.Remarks,
                    RemarksUpdatedAt = si.RemarksUpdatedAt // ✅ NEW

                }).ToList()
            })
            .ToListAsync();

        return new PagedResult<Service>(results, totalCount, query.PageNumber, query.PageSize);
    }
    public async Task<PagedResult<RentalItem>> SearchRentalItemsAsync(RentalItemSearchQuery query)
    {
        var rentalItems = context.RentalItems.AsNoTracking().AsQueryable();

        // Apply search filter
        if (!string.IsNullOrWhiteSpace(query.SearchTerm))
        {
            var searchLower = query.SearchTerm.ToLower();
            rentalItems = rentalItems.Where(r =>
                r.CustomerName.ToLower().Contains(searchLower) ||
                r.ItemName.ToLower().Contains(searchLower) ||
                r.SerialNumber.ToLower().Contains(searchLower));
        }

        // Apply condition filter
        if (!string.IsNullOrWhiteSpace(query.Condition))
        {
            rentalItems = rentalItems.Where(r => r.Condition == query.Condition);
        }

        // Apply location filter
        if (!string.IsNullOrWhiteSpace(query.Location))
        {
            rentalItems = rentalItems.Where(r => r.Location.ToLower().Contains(query.Location.ToLower()));
        }

        // Apply customer filter
        if (query.CustomerId.HasValue)
        {
            rentalItems = rentalItems.Where(r => r.CustomerId == query.CustomerId.Value);
        }

        // Apply sorting
        rentalItems = query.SortBy?.ToLower() switch
        {
            "customername" => query.SortDescending
                ? rentalItems.OrderByDescending(r => r.CustomerName)
                : rentalItems.OrderBy(r => r.CustomerName),
            "itemname" => query.SortDescending
                ? rentalItems.OrderByDescending(r => r.ItemName)
                : rentalItems.OrderBy(r => r.ItemName),
            "serialnumber" => query.SortDescending
                ? rentalItems.OrderByDescending(r => r.SerialNumber)
                : rentalItems.OrderBy(r => r.SerialNumber),
            _ => query.SortDescending
                ? rentalItems.OrderByDescending(r => r.CreatedAt)
                : rentalItems.OrderBy(r => r.CreatedAt)
        };

        var totalCount = await rentalItems.CountAsync();

        var results = await rentalItems
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(i => new RentalItem
            {
                Id = i.Id,
                CreateBy = i.CreatedBy,
                CustomerId = i.CustomerId,
                CustomerName = i.CustomerName,
                ItemName = i.ItemName,
                SerialNumber = i.SerialNumber,
                Condition = i.Condition,
                Location = i.Location,
                Duration = i.Duration
            })
            .ToListAsync();

        return new PagedResult<RentalItem>(results, totalCount, query.PageNumber, query.PageSize);
    }
    public async Task<List<CompanyStatusSummary>> GetMonthlyReportCompanySummaryAsync(
    DateTime fromDate, DateTime toDate, string? serviceLocation)
    {
        var from = fromDate.Date;
        var to = toDate.Date;

        // ✅ FIXED: count by the date each event happened, not by the record's
        // CURRENT status. A service that was Finished on e.g. 2026-06-29 and
        // later moved back to Inspecting (via MoveBackToInspectingAsync) still
        // keeps its FinishedDate — it should still count as "Finished" for
        // this historical period, which matches what a raw
        // "WHERE FinishedDate BETWEEN ..." query in SSMS shows.
        //
        // Previously this method filtered on relevantStatuses.Contains(s.Status.Name)
        // FIRST, which silently dropped any service whose current status had
        // since changed away from Finished/Customer Rejected/Unrepairable,
        // even though the date-stamped event still falls in range.
        var query = context.Services
            .AsNoTracking()
            .Where(s =>
                (s.FinishedDate.HasValue &&
                    s.FinishedDate.Value.Date >= from && s.FinishedDate.Value.Date <= to) ||
                (s.CustomerRejectedDate.HasValue &&
                    s.CustomerRejectedDate.Value.Date >= from && s.CustomerRejectedDate.Value.Date <= to) ||
                (s.UnrepairableDate.HasValue &&
                    s.UnrepairableDate.Value.Date >= from && s.UnrepairableDate.Value.Date <= to)
            );

        if (!string.IsNullOrWhiteSpace(serviceLocation) && serviceLocation != "All" &&
            Enum.TryParse<Domain.AggregatesModel.TechnicalAggregate.ServiceLocation>(
                serviceLocation, out var locationEnum))
        {
            query = query.Where(s => s.ServiceLocation == locationEnum);
        }

        // ✅ A single service could theoretically have more than one of these
        // dates fall in-range across different periods (e.g. finished this
        // month after being unrepairable last month) — each count below is
        // independently evaluated per-row, so TotalCount is the count of
        // services with AT LEAST ONE qualifying event in range, while
        // FinishedCount/CustomerRejectedCount/UnrepairableCount are counted
        // per matching event type.
        var summary = await query
            .GroupBy(s => s.CompanyName)
            .Select(g => new CompanyStatusSummary
            {
                CompanyName = g.Key,
                FinishedCount = g.Count(x =>
                    x.FinishedDate.HasValue &&
                    x.FinishedDate.Value.Date >= from && x.FinishedDate.Value.Date <= to),
                CustomerRejectedCount = g.Count(x =>
                    x.CustomerRejectedDate.HasValue &&
                    x.CustomerRejectedDate.Value.Date >= from && x.CustomerRejectedDate.Value.Date <= to),
                UnrepairableCount = g.Count(x =>
                    x.UnrepairableDate.HasValue &&
                    x.UnrepairableDate.Value.Date >= from && x.UnrepairableDate.Value.Date <= to),
                TotalCount = g.Count()
            })
            .ToListAsync();

        return summary;
    }
    // OPTIMIZED: Search Rental Services
    public async Task<PagedResult<RentalService>> SearchRentalServicesAsync(RentalServiceSearchQuery query)
    {
        var rentalServices = context.RentalServices
            .AsNoTracking()
            .Include(r => r.Spareparts)
            .AsQueryable();

        // Apply rental item filter
        if (query.RentalItemId.HasValue)
        {
            rentalServices = rentalServices.Where(r => r.RentalItemId == query.RentalItemId.Value);
        }

        // Apply action filter
        if (!string.IsNullOrWhiteSpace(query.Action))
        {
            rentalServices = rentalServices.Where(r => r.Action.ToString() == query.Action);
        }

        // Apply date range filter
        if (query.FromDate.HasValue)
        {
            rentalServices = rentalServices.Where(r => r.Date >= query.FromDate.Value);
        }
        if (query.ToDate.HasValue)
        {
            rentalServices = rentalServices.Where(r => r.Date <= query.ToDate.Value);
        }

        // Apply user filter
        if (query.UserId.HasValue)
        {
            rentalServices = rentalServices.Where(r => r.UserId == query.UserId.Value);
        }

        // Apply sorting
        rentalServices = query.SortBy?.ToLower() switch
        {
            "action" => query.SortDescending
                ? rentalServices.OrderByDescending(r => r.Action)
                : rentalServices.OrderBy(r => r.Action),
            _ => query.SortDescending
                ? rentalServices.OrderByDescending(r => r.Date)
                : rentalServices.OrderBy(r => r.Date)
        };

        var totalCount = await rentalServices.CountAsync();

        var results = await rentalServices
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(r => new RentalService
            {
                Id = r.Id,
                RentalItemId = r.RentalItemId,
                Date = r.Date,
                Action = r.Action.ToString(),
                Note = r.Note,
                UserId = r.UserId,
                Spareparts = r.Spareparts.Select(si => new SparepartItem
                {
                    SparepartId = si.SparepartId,
                    Description = si.Description,
                    Quantity = si.Quantity,
                    Condition = si.Condition.ToString()
                }).ToList()
            })
            .ToListAsync();

        return new PagedResult<RentalService>(results, totalCount, query.PageNumber, query.PageSize);
    }
    public async Task<PagedResult<Service>> GetAllServicesAsync()
    {
        // Read-only projection: without AsNoTracking, EF built a change-tracking
        // entry for every row in Services (3,600+ and growing) on each call, for
        // entities nothing here ever mutates.
        var query = context.Services.AsNoTracking().AsQueryable();
        var totalCount = await query.CountAsync();

        // Get ALL items without Skip/Take
        var items = await query
            .OrderByDescending(s => s.ServiceDate)
            .Select(s => new Service
            {
                Id = s.Id,
                ReportNo = s.ReportNo,
                ServiceDate = s.ServiceDate,
                CompanyName = s.CompanyName,
                Address = s.Address,
                ContactName = s.ContactName,
                PhoneNumber = s.PhoneNumber,
                ItemName = s.Item.ItemName,
                SerialNumber = s.Item.SerialNumber,
                CustomerRequest = s.CustomerRequest,
                Inspection = s.Inspection,
                Solution = s.Solution,
                ServiceLocation = s.ServiceLocation.ToString(),
                ServiceType = s.ServiceType.Name,
                ServicePriority = s.ServicePriority.ToString(),
                Status = s.Status.ToString(),
                HasContract = s.HasContract,
                CreateBy = s.CreateBy,
                InspectDate = s.InspectDate,
                InspectBy = s.InspectBy,
                UnrepairableDate = s.UnrepairableDate,
                SetUnrepairableBy = s.SetUnrepairableBy,
                CustomerRejectedDate = s.CustomerRejectedDate,
                SetCustomerRejectedBy = s.SetCustomerRejectedBy,
                AwaitingCustomerConfirmDate = s.AwaitingCustomerConfirmDate,
                SetAwaitingCustomerConfirmBy = s.SetAwaitingCustomerConfirmBy,
                AwaitingSparepartDate = s.AwaitingSparepartDate,
                SetAwaitingSparepartBy = s.SetAwaitingSparepartBy,
                RepairDate = s.RepairDate,
                RepairBy = s.RepairBy,
                ThirdPartyRepairDate = s.ThirdPartyRepairDate,
                ThirdPartyRepairBy = s.ThirdPartyRepairBy,
                IsThirdPartyRepair = s.ThirdPartyRepairDate != null || s.ThirdPartyRepairBy != null,
                FinishedDate = s.FinishedDate,
                VerifiedBy = s.VerifiedBy,
                SparepartItems = s.SparepartItems.Select(si => new SparepartItem
                {   
                    Id = si.Id,
                    SparepartId = si.SparepartId,
                    Description = si.Description,
                    Quantity = si.Quantity,
                    Condition = si.Condition.ToString(),
                    Remarks = si.Remarks,
                    RemarksUpdatedAt = si.RemarksUpdatedAt // ✅ NEW

                }).ToList()
            }).ToListAsync();

        // Return PagedResult with all items (pageNumber=1, pageSize=totalCount)
        return new PagedResult<Service>(items, totalCount, 1, totalCount);
    }
    public async Task<PagedResult<string>> GetUniqueItemNamesAsync(int? pageNumber, int? pageSize, string searchTerm)
    {
        var query = context.Items
            .AsNoTracking()
            .Select(i => i.ItemName)
            .Distinct();

        // Apply search filter if provided
        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var searchLower = searchTerm.ToLower();
            query = query.Where(name => name.ToLower().Contains(searchLower));
        }

        // Order the results
        query = query.OrderBy(name => name);

        // Get total count after filtering
        var totalCount = await query.CountAsync();

        // Load all items if pagination is not specified
        List<string> items;
        int effectivePageNumber;
        int effectivePageSize;

        if (pageNumber.HasValue && pageSize.HasValue)
        {
            // Apply pagination
            items = await query
                .Skip((pageNumber.Value - 1) * pageSize.Value)
                .Take(pageSize.Value)
                .ToListAsync();

            effectivePageNumber = pageNumber.Value;
            effectivePageSize = pageSize.Value;
        }
        else
        {
            // Load ALL items - no pagination
            items = await query.ToListAsync();
            effectivePageNumber = 1;
            effectivePageSize = totalCount > 0 ? totalCount : 1; // Avoid division by zero
        }

        return new PagedResult<string>(items, totalCount, effectivePageNumber, effectivePageSize);
    }
    public async Task<List<SparepartWithUsage>> GetSparePartsUsedInServicesAsync()
    {
        var usedIds = await context.SparepartItems
            .AsNoTracking()
            .Where(si => si.SparepartId != Guid.Empty && si.ServiceId != Guid.Empty)
            .Select(si => si.SparepartId)
            .Distinct()
            .ToListAsync();

        if (!usedIds.Any()) return new List<SparepartWithUsage>();

        var usageCount = await context.SparepartItems
            .AsNoTracking()
            .Where(si => si.SparepartId != Guid.Empty && si.ServiceId != Guid.Empty)
            .GroupBy(si => si.SparepartId)
            .Select(g => new
            {
                SparepartId = g.Key,
                UsageCount = g.Count(),
                TotalQtyUsed = g.Sum(x => x.Quantity)
            })
            .ToListAsync();

        var spareparts = await context.Spareparts
            .AsNoTracking()
            .Where(sp => usedIds.Contains(sp.Id))
            .Select(sp => new
            {
                sp.Id,
                sp.ItemName,
                sp.SerialNumber,
                sp.Description,
                sp.UserFor,
                sp.PictureUrl,
                sp.LinkItemId,
                sp.Quantity
            })
            .ToListAsync();

        var result = spareparts
            .Join(usageCount,
                sp => sp.Id,
                uc => uc.SparepartId,
                (sp, uc) => new SparepartWithUsage
                {
                    Id = sp.Id,
                    ItemName = sp.ItemName,
                    SerialNumber = sp.SerialNumber,
                    Description = sp.Description,
                    UseFor = sp.UserFor,
                    PictureUrl = sp.PictureUrl,
                    LinkItemId = sp.LinkItemId,
                    Quantity = sp.Quantity,
                    UsageCount = uc.UsageCount,
                    TotalQtyUsed = uc.TotalQtyUsed
                })
            .OrderByDescending(x => x.UsageCount)
            .ThenByDescending(x => x.TotalQtyUsed)
            .ToList();

        return result;
    }
    public async Task<PagedResult<string>> GetUniqueItemTypesAsync(int? pageNumber, int? pageSize, string searchTerm)
    {
        var query = context.Items
            .AsNoTracking()
            .Where(i => !string.IsNullOrWhiteSpace(i.ItemType.Type) && i.ItemType.Type != "Generate")
            .Select(i => i.ItemType.Type)
            .Distinct();

        // Apply search filter if provided
        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var searchLower = searchTerm.ToLower();
            query = query.Where(type => type.ToLower().Contains(searchLower));
        }

        // Order the results
        query = query.OrderBy(type => type);

        // Get total count after filtering
        var totalCount = await query.CountAsync();

        // Load all items if pagination is not specified
        List<string> items;
        int effectivePageNumber;
        int effectivePageSize;

        if (pageNumber.HasValue && pageSize.HasValue)
        {
            // Apply pagination
            items = await query
                .Skip((pageNumber.Value - 1) * pageSize.Value)
                .Take(pageSize.Value)
                .ToListAsync();

            effectivePageNumber = pageNumber.Value;
            effectivePageSize = pageSize.Value;
        }
        else
        {
            // Load ALL items - no pagination
            items = await query.ToListAsync();
            effectivePageNumber = 1;
            effectivePageSize = totalCount > 0 ? totalCount : 1; // Avoid division by zero
        }

        return new PagedResult<string>(items, totalCount, effectivePageNumber, effectivePageSize);
    }
    public async Task<Sparepart> GetSparepartAsync(Guid id)
    {
        var sparepart = await context.Spareparts
            .FirstOrDefaultAsync(s => s.Id == id);

        if (sparepart is null)
            throw new KeyNotFoundException();

        return new Sparepart
        {
            Id = sparepart.Id,
            ItemName = sparepart.ItemName,
            SerialNumber = sparepart.SerialNumber,
            Description = sparepart.Description,
            UseFor = sparepart.UserFor,
            PictureUrl = sparepart.PictureUrl,
            LinkItemId = sparepart.LinkItemId,
            Quantity = sparepart.Quantity,// ✅ ADD THIS LINE
                DefaultPrice = sparepart.DefaultPrice // ✅ ADD


        };
    }
  

}