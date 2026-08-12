using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;
namespace TechnicalService.API.Application.Commands;
public class UpdateInspectItemCommandHandler : IRequestHandler<UpdateInspectItemCommand, bool>
{
    private readonly ITechnicalServiceRepository _technicalServiceRepository;
    private readonly IMediator _mediator;
    private readonly ILogger<UpdateInspectItemCommandHandler> _logger;
    public UpdateInspectItemCommandHandler(IMediator mediator,
        ITechnicalServiceRepository technicalServiceRepository,
        ILogger<UpdateInspectItemCommandHandler> logger)
    {
        _technicalServiceRepository = technicalServiceRepository ?? throw new ArgumentNullException(nameof(technicalServiceRepository));
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
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

        serviceToUpdate.SetInspection(command.InspectBy, DateTime.UtcNow,
            command.Inspection, command.Solution);
        serviceToUpdate.SetServiceType(command.ServiceTypeId);

        var existingItems = serviceToUpdate.SparepartItems.ToList();
        var commandSparepartIds = command.Spareparts
            .Where(sp => sp.SparepartId != Guid.Empty)
            .Select(s => s.SparepartId)
            .ToList();

        _logger.LogInformation("📊 Existing spare part items: {Count}", existingItems.Count);
        _logger.LogInformation("📊 Command spare part IDs: {Count}", commandSparepartIds.Count);

        var itemsToRemove = existingItems
            .Where(e => !commandSparepartIds.Contains(e.SparepartId))
            .ToList();

        _logger.LogInformation("🗑️ Items to remove: {Count}", itemsToRemove.Count);
        foreach (var item in itemsToRemove)
        {
            _logger.LogInformation("🗑️ Removing SparepartItem - Id: {Id}, SparepartId: {SparepartId}, Quantity: {Quantity}",
                item.Id, item.SparepartId, item.Quantity);
            serviceToUpdate.RemoveSparepartItem(item.Id);
        }

        foreach (var part in command.Spareparts.Where(sp => sp.SparepartId != Guid.Empty))
        {
            var existingItem = existingItems.FirstOrDefault(e => e.SparepartId == part.SparepartId);

            if (existingItem != null && !itemsToRemove.Contains(existingItem))
            {
                _logger.LogInformation("✏️ Updating existing item - SparepartId: {SparepartId}", part.SparepartId);
                existingItem.UpdateDetails(
                    part.Description,
                    part.Quantity,
                    Enum.Parse<SparepartCondition>(part.Condition),
                    part.IsHoldStatus); // ✅ NEW
            }
            else if (existingItem == null)
            {
                _logger.LogInformation("➕ Adding new item - SparepartId: {SparepartId}", part.SparepartId);
                serviceToUpdate.AddSparepartItem(
                    part.SparepartId,
                    part.Description,
                    part.Quantity,
                    Enum.Parse<SparepartCondition>(part.Condition),
                    part.IsHoldStatus); // ✅ NEW
            }
        }

        _logger.LogInformation("Updating Service - UpdateInspectItem: {@Service}", serviceToUpdate);
        var result = await _technicalServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        _logger.LogInformation("💾 SaveEntitiesAsync result: {Result}", result);
        return result;
    }
}