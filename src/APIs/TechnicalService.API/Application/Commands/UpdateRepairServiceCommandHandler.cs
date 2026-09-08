using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;
using TechnicalService.API.Extensions;
using TechnicalService.Infrastructure;
using Microsoft.EntityFrameworkCore;
using TechnicalService.API.Application.DTOs;

namespace TechnicalService.API.Application.Commands;

public class UpdateRepairServiceCommandHandler : IRequestHandler<UpdateRepairServiceCommand, bool>
{
    private readonly ITechnicalServiceRepository _repairServiceRepository;

    public UpdateRepairServiceCommandHandler(
        ITechnicalServiceRepository repairServiceRepository)
    {
        _repairServiceRepository = repairServiceRepository;
    }

    public async Task<bool> Handle(UpdateRepairServiceCommand command, CancellationToken cancellationToken)
    {
        var serviceToUpdate = await _repairServiceRepository.GetServiceAsync(command.Id);
        if (serviceToUpdate == null)
        {
            return false;
        }

        Guid? finalItemId = command.ItemId;

        // Handle Item update or creation when ItemName or SerialNumber is provided
        if (!string.IsNullOrWhiteSpace(command.ItemName) || !string.IsNullOrWhiteSpace(command.SerialNumber))
        {
            var targetItemId = (finalItemId.HasValue && finalItemId.Value != Guid.Empty)
                ? finalItemId.Value
                : (serviceToUpdate.ItemId.HasValue && serviceToUpdate.ItemId.Value != Guid.Empty ? serviceToUpdate.ItemId.Value : (Guid?)null);

            if (targetItemId.HasValue)
            {
                var existingItem = await _repairServiceRepository.GetItemAsync(targetItemId.Value);
                if (existingItem != null)
                {
                    existingItem.UpdateItem(
                        !string.IsNullOrWhiteSpace(command.ItemName) ? command.ItemName : existingItem.ItemName,
                        command.SerialNumber ?? existingItem.SerialNumber ?? "",
                        existingItem.ItemType?.Type ?? "Toner");
                    _repairServiceRepository.UpdateItem(existingItem);
                    finalItemId = existingItem.Id;
                }
                else
                {
                    var newItem = new Item(command.ItemName ?? "Instrument", command.SerialNumber ?? "", new ItemType("Toner"));
                    _repairServiceRepository.AddItem(newItem);
                    finalItemId = newItem.Id;
                }
            }
            else
            {
                var newItem = new Item(command.ItemName ?? "Instrument", command.SerialNumber ?? "", new ItemType("Toner"));
                _repairServiceRepository.AddItem(newItem);
                finalItemId = newItem.Id;
            }
        }
        else if (serviceToUpdate.ItemId.HasValue && (!finalItemId.HasValue || finalItemId.Value == Guid.Empty))
        {
            // Preserve existing ItemId so it does not get cleared when caller omits it
            finalItemId = serviceToUpdate.ItemId;
        }

        int targetStatusId = command.StatusId > 0 ? command.StatusId : serviceToUpdate.ServiceStatusId;
        bool isHoldStatus = !(targetStatusId == 5 || targetStatusId == 6 || targetStatusId == 12);

        // Capture existing sparepart IDs before update to identify removed parts
        var existingSparepartIds = serviceToUpdate.SparepartItems
            .Select(x => x.SparepartId)
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToList();

        var incomingList = command.SparepartItems ?? Enumerable.Empty<SparepartItemDTO>();

        var incomingSparepartIds = incomingList
            .Select(x => x.SparepartId)
            .Where(id => id != Guid.Empty)
            .ToHashSet();

        var removedSparepartIds = existingSparepartIds
            .Where(id => !incomingSparepartIds.Contains(id))
            .ToList();

        var partList = new List<SparepartItem>();

        foreach (var part in incomingList)
        {
            var item = new SparepartItem(
                part.SparepartId,
                part.Description,
                part.Quantity,
                EnumParsing.Parse<SparepartCondition>(part.Condition, "Condition"),
                isHoldStatus,
                part.Remarks);
            if (part.Id.HasValue && part.Id.Value != Guid.Empty)
            {
                item.Update(part.Id.Value);
            }
            partList.Add(item);
        }

        var serviceDate = command.ServiceDate.Kind == DateTimeKind.Utc
            ? command.ServiceDate.AddHours(7)
            : command.ServiceDate;

        DateTime? finishedDate = null;
        if (command.FinishedDate.HasValue)
        {
            finishedDate = command.FinishedDate.Value.Kind == DateTimeKind.Utc
                ? command.FinishedDate.Value.AddHours(7)
                : command.FinishedDate.Value;
        }

        int targetPriorityId = command.ServicePriorityId > 0 ? command.ServicePriorityId : serviceToUpdate.ServicePriorityId;
        int targetTypeId = command.ServiceTypeId > 0 ? command.ServiceTypeId : serviceToUpdate.ServiceTypeId;
        Guid finalCustomerId = command.CustomerId != Guid.Empty ? command.CustomerId : serviceToUpdate.CustomerId;

        serviceToUpdate.UpdateRepairService(
            command.ReportNo,
            serviceDate,
            finalCustomerId,
            command.CompanyName,
            command.Address,
            command.ContactName,
            command.PhoneNumber,
            command.CustomerRequest,
            command.Inspection,
            command.Solution,
            EnumParsing.Parse<ServiceLocation>(command.ServiceLocation, "ServiceLocation"),
            targetTypeId,
            targetPriorityId,
            targetStatusId,
            finalItemId,
            command.HasContract,
            partList,
            finishedDate,
            command.RepairBy,
            command.VerifiedBy);

        var result = await _repairServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        // 🗑️ When user removes sparepart items and saves, clean up associated audit logs & outbox rows
        if (result && _repairServiceRepository.UnitOfWork is TechnicalServiceContext dbContext)
        {
            if (removedSparepartIds.Any())
            {
                foreach (var removedId in removedSparepartIds)
                {
                    if (isHoldStatus)
                    {
                        // In Hold Status: clean up all tracking rows for the cancelled spare part
                        await dbContext.Database.ExecuteSqlInterpolatedAsync(
                            $"DELETE FROM dbo.SparepartStockAuditLog WHERE ServiceId = {serviceToUpdate.Id} AND SparepartId = {removedId}; DELETE FROM dbo.StockNotificationOutbox WHERE ServiceId = {serviceToUpdate.Id} AND SparepartId = {removedId};",
                            cancellationToken);
                    }
                    else
                    {
                        // In Active Status: clean up 0-change tracking rows; real movements (QuantityChange != 0) are preserved!
                        await dbContext.Database.ExecuteSqlInterpolatedAsync(
                            $"DELETE FROM dbo.SparepartStockAuditLog WHERE ServiceId = {serviceToUpdate.Id} AND SparepartId = {removedId} AND QuantityChange = 0; DELETE FROM dbo.StockNotificationOutbox WHERE ServiceId = {serviceToUpdate.Id} AND SparepartId = {removedId};",
                            cancellationToken);
                    }
                }
            }

            // If user removed all spareparts from the ticket
            if (!command.SparepartItems.Any() && existingSparepartIds.Count > 0)
            {
                if (isHoldStatus)
                {
                    await dbContext.Database.ExecuteSqlInterpolatedAsync(
                        $"DELETE FROM dbo.SparepartStockAuditLog WHERE ServiceId = {serviceToUpdate.Id}; DELETE FROM dbo.StockNotificationOutbox WHERE ServiceId = {serviceToUpdate.Id};",
                        cancellationToken);
                }
                else
                {
                    await dbContext.Database.ExecuteSqlInterpolatedAsync(
                        $"DELETE FROM dbo.SparepartStockAuditLog WHERE ServiceId = {serviceToUpdate.Id} AND QuantityChange = 0; DELETE FROM dbo.StockNotificationOutbox WHERE ServiceId = {serviceToUpdate.Id};",
                        cancellationToken);
                }
            }
        }

        return result;
    }
}
