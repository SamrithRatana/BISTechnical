using Microsoft.AspNetCore.Http.HttpResults;
using TechnicalService.API.Apis;
using TechnicalService.API.Extensions;
using TechnicalService.Domain.AggregatesModel.RentalAggregate;

namespace TechnicalService.API.Application.Queries;

public class TechnicalServiceQueries(TechnicalServiceContext context)
    : ITechnicalServiceQueries
{
    public async Task<IEnumerable<ServiceType>> GetServiceTypesAsync() =>
        await context.ServiceTypes.AsNoTracking().Select(c => new ServiceType { Id = c.Id, Name = c.Name }).ToListAsync();

    public async Task<IEnumerable<ServicePriority>> GetServicePrioritiesAsync() =>
        await context.ServicePriorities.AsNoTracking().Select(c => new ServicePriority(c.Id, c.Name)).ToListAsync();

    public async Task<IEnumerable<ServiceStatus>> GetServiceStatusesAsync() =>
        await context.ServiceStatuses.AsNoTracking().Select(c => new ServiceStatus(c.Id, c.Name)).ToListAsync();

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
        // The workshop's day, not the host's: on a UTC server DateTime.Today
        // names yesterday for the first seven hours of every local day, so the
        // "today" tile read low every morning.
        var today = BusinessClock.Today;
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
        var query = context.Services.AsNoTracking();
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
                ItemId = s.ItemId,
                ItemName = s.Item != null ? s.Item.ItemName : null,
                SerialNumber = s.Item != null ? s.Item.SerialNumber : null,
                CustomerRequest = s.CustomerRequest,
                Inspection = s.Inspection,
                Solution = s.Solution,
                ServiceLocation = s.ServiceLocation.ToString(),
                ServiceType = s.ServiceType.Name,
                ServiceTypeId = s.ServiceType.Id,
                ServicePriority = s.ServicePriority.ToString(),
                ServicePriorityId = s.ServicePriority.Id,
                Status = s.Status.ToString(),
                StatusId = s.Status.Id,
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
                SentSparepartsDate = s.SentSparepartsDate,
                SetSentSparepartsBy = s.SetSentSparepartsBy,
                SparepartItems = s.SparepartItems.Select(si => new SparepartItem
                {
                    Id = si.Id,
                    SparepartId = si.SparepartId,
                    Description = si.Description,
                    Quantity = si.Quantity,
                    Condition = si.Condition.ToString(),
                    IsHoldStatus = si.IsHoldStatus,
                    Remarks = si.Remarks,
                    RemarksUpdatedAt = si.RemarksUpdatedAt
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
        bool statusFilterActive = !string.IsNullOrWhiteSpace(query.Status);
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

        // `Condition` is nullable: a ledger row whose SparepartItem has since been
        // deleted (which is exactly what fires the stock-in restore) has no
        // condition left to read, and the grouping below relies on `null` to keep
        // it out of the distinct `Conditions` list.
        var serviceLogs = new List<(Guid SparepartId, int Qty, string? Condition, string Source)>();
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

                // Half-open range, not `.Date >=` / `.Date <=`. Comparing
                // `.Date` emits CAST([ServiceDate] AS date) and a function over
                // the column rules out a seek on IX_Services_ServiceDate, so
                // every run scanned Services. `>= from && < to+1day` selects
                // exactly the same calendar days while staying sargable — the
                // same rewrite SearchServicesAsync's ForceServiceDateOnly
                // branch and GetSparepartTransactionsAsync already use.
                if (query.FromDate.HasValue)
                {
                    var fromDate = query.FromDate.Value.Date;
                    rawCreated = rawCreated.Where(x =>
                        x.ProcessDate.HasValue && x.ProcessDate.Value >= fromDate);
                }

                if (query.ToDate.HasValue)
                {
                    var dayAfterTo = query.ToDate.Value.Date.AddDays(1);
                    rawCreated = rawCreated.Where(x =>
                        x.ProcessDate.HasValue && x.ProcessDate.Value < dayAfterTo);
                }

                var fetchedCreated = await rawCreated.ToListAsync();

                serviceLogs = fetchedCreated
                    .Select(x => (x.SparepartId, x.Qty, (string?)x.ConditionEnum.ToString(), x.Source))
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
                //
                // ── Transaction ledger ──────────────────────────────────────
                //
                // Service-sourced movements are read from the audit log the SQL
                // triggers write, and dated by that row's own `Timestamp` — the
                // moment stock actually left or returned to the shelf.
                //
                // What this replaced, and why it was wrong: the movement used to
                // be reconstructed by joining `Services` x `SparepartItems` and
                // synthesising a date from the ticket's CURRENT status
                // (Finished -> FinishedDate, Repairing -> RepairDate, ...). Two
                // consequences, both of the confident-wrong-answer kind:
                //
                //   1. The date MOVED. A part fitted on the 3rd on a ticket
                //      marked Finished on the 10th reported its stock-out on the
                //      10th — and would report a different day again the next
                //      time the ticket advanced. A report printed last week
                //      stopped reconciling with the same report run today, which
                //      on a page whose whole purpose is checking a number makes
                //      every number on it unciteable.
                //
                //   2. Rows VANISHED. Those per-status date columns are
                //      nullable, and both date filters below require a value. A
                //      ticket sitting in a status whose own date column was NULL
                //      produced a null date and was silently dropped from every
                //      range — stock had left the shelf and no report would ever
                //      show it.
                //
                // `QuantityChange != 0` is what separates a real movement from a
                // tracking-only row: hold-status, Fix-condition and qty-0 entries
                // are written with a zero change purely for audit visibility, and
                // summing them would distort the totals. It also makes this
                // independent of the `OperationType` spelling, which lives in the
                // trigger bodies rather than in this repo.
                //
                // Sign convention: the log stores a stock-out as negative, so
                // usage is `-QuantityChange`. A restore (a SparepartItem deleted,
                // firing `trg_Sparepartitems_AfterDelete_StockIn`) is therefore
                // negative usage, which is the correct ledger arithmetic: fit and
                // then un-fit a part inside one window and the window nets to
                // zero, exactly as the old query reported it by virtue of the row
                // no longer existing.
                //
                var logsQuery = context.SparepartStockAuditLogs
                    .AsNoTracking()
                    .Where(l =>
                        l.ServiceId != null &&
                        l.QuantityChange != 0 &&
                        l.SparepartId != Guid.Empty);

                if (query.FromDate.HasValue)
                {
                    var fromDate = query.FromDate.Value.Date;
                    logsQuery = logsQuery.Where(l => l.Timestamp >= fromDate);
                }

                if (query.ToDate.HasValue)
                {
                    var dayAfterTo = query.ToDate.Value.Date.AddDays(1);
                    logsQuery = logsQuery.Where(l => l.Timestamp < dayAfterTo);
                }

                var rawServiceQuery =
                    from log in logsQuery
                    join svc in context.Services
                        .AsNoTracking()
                        .Include(s => s.ServiceType)
                        .Include(s => s.Status)
                        .Include(s => s.Item)
                        on log.ServiceId equals (Guid?)svc.Id
                    where
                        (!serviceTypeFilterActive || svc.ServiceType.Name == query.ServiceType)
                        && (!statusFilterActive || svc.Status.Name == query.Status)
                        && !context.SparepartItems.Any(si =>
                                si.ServiceId == svc.Id &&
                                si.SparepartId == log.SparepartId &&
                                si.IsHoldStatus == true)
                    select new
                    {
                        log.SparepartId,
                        Qty = -log.QuantityChange,
                        ConditionEnum = context.SparepartItems
                            .Where(si => si.ServiceId == svc.Id &&
                                         si.SparepartId == log.SparepartId)
                            .Select(si => (Domain.AggregatesModel.TechnicalAggregate.SparepartCondition?)si.Condition)
                            .FirstOrDefault(),
                        Source = "Service",
                        ServiceId = svc.Id,
                        svc.ReportNo,
                        svc.CompanyName,
                        ServiceStatus = svc.Status.Name,
                        ServiceTypeName = svc.ServiceType.Name,
                        MachineItemName = svc.Item != null ? svc.Item.ItemName : "",
                        MachineSerialNumber = svc.Item != null ? svc.Item.SerialNumber : "",
                        Reason = log.Remarks,
                        ProcessDate = (DateTime?)log.Timestamp
                    };

                if (conditionFilterActive && conditionEnumParsed)
                    rawServiceQuery = rawServiceQuery
                        .Where(x => x.ConditionEnum == conditionEnumValue);

                var fetched = await rawServiceQuery.ToListAsync();

                // `null`, not "—", when the condition could not be recovered:
                // the grouping below builds its distinct `Conditions` list with
                // `.Where(x => x.Condition != null)`, so a placeholder here would
                // show up as a condition the part was never used in.
                serviceLogs = fetched
                    .Select(x => (
                        x.SparepartId,
                        x.Qty,
                        x.ConditionEnum.HasValue ? x.ConditionEnum.Value.ToString() : null,
                        x.Source))
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
                            Condition = x.ConditionEnum.HasValue
                                ? x.ConditionEnum.Value.ToString()
                                : "—",
                            ServiceType = x.ServiceTypeName ?? "",
                            ProcessDate = x.ProcessDate,
                            Source = "Service",
                            Reason = x.Reason,
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

        bool wantManual = (query.IncludeManualStockOut ?? true)
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

            // Half-open, same reasoning. This branch filters Timestamp with
            // nothing else selective alongside it, so it is the one predicate
            // here that can seek IX_AuditLog_Timestamp outright.
            if (query.FromDate.HasValue)
            {
                var fromDate = query.FromDate.Value.Date;
                manualQuery = manualQuery.Where(log => log.Timestamp >= fromDate);
            }

            if (query.ToDate.HasValue)
            {
                var dayAfterTo = query.ToDate.Value.Date.AddDays(1);
                manualQuery = manualQuery.Where(log => log.Timestamp < dayAfterTo);
            }

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
                    .Select(x => x.Condition!)
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
                    //
                    // Floored at zero. A part can still net negative here after
                    // the hold exclusion above, because a RESTORE can land in the
                    // window while the matching DEDUCTION sits outside it — either
                    // in an earlier period, or before 2026-02-19 where the ledger
                    // simply does not go back to. That is not a stock deficit, and
                    // showing "-1" in a column headed "Used Qty" reads as one.
                    //
                    // Zero is the honest reading of "nothing was consumed here":
                    // the return itself is visible on `/sparepart-hold` when the
                    // part is held, and in `StockQuantity`, which is the live
                    // catalogue figure and already reflects the stock coming back.
                    //
                    UsedQuantity = g.TotalQuantity < 0 ? 0 : g.TotalQuantity,
                    ServiceUsedQty = g.ServiceUsedQty < 0 ? 0 : g.ServiceUsedQty,
                    ManualUsedQty = g.ManualUsedQty < 0 ? 0 : g.ManualUsedQty,
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
            // This runs in memory (the rows were materialised above), so the
            // comparison has to fold case itself. OrdinalIgnoreCase does it
            // without allocating a lowercased copy of every field of every row.
            var s = query.SearchTerm.Trim();
            results = results.Where(r =>
                r.ItemName.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                (r.SerialNumber != null && r.SerialNumber.Contains(s, StringComparison.OrdinalIgnoreCase)) ||
                r.Services.Any(svc =>
                    !string.IsNullOrEmpty(svc.ReportNo) &&
                    svc.ReportNo.Contains(s, StringComparison.OrdinalIgnoreCase)) ||
                r.Services.Any(svc =>
                    !string.IsNullOrEmpty(svc.MachineSerialNumber) &&
                    svc.MachineSerialNumber.Contains(s, StringComparison.OrdinalIgnoreCase)) ||
                r.Services.Any(svc =>
                    !string.IsNullOrEmpty(svc.MachineItemName) &&
                    svc.MachineItemName.Contains(s, StringComparison.OrdinalIgnoreCase))
            );
        }

        // ─────────────────────────────────────────────────────────────────────
        // PART 7: Sort
        // ─────────────────────────────────────────────────────────────────────
        var sortDesc = query.SortDescending ?? true;
        results = query.SortBy?.ToLower() switch
        {
            "itemname" => sortDesc
                ? results.OrderByDescending(r => r.ItemName)
                : results.OrderBy(r => r.ItemName),
            "usedquantity" => sortDesc
                ? results.OrderByDescending(r => r.UsedQuantity)
                : results.OrderBy(r => r.UsedQuantity),
            "usagecount" => sortDesc
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

        var pageNumber = query.PageNumber is null or < 1 ? 1 : query.PageNumber.Value;
        var pageSize = query.PageSize is null or < 1 or > 2000 ? 15 : query.PageSize.Value;

        var paged = results
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        var pageResult = new PagedResult<SparepartUsageSummary>(
            paged, totalCount, pageNumber, pageSize);

        pageResult.TotalUsedQuantity = totalUsedQuantity;
        pageResult.TotalServiceUsedQuantity = totalServiceUsedQty;
        pageResult.TotalManualUsedQuantity = totalManualUsedQty;

        return pageResult;
    }
    public async Task<PagedResult<SparepartHoldSummary>> GetSparepartHoldStatusAsync(
      SparepartHoldQuery query)
    {
        // ── STEP 1: Query Services ដែលមាន SparepartItems IsHoldStatus=true ──
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
            // In-memory, as above: fold case without allocating per row.
            var s = query.SearchTerm.Trim();
            results = results.Where(r =>
                r.ItemName.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                (r.SerialNumber != null && r.SerialNumber.Contains(s, StringComparison.OrdinalIgnoreCase)));
        }

        // ── STEP 6: Sort ──────────────────────────────────────────────────
        bool isDesc = query.SortDescending.GetValueOrDefault(true);
        results = query.SortBy?.ToLower() switch
        {
            "itemname" => isDesc
                            ? results.OrderByDescending(r => r.ItemName)
                            : results.OrderBy(r => r.ItemName),
            "holdcount" => isDesc
                            ? results.OrderByDescending(r => r.HoldCount)
                            : results.OrderBy(r => r.HoldCount),
            _ => isDesc
                            ? results.OrderByDescending(r => r.TotalHoldQty)
                            : results.OrderBy(r => r.TotalHoldQty)
        };

        // ── STEP 7: Totals + Paginate ─────────────────────────────────────
        var totalCount = results.Count();
        var totalHoldQty = results.Sum(r => r.TotalHoldQty);
        var totalHoldJobs = results.Sum(r => r.HoldCount);
        int pageNum = query.PageNumber.GetValueOrDefault(1);
        int pageSize = query.PageSize.GetValueOrDefault(15);
        if (pageNum < 1) pageNum = 1;
        if (pageSize < 1) pageSize = 15;

        var paged = results
            .Skip((pageNum - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        var pageResult = new PagedResult<SparepartHoldSummary>(
            paged, totalCount, pageNum, pageSize);

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
    //       public int TotalUsedQuantity { get; set; }    //   }
    // ══════════════════════════════════════════════════════════════════

    public async Task<Service> GetServiceAsync(Guid id)
    {
        var repairService = await context.Services.AsNoTracking()
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
            CustomerId = repairService.CustomerId,
            ReportNo = repairService.ReportNo,
            ServiceDate = repairService.ServiceDate,
            CompanyName = repairService.CompanyName,
            Address = repairService.Address,
            ContactName = repairService.ContactName,
            PhoneNumber = repairService.PhoneNumber,
            ItemId = repairService.ItemId,
            ItemName = repairService.Item?.ItemName,
            SerialNumber = repairService.Item?.SerialNumber,
            CustomerRequest = repairService.CustomerRequest,
            Inspection = repairService.Inspection,
            Solution = repairService.Solution,
            ServiceLocation = repairService.ServiceLocation.ToString(),
            ServiceType = repairService.ServiceType?.Name,
            ServiceTypeId = repairService.ServiceType?.Id,
            ServicePriority = repairService.ServicePriority?.Name,
            ServicePriorityId = repairService.ServicePriority?.Id,
            Status = repairService.Status?.Name,
            StatusId = repairService.Status?.Id,
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
            SentSparepartsDate = repairService.SentSparepartsDate,
            SetSentSparepartsBy = repairService.SetSentSparepartsBy,
            SparepartItems = repairService.SparepartItems.Select(si => new SparepartItem
            {
                Id = si.Id,
                SparepartId = si.SparepartId,
                Description = si.Description,
                Quantity = si.Quantity,
                Condition = si.Condition.ToString(),
                IsHoldStatus = si.IsHoldStatus,
                Remarks = si.Remarks,
                RemarksUpdatedAt = si.RemarksUpdatedAt
            }).ToList()
        };
    }
    // UPDATED: Now returns PagedResult<Item>
    public async Task<PagedResult<Item>> GetItemsAsync(int pageNumber, int pageSize)
    {
        var query = context.Items.AsNoTracking();
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
        var item = await context.Items.AsNoTracking()
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

    public async Task<IEnumerable<ReceiveItem>> GetReceiveItemsAsync()
    {
        return await context.Services.AsNoTracking().Where(s => s.Status == Domain.AggregatesModel.TechnicalAggregate.ServiceStatus.ItemReceived)
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
        return await context.Services.AsNoTracking().Where(s => s.Status == Domain.AggregatesModel.TechnicalAggregate.ServiceStatus.Inspection)
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
                        Id = si.Id,                        SparepartId = si.SparepartId,
                        Description = si.Description,
                        Quantity = si.Quantity,
                        Remarks = si.Remarks,
                        RemarksUpdatedAt = si.RemarksUpdatedAt                    }).ToList()
                }).ToListAsync();
    }

    public async Task<IEnumerable<Service>> GetAwaitingCustomerConfirmsAsync()
    {
        return await context.Services.AsNoTracking().Where(s => s.Status == Domain.AggregatesModel.TechnicalAggregate.ServiceStatus.AwaitingCustomerConfirm)
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
                        Id = si.Id,                        SparepartId = si.SparepartId,
                        Description = si.Description,
                        Quantity = si.Quantity,
                        Remarks = si.Remarks,
                        RemarksUpdatedAt = si.RemarksUpdatedAt
                    }).ToList()
                }).ToListAsync();
    }

    // UPDATED: Now returns PagedResult<RentalItem>
    public async Task<PagedResult<RentalItem>> GetRentalItemsAsync(int pageNumber, int pageSize)
    {
        var query = context.RentalItems.AsNoTracking();
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
        var rentalItem = await context.RentalItems.AsNoTracking()
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
        var query = context.RentalServices.AsNoTracking();
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
        var rentalService = await context.RentalServices.AsNoTracking()
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
        var rentalItem = await context.RentalItems.AsNoTracking()
            .FirstOrDefaultAsync(i => i.Id == id);

        var rentalServices = await context.RentalServices.AsNoTracking()
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
        var endDate = toDate ?? BusinessClock.Now;

        var items = await context.RentalItems.AsNoTracking().Where(i => i.CreatedAt >= startDate && i.CreatedAt <= endDate)
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
        var items = await context.RentalItems.AsNoTracking()
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
        var baseQuery = context.Spareparts.AsNoTracking().AsQueryable();

        // Apply search filter — see SearchServicesAsync for why the column is
        // compared directly instead of via ToLower().
        if (!string.IsNullOrWhiteSpace(query.SearchTerm))
        {
            var search = query.SearchTerm.Trim();
            // The classification names are searchable too, so typing "HP"
            // finds every HP part whether or not the brand appears in the
            // item name. The navigations are optional, so EF emits LEFT
            // JOINs; a null name simply does not match.
            baseQuery = baseQuery.Where(s =>
                s.ItemName.Contains(search) ||
                s.SerialNumber.Contains(search) ||
                s.Description.Contains(search) ||
                s.UserFor.Contains(search) ||
                s.Brand.Name.Contains(search) ||
                s.Type.Name.Contains(search) ||
                s.Category.Name.Contains(search));
        }

        // Apply LinkItemId filter
        if (query.LinkItemId.HasValue)
        {
            baseQuery = baseQuery.Where(s => s.LinkItemId == query.LinkItemId.Value);
        }

        // Classification filters. Guid.Empty is what an unset <select> sends
        // and means "no filter", the same convention as SetClassification.
        if (query.CategoryId is { } categoryId && categoryId != Guid.Empty)
        {
            baseQuery = baseQuery.Where(s => s.CategoryId == categoryId);
        }
        if (query.TypeId is { } typeId && typeId != Guid.Empty)
        {
            baseQuery = baseQuery.Where(s => s.TypeId == typeId);
        }
        if (query.BrandId is { } brandId && brandId != Guid.Empty)
        {
            baseQuery = baseQuery.Where(s => s.BrandId == brandId);
        }

        // Single aggregation query for catalogue/search breakdown counts (zero extra roundtrips)
        var counts = await baseQuery
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Good = g.Count(s => s.Quantity > 2),
                Critical = g.Count(s => s.Quantity > 0 && s.Quantity <= 2),
                Out = g.Count(s => s.Quantity <= 0)
            })
            .FirstOrDefaultAsync();

        var totalAll = counts?.Total ?? 0;
        var goodCount = counts?.Good ?? 0;
        var criticalCount = counts?.Critical ?? 0;
        var outCount = counts?.Out ?? 0;

        // Apply StockBand filter if specified
        var spareparts = baseQuery;
        if (!string.IsNullOrWhiteSpace(query.StockBand) && !string.Equals(query.StockBand, "all", StringComparison.OrdinalIgnoreCase))
        {
            spareparts = query.StockBand.ToLower() switch
            {
                "good" => spareparts.Where(s => s.Quantity > 2),
                "critical" => spareparts.Where(s => s.Quantity > 0 && s.Quantity <= 2),
                "out" => spareparts.Where(s => s.Quantity <= 0),
                _ => spareparts
            };
        }

        var totalCount = query.StockBand?.ToLower() switch
        {
            "good" => goodCount,
            "critical" => criticalCount,
            "out" => outCount,
            _ => totalAll
        };

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
            // Unbranded parts go last in both directions — SQL Server would
            // otherwise sort NULL brands first ascending, which reads as a
            // page of blanks before the first real brand.
            "brand" => query.SortDescending
                ? spareparts.OrderBy(s => s.BrandId == null).ThenByDescending(s => s.Brand.Name).ThenByDescending(s => s.ItemName)
                : spareparts.OrderBy(s => s.BrandId == null).ThenBy(s => s.Brand.Name).ThenBy(s => s.ItemName),
            _ => query.SortDescending
                ? spareparts.OrderByDescending(s => s.ItemName)
                : spareparts.OrderBy(s => s.ItemName)
        };

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
                DefaultPrice = p.DefaultPrice,
                CategoryId = p.CategoryId,
                CategoryName = p.Category != null ? p.Category.Name : null,
                TypeId = p.TypeId,
                TypeName = p.Type != null ? p.Type.Name : null,
                BrandId = p.BrandId,
                BrandName = p.Brand != null ? p.Brand.Name : null,
                BrandLogoUrl = p.Brand != null ? p.Brand.LogoUrl : null,
            })
            .ToListAsync();

        return new PagedResult<Sparepart>(results, totalCount, query.PageNumber, query.PageSize)
        {
            TotalAll = totalAll,
            GoodCount = goodCount,
            CriticalCount = criticalCount,
            OutOfStockCount = outCount
        };
    }

    /// <summary>
    /// Every filter, search and sort in <see cref="SearchServicesAsync"/>, with no
    /// projection attached.
    /// </summary>
    /// <remarks>
    /// Extracted so the full-ticket and summary shapes cannot drift apart. They
    /// answer the same question and differ only in which columns come back — and
    /// this file already carries three hand-copied variants of the 44-field
    /// projection, one of which (GetAllServicesAsync) silently lost
    /// InspectingBy, InspectingDate and both SaleConfirmed fields. One filter
    /// pipeline, two projections.
    /// </remarks>
    private IQueryable<Domain.AggregatesModel.TechnicalAggregate.Service> BuildServiceSearchQuery(
        ServiceSearchQuery query)
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
            var dayAfterTo = query.ToDate.Value.Date.AddDays(1);

            services = services.Where(s =>
                (query.StatusesForProcessFiltering.Contains("Item Recieved") &&
                    s.ServiceDate >= fromDate && s.ServiceDate < dayAfterTo) ||
                (query.StatusesForProcessFiltering.Contains("Inspection") &&
                    s.InspectDate.HasValue && s.InspectDate.Value >= fromDate && s.InspectDate.Value < dayAfterTo) ||
                (query.StatusesForProcessFiltering.Contains("Inspecting") &&
                    s.InspectingDate.HasValue && s.InspectingDate.Value >= fromDate && s.InspectingDate.Value < dayAfterTo) ||
                (query.StatusesForProcessFiltering.Contains("Sale Confirmed") &&
                    s.SaleConfirmedDate.HasValue && s.SaleConfirmedDate.Value >= fromDate && s.SaleConfirmedDate.Value < dayAfterTo) ||
                (query.StatusesForProcessFiltering.Contains("Awaiting Customer Confirm") &&
                    s.AwaitingCustomerConfirmDate.HasValue && s.AwaitingCustomerConfirmDate.Value >= fromDate && s.AwaitingCustomerConfirmDate.Value < dayAfterTo) ||
                (query.StatusesForProcessFiltering.Contains("Awaiting Sparepart") &&
                    s.AwaitingSparepartDate.HasValue && s.AwaitingSparepartDate.Value >= fromDate && s.AwaitingSparepartDate.Value < dayAfterTo) ||
                (query.StatusesForProcessFiltering.Contains("Sent Spareparts") &&
                    s.SentSparepartsDate.HasValue && s.SentSparepartsDate.Value >= fromDate && s.SentSparepartsDate.Value < dayAfterTo) ||
                (query.StatusesForProcessFiltering.Contains("Repairing") &&
                    s.RepairDate.HasValue && s.RepairDate.Value >= fromDate && s.RepairDate.Value < dayAfterTo) ||
                (query.StatusesForProcessFiltering.Contains("Finished") &&
                    s.FinishedDate.HasValue && s.FinishedDate.Value >= fromDate && s.FinishedDate.Value < dayAfterTo) ||
                (query.StatusesForProcessFiltering.Contains("Customer Rejected") &&
                    s.CustomerRejectedDate.HasValue && s.CustomerRejectedDate.Value >= fromDate && s.CustomerRejectedDate.Value < dayAfterTo) ||
                (query.StatusesForProcessFiltering.Contains("Unrepairable") &&
                    s.UnrepairableDate.HasValue && s.UnrepairableDate.Value >= fromDate && s.UnrepairableDate.Value < dayAfterTo) ||
                (query.StatusesForProcessFiltering.Contains("Repair by Third-Party") &&
                    s.ThirdPartyRepairDate.HasValue && s.ThirdPartyRepairDate.Value >= fromDate && s.ThirdPartyRepairDate.Value < dayAfterTo)
            );
        }
        else if (isStatusFiltering)
        {
            if (query.FromDate.HasValue && query.ToDate.HasValue)
            {
                var fromDate = query.FromDate.Value.Date;
                var dayAfterTo = query.ToDate.Value.Date.AddDays(1);
                var statuses = query.Status.Split(',').Select(s => s.Trim()).ToArray();

                services = services.Where(s =>
                    (statuses.Contains("Item Recieved") && s.Status.Name == "Item Recieved" &&
                        s.ServiceDate >= fromDate && s.ServiceDate < dayAfterTo) ||
                    (statuses.Contains("Inspection") && s.Status.Name == "Inspection" &&
                        s.InspectDate.HasValue && s.InspectDate.Value >= fromDate && s.InspectDate.Value < dayAfterTo) ||
                    (statuses.Contains("Awaiting Customer Confirm") && s.Status.Name == "Awaiting Customer Confirm" &&
                        s.AwaitingCustomerConfirmDate.HasValue && s.AwaitingCustomerConfirmDate.Value >= fromDate && s.AwaitingCustomerConfirmDate.Value < dayAfterTo) ||
                    (statuses.Contains("Awaiting Sparepart") && s.Status.Name == "Awaiting Sparepart" &&
                        s.AwaitingSparepartDate.HasValue && s.AwaitingSparepartDate.Value >= fromDate && s.AwaitingSparepartDate.Value < dayAfterTo) ||
                    (statuses.Contains("Repairing") && s.Status.Name == "Repairing" &&
                        s.RepairDate.HasValue && s.RepairDate.Value >= fromDate && s.RepairDate.Value < dayAfterTo) ||
                    (statuses.Contains("Finished") && s.Status.Name == "Finished" &&
                        s.FinishedDate.HasValue && s.FinishedDate.Value >= fromDate && s.FinishedDate.Value < dayAfterTo) ||
                    (statuses.Contains("Customer Rejected") && s.Status.Name == "Customer Rejected" &&
                        s.CustomerRejectedDate.HasValue && s.CustomerRejectedDate.Value >= fromDate && s.CustomerRejectedDate.Value < dayAfterTo) ||
                    (statuses.Contains("Unrepairable") && s.Status.Name == "Unrepairable" &&
                        s.UnrepairableDate.HasValue && s.UnrepairableDate.Value >= fromDate && s.UnrepairableDate.Value < dayAfterTo) ||
                    (statuses.Contains("Repair by Third-Party") && s.Status.Name == "Repair by Third-Party" &&
                        s.ThirdPartyRepairDate.HasValue && s.ThirdPartyRepairDate.Value >= fromDate && s.ThirdPartyRepairDate.Value < dayAfterTo)
                );
            }
            else if (query.FromDate.HasValue)
            {
                var fromDate = query.FromDate.Value.Date;
                var statuses = query.Status.Split(',').Select(s => s.Trim()).ToArray();
                services = services.Where(s =>
                    (statuses.Contains("Finished") && s.Status.Name == "Finished" &&
                        s.FinishedDate.HasValue && s.FinishedDate.Value >= fromDate) ||
                    (!statuses.Contains("Finished") && s.ServiceDate >= fromDate)
                );
            }
            else if (query.ToDate.HasValue)
            {
                var dayAfterTo = query.ToDate.Value.Date.AddDays(1);
                var statuses = query.Status.Split(',').Select(s => s.Trim()).ToArray();
                services = services.Where(s =>
                    (statuses.Contains("Finished") && s.Status.Name == "Finished" &&
                        s.FinishedDate.HasValue && s.FinishedDate.Value < dayAfterTo) ||
                    (!statuses.Contains("Finished") && s.ServiceDate < dayAfterTo)
                );
            }
        }
        else
        {
            if (query.DateFilter != null && !string.IsNullOrWhiteSpace(query.DateFilter))
            {
                // Half-open ranges rather than `.Date ==` / `.Date >=`, so these
                // stay sargable against the ServiceDate index.
                // Resolved in the workshop's timezone - see GetDashboardStatsAsync.
                var today = BusinessClock.Today;
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

        return services;
    }

    public async Task<PagedResult<ServiceSummary>> SearchServiceSummariesAsync(
        ServiceSearchQuery query)
    {
        //
        // The dashboard's sparklines sample the 400 most recent tickets and read
        // status and the two dates off them. Served as full tickets that was
        // 901 KB on the wire against 39 KB of usable data, and dragged the
        // SparepartItems of every row along with it.
        //
        // Shares BuildServiceSearchQuery with SearchServicesAsync, so the two
        // shapes always answer the same question.
        //
        var services = BuildServiceSearchQuery(query);

        var totalCount = query.IncludeTotalCount
            ? await services.CountAsync()
            : 0;

        var items = await services
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(s => new ServiceSummary(
                s.Id,
                s.ServiceDate,
                s.FinishedDate,
                s.Status.ToString(),
                s.ReportNo,
                s.CompanyName,
                s.Item != null ? s.Item.ItemName : null,
                s.Item != null ? s.Item.SerialNumber : null,
                s.ServicePriority != null ? s.ServicePriority.ToString() : null,
                s.ServiceType != null ? s.ServiceType.Name : null,
                s.CreateBy,
                s.InspectBy,
                s.RepairBy,
                s.VerifiedBy))
            .ToListAsync();

        return new PagedResult<ServiceSummary>(items, totalCount, query.PageNumber, query.PageSize);
    }

    public async Task<PagedResult<Service>> SearchServicesAsync(ServiceSearchQuery query)
    {
        var services = BuildServiceSearchQuery(query);

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
        var paged = services
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize);

        var results = await paged
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
                SentSparepartsDate = s.SentSparepartsDate,
                SetSentSparepartsBy = s.SetSentSparepartsBy,
                SparepartItems = s.SparepartItems.Select(si => new SparepartItem
                {
                    Id = si.Id,
                    SparepartId = si.SparepartId,
                    Description = si.Description,
                    Quantity = si.Quantity,
                    Condition = si.Condition.ToString(),
                    IsHoldStatus = si.IsHoldStatus,
                    Remarks = si.Remarks,
                    RemarksUpdatedAt = si.RemarksUpdatedAt
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
            // Column compared directly - see SearchServicesAsync for why
            // wrapping it in LOWER() rules out any index use, and why the
            // database's own CI collation makes the results identical.
            var search = query.SearchTerm.Trim();
            rentalItems = rentalItems.Where(r =>
                r.CustomerName.Contains(search) ||
                r.ItemName.Contains(search) ||
                r.SerialNumber.Contains(search));
        }

        // Apply condition filter
        if (!string.IsNullOrWhiteSpace(query.Condition))
        {
            rentalItems = rentalItems.Where(r => r.Condition == query.Condition);
        }

        // Apply location filter
        if (!string.IsNullOrWhiteSpace(query.Location))
        {
            var location = query.Location.Trim();
            rentalItems = rentalItems.Where(r => r.Location.Contains(location));
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
                SaleConfirmedDate = s.SaleConfirmedDate,
                SetSaleConfirmedBy = s.SetSaleConfirmedBy,
                SentSparepartsDate = s.SentSparepartsDate,
                SetSentSparepartsBy = s.SetSentSparepartsBy,
                SparepartItems = s.SparepartItems.Select(si => new SparepartItem
                {   
                    Id = si.Id,
                    SparepartId = si.SparepartId,
                    Description = si.Description,
                    Quantity = si.Quantity,
                    Condition = si.Condition.ToString(),
                    Remarks = si.Remarks,
                    RemarksUpdatedAt = si.RemarksUpdatedAt
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
            // Compared directly so the index on the column stays usable -
            // see SearchServicesAsync.
            var search = searchTerm.Trim();
            query = query.Where(name => name.Contains(search));
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
        // One aggregate, not two passes. There used to be a separate DISTINCT
        // query producing `usedIds` before this one, over the same table with
        // the same WHERE — but the GROUP BY below already yields exactly that
        // key set, so the first query was a second full scan of SparepartItems
        // for a list this one hands back for free.
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

        if (usageCount.Count == 0) return new List<SparepartWithUsage>();

        var usedIds = usageCount.Select(u => u.SparepartId).ToList();

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
            // Compared directly so the index on the column stays usable -
            // see SearchServicesAsync.
            var search = searchTerm.Trim();
            query = query.Where(type => type.Contains(search));
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
        // Projected rather than materialised so the classification names
        // come back in the same statement (LEFT JOINs), not as lazy nulls.
        var sparepart = await context.Spareparts.AsNoTracking()
            .Where(s => s.Id == id)
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
                DefaultPrice = p.DefaultPrice,
                CategoryId = p.CategoryId,
                CategoryName = p.Category != null ? p.Category.Name : null,
                TypeId = p.TypeId,
                TypeName = p.Type != null ? p.Type.Name : null,
                BrandId = p.BrandId,
                BrandName = p.Brand != null ? p.Brand.Name : null,
                BrandLogoUrl = p.Brand != null ? p.Brand.LogoUrl : null,
            })
            .FirstOrDefaultAsync();

        return sparepart ?? throw new KeyNotFoundException();
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  STOCK TRANSACTION REPORTING
    //
    //  Three views over the same table, all keyed on the audit log's own
    //  `Timestamp` — the moment the trigger fired — for the same reason the
    //  usage ledger is: any date derived from a ticket's CURRENT status moves
    //  retroactively when the ticket advances, and a report that changes after
    //  it is printed cannot be cited.
    //
    //  Why these exist alongside the usage report: that one aggregates to a
    //  net figure per part, so an issue and a return cancel out and neither is
    //  visible. Measured on the live ledger, ~100 units returned to stock over
    //  six months while only a handful of rows ever showed it. Stock control
    //  needs the movements, not just the balance.
    // ═══════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Classifies a ledger row's origin. `ServiceId` is the discriminator that
    /// actually exists: rows written by the SparepartItems triggers carry one,
    /// manual stock-outs and direct catalogue edits do not. The two no-service
    /// kinds are then told apart by the trigger's own wording, which is the
    /// only thing distinguishing them — `OperationType` is just STOCK_IN /
    /// STOCK_OUT for every row in the table.
    /// </summary>
    private static string ClassifySource(Guid? serviceId, string remarks, string operationType)
    {
        if (serviceId != null) return "Service";

        // `CK_AuditLog_OperationType` permits STOCK_ADJUSTED as well as
        // STOCK_IN / STOCK_OUT. No row currently uses it — every one of the 41
        // direct catalogue edits on the live table is spelled STOCK_IN or
        // STOCK_OUT and identified only by its Remarks — but the constraint
        // says the trigger may start writing it, and a row that appeared under
        // a new OperationType would otherwise be silently misfiled as "Manual".
        if (string.Equals(operationType, "STOCK_ADJUSTED", StringComparison.OrdinalIgnoreCase))
            return "Adjustment";

        return (remarks ?? "").Contains("Direct quantity edit") ? "Adjustment" : "Manual";
    }

    public async Task<PagedResult<SparepartTransactionRow>> GetSparepartTransactionsAsync(
        SparepartTransactionQuery query)
    {
        var pageNumber = query.PageNumber is null or < 1 ? 1 : query.PageNumber.Value;
        var pageSize = query.PageSize is null or < 1 or > 2000 ? 200 : query.PageSize.Value;

        var logs = context.SparepartStockAuditLogs.AsNoTracking()
            .Where(l => l.SparepartId != Guid.Empty);

        if (query.IncludeTrackingRows != true)
            logs = logs.Where(l => l.QuantityChange != 0);

        if (query.FromDate.HasValue)
            logs = logs.Where(l => l.Timestamp >= query.FromDate.Value.Date);

        // Inclusive of the whole end day: the caller passes a date, not an
        // instant, and a movement at 16:40 must not fall outside "to the 11th".
        if (query.ToDate.HasValue)
        {
            var end = query.ToDate.Value.Date.AddDays(1);
            logs = logs.Where(l => l.Timestamp < end);
        }

        if (string.Equals(query.Direction, "In", StringComparison.OrdinalIgnoreCase))
            logs = logs.Where(l => l.QuantityChange > 0);
        else if (string.Equals(query.Direction, "Out", StringComparison.OrdinalIgnoreCase))
            logs = logs.Where(l => l.QuantityChange < 0);

        if (string.Equals(query.Source, "Service", StringComparison.OrdinalIgnoreCase))
            logs = logs.Where(l => l.ServiceId != null);
        else if (string.Equals(query.Source, "Adjustment", StringComparison.OrdinalIgnoreCase))
            logs = logs.Where(l => l.ServiceId == null && (l.OperationType == "STOCK_ADJUSTED" || l.Remarks.Contains("Direct quantity edit")));
        else if (string.Equals(query.Source, "Manual", StringComparison.OrdinalIgnoreCase))
            logs = logs.Where(l => l.ServiceId == null && l.OperationType != "STOCK_ADJUSTED" && !l.Remarks.Contains("Direct quantity edit"));

        // Left-joined to both: a part can be deleted from the catalogue after
        // its movement was logged (33 such rows measured), and a movement with
        // no ServiceId has no ticket at all. Inner joins would silently drop
        // exactly the rows an audit trail must not lose.
        var rows =
            from l in logs
            join sp in context.Spareparts.AsNoTracking() on l.SparepartId equals sp.Id into spj
            from sp in spj.DefaultIfEmpty()
            join svc in context.Services.AsNoTracking().Include(s => s.Status)
                on l.ServiceId equals (Guid?)svc.Id into svcj
            from svc in svcj.DefaultIfEmpty()
            select new
            {
                l.Id,
                l.Timestamp,
                l.SparepartId,
                ItemName = sp != null ? sp.ItemName : "(deleted part)",
                SerialNumber = sp != null ? sp.SerialNumber : "",
                PictureUrl = sp != null ? sp.PictureUrl : null,
                l.OperationType,
                l.QuantityChange,
                l.OldQuantity,
                l.NewQuantity,
                l.ServiceId,
                ReportNo = svc != null ? svc.ReportNo : "",
                CompanyName = svc != null ? svc.CompanyName : "",
                ServiceStatus = svc != null && svc.Status != null ? svc.Status.Name : "",
                Reason = l.Remarks
            };

        if (!string.IsNullOrWhiteSpace(query.SearchTerm))
        {
            var term = query.SearchTerm.Trim();
            rows = rows.Where(r =>
                r.ItemName.Contains(term) ||
                r.SerialNumber.Contains(term) ||
                r.ReportNo.Contains(term) ||
                r.CompanyName.Contains(term));
        }

        var totalCount = await rows.CountAsync();

        // Newest first by default: a ledger is read from the most recent event
        // backwards. Timestamp is indexed (IX_AuditLog_Timestamp).
        var desc = query.SortDescending ?? true;
        rows = string.Equals(query.SortBy, "quantity", StringComparison.OrdinalIgnoreCase)
            ? (desc
                ? rows.OrderByDescending(r => r.QuantityChange)
                : rows.OrderBy(r => r.QuantityChange))
            : (desc
                ? rows.OrderByDescending(r => r.Timestamp)
                : rows.OrderBy(r => r.Timestamp));

        var page = await rows
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        // ── Pair up movements that cancelled each other ────────────────────
        //
        // A deduction undone by a later return on the same ticket and part is
        // the reason the Telegram feed and the usage report disagree: the feed
        // shows both the deduction and (in a different topic) the return, while
        // the report nets them to nothing. Marking the pair here lets the
        // ledger say so on its own, rather than leaving three deductions on
        // 2026-08-18 looking like missing stock.
        //
        // Scoped to the same ticket+part and to a 24-hour window: a part
        // returned weeks later is a genuine separate movement, not a
        // correction of the original.
        var keys = page
            .Where(r => r.ServiceId != null)
            .Select(r => r.ServiceId!.Value)
            .Distinct()
            .ToList();

        var neighbours = keys.Count == 0
            ? new List<(Guid ServiceId, Guid SparepartId, int Qty, DateTime Ts)>()
            : (await context.SparepartStockAuditLogs.AsNoTracking()
                .Where(l => l.ServiceId != null && keys.Contains(l.ServiceId.Value)
                            && l.QuantityChange != 0)
                .Select(l => new { l.ServiceId, l.SparepartId, l.QuantityChange, l.Timestamp })
                .ToListAsync())
              .Select(x => (
                  ServiceId: x.ServiceId!.Value,
                  SparepartId: x.SparepartId,
                  Qty: x.QuantityChange,
                  Ts: x.Timestamp))
              .ToList();

        bool HasOpposite(Guid? svc, Guid part, int qty, DateTime at, bool later)
        {
            if (svc == null || qty == 0) return false;
            return neighbours.Any(n =>
                n.ServiceId == svc.Value &&
                n.SparepartId == part &&
                Math.Sign(n.Qty) == -Math.Sign(qty) &&
                Math.Abs(n.Qty) == Math.Abs(qty) &&
                (later ? n.Ts > at : n.Ts < at) &&
                Math.Abs((n.Ts - at).TotalHours) <= 24);
        }

        var items = page.Select(r => new SparepartTransactionRow
        {
            Id = r.Id,
            ReversedLater = HasOpposite(r.ServiceId, r.SparepartId, r.QuantityChange, r.Timestamp, later: true),
            IsReversal = HasOpposite(r.ServiceId, r.SparepartId, r.QuantityChange, r.Timestamp, later: false),
            Timestamp = DateTime.SpecifyKind(r.Timestamp, DateTimeKind.Utc),
            SparepartId = r.SparepartId,
            ItemName = r.ItemName,
            SerialNumber = r.SerialNumber,
            PictureUrl = r.PictureUrl,
            OperationType = r.OperationType,
            QuantityChange = r.QuantityChange,
            Quantity = Math.Abs(r.QuantityChange),
            Direction = r.QuantityChange > 0 ? "In" : r.QuantityChange < 0 ? "Out" : "None",
            Source = ClassifySource(r.ServiceId, r.Reason, r.OperationType),
            BalanceBefore = r.OldQuantity,
            BalanceAfter = r.NewQuantity,
            ServiceId = r.ServiceId,
            ReportNo = r.ReportNo,
            CompanyName = r.CompanyName,
            ServiceStatus = r.ServiceStatus,
            Reason = r.Reason
        }).ToList();

        return new PagedResult<SparepartTransactionRow>(items, totalCount, pageNumber, pageSize);
    }

    public async Task<PagedResult<SparepartMovementSummary>> GetSparepartMovementSummaryAsync(
        SparepartTransactionQuery query)
    {
        var pageNumber = query.PageNumber is null or < 1 ? 1 : query.PageNumber.Value;
        var pageSize = query.PageSize is null or < 1 or > 2000 ? 200 : query.PageSize.Value;

        var from = query.FromDate?.Date;
        var toExclusive = query.ToDate?.Date.AddDays(1);

        var window = context.SparepartStockAuditLogs.AsNoTracking()
            .Where(l => l.SparepartId != Guid.Empty && l.QuantityChange != 0);

        if (from.HasValue) window = window.Where(l => l.Timestamp >= from.Value);
        if (toExclusive.HasValue) window = window.Where(l => l.Timestamp < toExclusive.Value);

        // Opening and closing balances are taken from the ledger's own
        // OldQuantity/NewQuantity rather than recomputed. Verified on the live
        // table: NewQuantity == OldQuantity + QuantityChange holds on all 3,226
        // rows, so the first row's OldQuantity IS the opening balance and the
        // last row's NewQuantity IS the closing one — no reconstruction, and
        // therefore no drift between this report and the audit trail.
        var grouped = await window
            .GroupBy(l => l.SparepartId)
            .Select(g => new
            {
                SparepartId = g.Key,
                TotalIn = g.Where(x => x.QuantityChange > 0).Sum(x => (int?)x.QuantityChange) ?? 0,
                TotalOut = g.Where(x => x.QuantityChange < 0).Sum(x => (int?)-x.QuantityChange) ?? 0,
                MovementCount = g.Count(),
                FirstAt = g.Min(x => x.Timestamp),
                LastAt = g.Max(x => x.Timestamp)
            })
            .ToListAsync();

        if (grouped.Count == 0)
            return new PagedResult<SparepartMovementSummary>(
                new List<SparepartMovementSummary>(), 0, pageNumber, pageSize);

        var ids = grouped.Select(g => g.SparepartId).ToList();

        var boundaries = await context.SparepartStockAuditLogs.AsNoTracking()
            .Where(l => ids.Contains(l.SparepartId) && l.QuantityChange != 0
                        && (!from.HasValue || l.Timestamp >= from.Value)
                        && (!toExclusive.HasValue || l.Timestamp < toExclusive.Value))
            .Select(l => new { l.SparepartId, l.Timestamp, l.OldQuantity, l.NewQuantity })
            .ToListAsync();

        var opening = boundaries
            .GroupBy(b => b.SparepartId)
            .ToDictionary(
                g => g.Key,
                g => new
                {
                    Open = g.OrderBy(x => x.Timestamp).First().OldQuantity,
                    Close = g.OrderByDescending(x => x.Timestamp).First().NewQuantity
                });

        var parts = await context.Spareparts.AsNoTracking()
            .Where(sp => ids.Contains(sp.Id))
            .Select(sp => new { sp.Id, sp.ItemName, sp.SerialNumber, sp.Quantity })
            .ToListAsync();
        var partById = parts.ToDictionary(p => p.Id);

        var all = grouped.Select(g =>
        {
            partById.TryGetValue(g.SparepartId, out var p);
            var b = opening[g.SparepartId];
            return new SparepartMovementSummary
            {
                SparepartId = g.SparepartId,
                ItemName = p?.ItemName ?? "(deleted part)",
                SerialNumber = p?.SerialNumber ?? "",
                OpeningBalance = b.Open,
                TotalIn = g.TotalIn,
                TotalOut = g.TotalOut,
                NetChange = g.TotalIn - g.TotalOut,
                ClosingBalance = b.Close,
                CurrentStock = p?.Quantity ?? 0,
                MovementCount = g.MovementCount
            };
        });

        if (!string.IsNullOrWhiteSpace(query.SearchTerm))
        {
            var term = query.SearchTerm.Trim();
            all = all.Where(r =>
                (r.ItemName ?? "").Contains(term, StringComparison.OrdinalIgnoreCase) ||
                (r.SerialNumber ?? "").Contains(term, StringComparison.OrdinalIgnoreCase));
        }

        var list = all.ToList();
        var ordered = (query.SortDescending ?? true)
            ? list.OrderByDescending(r => r.TotalOut).ThenByDescending(r => r.TotalIn).ToList()
            : list.OrderBy(r => r.TotalOut).ThenBy(r => r.TotalIn).ToList();

        var items = ordered.Skip((pageNumber - 1) * pageSize).Take(pageSize).ToList();
        return new PagedResult<SparepartMovementSummary>(items, ordered.Count, pageNumber, pageSize);
    }

    public async Task<PagedResult<SparepartDeadStockRow>> GetSparepartDeadStockAsync(
        SparepartTransactionQuery query)
    {
        var pageNumber = query.PageNumber is null or < 1 ? 1 : query.PageNumber.Value;
        var pageSize = query.PageSize is null or < 1 or > 2000 ? 200 : query.PageSize.Value;
        var idleDays = query.IdleDays is null or < 1 ? 90 : query.IdleDays.Value;

        // Server-local, matching the trigger's own GETDATE() — comparing an
        // audit timestamp written in server-local time against a UTC "now"
        // would shift the cutoff by the timezone offset and silently mislabel
        // a day's worth of parts either side of the boundary.
        var cutoff = DateTime.Now.AddDays(-idleDays);

        var lastMovements = await context.SparepartStockAuditLogs.AsNoTracking()
            .Where(l => l.QuantityChange != 0 && l.SparepartId != Guid.Empty)
            .GroupBy(l => l.SparepartId)
            .Select(g => new { SparepartId = g.Key, LastAt = g.Max(x => x.Timestamp) })
            .ToListAsync();
        var lastById = lastMovements.ToDictionary(x => x.SparepartId, x => x.LastAt);

        // Only parts actually holding stock: a part at zero is not idle capital,
        // it is simply out of stock, and belongs in a reorder report instead.
        var stocked = await context.Spareparts.AsNoTracking()
            .Where(sp => sp.Quantity > 0)
            .Select(sp => new { sp.Id, sp.ItemName, sp.SerialNumber, sp.Quantity })
            .ToListAsync();

        var held = await context.SparepartItems.AsNoTracking()
            .Where(si => si.IsHoldStatus == true && si.SparepartId != Guid.Empty && si.Quantity > 0)
            .GroupBy(si => si.SparepartId)
            .Select(g => new { SparepartId = g.Key, Qty = g.Sum(x => x.Quantity) })
            .ToListAsync();
        var heldById = held.ToDictionary(x => x.SparepartId, x => x.Qty);

        var now = DateTime.Now;
        var rows = stocked
            .Select(sp =>
            {
                lastById.TryGetValue(sp.Id, out var last);
                var hasMovement = lastById.ContainsKey(sp.Id);
                return new SparepartDeadStockRow
                {
                    SparepartId = sp.Id,
                    ItemName = sp.ItemName,
                    SerialNumber = sp.SerialNumber,
                    Quantity = sp.Quantity,
                    HeldQuantity = heldById.TryGetValue(sp.Id, out var h) ? h : 0,
                    // Null, not a sentinel date: a part with NO movement on
                    // record is a different statement from one that moved long
                    // ago, and the ledger only goes back to 2026-02-19 anyway.
                    LastMovement = hasMovement ? last : null,
                    DaysSinceMovement = hasMovement ? (int)(now - last).TotalDays : null
                };
            })
            .Where(r => r.LastMovement == null || r.LastMovement < cutoff);

        if (!string.IsNullOrWhiteSpace(query.SearchTerm))
        {
            var term = query.SearchTerm.Trim();
            rows = rows.Where(r =>
                (r.ItemName ?? "").Contains(term, StringComparison.OrdinalIgnoreCase) ||
                (r.SerialNumber ?? "").Contains(term, StringComparison.OrdinalIgnoreCase));
        }

        // Longest-idle first, with never-moved parts ahead of everything —
        // they are the strongest signal and would otherwise sort as zero.
        var ordered = rows
            .OrderByDescending(r => r.DaysSinceMovement ?? int.MaxValue)
            .ThenByDescending(r => r.Quantity)
            .ToList();

        var items = ordered.Skip((pageNumber - 1) * pageSize).Take(pageSize).ToList();
        return new PagedResult<SparepartDeadStockRow>(items, ordered.Count, pageNumber, pageSize);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  STOCK DATA HEALTH
    //
    //  Every fault this looks for was found by hand on 2026-08-19, and every
    //  one of them had been sitting undetected. Nothing in the system was
    //  checking, so the first sign of trouble was a user asking why Telegram
    //  said 13 and the report said 9.
    //
    //  It reports; it never repairs. Each category needs a different human
    //  judgement — merging duplicate parts, correcting a balance, or chasing a
    //  trigger — and an automatic "fix" that guessed wrong would corrupt the
    //  audit trail these checks exist to protect.
    // ═══════════════════════════════════════════════════════════════════════
    public async Task<PagedResult<StockHealthIssue>> GetStockHealthAsync(
        SparepartTransactionQuery query)
    {
        var pageNumber = query.PageNumber is null or < 1 ? 1 : query.PageNumber.Value;
        var pageSize = query.PageSize is null or < 1 or > 2000 ? 500 : query.PageSize.Value;

        var issues = new List<StockHealthIssue>();

        var parts = await context.Spareparts.AsNoTracking()
            .Select(sp => new { sp.Id, sp.ItemName, sp.SerialNumber, sp.Quantity })
            .ToListAsync();
        var partById = parts.ToDictionary(p => p.Id);

        // ── 1. Notifications with no ledger row ────────────────────────────
        //
        // The outbox is the Telegram feed. A row here with no matching audit
        // row means a stock message went out for a movement the ledger has no
        // record of — the two tables are written by the same triggers and must
        // not disagree. Measured 2026-08-19: 8 of 139 outbox rows.
        //
        // Matched on part + signed quantity + a 2-second window, because both
        // writes happen inside one trigger execution and `CreatedAt` defaults
        // to the same `getdate()` the audit insert uses.
        // Read via raw ADO on the context's own connection rather than through
        // EF. `StockNotificationOutbox` has no entity and no configuration —
        // it is written entirely by SQL triggers and has never been mapped —
        // and mapping it would mean adding a type from this project to the
        // shared `TechnicalServiceContext`, inverting the dependency for one
        // read-only diagnostic query.
        var outbox = new List<StockNotificationOutboxRow>();
        var conn = context.Database.GetDbConnection();
        var opened = conn.State != System.Data.ConnectionState.Open;
        if (opened) await conn.OpenAsync();
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT o.SparepartId, o.ServiceId, o.OperationType,
                       o.QuantityChange, o.CreatedAt
                FROM dbo.StockNotificationOutbox o
                WHERE NOT EXISTS (
                    SELECT 1 FROM dbo.SparepartStockAuditLog l
                    WHERE l.SparepartId = o.SparepartId
                      AND ABS(DATEDIFF(SECOND, l.Timestamp, o.CreatedAt)) <= 2
                      AND l.QuantityChange = o.QuantityChange)";
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                outbox.Add(new StockNotificationOutboxRow
                {
                    SparepartId = reader.GetGuid(0),
                    ServiceId = reader.IsDBNull(1) ? null : reader.GetGuid(1),
                    OperationType = reader.IsDBNull(2) ? "" : reader.GetString(2),
                    QuantityChange = reader.GetInt32(3),
                    CreatedAt = reader.GetDateTime(4)
                });
            }
        }
        finally
        {
            if (opened) await conn.CloseAsync();
        }

        var orphanServiceIds = outbox.Where(o => o.ServiceId != null)
            .Select(o => o.ServiceId!.Value).Distinct().ToList();
        var orphanReportNos = await context.Services.AsNoTracking()
            .Where(s => orphanServiceIds.Contains(s.Id))
            .Select(s => new { s.Id, s.ReportNo })
            .ToDictionaryAsync(x => x.Id, x => x.ReportNo);

        foreach (var o in outbox)
        {
            partById.TryGetValue(o.SparepartId, out var p);
            issues.Add(new StockHealthIssue
            {
                Category = "OrphanNotification",
                Severity = "high",
                SparepartId = o.SparepartId,
                ItemName = p?.ItemName ?? "(deleted part)",
                SerialNumber = p?.SerialNumber ?? "",
                Detail = $"A stock notification was sent ({o.OperationType} {o.QuantityChange:+#;-#;0}) "
                       + "but the audit ledger has no matching movement.",
                Expected = o.QuantityChange,
                Actual = null,
                OccurredAt = o.CreatedAt,
                ReportNo = o.ServiceId != null && orphanReportNos.TryGetValue(o.ServiceId.Value, out var rn)
                    ? rn : ""
            });
        }

        // ── 2. Ledger implies an impossible opening balance ────────────────
        //
        // SUM(QuantityChange) over all real movements should equal
        // CurrentQuantity - InitialQuantity. `Spareparts` stores no initial
        // quantity, so the check that survives is the sign: an implied opening
        // below zero cannot have happened. Usually it means issues predating
        // the ledger (2026-02-19) whose returns landed after it.
        var ledgerNet = await context.SparepartStockAuditLogs.AsNoTracking()
            .Where(l => l.QuantityChange != 0 && l.SparepartId != Guid.Empty)
            .GroupBy(l => l.SparepartId)
            .Select(g => new { SparepartId = g.Key, Net = g.Sum(x => x.QuantityChange) })
            .ToListAsync();

        foreach (var n in ledgerNet)
        {
            if (!partById.TryGetValue(n.SparepartId, out var p)) continue;
            var impliedOpening = p.Quantity - n.Net;
            if (impliedOpening >= 0) continue;

            issues.Add(new StockHealthIssue
            {
                Category = "LedgerMismatch",
                Severity = "high",
                SparepartId = n.SparepartId,
                ItemName = p.ItemName,
                SerialNumber = p.SerialNumber,
                Detail = $"Ledger nets {n.Net:+#;-#;0} against a current stock of {p.Quantity}, "
                       + $"implying an opening balance of {impliedOpening} — which is impossible. "
                       + "Usually an issue that predates the ledger with its return recorded after it.",
                Expected = 0,
                Actual = impliedOpening
            });
        }

        // ── 3. Duplicate catalogue names ───────────────────────────────────
        //
        // The direct cause of the wrong-part picks: 30 rows are all called
        // "Fuser Film Sleeve", two of them with serial "N/A" holding different
        // quantities. A technician picking from a dropdown cannot tell them
        // apart, which is how one ticket produced two contradictory stock
        // messages within 23 minutes.
        //
        // Grouped on the TRIMMED, case-folded name because several of these
        // differ only by a trailing space.
        var dupGroups = parts
            .GroupBy(p => (p.ItemName ?? "").Trim().ToLowerInvariant())
            .Where(g => !string.IsNullOrWhiteSpace(g.Key) && g.Count() > 1);

        foreach (var g in dupGroups)
        {
            var withStock = g.Count(p => p.Quantity > 0);
            issues.Add(new StockHealthIssue
            {
                Category = "DuplicateName",
                // Only worth acting on when more than one of them actually
                // holds stock — that is when a wrong pick moves real units.
                Severity = withStock > 1 ? "high" : "low",
                SparepartId = g.First().Id,
                ItemName = g.First().ItemName,
                SerialNumber = string.Join(", ", g.Select(p => string.IsNullOrWhiteSpace(p.SerialNumber)
                    ? "(no serial)" : p.SerialNumber.Trim()).Take(6)),
                Detail = $"{g.Count()} catalogue entries share this name, {withStock} of them holding stock. "
                       + "Identical names in a picker let the wrong one be chosen.",
                Expected = 1,
                Actual = g.Count()
            });
        }

        // ── 4. Negative stock ──────────────────────────────────────────────
        // None on the live catalogue today, but a part below zero means the
        // deduction path ran without the stock being there.
        foreach (var p in parts.Where(p => p.Quantity < 0))
        {
            issues.Add(new StockHealthIssue
            {
                Category = "NegativeStock",
                Severity = "high",
                SparepartId = p.Id,
                ItemName = p.ItemName,
                SerialNumber = p.SerialNumber,
                Detail = $"Catalogue quantity is {p.Quantity}. Stock cannot be negative.",
                Expected = 0,
                Actual = p.Quantity
            });
        }

        // ── 5. Returns with no matching issue ──────────────────────────────
        //
        // A STOCK_IN whose ticket+part has more returned than was ever issued.
        // This is what renders as a negative "used" figure in the usage report
        // and reads as a stock deficit. Measured: 10 such pairs.
        var perServicePart = await context.SparepartStockAuditLogs.AsNoTracking()
            .Where(l => l.QuantityChange != 0 && l.ServiceId != null && l.SparepartId != Guid.Empty)
            .GroupBy(l => new { l.ServiceId, l.SparepartId })
            .Select(g => new
            {
                g.Key.ServiceId,
                g.Key.SparepartId,
                In = g.Where(x => x.QuantityChange > 0).Sum(x => (int?)x.QuantityChange) ?? 0,
                Out = g.Where(x => x.QuantityChange < 0).Sum(x => (int?)-x.QuantityChange) ?? 0,
                LastAt = g.Max(x => x.Timestamp)
            })
            .Where(x => x.In > x.Out)
            .ToListAsync();

        var orphanRestoreServiceIds = perServicePart.Select(x => x.ServiceId!.Value).Distinct().ToList();
        var restoreReportNos = await context.Services.AsNoTracking()
            .Where(s => orphanRestoreServiceIds.Contains(s.Id))
            .Select(s => new { s.Id, s.ReportNo })
            .ToDictionaryAsync(x => x.Id, x => x.ReportNo);

        foreach (var x in perServicePart)
        {
            partById.TryGetValue(x.SparepartId, out var p);
            issues.Add(new StockHealthIssue
            {
                Category = "OrphanRestore",
                Severity = "medium",
                SparepartId = x.SparepartId,
                ItemName = p?.ItemName ?? "(deleted part)",
                SerialNumber = p?.SerialNumber ?? "",
                Detail = $"{x.In} unit(s) returned but only {x.Out} ever issued on this ticket. "
                       + "The original deduction predates the ledger, so the return has no pair.",
                Expected = x.In,
                Actual = x.Out,
                OccurredAt = x.LastAt,
                ReportNo = restoreReportNos.TryGetValue(x.ServiceId!.Value, out var rn2) ? rn2 : ""
            });
        }

        if (!string.IsNullOrWhiteSpace(query.SearchTerm))
        {
            var term = query.SearchTerm.Trim();
            issues = issues.Where(i =>
                (i.ItemName ?? "").Contains(term, StringComparison.OrdinalIgnoreCase) ||
                (i.Category ?? "").Contains(term, StringComparison.OrdinalIgnoreCase) ||
                (i.ReportNo ?? "").Contains(term, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        // Highest severity first, then most recent — the order someone
        // triaging this page needs.
        var rank = new Dictionary<string, int> { ["high"] = 0, ["medium"] = 1, ["low"] = 2 };
        var ordered = issues
            .OrderBy(i => rank.TryGetValue(i.Severity, out var r) ? r : 3)
            .ThenByDescending(i => i.OccurredAt ?? DateTime.MinValue)
            .ThenBy(i => i.ItemName)
            .ToList();

        var page = ordered.Skip((pageNumber - 1) * pageSize).Take(pageSize).ToList();
        return new PagedResult<StockHealthIssue>(page, ordered.Count, pageNumber, pageSize);
    }

    /// <summary>Turns a trigger's own remark into something a storekeeper reads.</summary>
    private static string DescribeReturn(string remarks)
    {
        var r = remarks ?? "";
        if (r.Contains("to Hold", StringComparison.OrdinalIgnoreCase)
            || r.Contains("Hold → stock restored", StringComparison.OrdinalIgnoreCase)
            || r.Contains("Hold ? stock restored", StringComparison.OrdinalIgnoreCase))
            return "put back on hold";
        if (r.Contains("Removed from repair order", StringComparison.OrdinalIgnoreCase))
            return "removed from repair order";
        if (r.Contains("Direct quantity edit", StringComparison.OrdinalIgnoreCase))
            return "stock corrected by hand";
        return string.IsNullOrWhiteSpace(r) ? "returned to stock" : r;
    }

    public async Task<StockReconciliationResult> GetStockReconciliationAsync(
        SparepartTransactionQuery query)
    {
        var from = query.FromDate?.Date ?? DateTime.Now.Date;
        var toExclusive = (query.ToDate?.Date ?? DateTime.Now.Date).AddDays(1);

        // ── Read BOTH tables ───────────────────────────────────────────────
        //
        // The ledger alone cannot answer this. On 2026-08-18 one of the three
        // reversals — the Fuser Film Sleeve pair on ticket 20260817-1695 —
        // exists ONLY in the outbox: a notification went out, the catalogue
        // quantity moved 8 → 7 → 8, and `SparepartStockAuditLog` recorded
        // neither half. Reading the ledger by itself would explain 2 of the 3
        // and leave the user with the same unexplained unit they started with.
        var ledger = await context.SparepartStockAuditLogs.AsNoTracking()
            .Where(l => l.QuantityChange != 0 && l.SparepartId != Guid.Empty
                        && l.Timestamp >= from && l.Timestamp < toExclusive)
            .Select(l => new
            {
                l.SparepartId, l.ServiceId, l.QuantityChange, l.Timestamp, l.Remarks
            })
            .ToListAsync();

        var movements = ledger
            .Select(l => (l.SparepartId, l.ServiceId, Qty: l.QuantityChange,
                          At: l.Timestamp, l.Remarks, InLedger: true))
            .ToList();

        var conn = context.Database.GetDbConnection();
        var opened = conn.State != System.Data.ConnectionState.Open;
        if (opened) await conn.OpenAsync();
        try
        {
            await using var cmd = conn.CreateCommand();
            // Only outbox rows the ledger does not already have — otherwise
            // every movement would be counted twice and every pair duplicated.
            cmd.CommandText = @"
                SELECT o.SparepartId, o.ServiceId, o.QuantityChange, o.CreatedAt, o.Remarks
                FROM dbo.StockNotificationOutbox o
                WHERE o.CreatedAt >= @from AND o.CreatedAt < @to
                  AND NOT EXISTS (
                      SELECT 1 FROM dbo.SparepartStockAuditLog l
                      WHERE l.SparepartId = o.SparepartId
                        AND ABS(DATEDIFF(SECOND, l.Timestamp, o.CreatedAt)) <= 2
                        AND l.QuantityChange = o.QuantityChange)";
            var pFrom = cmd.CreateParameter(); pFrom.ParameterName = "@from"; pFrom.Value = from;
            var pTo = cmd.CreateParameter(); pTo.ParameterName = "@to"; pTo.Value = toExclusive;
            cmd.Parameters.Add(pFrom); cmd.Parameters.Add(pTo);

            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                movements.Add((
                    reader.GetGuid(0),
                    reader.IsDBNull(1) ? (Guid?)null : reader.GetGuid(1),
                    reader.GetInt32(2),
                    reader.GetDateTime(3),
                    reader.IsDBNull(4) ? "" : reader.GetString(4),
                    false));
            }
        }
        finally
        {
            if (opened) await conn.CloseAsync();
        }

        // ── Pair each deduction with its return ────────────────────────────
        //
        // Same ticket, same part, same magnitude, opposite sign, return after
        // the deduction, within 24 hours. The window is what separates a
        // correction from a genuine later movement: a part returned next month
        // is not undoing anything, it is its own event.
        //
        // Each return is consumed once (`used`), so two deductions of the same
        // part on one ticket cannot both claim the same single return.
        // Each return can only cancel ONE deduction: two issues of the same part
        // on one ticket must not both claim the same single return.
        var claimedReturns = new HashSet<int>();
        var pairs = new List<(Guid SparepartId, Guid? ServiceId, int Qty,
                              DateTime OutAt, DateTime BackAt, string Why, bool InLedger)>();

        foreach (var outMv in movements.Where(m => m.Qty < 0).OrderBy(m => m.At))
        {
            if (outMv.ServiceId == null) continue; // adjustments have no ticket to pair on

            for (var i = 0; i < movements.Count; i++)
            {
                var back = movements[i];
                if (claimedReturns.Contains(i)) continue;
                if (back.Qty <= 0) continue;
                if (back.ServiceId != outMv.ServiceId) continue;
                if (back.SparepartId != outMv.SparepartId) continue;
                if (back.Qty != -outMv.Qty) continue;
                if (back.At <= outMv.At) continue;
                if ((back.At - outMv.At).TotalHours > 24) continue;

                claimedReturns.Add(i);
                pairs.Add((outMv.SparepartId, outMv.ServiceId, -outMv.Qty, outMv.At, back.At,
                          DescribeReturn(back.Remarks), outMv.InLedger && back.InLedger));
                break;
            }
        }

        // ── Enrich for display ─────────────────────────────────────────────
        var partIds = pairs.Select(p => p.SparepartId).Distinct().ToList();
        var parts = await context.Spareparts.AsNoTracking()
            .Where(sp => partIds.Contains(sp.Id))
            .Select(sp => new { sp.Id, sp.ItemName, sp.SerialNumber })
            .ToListAsync();
        var partById = parts.ToDictionary(p => p.Id);

        var svcIds = pairs.Where(p => p.ServiceId != null).Select(p => p.ServiceId!.Value)
            .Distinct().ToList();
        var reportNos = await context.Services.AsNoTracking()
            .Where(s => svcIds.Contains(s.Id))
            .Select(s => new { s.Id, s.ReportNo })
            .ToDictionaryAsync(x => x.Id, x => x.ReportNo);

        var rows = pairs
            .OrderBy(p => p.OutAt)
            .Select(p =>
            {
                partById.TryGetValue(p.SparepartId, out var sp);
                return new StockReconciliationRow
                {
                    SparepartId = p.SparepartId,
                    ItemName = sp?.ItemName ?? "(deleted part)",
                    SerialNumber = sp?.SerialNumber ?? "",
                    Quantity = p.Qty,
                    OutAt = p.OutAt,
                    ReturnedAt = p.BackAt,
                    MinutesOut = (int)Math.Round((p.BackAt - p.OutAt).TotalMinutes),
                    Why = p.Why,
                    ReportNo = p.ServiceId != null && reportNos.TryGetValue(p.ServiceId.Value, out var rn)
                        ? rn : "",
                    RecordedInLedger = p.InLedger
                };
            })
            .ToList();

        // Headline counts. `NotificationsSent` is every stock-out movement
        // across both tables — what the Telegram feed actually posted — while
        // `ReportedUsage` nets the returns back out, which is what the usage
        // report shows. The gap between them is what this page exists to
        // itemise.
        var notificationsSent = movements.Count(m => m.Qty < 0);
        var ledgerStockOut = movements.Count(m => m.Qty < 0 && m.InLedger);
        var reportedUsage = movements
            .Where(m => m.InLedger && m.ServiceId != null)
            .Sum(m => -m.Qty);

        return new StockReconciliationResult
        {
            NotificationsSent = notificationsSent,
            LedgerStockOut = ledgerStockOut,
            ReportedUsage = reportedUsage,
            ReversedPairs = rows.Count,
            UnrecordedMovements = movements.Count(m => !m.InLedger),
            Rows = rows
        };
    }

    public async Task<AnnualTechnicalMatrixDto> GetAnnualTechnicalMatrixAsync(int year)
    {
        var from = new DateTime(year, 1, 1);
        var to = new DateTime(year, 12, 31, 23, 59, 59);

        var services = await context.Services
            .AsNoTracking()
            .Where(s =>
                (s.ServiceDate >= from && s.ServiceDate <= to) ||
                (s.FinishedDate.HasValue && s.FinishedDate.Value >= from && s.FinishedDate.Value <= to) ||
                (s.UnrepairableDate.HasValue && s.UnrepairableDate.Value >= from && s.UnrepairableDate.Value <= to) ||
                (s.CustomerRejectedDate.HasValue && s.CustomerRejectedDate.Value >= from && s.CustomerRejectedDate.Value <= to) ||
                (s.AwaitingCustomerConfirmDate.HasValue && s.AwaitingCustomerConfirmDate.Value >= from && s.AwaitingCustomerConfirmDate.Value <= to) ||
                (s.AwaitingSparepartDate.HasValue && s.AwaitingSparepartDate.Value >= from && s.AwaitingSparepartDate.Value <= to) ||
                (s.SaleConfirmedDate.HasValue && s.SaleConfirmedDate.Value >= from && s.SaleConfirmedDate.Value <= to) ||
                (s.SentSparepartsDate.HasValue && s.SentSparepartsDate.Value >= from && s.SentSparepartsDate.Value <= to)
            )
            .Select(s => new
            {
                s.ServiceDate,
                s.FinishedDate,
                s.UnrepairableDate,
                s.CustomerRejectedDate,
                s.AwaitingCustomerConfirmDate,
                s.AwaitingSparepartDate,
                s.SaleConfirmedDate,
                s.SentSparepartsDate,
                StatusId = s.Status.Id,
                ServiceLocation = s.ServiceLocation
            })
            .ToListAsync();

        var machineIn = new int[12];
        var machineOut = new int[12];
        var unrepairable = new int[12];
        var awaitingConfirm = new int[12];
        var onsiteService = new int[12];

        foreach (var s in services)
        {
            // 1. ម៉ាស៊ីនចូល (ServiceDate)
            if (s.ServiceDate.Year == year)
            {
                var m = s.ServiceDate.Month - 1;
                machineIn[m]++;

                // 7. ឆែក&ជួសជុលម៉ាស៊ីនខាងក្រៅ (OnSite)
                if (s.ServiceLocation == Domain.AggregatesModel.TechnicalAggregate.ServiceLocation.OnSite)
                {
                    onsiteService[m]++;
                }
            }

            // 2. ម៉ាស៊ីនចេញ (CompanyService + FinishedDate: StatusId == 6)
            if (s.StatusId == 6 && s.ServiceLocation == Domain.AggregatesModel.TechnicalAggregate.ServiceLocation.CompanyService)
            {
                var fDate = s.FinishedDate ?? s.ServiceDate;
                if (fDate.Year == year)
                {
                    machineOut[fDate.Month - 1]++;
                }
            }

            // 3. ម៉ាស៊ីនជួសជុលមិនបាន (Unrepairable: StatusId == 8 || Customer Rejected: StatusId == 7)
            if (s.StatusId == 8 || s.StatusId == 7)
            {
                var rDate = s.CustomerRejectedDate ?? s.UnrepairableDate ?? s.ServiceDate;
                if (rDate.Year == year)
                {
                    unrepairable[rDate.Month - 1]++;
                }
            }

            // 4. ម៉ាស៊ីនរង់ចាំការយល់ព្រមជួសជុល (Awaiting Confirm: 3, Awaiting Sparepart: 4, Sale Confirmed: 11, Sent Spareparts: 12)
            if (s.StatusId == 3 || s.StatusId == 4 || s.StatusId == 11 || s.StatusId == 12)
            {
                var wDate = (s.StatusId == 3 ? s.AwaitingCustomerConfirmDate : null) ??
                            (s.StatusId == 4 ? s.AwaitingSparepartDate : null) ??
                            (s.StatusId == 11 ? s.SaleConfirmedDate : null) ??
                            (s.StatusId == 12 ? s.SentSparepartsDate : null) ??
                            s.ServiceDate;

                if (wDate.Year == year)
                {
                    awaitingConfirm[wDate.Month - 1]++;
                }
            }
        }

        return new AnnualTechnicalMatrixDto(machineIn, machineOut, unrepairable, awaitingConfirm, onsiteService);
    }
}


/// <summary>
/// Read-only projection of `StockNotificationOutbox`, which has no EF entity —
/// the table is written entirely by SQL triggers and has never been mapped.
/// Populated by raw ADO, never by EF, so it needs no key and no mapping.
/// </summary>
public class StockNotificationOutboxRow
{
    public Guid SparepartId { get; set; }
    public Guid? ServiceId { get; set; }
    public string OperationType { get; set; }
    public int QuantityChange { get; set; }
    public DateTime CreatedAt { get; set; }
}