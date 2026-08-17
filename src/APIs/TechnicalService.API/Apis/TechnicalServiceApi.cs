using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Azure.Core;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using System.Globalization;
using TechnicalService.API.Apis;
using TechnicalService.API.Application.Commands;
using TechnicalService.API.Application.Queries;

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
        api.MapGet("/spareparts", GetSparepartsAsync);
        api.MapGet("/spareparts/search", SearchSparepartsAsync);
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
        api.MapPut("/technicalservices/{serviceId:Guid}/status", async (
      Guid serviceId,
      [FromBody] UpdateServiceStatusRequest request,
      TechnicalServiceContext context) =>
        {
            var service = await context.Services
                .FirstOrDefaultAsync(s => s.Id == serviceId);

            if (service == null) return Results.NotFound();

            switch (request.StatusId)
            {
                case 10: // Inspecting
                    service.SetInspecting(Guid.Empty, DateTime.UtcNow.AddHours(7));
                    break;
                case 2: // Inspection
                    service.SetInspection(Guid.Empty, DateTime.UtcNow.AddHours(7), service.Inspection, service.Solution);
                    break;
                default:
                    return Results.BadRequest($"StatusId {request.StatusId} is not supported.");
            }

            await context.SaveChangesAsync();
            return Results.Ok();
        });

        api.MapGet("/spareparts/usage", GetSparepartUsageAsync);
        api.MapPost("/spareparts/manual-stockout", ManualStockOutAsync);
        api.MapGet("/spareparts/hold", GetSparepartHoldAsync);
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
    [AsParameters] TechnicalServices services)
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
        var items = await queries.GetItemsAsync(pageNumber, pageSize);
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
        }
        else
        {
            services.Logger.LogWarning("CreateItemCommand failed");
        }

        return TypedResults.Ok();
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

        return TypedResults.Ok();
    }

    public static async Task<Results<Ok, NotFound>> DeleteItemAsync(
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

            return TypedResults.Ok();
        }
        catch
        {
            return TypedResults.NotFound();
        }
    }

    public static async Task<Ok<PagedResult<Sparepart>>> GetSparepartsAsync(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        ITechnicalServiceQueries queries = null)
    {
        var parts = await queries.GetSparepartsAsync(pageNumber, pageSize);
        return TypedResults.Ok(parts);
    }

    public static async Task<Results<Ok, BadRequest<string>>> CreateSparepartAsync(
     CreateSparepartRequest request,
     [AsParameters] TechnicalServices services)
    {
        var createSparepartCommand = new CreateSparepartCommand(
            request.ItemName,
            request.SerialNumber,
            request.Description,
            request.UseFor,
            request.PictureUrl,
            request.LinkItemId,
            request.Quantity,
                    request.DefaultPrice); // ✅ ADD THIS


        services.Logger.LogInformation(
            "Sending command: {CommandName}: {@Command}",
            createSparepartCommand.GetType().Name,
            createSparepartCommand);

        var result = await services.Mediator.Send(createSparepartCommand);

        if (result)
        {
            services.Logger.LogInformation("CreateSparepartCommand succeeded");
        }
        else
        {
            services.Logger.LogWarning("CreateSparepartCommand failed");
        }

        return TypedResults.Ok();
    }
    public static async Task<Results<Ok, BadRequest<string>>> UpdateSparepartAsync(
        UpdateSparepartCommand command,
        [AsParameters] TechnicalServices services)
    {
        services.Logger.LogInformation(
            "Sending command: {CommandName} - {IdProperty}: {CommandId} ({@Command})",
            command.GetType().Name,
            nameof(command.Id),
            command.Id,
            command);

        var commandResult = await services.Mediator.Send(command);

        return TypedResults.Ok();
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

        var repairServices = await queries.GetServicesAsync(pageNumber.Value, pageSize.Value);
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
        var createRepairServiceCommand = new ReceiveItemCommand(
            request.CustomerId,
            request.CompanyName,
            request.Address,
            request.ContactName,
            request.PhoneNumber,
            request.HasContract,
            request.ServiceDate,
            request.ReportNo,
            request.ServiceLocation,
            request.ServicePriorityId,
            request.ItemId,
            request.CustomerRequest,
            request.CreateBy);

        services.Logger.LogInformation(
            "Sending command: {CommandName}: {@Command}",
            createRepairServiceCommand.GetType().Name,
            createRepairServiceCommand);

        var result = await services.Mediator.Send(createRepairServiceCommand);

        if (result)
        {
            services.Logger.LogInformation("ReceiveItemCommand succeeded");
        }
        else
        {
            services.Logger.LogWarning("ReceiveItemCommand failed");
        }

        return TypedResults.Ok();
    }

    public static async Task<Results<Ok, BadRequest<string>>> UpdateReceiveItemAsync(
    UpdateReceiveItemCommand command,
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
            services.Logger.LogInformation("UpdateReceiveItemCommand succeeded");
            return TypedResults.Ok();
        }
        else
        {
            services.Logger.LogWarning("UpdateReceiveItemCommand failed");
            return TypedResults.BadRequest("Failed to update receive item");
        }
    }

    public static async Task<Results<Ok, NotFound>> DeleteReceiveItemAsync(
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
                return TypedResults.NotFound();
            }
        }
        catch (KeyNotFoundException)
        {
            return TypedResults.NotFound();
        }
    }
    public static async Task<Results<Ok, BadRequest<string>>> SetInspectingAsync(
    SetInspectingRequest request,
    [AsParameters] TechnicalServices services)
    {
        var command = new SetInspectingCommand(
    request.Id,
    request.InspectingBy,
    DateTime.UtcNow.AddHours(7));  // ✅ FIXED


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
        services.Logger.LogInformation(
            "Sending command: {CommandName} - {IdProperty}: {CommandId} ({@Command})",
            command.GetType().Name,
            nameof(command.Id),
            command.Id,
            command);

        var commandResult = await services.Mediator.Send(command);

        return TypedResults.Ok();
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
   

    public record UpdateServiceStatusRequest(int StatusId);
    public static async Task<Ok<IEnumerable<Service>>> GetInspectItemsAsync(ITechnicalServiceQueries queries)
    {
        var inspectItems = await queries.GetInpsectItemsAsync();
        return TypedResults.Ok(inspectItems);
    }

    // ✅ FIXED: Changed DateTime.Now to DateTime.UtcNow
    public static async Task<Results<Ok, BadRequest<string>>> CreateInspectItemAsync(
     InspectItemRequest request,
     [AsParameters] TechnicalServices services)
    {
        var inspectItemCommand = new InspectItemCommand(
     request.Id,
     request.InspectBy,
     DateTime.UtcNow.AddHours(7),  // ✅ FIXED
     request.Inspection,
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
        }
        else
        {
            services.Logger.LogWarning("InspectItemCommand failed");
        }

        return TypedResults.Ok();
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
            var service = await services.Queries.GetServiceAsync(serviceId);
            if (service == null)
            {
                return TypedResults.NotFound();
            }

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
            else
            {
                return TypedResults.BadRequest("Failed to delete spare part item");
            }
        }
        catch (Exception ex)
        {
            services.Logger.LogError(ex, "Error deleting spare part item");
            return TypedResults.BadRequest(ex.Message);
        }
    }

    public static async Task<Ok<IEnumerable<Service>>> GetAwaitingCustomerConfirmAsync(ITechnicalServiceQueries queries)
    {
        var results = await queries.GetAwaitingCustomerConfirmsAsync();
        return TypedResults.Ok(results);
    }

    // ✅ FIXED: Changed DateTime.Now to DateTime.UtcNow
    public static async Task<Results<Ok, BadRequest<string>>> SetAwaitingCustomerConfirmAsync(
        SetAwaitingCustomerConfirmRequest request,
        [AsParameters] TechnicalServices services)
    {
        var command = new SetAwaitingCustomerConfirmCommand(
    request.Id,
    request.SetAwaitingCustomerConfirmBy,
    DateTime.UtcNow.AddHours(7));  // ✅ fixed



        services.Logger.LogInformation(
            "Sending command: {CommandName}: {@Command}",
            command.GetType().Name,
            command);

        var result = await services.Mediator.Send(command);

        if (result)
        {
            services.Logger.LogInformation("SetAwaitingCustomerConfirmCommand succeeded");
        }
        else
        {
            services.Logger.LogWarning("SetAwaitingCustomerConfirmCommand failed");
        }

        return TypedResults.Ok();
    }

    // ✅ FIXED: Changed DateTime.Now to DateTime.UtcNow
    public static async Task<Results<Ok, BadRequest<string>>> SetCustomerRejectedAsync(
    SetCustomerRejectedRequest request,
    [AsParameters] TechnicalServices services)
    {
        var command = new SetCustomerRejectedCommand(
      request.Id,
      request.SetCustomerRejectedBy,
      DateTime.UtcNow.AddHours(7));  // ✅ FIXED

        services.Logger.LogInformation(
            "Sending command: {CommandName}: {@Command}",
            command.GetType().Name,
            command);

        var result = await services.Mediator.Send(command);

        if (result)
        {
            services.Logger.LogInformation("SetCustomerRejectedCommand succeeded");
        }
        else
        {
            services.Logger.LogWarning("SetCustomerRejectedCommand failed");
        }

        return TypedResults.Ok();
    }

    // ✅ FIXED: Changed DateTime.Now to DateTime.UtcNow
    public static async Task<Results<Ok, BadRequest<string>>> SetAwaitingSparepartAsync(
        SetAwaitingSparepartRequest request,
        [AsParameters] TechnicalServices services)
    {
        // SetAwaitingSparepartAsync
        var command = new SetAwaitingSparepartCommand(
            request.Id,
            request.SetAwaitingSparepartBy,
            DateTime.UtcNow.AddHours(7));

        services.Logger.LogInformation(
            "Sending command: {CommandName}: {@Command}",
            command.GetType().Name,
            command);

        var result = await services.Mediator.Send(command);

        if (result)
        {
            services.Logger.LogInformation("SetAwaitingSparepartCommand succeeded");
        }
        else
        {
            services.Logger.LogWarning("SetAwaitingSparepartCommand failed");
        }

        return TypedResults.Ok();
    }
    public static async Task<Results<Ok, BadRequest<string>>> SetSaleConfirmedAsync(
     SetSaleConfirmedRequest request,
     [AsParameters] TechnicalServices services)
    {
        var command = new SetSaleConfirmedCommand(
            request.Id,
            request.SetSaleConfirmedBy,
            DateTime.UtcNow.AddHours(7));  // ✅ FIXED: Cambodia time UTC+7

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
        var command = new SetSentSparepartsCommand(
            request.Id,
            DateTime.UtcNow.AddHours(7),  // ✅ Cambodia time (UTC+7)
            request.SetSentSparepartsBy);

        services.Logger.LogInformation(
            "Sending command: {CommandName}: {@Command}",
            command.GetType().Name,
            command);

        var result = await services.Mediator.Send(command);

        if (result)
        {
            services.Logger.LogInformation("{@Command} succeeded", command.GetType().Name);
        }
        else
        {
            services.Logger.LogWarning("{@Command} failed", command.GetType().Name);
        }

        return TypedResults.Ok();
    }
    // ✅ FIXED: Changed DateTime.Now to DateTime.UtcNow
    public static async Task<Results<Ok, BadRequest<string>>> SetRepairAsync(
     SetRepairRequest request,
     [AsParameters] TechnicalServices services)
    {
        var command = new SetRepairCommand(
            request.Id,
            request.RepairBy,
            DateTime.UtcNow.AddHours(7));  // ✅ Cambodia time (UTC+7)

        services.Logger.LogInformation(
            "Sending command: {CommandName}: {@Command}",
            command.GetType().Name,
            command);

        var result = await services.Mediator.Send(command);

        if (result)
        {
            services.Logger.LogInformation("SetRepairCommand succeeded");
        }
        else
        {
            services.Logger.LogWarning("SetRepairCommand failed");
        }

        return TypedResults.Ok();
    }

    // ✅ FIXED: Changed DateTime.Now to DateTime.UtcNow
    public static async Task<Results<Ok, BadRequest<string>>> SetThirdPartyRepairAsync(
       SetThirdPartyRepairRequest request,
       [AsParameters] TechnicalServices services)
    {
        var command = new SetThirdPartyRepairCommand(
       request.Id,
       request.ThirdPartyRepairBy,
       DateTime.UtcNow.AddHours(7));  // ✅ FIXED


        services.Logger.LogInformation(
            "Sending command: {CommandName}: {@Command}",
            command.GetType().Name,
            command);

        var result = await services.Mediator.Send(command);

        if (result)
        {
            services.Logger.LogInformation("SetThirdPartyRepairCommand succeeded");
        }
        else
        {
            services.Logger.LogWarning("SetThirdPartyRepairCommand failed");
        }

        return TypedResults.Ok();
    }

    // ✅ FIXED: Changed DateTime.Now to DateTime.UtcNow
    public static async Task<Results<Ok, BadRequest<string>>> SetFinishedStatusAsync(
     SetFinishedRequest request,
     [AsParameters] TechnicalServices services)
    {
        var command = new SetFinishedStatusCommand(
            request.Id,
            DateTime.UtcNow.AddHours(7),  // ✅ Cambodia time (UTC+7)
            request.VerifiedBy);

        services.Logger.LogInformation(
            "Sending command: {CommandName}: {@Command}",
            command.GetType().Name,
            command);

        var result = await services.Mediator.Send(command);

        if (result)
        {
            services.Logger.LogInformation("{@Command} succeeded", command.GetType().Name);
        }
        else
        {
            services.Logger.LogWarning("{@Command} failed", command.GetType().Name);
        }

        return TypedResults.Ok();
    }

    // ✅ FIXED: Changed DateTime.Now to DateTime.UtcNow
    public static async Task<Results<Ok, BadRequest<string>>> SetUnrepairableAsync(
        SetUnrepairableRequest request,
        [AsParameters] TechnicalServices services)
    {
        var command = new SetUnrepairableCommand(
      request.Id,
      request.SetUnrepairableBy,
      DateTime.UtcNow.AddHours(7));  // ✅ FIXED

        services.Logger.LogInformation(
            "Sending command: {CommandName}: {@Command}",
            command.GetType().Name,
            command);

        var result = await services.Mediator.Send(command);

        if (result)
        {
            services.Logger.LogInformation("SetUnrepairableCommand succeeded");
        }
        else
        {
            services.Logger.LogWarning("SetUnrepairableCommand failed");
        }

        return TypedResults.Ok();
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
        }
        else
        {
            services.Logger.LogWarning("CreateRentalItemCommand failed");
        }
        return TypedResults.Ok();
    }

    public static async Task<Ok<PagedResult<RentalItem>>> GetRentalItemsAsync(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        ITechnicalServiceQueries queries = null)
    {
        var rentalItems = await queries.GetRentalItemsAsync(pageNumber, pageSize);
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
            services.Logger.LogInformation("CreateRentalItemCommand succeeded");
        }
        else
        {
            services.Logger.LogWarning("CreateRentalItemCommand failed");
        }
        
        return TypedResults.Ok();
    }

    public static async Task<Ok<PagedResult<RentalService>>> GetRentalServicesAsync(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        ITechnicalServiceQueries queries = null)
    {
        var rentalItems = await queries.GetRentalServicesAsync(pageNumber, pageSize);
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

    public static async Task<Ok<PagedResult<Service>>> SearchServicesAsync(
        [AsParameters] ServiceSearchQuery query,
        ITechnicalServiceQueries queries)
    {
        var services = await queries.SearchServicesAsync(query);
        return TypedResults.Ok(services);
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
    decimal DefaultPrice = 0); // ✅ ADD THIS

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
