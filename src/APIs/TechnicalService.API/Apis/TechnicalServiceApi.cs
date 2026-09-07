using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Azure.Core;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using System.Globalization;
using TechnicalService.API.Apis;
using TechnicalService.API.Application.Commands;
using TechnicalService.API.Application.Queries;
using TechnicalService.Domain;

// Imported as aliases rather than `using TechnicalService.API.Extensions;`
// because this file also references the global `Extensions` class by name
// (Extensions.LookupCachePolicy), and importing a namespace whose last segment
// is "Extensions" makes that identifier ambiguous.
using BusinessClock = TechnicalService.API.Extensions.BusinessClock;
using Pagination = TechnicalService.API.Extensions.Pagination;

public static class TechnicalServiceApi
{
    public static RouteGroupBuilder MapRepairsApiV1(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("api");


        // Items - Basic and Search
        api.MapGet("/items", GetItemsAsync);
        api.MapGet("/items/search", SearchItemsAsync);
        api.MapGet("/items/unique-names", GetUniqueItemNamesAsync);
        api.MapGet("/items/unique-types", GetUniqueItemTypesAsync);
        api.MapGet("/items/{itemId:Guid}", GetItemAsync);
        api.MapPost("/items", CreateItemAsync);
        api.MapPut("/items", UpdateItemAsync);
        api.MapDelete("/items/{itemId:Guid}", DeleteItemAsync);

        // Spareparts - Basic and Search
        api.MapGet("/spareparts", GetSparepartsAsync)
           .CacheOutput(Extensions.SparepartsCachePolicy);
        api.MapGet("/spareparts/search", SearchSparepartsAsync)
           .CacheOutput(Extensions.SparepartsCachePolicy);
        api.MapGet("/spareparts/{sparepartId:Guid}", GetSparepartAsync);
        api.MapPost("/spareparts", CreateSparepartAsync);
        api.MapPut("/spareparts", UpdateSparepartAsync);
        api.MapGet("/spareparts/used-in-services", GetSparePartsUsedInServicesAsync);
        // Seeded lookup tables — they only change when a migration reseeds them,
        // but the UI asks for them on every page load. Cached server-side so the
        // repeat asks never reach the (remote) database.
        api.MapGet("/technicalservices/servicetypes", GetServiceTypesAsync)
           .CacheOutput(Extensions.LookupCachePolicy);
        api.MapGet("/technicalservices/servicepriorities", GetServicePrioritiesAsync)
           .CacheOutput(Extensions.LookupCachePolicy);
        api.MapGet("/technicalservices/servicestatuses", GetServiceStatusesAsync)
           .CacheOutput(Extensions.LookupCachePolicy);

        // Dashboard stat tiles. Must be declared before the
        // "/technicalservices/{serviceId:Guid}" route is matched — the Guid
        // constraint already keeps them apart, but keeping literal segments
        // above parameterised ones avoids depending on that.
        api.MapGet("/technicalservices/dashboard-stats", GetDashboardStatsAsync)
           .CacheOutput(Extensions.DashboardCachePolicy);

        // Services - Basic and Search
        api.MapGet("/technicalservices", GetServicesAsync);
        api.MapGet("/technicalservices/search", SearchServicesAsync);
        api.MapGet("/technicalservices/{serviceId:Guid}", GetServiceAsync);
        api.MapPut("/technicalservices", UpdateRepairServiceAsync);
        api.MapDelete("/technicalservices/{serviceId:Guid}", DeleteTechnicalServiceAsync);
        api.MapPut("/technicalservices/{serviceId:Guid}/status", UpdateServiceStatusAsync);

        api.MapGet("/spareparts/usage", GetSparepartUsageAsync);
        api.MapPost("/spareparts/manual-stockout", ManualStockOutAsync);
        api.MapGet("/spareparts/hold", GetSparepartHoldAsync);
        api.MapGet("/spareparts/transactions", GetSparepartTransactionsAsync);
        api.MapGet("/spareparts/movement-summary", GetSparepartMovementSummaryAsync);
        api.MapGet("/spareparts/dead-stock", GetSparepartDeadStockAsync);
        api.MapGet("/spareparts/health", GetStockHealthAsync);
        api.MapGet("/spareparts/reconciliation", GetStockReconciliationAsync);
        api.MapPost("/spareparts/items/{sparepartItemId:Guid}/remarks", UpdateSparepartItemRemarksAsync);


        api.MapPost("/receiveitem", CreateReceiveItemAsync);
        api.MapPut("/receiveitem", UpdateReceiveItemAsync);
        api.MapDelete("/receiveitem/{serviceId:Guid}", DeleteReceiveItemAsync);
        api.MapPost("/inspecting", SetInspectingAsync);
        api.MapPost("/inspectitem", CreateInspectItemAsync);
        api.MapPut("/inspectitem", UpdateInspectItemAsync);
        api.MapDelete("/inspectitem/{serviceId:Guid}/spareparts/{sparepartItemId:Guid}",
    DeleteSparepartItemAsync);
        api.MapPost("/awaitingcustomerConfirm", SetAwaitingCustomerConfirmAsync);
        api.MapPost("/customerrejected", SetCustomerRejectedAsync);
        api.MapPost("/awaitingsparepart", SetAwaitingSparepartAsync);
        api.MapPost("/saleconfirmed", SetSaleConfirmedAsync);
        api.MapPost("/sentspareparts", SetSentSparepartsAsync);

        api.MapPost("/repairitem", SetRepairAsync);
        api.MapPost("/thirdpartyrepair", SetThirdPartyRepairAsync);
        api.MapPost("/finishedrepair", SetFinishedStatusAsync);
        api.MapPost("/unrepairable", SetUnrepairableAsync);
        api.MapGet("/technicalservices/monthly-report-summary", GetMonthlyReportSummaryAsync);
        api.MapGet("/technicalservices/annual-matrix", GetAnnualTechnicalMatrixAsync);

        // Rental Items - Basic and Search
        api.MapPost("/rentalitem", CreateRentalItemAsync);
        api.MapGet("/rentalitem", GetRentalItemsAsync);
        api.MapGet("/rentalitem/search", SearchRentalItemsAsync);
        api.MapGet("/rentalItem/{id:Guid}", GetRentalItemAsync);

        // Rental Services - Basic and Search
        api.MapPost("/rentalservice", CreateRentalServiceAsync);
        api.MapGet("/rentalservice", GetRentalServicesAsync);
        api.MapGet("/rentalservice/search", SearchRentalServicesAsync);
        api.MapGet("/rentalservice/{id:Guid}", GetRentalServiceAsync);

        api.MapGet("/rentalitemdetail/{id:Guid}",
            async Task<Results<Ok<RentalItemDetail>, NotFound>> (Guid id, ITechnicalServiceQueries queries) =>
        {
            // GetRentalItemDetailAsync throws when the rental item is missing,
            // and this handler had no 404 path at all, so an unknown id was an
            // unhandled 500.
            try
            {
                return TypedResults.Ok(await queries.GetRentalItemDetailAsync(id));
            }
            catch (KeyNotFoundException)
            {
                return TypedResults.NotFound();
            }
        });

        api.MapGet("/rentalitemdetail", async ([FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, ITechnicalServiceQueries queries) =>
        {
            var rentalItems = await queries.GetRentalItemsByDateAsync(fromDate, toDate);
            return TypedResults.Ok(rentalItems);
        });

        api.MapGet("/rentalitemdetail/{serialNo}", async (string serialNo, ITechnicalServiceQueries queries) =>
        {
            var rentalItems = await queries.GetRentalItemsBySerialNumberAsync(serialNo);
            return TypedResults.Ok(rentalItems);
        });

        // ── Telegram message tracking endpoints (per-topic message lifecycle) ──
        api.MapGet("/technicalservices/{serviceId:Guid}/telegram-messages", async (
            Guid serviceId,
            TechnicalServiceContext context) =>
        {
            var messages = await context.ServiceTelegramMessages
                .AsNoTracking()
                .Where(x => x.ServiceId == serviceId && x.DeletedAt == null)
                .OrderByDescending(x => x.CreatedAt)
                .Select(x => new { x.TopicKey, x.MessageId, x.CreatedAt })
                .ToListAsync();

            if (messages.Count == 0)
            {
                var svc = await context.Services
                    .AsNoTracking()
                    .Where(x => x.Id == serviceId)
                    .Select(x => new { x.TelegramMessageId, StatusId = x.Status.Id })
                    .FirstOrDefaultAsync();

                if (svc?.TelegramMessageId != null && svc.TelegramMessageId > 0)
                {
                    string topicKey = svc.StatusId switch
                    {
                        1 => "ItemReceived",
                        11 => "Inspecting",
                        2 => "Inspection",
                        4 => "AwaitingCustomerConfirm",
                        3 => "AwaitingSparepart",
                        5 => "SaleConfirmed",
                        6 => "SentSpareparts",
                        12 => "Finished",
                        7 => "CustomerRejected",
                        8 => "Unrepairable",
                        _ => "ItemReceived"
                    };
                    return Results.Ok(new[] { new { TopicKey = topicKey, MessageId = svc.TelegramMessageId.Value, CreatedAt = DateTime.UtcNow } });
                }
            }

            return Results.Ok(messages);
        });

        api.MapGet("/technicalservices/{serviceId:Guid}/telegram-message", async (
            Guid serviceId,
            [FromQuery] string topicKey,
            TechnicalServiceContext context) =>
        {
            if (string.IsNullOrWhiteSpace(topicKey))
                return Results.BadRequest("topicKey is required.");

            var messageId = await context.ServiceTelegramMessages
                .AsNoTracking()
                .Where(x => x.ServiceId == serviceId && x.TopicKey == topicKey && x.DeletedAt == null)
                .OrderByDescending(x => x.CreatedAt)
                .Select(x => (int?)x.MessageId)
                .FirstOrDefaultAsync();

            if (messageId == null)
            {
                var svc = await context.Services
                    .AsNoTracking()
                    .Where(x => x.Id == serviceId)
                    .Select(x => (int?)x.TelegramMessageId)
                    .FirstOrDefaultAsync();

                if (svc != null && svc > 0)
                {
                    return Results.Ok(new { MessageId = svc.Value });
                }

                return Results.NotFound();
            }

            return Results.Ok(new { MessageId = messageId });
        });

        api.MapPost("/technicalservices/{serviceId:Guid}/telegram-message", async (
            Guid serviceId,
            [FromBody] SaveTelegramMessageRequest request,
            TechnicalServiceContext context) =>
        {
            if (string.IsNullOrWhiteSpace(request.TopicKey))
                return Results.BadRequest("TopicKey is required.");

            var row = new ServiceTelegramMessage(serviceId, request.TopicKey, request.MessageId);
            context.ServiceTelegramMessages.Add(row);
            await context.SaveChangesAsync();
            return Results.Ok();
        });

        api.MapPost("/technicalservices/telegram-message/{messageId:int}/mark-deleted", async (
            int messageId,
            TechnicalServiceContext context) =>
        {
            var row = await context.ServiceTelegramMessages
                .Where(x => x.MessageId == messageId && x.DeletedAt == null)
                .OrderByDescending(x => x.CreatedAt)
                .FirstOrDefaultAsync();

            if (row != null)
            {
                row.MarkDeleted();
                await context.SaveChangesAsync();
            }
            return Results.Ok();
        });

        api.MapPost("/technicalservices/{serviceId:Guid}/telegram-messages/mark-all-deleted", async (
            Guid serviceId,
            TechnicalServiceContext context) =>
        {
            var rows = await context.ServiceTelegramMessages
                .Where(x => x.ServiceId == serviceId && x.DeletedAt == null)
                .ToListAsync();

            foreach (var row in rows)
            {
                row.MarkDeleted();
            }
            await context.SaveChangesAsync();
            return Results.Ok();
        });

        return api;
    }

    // Add this handler method:
    public static async Task<Ok<PagedResult<SparepartUsageSummary>>> GetSparepartUsageAsync(
        [AsParameters] SparepartUsageQuery query,
        ITechnicalServiceQueries queries)
    {
        var result = await queries.GetSparepartUsageByDateRangeAsync(query);
        return TypedResults.Ok(result);
    }
    /// <summary>
    /// GET /api/spareparts/transactions — the stock movement ledger, one row
    /// per movement. Filterable by direction (In/Out) and source
    /// (Service/Manual/Adjustment), which is what lets a single endpoint serve
    /// the stock-in, stock-out and inventory-adjustment reports.
    /// </summary>
    public static async Task<Ok<PagedResult<SparepartTransactionRow>>> GetSparepartTransactionsAsync(
        [AsParameters] SparepartTransactionQuery query,
        ITechnicalServiceQueries queries)
    {
        var result = await queries.GetSparepartTransactionsAsync(query);
        return TypedResults.Ok(result);
    }

    /// <summary>
    /// GET /api/spareparts/movement-summary — per-part reconciliation over a
    /// period: opening balance, in, out, closing balance.
    /// </summary>
    public static async Task<Ok<PagedResult<SparepartMovementSummary>>> GetSparepartMovementSummaryAsync(
        [AsParameters] SparepartTransactionQuery query,
        ITechnicalServiceQueries queries)
    {
        var result = await queries.GetSparepartMovementSummaryAsync(query);
        return TypedResults.Ok(result);
    }

    /// <summary>
    /// GET /api/spareparts/dead-stock — parts holding stock that nothing has
    /// touched for `idleDays` (default 90).
    /// </summary>
    public static async Task<Ok<PagedResult<SparepartDeadStockRow>>> GetSparepartDeadStockAsync(
        [AsParameters] SparepartTransactionQuery query,
        ITechnicalServiceQueries queries)
    {
        var result = await queries.GetSparepartDeadStockAsync(query);
        return TypedResults.Ok(result);
    }

    /// <summary>
    /// GET /api/spareparts/health — stock-data inconsistencies: notifications
    /// with no ledger row, impossible opening balances, duplicate catalogue
    /// names, negative stock, and returns with no matching issue. Reports only.
    /// </summary>
    public static async Task<Ok<PagedResult<StockHealthIssue>>> GetStockHealthAsync(
        [AsParameters] SparepartTransactionQuery query,
        ITechnicalServiceQueries queries)
    {
        var result = await queries.GetStockHealthAsync(query);
        return TypedResults.Ok(result);
    }

    /// <summary>
    /// GET /api/spareparts/reconciliation — for a date range, every deduction
    /// that was returned, plus the headline counts that explain why the
    /// notification feed and the usage report disagree.
    /// </summary>
    public static async Task<Ok<StockReconciliationResult>> GetStockReconciliationAsync(
        [AsParameters] SparepartTransactionQuery query,
        ITechnicalServiceQueries queries)
    {
        var result = await queries.GetStockReconciliationAsync(query);
        return TypedResults.Ok(result);
    }

    public static async Task<Ok<PagedResult<SparepartHoldSummary>>> GetSparepartHoldAsync(
    [AsParameters] SparepartHoldQuery query,
    ITechnicalServiceQueries queries)
    {
        var result = await queries.GetSparepartHoldStatusAsync(query);
        return TypedResults.Ok(result);
    }
    public static async Task<Results<Ok, NotFound, BadRequest<string>>> UpdateSparepartItemRemarksAsync(
    Guid sparepartItemId,
    UpdateSparepartItemRemarksRequest request,
    [AsParameters] TechnicalServices services)
    {
        var command = new UpdateSparepartItemRemarksCommand(sparepartItemId, request.Remarks);

        services.Logger.LogInformation(
            "Sending command: {CommandName}: {@Command}",
            command.GetType().Name,
            command);

        try
        {
            var result = await services.Mediator.Send(command);

            if (result)
            {
                services.Logger.LogInformation("UpdateSparepartItemRemarksCommand succeeded");
                return TypedResults.Ok();
            }

            services.Logger.LogWarning("UpdateSparepartItemRemarksCommand failed");
            return TypedResults.BadRequest("Failed to update remarks.");
        }
        catch (KeyNotFoundException)
        {
            return TypedResults.NotFound();
        }
    }
    public static async Task<Results<Ok, BadRequest<string>>> ManualStockOutAsync(
    ManualStockOutRequest request,
    [AsParameters] TechnicalServices services,
    IOutputCacheStore cache)
    {
        if (request.SparepartId == Guid.Empty)
            return TypedResults.BadRequest("SparepartId is required.");

        if (request.Quantity <= 0)
            return TypedResults.BadRequest("Quantity must be greater than 0.");

        var command = new ManualStockOutCommand(
            request.SparepartId,
            request.Quantity,
            request.Reason,
            request.PerformedBy);

        services.Logger.LogInformation(
            "Sending command: {CommandName}: {@Command}",
            command.GetType().Name,
            command);

        try
        {
            var result = await services.Mediator.Send(command);

            if (result)
            {
                services.Logger.LogInformation(
                    "ManualStockOutCommand succeeded");
                // The trigger has just changed Spareparts.Quantity; the cached
                // list must not keep showing the old stock for another 60s.
                await cache.EvictByTagAsync(Extensions.SparepartsCacheTag, CancellationToken.None);
                return TypedResults.Ok();
            }

            services.Logger.LogWarning("ManualStockOutCommand failed");
            return TypedResults.BadRequest("Stock out operation failed.");
        }
        catch (KeyNotFoundException ex)
        {
            return TypedResults.BadRequest(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            // Catches insufficient stock from handler or SQL trigger RAISERROR
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok<Item>, NotFound>> GetItemAsync(
    Guid itemId,
    ITechnicalServiceQueries queries)
    {
        try
        {
            var item = await queries.GetItemAsync(itemId);
            return TypedResults.Ok(item);
        }
        catch (KeyNotFoundException)
        {
            return TypedResults.NotFound();
        }
    }

    public static async Task<Results<Ok<Sparepart>, NotFound>> GetSparepartAsync(
        Guid sparepartId,
        ITechnicalServiceQueries queries)
    {
        try
        {
            var sparepart = await queries.GetSparepartAsync(sparepartId);
            return TypedResults.Ok(sparepart);
        }
        catch (KeyNotFoundException)
        {
            return TypedResults.NotFound();
        }
    }

    public static async Task<Results<Ok<Service>, NotFound>> GetServiceAsync(
        Guid serviceId,
        ITechnicalServiceQueries queries)
    {
        try
        {
            var service = await queries.GetServiceAsync(serviceId);
            return TypedResults.Ok(service);
        }
        catch (KeyNotFoundException)
        {
            return TypedResults.NotFound();
        }
    }

    public static async Task<Ok<PagedResult<Item>>> GetItemsAsync(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        ITechnicalServiceQueries queries = null)
    {
        var (page, size) = Pagination.Normalize(pageNumber, pageSize);
        var items = await queries.GetItemsAsync(page, size);
        return TypedResults.Ok(items);
    }

    public static async Task<Results<Ok, BadRequest<string>>> CreateItemAsync(
        CreateItemRequest request,
        [AsParameters] TechnicalServices services)
    {
        var createItemCommand = new CreateItemCommand(request.ItemName, request.SerialNumber, request.ItemType);

        services.Logger.LogInformation(
            "Sending command: {CommandName}: {@Command}",
            createItemCommand.GetType().Name,
            createItemCommand);

        var result = await services.Mediator.Send(createItemCommand);

        if (result)
        {
            services.Logger.LogInformation("CreateItemCommand succeeded");
            return TypedResults.Ok();
        }

        services.Logger.LogWarning("CreateItemCommand failed");
        return TypedResults.BadRequest("CreateItemCommand failed.");
    }

    public static async Task<Results<Ok, BadRequest<string>>> UpdateItemAsync(
        UpdateItemCommand command,
        [AsParameters] TechnicalServices services)
    {
        services.Logger.LogInformation(
            "Sending command: {CommandName} - {IdProperty}: {CommandId} ({@Command})",
            command.GetType().Name,
            nameof(command.Id),
            command.Id,
            command);

        var commandResult = await services.Mediator.Send(command);

        if (commandResult)
        {
            services.Logger.LogInformation("{CommandName} succeeded", command.GetType().Name);
            return TypedResults.Ok();
        }

        services.Logger.LogWarning("{CommandName} failed", command.GetType().Name);
        return TypedResults.BadRequest($"{command.GetType().Name} failed.");
    }

    public static async Task<Results<Ok, NotFound, BadRequest<string>>> DeleteItemAsync(
        Guid itemId,
        [AsParameters] TechnicalServices services)
    {
        try
        {
            var item = await services.Queries.GetItemAsync(itemId);

            var command = new DeleteItemCommand(item.Id);
            services.Logger.LogInformation(
                "Sending command: {CommandName} - {IdProperty}: {CommandId} ({@Command})",
                command.GetType().Name,
                nameof(command.ItemId),
                command.ItemId,
                command);

            var commandResult = await services.Mediator.Send(command);

            if (commandResult)
            {
                services.Logger.LogInformation("DeleteItemCommand succeeded");
                return TypedResults.Ok();
            }

            services.Logger.LogWarning("DeleteItemCommand failed");
            return TypedResults.BadRequest("Failed to delete item.");
        }
        catch (KeyNotFoundException)
        {
            // Previously a bare `catch`, which reported *every* failure -
            // including a dropped database connection - as "item not found",
            // and swallowed the exception without logging it.
            services.Logger.LogWarning("Item with ID {ItemId} not found", itemId);
            return TypedResults.NotFound();
        }
    }

    public static async Task<Ok<PagedResult<Sparepart>>> GetSparepartsAsync(
        [AsParameters] SparepartSearchQuery query,
        ITechnicalServiceQueries queries)
    {
        var parts = await queries.SearchSparepartsAsync(query);
        return TypedResults.Ok(parts);
    }

    public static async Task<Results<Ok, BadRequest<string>>> CreateSparepartAsync(
     CreateSparepartRequest request,
     [AsParameters] TechnicalServices services,
     IOutputCacheStore cache)
    {
        var createSparepartCommand = new CreateSparepartCommand(
            request.ItemName,
            request.SerialNumber,
            request.Description,
            request.UseFor,
            request.PictureUrl,
            request.LinkItemId,
            request.Quantity,
            request.DefaultPrice,
            request.Classification);

        services.Logger.LogInformation(
            "Sending command: {CommandName}: {@Command}",
            createSparepartCommand.GetType().Name,
            createSparepartCommand);

        var result = await services.Mediator.Send(createSparepartCommand);

        if (result)
        {
            services.Logger.LogInformation("CreateSparepartCommand succeeded");
            // The list endpoints are output-cached under this tag for 60s;
            // without the eviction a new part was invisible until the entry
            // expired, however many times the client refetched. The taxonomy
            // lists carry PartCount, so they go too — but only when a
            // classification was actually written.
            await cache.EvictByTagAsync(Extensions.SparepartsCacheTag, CancellationToken.None);
            if (request.Classification is not null)
            {
                await cache.EvictByTagAsync(Extensions.SparepartTaxonomyCacheTag, CancellationToken.None);
            }
            return TypedResults.Ok();
        }

        services.Logger.LogWarning("CreateSparepartCommand failed");
        return TypedResults.BadRequest("CreateSparepartCommand failed.");
    }
    public static async Task<Results<Ok, BadRequest<string>>> UpdateSparepartAsync(
        UpdateSparepartCommand command,
        [AsParameters] TechnicalServices services,
        IOutputCacheStore cache)
    {
        services.Logger.LogInformation(
            "Sending command: {CommandName} - {IdProperty}: {CommandId} ({@Command})",
            command.GetType().Name,
            nameof(command.Id),
            command.Id,
            command);

        var commandResult = await services.Mediator.Send(command);

        if (commandResult)
        {
            services.Logger.LogInformation("{CommandName} succeeded", command.GetType().Name);
            await cache.EvictByTagAsync(Extensions.SparepartsCacheTag, CancellationToken.None);
            // The phone's stock-in is a PUT with no classification; PartCount
            // cannot have moved, so the taxonomy lists keep their cache.
            if (command.Classification is not null)
            {
                await cache.EvictByTagAsync(Extensions.SparepartTaxonomyCacheTag, CancellationToken.None);
            }
            return TypedResults.Ok();
        }

        services.Logger.LogWarning("{CommandName} failed", command.GetType().Name);
        return TypedResults.BadRequest($"{command.GetType().Name} failed.");
    }
    // បន្ថែម handler method ថ្មី
    public static async Task<Ok<List<SparepartWithUsage>>> GetSparePartsUsedInServicesAsync(
     ITechnicalServiceQueries queries)
    {
        var result = await queries.GetSparePartsUsedInServicesAsync();
        return TypedResults.Ok(result);
    }
    public static async Task<Ok<IEnumerable<ServiceType>>> GetServiceTypesAsync(ITechnicalServiceQueries queries)
    {
        var serviceTypes = await queries.GetServiceTypesAsync();
        return TypedResults.Ok(serviceTypes);
    }

    public static async Task<Ok<IEnumerable<ServicePriority>>> GetServicePrioritiesAsync(ITechnicalServiceQueries queries)
    {
        var servicePriorities = await queries.GetServicePrioritiesAsync();
        return TypedResults.Ok(servicePriorities);
    }

    public static async Task<Ok<IEnumerable<ServiceStatus>>> GetServiceStatusesAsync(ITechnicalServiceQueries queries)
    {
        var serviceStatuses = await queries.GetServiceStatusesAsync();
        return TypedResults.Ok(serviceStatuses);
    }

    public static async Task<Ok<DashboardStats>> GetDashboardStatsAsync(ITechnicalServiceQueries queries)
    {
        var stats = await queries.GetDashboardStatsAsync();
        return TypedResults.Ok(stats);
    }

    public static async Task<Ok<PagedResult<Service>>> GetServicesAsync(
     [FromQuery] int? pageNumber = null,
     [FromQuery] int? pageSize = null,
     ITechnicalServiceQueries queries = null)
    {
        if (!pageNumber.HasValue || !pageSize.HasValue)
        {
            var allServices = await queries.GetAllServicesAsync();
            return TypedResults.Ok(allServices);
        }

        var (page, size) = Pagination.Normalize(pageNumber.Value, pageSize.Value);
        var repairServices = await queries.GetServicesAsync(page, size);
        return TypedResults.Ok(repairServices);
    }

    public static async Task<Ok<IEnumerable<ReceiveItem>>> GetReceiveItemsAsync(ITechnicalServiceQueries queries)
    {
        var receiveItems = await queries.GetReceiveItemsAsync();
        return TypedResults.Ok(receiveItems);
    }

    public static async Task<Results<Ok, BadRequest<string>>> CreateReceiveItemAsync(
        ReceiveItemRequest request,
        [AsParameters] TechnicalServices services)
    {
        var serviceDate = request.ServiceDate.Kind == DateTimeKind.Utc
            ? request.ServiceDate.AddHours(7)
            : request.ServiceDate;

        var createRepairServiceCommand = new ReceiveItemCommand(
            request.CustomerId,
            request.CompanyName,
            request.Address,
            request.ContactName,
            request.PhoneNumber,
            request.HasContract,
            serviceDate,
            request.ReportNo,
            request.ServiceLocation,
            request.ServicePriorityId,
            request.ItemId,
            request.CustomerRequest,
            request.CreateBy);

        // Deliberately not "{@Command}": ReceiveItemCommand carries the
        // customer's name, address and phone number.
        services.Logger.LogInformation(
            "Sending command: {CommandName} for report {ReportNo}",
            createRepairServiceCommand.GetType().Name,
            request.ReportNo);

        var result = await services.Mediator.Send(createRepairServiceCommand);

        if (result)
        {
            services.Logger.LogInformation("ReceiveItemCommand succeeded");
            return TypedResults.Ok();
        }

        services.Logger.LogWarning("ReceiveItemCommand failed");
        return TypedResults.BadRequest("ReceiveItemCommand failed.");
    }

    public static async Task<Results<Ok, BadRequest<string>>> UpdateReceiveItemAsync(
    UpdateReceiveItemCommand command,
    [AsParameters] TechnicalServices services)
    {
        // Id only, not "{@Command}": this command carries customer contact
        // details - see the note on CreateReceiveItemAsync.
        services.Logger.LogInformation(
            "Sending command: {CommandName} - {IdProperty}: {CommandId}",
            command.GetType().Name,
            nameof(command.Id),
            command.Id);

        var commandResult = await services.Mediator.Send(command);

        if (commandResult)
        {
            services.Logger.LogInformation("UpdateReceiveItemCommand succeeded");
            return TypedResults.Ok();
        }
        else
        {
            services.Logger.LogWarning("UpdateReceiveItemCommand failed");
            return TypedResults.BadRequest("Failed to update receive item");
        }
    }

    public static async Task<Results<Ok, NotFound, BadRequest<string>>> DeleteReceiveItemAsync(
        Guid serviceId,
        [AsParameters] TechnicalServices services)
    {
        try
        {
            var service = await services.Queries.GetServiceAsync(serviceId);

            var command = new DeleteReceiveItemCommand(service.Id);
            services.Logger.LogInformation(
                "Sending command: {CommandName} - {IdProperty}: {CommandId} ({@Command})",
                command.GetType().Name,
                nameof(command.ServiceId),
                command.ServiceId,
                command);

            var commandResult = await services.Mediator.Send(command);

            if (commandResult)
            {
                services.Logger.LogInformation("DeleteReceiveItemCommand succeeded");
                return TypedResults.Ok();
            }
            else
            {
                services.Logger.LogWarning("DeleteReceiveItemCommand failed");
                return TypedResults.BadRequest("Failed to delete receive item");
            }
        }
        catch (KeyNotFoundException)
        {
            return TypedResults.NotFound();
        }
        catch (InvalidOperationException ex)
        {
            services.Logger.LogWarning(ex, "Cannot delete service with ID {ServiceId}", serviceId);
            return TypedResults.BadRequest(ex.Message);
        }
    }
    public static async Task<Results<Ok, BadRequest<string>>> SetInspectingAsync(
    SetInspectingRequest request,
    [AsParameters] TechnicalServices services)
    {
        var command = new SetInspectingCommand(
    request.Id,
    request.InspectingBy,
    BusinessClock.Now);

        services.Logger.LogInformation(
            "Sending command: {CommandName}: {@Command}",
            command.GetType().Name,
            command);

        try
        {
            var result = await services.Mediator.Send(command);

            if (result)
            {
                services.Logger.LogInformation("SetInspectingCommand succeeded");
                return TypedResults.Ok();
            }

            services.Logger.LogWarning("SetInspectingCommand failed");
            return TypedResults.BadRequest("Failed to set service to Inspecting.");
        }
        catch (InvalidOperationException ex)
        {
            services.Logger.LogWarning(ex, "Invalid status transition for SetInspecting");
            return TypedResults.BadRequest(ex.Message);
        }
    }
    public static async Task<Results<Ok, BadRequest<string>>> UpdateRepairServiceAsync(
        UpdateRepairServiceCommand command,
        [AsParameters] TechnicalServices services)
    {
        // Id only, not "{@Command}": this command carries customer contact
        // details - see the note on CreateReceiveItemAsync.
        services.Logger.LogInformation(
            "Sending command: {CommandName} - {IdProperty}: {CommandId}",
            command.GetType().Name,
            nameof(command.Id),
            command.Id);

        var commandResult = await services.Mediator.Send(command);

        if (commandResult)
        {
            services.Logger.LogInformation("{CommandName} succeeded", command.GetType().Name);
            return TypedResults.Ok();
        }

        services.Logger.LogWarning("{CommandName} failed", command.GetType().Name);
        return TypedResults.BadRequest($"{command.GetType().Name} failed.");
    }

    public static async Task<Results<Ok, NotFound, BadRequest<string>>> DeleteTechnicalServiceAsync(
    Guid serviceId,
    [AsParameters] TechnicalServices services)
    {
        try
        {
            var service = await services.Queries.GetServiceAsync(serviceId);

            var command = new DeleteTechnicalServiceCommand(serviceId);

            services.Logger.LogInformation(
                "Sending command: {CommandName} - {IdProperty}: {CommandId} ({@Command})",
                command.GetType().Name,
                nameof(command.ServiceId),
                command.ServiceId,
                command);

            var commandResult = await services.Mediator.Send(command);

            if (commandResult)
            {
                services.Logger.LogInformation("DeleteTechnicalServiceCommand succeeded");
                return TypedResults.Ok();
            }
            else
            {
                services.Logger.LogWarning("DeleteTechnicalServiceCommand failed");
                return TypedResults.BadRequest("Failed to delete technical service");
            }
        }
        catch (KeyNotFoundException)
        {
            services.Logger.LogWarning("Service with ID {ServiceId} not found", serviceId);
            return TypedResults.NotFound();
        }
        catch (InvalidOperationException ex)
        {
            services.Logger.LogWarning(ex, "Cannot delete service with ID {ServiceId}", serviceId);
            return TypedResults.BadRequest(ex.Message);
        }
    }
   

    /// <summary>
    /// Body of <c>PUT /api/technicalservices/{serviceId}/status</c>.
    /// </summary>
    /// <param name="StatusId">Target status. Only the transitions listed in
    /// <see cref="UpdateServiceStatusAsync"/> are supported.</param>
    /// <param name="UpdatedBy">
    /// Who performed the transition. Optional so existing callers that send
    /// only <c>statusId</c> keep working unchanged; when omitted the audit
    /// columns record <see cref="Guid.Empty"/>, which is what every call
    /// recorded before this parameter existed.
    /// </param>
    public record UpdateServiceStatusRequest(int StatusId, Guid? UpdatedBy = null);

    /// <summary>Status ids accepted by <see cref="UpdateServiceStatusAsync"/>.</summary>
    private static class ServiceStatusIds
    {
        public const int Inspecting = 10;
        public const int Inspection = 2;
    }

    /// <summary>
    /// Moves a service to one of the two statuses this endpoint supports.
    /// </summary>
    /// <remarks>
    /// Previously an inline lambda in the route table. Pulled out so it matches
    /// every other handler in this file, and so the magic status ids have names.
    /// It still writes through the DbContext rather than a MediatR command,
    /// unlike the other write paths - see the note in the review report.
    /// </remarks>
    public static async Task<Results<Ok, NotFound, BadRequest<string>>> UpdateServiceStatusAsync(
        Guid serviceId,
        [FromBody] UpdateServiceStatusRequest request,
        TechnicalServiceContext context,
        CancellationToken cancellationToken)
    {
        var service = await context.Services
            .FirstOrDefaultAsync(s => s.Id == serviceId, cancellationToken);

        if (service is null)
        {
            return TypedResults.NotFound();
        }

        var updatedBy = request.UpdatedBy ?? Guid.Empty;
        var occurredAt = BusinessClock.Now;

        switch (request.StatusId)
        {
            case ServiceStatusIds.Inspecting:
                service.SetInspecting(updatedBy, occurredAt);
                break;

            case ServiceStatusIds.Inspection:
                service.SetInspection(updatedBy, occurredAt, service.Inspection, service.Solution);
                break;

            default:
                return TypedResults.BadRequest($"StatusId {request.StatusId} is not supported.");
        }

        await context.SaveChangesAsync(cancellationToken);
        return TypedResults.Ok();
    }
    public static async Task<Ok<IEnumerable<Service>>> GetInspectItemsAsync(ITechnicalServiceQueries queries)
    {
        var inspectItems = await queries.GetInpsectItemsAsync();
        return TypedResults.Ok(inspectItems);
    }

    public static async Task<Results<Ok, BadRequest<string>>> CreateInspectItemAsync(
     InspectItemRequest request,
     [AsParameters] TechnicalServices services)
    {
        var inspectItemCommand = new InspectItemCommand(
     request.Id,
     request.InspectBy,
     BusinessClock.Now,     request.Inspection,
     request.Solution,
     request.ServiceTypeId,
     request.Spareparts);

        services.Logger.LogInformation(
            "Sending command: {CommandName}: {@Command}",
            inspectItemCommand.GetType().Name,
            inspectItemCommand);

        var result = await services.Mediator.Send(inspectItemCommand);

        if (result)
        {
            services.Logger.LogInformation("InspectItemCommand succeeded");
            return TypedResults.Ok();
        }

        services.Logger.LogWarning("InspectItemCommand failed");
        return TypedResults.BadRequest("InspectItemCommand failed.");
    }

    public static async Task<Results<Ok, BadRequest<string>>> UpdateInspectItemAsync(
    UpdateInspectItemCommand command,
    [AsParameters] TechnicalServices services)
    {
        services.Logger.LogInformation(
            "Sending command: {CommandName} - {IdProperty}: {CommandId} ({@Command})",
            command.GetType().Name,
            nameof(command.Id),
            command.Id,
            command);

        var commandResult = await services.Mediator.Send(command);

        if (commandResult)
        {
            services.Logger.LogInformation("UpdateInspectItemCommand succeeded");
            return TypedResults.Ok();
        }
        else
        {
            services.Logger.LogWarning("UpdateInspectItemCommand failed");
            return TypedResults.BadRequest("Failed to update inspection item");
        }
    }
    public static async Task<Results<Ok, NotFound, BadRequest<string>>> DeleteSparepartItemAsync(
    Guid serviceId,
    Guid sparepartItemId,
    [AsParameters] TechnicalServices services)
    {
        try
        {
            // GetServiceAsync signals "no such service" by throwing, never by
            // returning null, so the null check that used to be here was dead
            // code: a missing service fell through to the catch-all below and
            // came back as a 400 carrying the exception text.
            await services.Queries.GetServiceAsync(serviceId);

            var command = new DeleteSparepartItemCommand(serviceId, sparepartItemId);

            services.Logger.LogInformation(
                "Deleting spare part item {SparepartItemId} from service {ServiceId}",
                sparepartItemId,
                serviceId);

            var result = await services.Mediator.Send(command);

            if (result)
            {
                return TypedResults.Ok();
            }

            services.Logger.LogWarning(
                "Failed to delete spare part item {SparepartItemId} from service {ServiceId}",
                sparepartItemId,
                serviceId);
            return TypedResults.BadRequest("Failed to delete spare part item.");
        }
        catch (KeyNotFoundException)
        {
            services.Logger.LogWarning(
                "Service {ServiceId} or spare part item {SparepartItemId} not found",
                serviceId,
                sparepartItemId);
            return TypedResults.NotFound();
        }
        catch (InvalidOperationException ex)
        {
            // A domain rule refused the deletion; that message is written for
            // the user, so it is safe to return.
            services.Logger.LogWarning(ex, "Cannot delete spare part item {SparepartItemId}", sparepartItemId);
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Ok<IEnumerable<Service>>> GetAwaitingCustomerConfirmAsync(ITechnicalServiceQueries queries)
    {
        var results = await queries.GetAwaitingCustomerConfirmsAsync();
        return TypedResults.Ok(results);
    }

    public static async Task<Results<Ok, BadRequest<string>>> SetAwaitingCustomerConfirmAsync(
        SetAwaitingCustomerConfirmRequest request,
        [AsParameters] TechnicalServices services)
    {
        var command = new SetAwaitingCustomerConfirmCommand(
    request.Id,
    request.SetAwaitingCustomerConfirmBy,
    BusinessClock.Now);


        services.Logger.LogInformation(
            "Sending command: {CommandName}: {@Command}",
            command.GetType().Name,
            command);

        var result = await services.Mediator.Send(command);

        if (result)
        {
            services.Logger.LogInformation("SetAwaitingCustomerConfirmCommand succeeded");
            return TypedResults.Ok();
        }

        services.Logger.LogWarning("SetAwaitingCustomerConfirmCommand failed");
        return TypedResults.BadRequest("SetAwaitingCustomerConfirmCommand failed.");
    }

    public static async Task<Results<Ok, BadRequest<string>>> SetCustomerRejectedAsync(
    SetCustomerRejectedRequest request,
    [AsParameters] TechnicalServices services)
    {
        var command = new SetCustomerRejectedCommand(
      request.Id,
      request.SetCustomerRejectedBy,
      BusinessClock.Now);
        services.Logger.LogInformation(
            "Sending command: {CommandName}: {@Command}",
            command.GetType().Name,
            command);

        var result = await services.Mediator.Send(command);

        if (result)
        {
            services.Logger.LogInformation("SetCustomerRejectedCommand succeeded");
            return TypedResults.Ok();
        }

        services.Logger.LogWarning("SetCustomerRejectedCommand failed");
        return TypedResults.BadRequest("SetCustomerRejectedCommand failed.");
    }

    public static async Task<Results<Ok, BadRequest<string>>> SetAwaitingSparepartAsync(
        SetAwaitingSparepartRequest request,
        [AsParameters] TechnicalServices services)
    {
        // SetAwaitingSparepartAsync
        var command = new SetAwaitingSparepartCommand(
            request.Id,
            request.SetAwaitingSparepartBy,
            BusinessClock.Now);

        services.Logger.LogInformation(
            "Sending command: {CommandName}: {@Command}",
            command.GetType().Name,
            command);

        var result = await services.Mediator.Send(command);

        if (result)
        {
            services.Logger.LogInformation("SetAwaitingSparepartCommand succeeded");
            return TypedResults.Ok();
        }

        services.Logger.LogWarning("SetAwaitingSparepartCommand failed");
        return TypedResults.BadRequest("SetAwaitingSparepartCommand failed.");
    }
    public static async Task<Results<Ok, BadRequest<string>>> SetSaleConfirmedAsync(
     SetSaleConfirmedRequest request,
     [AsParameters] TechnicalServices services)
    {
        var command = new SetSaleConfirmedCommand(
            request.Id,
            request.SetSaleConfirmedBy,
            BusinessClock.Now);
        services.Logger.LogInformation(
            "Sending command: {CommandName}: {@Command}",
            command.GetType().Name,
            command);

        try
        {
            var result = await services.Mediator.Send(command);

            if (result)
            {
                services.Logger.LogInformation("SetSaleConfirmedCommand succeeded");
                return TypedResults.Ok();
            }

            services.Logger.LogWarning("SetSaleConfirmedCommand failed");
            return TypedResults.BadRequest("Failed to set service to Sale Confirmed.");
        }
        catch (InvalidOperationException ex)
        {
            services.Logger.LogWarning(ex, "Invalid status transition for SetSaleConfirmed");
            return TypedResults.BadRequest(ex.Message);
        }
    }
    public static async Task<Results<Ok, BadRequest<string>>> SetSentSparepartsAsync(
    SetSentSparepartsRequest request,
    [AsParameters] TechnicalServices services)
    {
        try
        {
            var command = new SetSentSparepartsCommand(
                request.Id,
                BusinessClock.Now,
                request.SetSentSparepartsBy);

            services.Logger.LogInformation(
                "Sending command: {CommandName}: {@Command}",
                command.GetType().Name,
                command);

            var result = await services.Mediator.Send(command);

            if (result)
            {
                services.Logger.LogInformation("{CommandName} succeeded", command.GetType().Name);
                return TypedResults.Ok();
            }

            services.Logger.LogWarning("{CommandName} failed", command.GetType().Name);
            return TypedResults.BadRequest("The operation failed.");
        }
        catch (Exception ex)
        {
            var msg = ex.GetBaseException()?.Message ?? ex.Message;
            services.Logger.LogWarning(ex, "Failed to SetSentSpareparts: {Message}", msg);
            return TypedResults.BadRequest(msg);
        }
    }
    public static async Task<Results<Ok, BadRequest<string>>> SetRepairAsync(
     SetRepairRequest request,
     [AsParameters] TechnicalServices services)
    {
        try
        {
            var command = new SetRepairCommand(
                request.Id,
                request.RepairBy,
                BusinessClock.Now);
            services.Logger.LogInformation(
                "Sending command: {CommandName}: {@Command}",
                command.GetType().Name,
                command);

            var result = await services.Mediator.Send(command);

            if (result)
            {
                services.Logger.LogInformation("SetRepairCommand succeeded");
                return TypedResults.Ok();
            }

            services.Logger.LogWarning("SetRepairCommand failed");
            return TypedResults.BadRequest("SetRepairCommand failed.");
        }
        catch (InvalidOperationException ex)
        {
            services.Logger.LogWarning("SetRepairCommand validation failed: {Message}", ex.Message);
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Results<Ok, BadRequest<string>>> SetThirdPartyRepairAsync(
       SetThirdPartyRepairRequest request,
       [AsParameters] TechnicalServices services)
    {
        var command = new SetThirdPartyRepairCommand(
       request.Id,
       request.ThirdPartyRepairBy,
       BusinessClock.Now);

        services.Logger.LogInformation(
            "Sending command: {CommandName}: {@Command}",
            command.GetType().Name,
            command);

        var result = await services.Mediator.Send(command);

        if (result)
        {
            services.Logger.LogInformation("SetThirdPartyRepairCommand succeeded");
            return TypedResults.Ok();
        }

        services.Logger.LogWarning("SetThirdPartyRepairCommand failed");
        return TypedResults.BadRequest("SetThirdPartyRepairCommand failed.");
    }

    public static async Task<Results<Ok, BadRequest<string>>> SetFinishedStatusAsync(
     SetFinishedRequest request,
     [AsParameters] TechnicalServices services)
    {
        var command = new SetFinishedStatusCommand(
            request.Id,
            BusinessClock.Now,            request.VerifiedBy);

        services.Logger.LogInformation(
            "Sending command: {CommandName}: {@Command}",
            command.GetType().Name,
            command);

        var result = await services.Mediator.Send(command);

        if (result)
        {
            services.Logger.LogInformation("{CommandName} succeeded", command.GetType().Name);
            return TypedResults.Ok();
        }

        services.Logger.LogWarning("{CommandName} failed", command.GetType().Name);
        return TypedResults.BadRequest("The operation failed.");
    }

    public static async Task<Results<Ok, BadRequest<string>>> SetUnrepairableAsync(
        SetUnrepairableRequest request,
        [AsParameters] TechnicalServices services)
    {
        var command = new SetUnrepairableCommand(
      request.Id,
      request.SetUnrepairableBy,
      BusinessClock.Now);
        services.Logger.LogInformation(
            "Sending command: {CommandName}: {@Command}",
            command.GetType().Name,
            command);

        var result = await services.Mediator.Send(command);

        if (result)
        {
            services.Logger.LogInformation("SetUnrepairableCommand succeeded");
            return TypedResults.Ok();
        }

        services.Logger.LogWarning("SetUnrepairableCommand failed");
        return TypedResults.BadRequest("SetUnrepairableCommand failed.");
    }
    public static async Task<Ok<List<CompanyStatusSummary>>> GetMonthlyReportSummaryAsync(
    [FromQuery] DateTime fromDate,
    [FromQuery] DateTime toDate,
    [FromQuery] string? serviceLocation,
    ITechnicalServiceQueries queries)
    {
        var result = await queries.GetMonthlyReportCompanySummaryAsync(fromDate, toDate, serviceLocation);
        return TypedResults.Ok(result);
    }

    public static async Task<Ok<AnnualTechnicalMatrixDto>> GetAnnualTechnicalMatrixAsync(
        [FromQuery] int? year,
        ITechnicalServiceQueries queries)
    {
        var targetYear = year ?? DateTime.UtcNow.Year;
        var result = await queries.GetAnnualTechnicalMatrixAsync(targetYear);
        return TypedResults.Ok(result);
    }

    public static async Task<Results<Ok, BadRequest<string>>> CreateRentalItemAsync(CreateRentalItemRequest request, [AsParameters] TechnicalServices services)
    {
        var command = new CreateRentalItemCommand(
            request.CreatedBy,
            request.CustomerId,
            request.CustomerName,
            request.ItemName,
            request.SerialNumber,
            request.Condition,
            request.Location,
            request.Duration);
        services.Logger.LogInformation(
                    "Sending command: {CommandName}: {@Command}",
                    command.GetType().Name,
                    command);
        var result = await services.Mediator.Send(command);
        if (result)
        {
            services.Logger.LogInformation("CreateRentalItemCommand succeeded");
            return TypedResults.Ok();
        }

        services.Logger.LogWarning("CreateRentalItemCommand failed");
        return TypedResults.BadRequest("CreateRentalItemCommand failed.");
    }

    public static async Task<Ok<PagedResult<RentalItem>>> GetRentalItemsAsync(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        ITechnicalServiceQueries queries = null)
    {
        var (page, size) = Pagination.Normalize(pageNumber, pageSize);
        var rentalItems = await queries.GetRentalItemsAsync(page, size);
        return TypedResults.Ok(rentalItems);
    }

    public static async Task<Results<Ok<RentalItem>, NotFound>> GetRentalItemAsync(
        Guid id, ITechnicalServiceQueries queries)
    {
        // The query signals "no such row" by throwing, never by returning null
        // (see TechnicalServiceQueries.GetRentalItemAsync) — so the null check
        // that used to be here was dead code and an unknown id escaped as an
        // unhandled 500. Caught the same way GetServiceAsync does it: asking
        // for a record that isn't there is a 404, not a fault.
        try
        {
            return TypedResults.Ok(await queries.GetRentalItemAsync(id));
        }
        catch (KeyNotFoundException)
        {
            return TypedResults.NotFound();
        }
    }

    public static async Task<Results<Ok, BadRequest<string>>> CreateRentalServiceAsync(CreateRentalServiceRequest request, [AsParameters] TechnicalServices services)
    {
        var command = new CreateRentalServiceCommand(
            request.RentalItemId,
            request.Date,
            request.Action,
            request.Note,
            request.UserId,
            request.Spareparts);
        services.Logger.LogInformation(
                            "Sending command: {CommandName}: {@Command}",
                            command.GetType().Name,
                            command);
        var result = await services.Mediator.Send(command);
        if (result)
        {
            services.Logger.LogInformation("CreateRentalServiceCommand succeeded");
        }
        else
        {
            services.Logger.LogWarning("CreateRentalServiceCommand failed");
        }
        
        return TypedResults.Ok();
    }

    public static async Task<Ok<PagedResult<RentalService>>> GetRentalServicesAsync(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        ITechnicalServiceQueries queries = null)
    {
        var (page, size) = Pagination.Normalize(pageNumber, pageSize);
        var rentalItems = await queries.GetRentalServicesAsync(page, size);
        return TypedResults.Ok(rentalItems);
    }

    public static async Task<Ok<PagedResult<string>>> GetUniqueItemNamesAsync(
        [FromQuery] int? pageNumber = null,
        [FromQuery] int? pageSize = null,
        [FromQuery] string searchTerm = null,
        ITechnicalServiceQueries queries = null)
    {
        var uniqueItemNames = await queries.GetUniqueItemNamesAsync(pageNumber, pageSize, searchTerm);
        return TypedResults.Ok(uniqueItemNames);
    }

    public static async Task<Ok<PagedResult<string>>> GetUniqueItemTypesAsync(
    [FromQuery] int? pageNumber = null,
    [FromQuery] int? pageSize = null,
    [FromQuery] string searchTerm = null,
    ITechnicalServiceQueries queries = null)
    {
        var uniqueItemTypes = await queries.GetUniqueItemTypesAsync(pageNumber, pageSize, searchTerm);
        return TypedResults.Ok(uniqueItemTypes);
    }

    public static async Task<Results<Ok<RentalService>, NotFound>> GetRentalServiceAsync(
        Guid id, ITechnicalServiceQueries queries)
    {
        // Same as GetRentalItemAsync above: the query throws rather than
        // returning null, so an unknown id was surfacing as a 500.
        try
        {
            return TypedResults.Ok(await queries.GetRentalServiceAsync(id));
        }
        catch (KeyNotFoundException)
        {
            return TypedResults.NotFound();
        }
    }

    // Search endpoint methods
    public static async Task<Ok<PagedResult<Item>>> SearchItemsAsync(
        [AsParameters] ItemSearchQuery query,
        ITechnicalServiceQueries queries)
    {
        var items = await queries.SearchItemsAsync(query);
        return TypedResults.Ok(items);
    }

    public static async Task<Ok<PagedResult<Sparepart>>> SearchSparepartsAsync(
        [AsParameters] SparepartSearchQuery query,
        ITechnicalServiceQueries queries)
    {
        var spareparts = await queries.SearchSparepartsAsync(query);
        return TypedResults.Ok(spareparts);
    }

    /// <summary>
    /// Ticket search. <c>?projection=summary</c> returns the four-column
    /// <see cref="ServiceSummary"/> shape instead of the full ticket; every
    /// filter, sort and page parameter behaves identically either way.
    /// </summary>
    public static async Task<Results<Ok<PagedResult<Service>>, Ok<PagedResult<ServiceSummary>>>>
        SearchServicesAsync(
            [AsParameters] ServiceSearchQuery query,
            ITechnicalServiceQueries queries)
    {
        if (string.Equals(query.Projection, "summary", StringComparison.OrdinalIgnoreCase))
        {
            return TypedResults.Ok(await queries.SearchServiceSummariesAsync(query));
        }

        return TypedResults.Ok(await queries.SearchServicesAsync(query));
    }

    public static async Task<Ok<PagedResult<RentalItem>>> SearchRentalItemsAsync(
        [AsParameters] RentalItemSearchQuery query,
        ITechnicalServiceQueries queries)
    {
        var rentalItems = await queries.SearchRentalItemsAsync(query);
        return TypedResults.Ok(rentalItems);
    }

    public static async Task<Ok<PagedResult<RentalService>>> SearchRentalServicesAsync(
        [AsParameters] RentalServiceSearchQuery query,
        ITechnicalServiceQueries queries)
    {
        var rentalServices = await queries.SearchRentalServicesAsync(query);
        return TypedResults.Ok(rentalServices);
    }
}

public record CreateItemRequest(
    string ItemName,
    string SerialNumber,
    string ItemType);

public record CreateSparepartRequest(
    string ItemName,
    string SerialNumber,
    string Description,
    string UseFor,
    string PictureUrl,
    Guid LinkItemId,
    int Quantity,
    decimal DefaultPrice = 0,
    SparepartClassification? Classification = null);
public record ReceiveItemRequest(
    Guid CustomerId,
    string CompanyName,
    string Address,
    string ContactName,
    string PhoneNumber,
    bool HasContract,
    DateTime ServiceDate,
    string ReportNo,
    string ServiceLocation,
    int ServicePriorityId,
    Guid ItemId,
    string CustomerRequest,
    Guid CreateBy);

public record InspectItemRequest(
    Guid Id,
    Guid InspectBy,
    string Inspection,
    string Solution,
    int ServiceTypeId,
    List<SparepartItem> Spareparts);

public record UpdateInspectItemRequest(
    Guid Id,
    Guid InspectBy,
    string Inspection,
    string Solution,
    int ServiceTypeId,
    List<SparepartItem> Spareparts);

public record SetAwaitingCustomerConfirmRequest(
    Guid Id,
    Guid SetAwaitingCustomerConfirmBy);

public record SetCustomerRejectedRequest(
    Guid Id,
    Guid SetCustomerRejectedBy);

public record SetAwaitingSparepartRequest(
    Guid Id,
    Guid SetAwaitingSparepartBy);

public record SetRepairRequest(
    Guid Id,
    Guid RepairBy);

public record SetThirdPartyRepairRequest(
    Guid Id,
    Guid ThirdPartyRepairBy);
public record SetInspectingRequest(
    Guid Id,
    Guid InspectingBy);
public record SetFinishedRequest(
    Guid Id,
    Guid VerifiedBy);

public record SetUnrepairableRequest(
    Guid Id,
    Guid SetUnrepairableBy);
// បន្ថែមក្រោម SetUnrepairableRequest
public record ManualStockOutRequest(
    Guid SparepartId,
    int Quantity,
    string Reason,
    Guid? PerformedBy);
public record SetSaleConfirmedRequest(
    Guid Id,
    Guid SetSaleConfirmedBy);
public record SetSentSparepartsRequest(
    Guid Id,
    Guid SetSentSparepartsBy);
public record UpdateSparepartItemRemarksRequest(string Remarks);
public record SaveTelegramMessageRequest(string TopicKey, int MessageId);
public record UpdateTelegramMessageIdRequest(int TelegramMessageId);
