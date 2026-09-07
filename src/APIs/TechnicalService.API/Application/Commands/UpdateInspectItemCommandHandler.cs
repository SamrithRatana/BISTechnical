using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;
using TechnicalService.API.Extensions;
using TechnicalService.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace TechnicalService.API.Application.Commands;
public class UpdateInspectItemCommandHandler : IRequestHandler<UpdateInspectItemCommand, bool>
{
    private readonly ITechnicalServiceRepository _technicalServiceRepository;
    private readonly ILogger<UpdateInspectItemCommandHandler> _logger;
    public UpdateInspectItemCommandHandler(
        ITechnicalServiceRepository technicalServiceRepository,
        ILogger<UpdateInspectItemCommandHandler> logger)
    {
        _technicalServiceRepository = technicalServiceRepository ?? throw new ArgumentNullException(nameof(technicalServiceRepository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }
    public async Task<bool> Handle(UpdateInspectItemCommand command, CancellationToken cancellationToken)
    {
        var serviceToUpdate = await _technicalServiceRepository.GetServiceAsync(command.Id);
        if (serviceToUpdate == null)
        {
            _logger.LogWarning("Service with Id {ServiceId} not found", command.Id);
            return false;
        }

        // Business-local, matching the create path (CreateInspectItemAsync
        // passes BusinessClock.Now). As UtcNow, editing an inspection rewrote
        // its date seven hours earlier than creating one.
        serviceToUpdate.SetInspection(command.InspectBy, BusinessClock.Now,
            command.Inspection, command.Solution);
        serviceToUpdate.SetServiceType(command.ServiceTypeId);

        var existingItems = serviceToUpdate.SparepartItems.ToList();
        var commandSparepartIds = command.Spareparts
            .Where(sp => sp.SparepartId != Guid.Empty)
            .Select(s => s.SparepartId)
            .ToList();

        _logger.LogDebug("Existing spare part items: {Count}", existingItems.Count);
        _logger.LogDebug("Command spare part IDs: {Count}", commandSparepartIds.Count);

        var itemsToRemove = existingItems
            .Where(e => !commandSparepartIds.Contains(e.SparepartId))
            .ToList();

        _logger.LogDebug("Items to remove: {Count}", itemsToRemove.Count);
        foreach (var item in itemsToRemove)
        {
            _logger.LogDebug("Removing SparepartItem - Id: {Id}, SparepartId: {SparepartId}, Quantity: {Quantity}",
                item.Id, item.SparepartId, item.Quantity);
            serviceToUpdate.RemoveSparepartItem(item.Id);
        }

        foreach (var part in command.Spareparts.Where(sp => sp.SparepartId != Guid.Empty))
        {
            var existingItem = existingItems.FirstOrDefault(e => e.SparepartId == part.SparepartId);

            if (existingItem != null && !itemsToRemove.Contains(existingItem))
            {
                _logger.LogDebug("Updating existing item - SparepartId: {SparepartId}", part.SparepartId);
                existingItem.UpdateDetails(
                    part.Description,
                    part.Quantity,
                    EnumParsing.Parse<SparepartCondition>(part.Condition, "Condition"),
                    part.IsHoldStatus);            }
            else if (existingItem == null)
            {
                _logger.LogDebug("Adding new item - SparepartId: {SparepartId}", part.SparepartId);
                serviceToUpdate.AddSparepartItem(
                    part.SparepartId,
                    part.Description,
                    part.Quantity,
                    EnumParsing.Parse<SparepartCondition>(part.Condition, "Condition"),
                    part.IsHoldStatus);            }
        }

        _logger.LogInformation("Updating Service - UpdateInspectItem: {ServiceId}", serviceToUpdate.Id);
        var result = await _technicalServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        _logger.LogDebug("SaveEntitiesAsync result: {Result}", result);

        // 🗑️ Clean up audit log and outbox records for removed spare parts
        if (result && _technicalServiceRepository.UnitOfWork is TechnicalServiceContext dbContext)
        {
            if (itemsToRemove.Any())
            {
                foreach (var item in itemsToRemove)
                {
                    await dbContext.Database.ExecuteSqlInterpolatedAsync(
                        $"DELETE FROM dbo.SparepartStockAuditLog WHERE ServiceId = {serviceToUpdate.Id} AND SparepartId = {item.SparepartId}; DELETE FROM dbo.StockNotificationOutbox WHERE ServiceId = {serviceToUpdate.Id} AND SparepartId = {item.SparepartId};",
                        cancellationToken);
                }
            }
        }

        return result;
    }
}