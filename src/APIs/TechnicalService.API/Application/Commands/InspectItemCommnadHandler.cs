using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;
using TechnicalService.API.Extensions;
namespace TechnicalService.API.Application.Commands;

public class InspectItemCommandHandler : IRequestHandler<InspectItemCommand, bool>
{
    private readonly ITechnicalServiceRepository _technicalServiceRepository;
    private readonly ILogger<InspectItemCommandHandler> _logger;

    public InspectItemCommandHandler(
        ITechnicalServiceRepository technicalServiceRepository,
        ILogger<InspectItemCommandHandler> logger)
    {
        _technicalServiceRepository = technicalServiceRepository ?? throw new ArgumentNullException(nameof(technicalServiceRepository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<bool> Handle(InspectItemCommand command, CancellationToken cancellationToken)
    {
        var serviceToUpdate = await _technicalServiceRepository.GetServiceAsync(command.Id);
        if (serviceToUpdate == null)
            return false;

        serviceToUpdate.SetInspection(command.InspectBy, command.InspectDate,
            command.Inspection, command.Solution);
        serviceToUpdate.SetServiceType(command.ServiceTypeId);

        foreach (var part in command.SparepartItems)
        {
            serviceToUpdate.AddSparepartItem(
                part.SparepartId,
                part.Description,
                part.Quantity,
                EnumParsing.Parse<SparepartCondition>(part.Condition, "Condition"),
                part.IsHoldStatus);
        }

        _logger.LogInformation("Updating Service - InspectItem: {ServiceId}", serviceToUpdate.Id);

        var saved = await _technicalServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return saved;
    }
}