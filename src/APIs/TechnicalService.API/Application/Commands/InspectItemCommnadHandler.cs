using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;
namespace TechnicalService.API.Application.Commands;

public class InspectItemCommandHandler : IRequestHandler<InspectItemCommand, bool>
{
    private readonly ITechnicalServiceRepository _technicalServiceRepository;
    private readonly IMediator _mediator;
    private readonly ILogger<InspectItemCommandHandler> _logger;

    public InspectItemCommandHandler(IMediator mediator,
        ITechnicalServiceRepository technicalServiceRepository,
        ILogger<InspectItemCommandHandler> logger)
    {
        _technicalServiceRepository = technicalServiceRepository ?? throw new ArgumentNullException(nameof(technicalServiceRepository));
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
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
                Enum.Parse<SparepartCondition>(part.Condition),
                part.IsHoldStatus);
        }

        _logger.LogInformation("Updating Service - InspectItem: {@Service}", serviceToUpdate);

        var saved = await _technicalServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return saved;
    }
}