using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class SetRepairCommnadHandler : IRequestHandler<SetRepairCommand, bool>
{
    private readonly ITechnicalServiceRepository _technicalServiceRepository;
    private readonly IMediator _mediator;
    private readonly ILogger<SetRepairCommnadHandler> _logger;

    // Using DI to inject infrastructure persistence Repositories
    public SetRepairCommnadHandler(IMediator mediator,
        ITechnicalServiceRepository technicalServiceRepository,
        ILogger<SetRepairCommnadHandler> logger)
    {
        _technicalServiceRepository = technicalServiceRepository ?? throw new ArgumentNullException(nameof(technicalServiceRepository));
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<bool> Handle(SetRepairCommand command, CancellationToken cancellationToken)
    {
        var serviceToUpdate = await _technicalServiceRepository.GetServiceAsync(command.Id);
        
        if (serviceToUpdate == null)
        {
            return false;
        }

        serviceToUpdate.SetRepairingStatus(command.RepairBy, command.RepairDate);

        _logger.LogInformation("Updating Service - SetRepair: {@Service}", serviceToUpdate);

        return await _technicalServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}