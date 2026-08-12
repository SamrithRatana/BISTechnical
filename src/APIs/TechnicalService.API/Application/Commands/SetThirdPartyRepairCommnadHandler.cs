using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class SetThirdPartyRepairCommnadHandler : IRequestHandler<SetThirdPartyRepairCommand, bool>
{
    private readonly ITechnicalServiceRepository _technicalServiceRepository;
    private readonly IMediator _mediator;
    private readonly ILogger<SetThirdPartyRepairCommnadHandler> _logger;

    // Using DI to inject infrastructure persistence Repositories
    public SetThirdPartyRepairCommnadHandler(IMediator mediator,
        ITechnicalServiceRepository technicalServiceRepository,
        ILogger<SetThirdPartyRepairCommnadHandler> logger)
    {
        _technicalServiceRepository = technicalServiceRepository ?? throw new ArgumentNullException(nameof(technicalServiceRepository));
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<bool> Handle(SetThirdPartyRepairCommand command, CancellationToken cancellationToken)
    {
        var serviceToUpdate = await _technicalServiceRepository.GetServiceAsync(command.Id);
        
        if (serviceToUpdate == null)
        {
            return false;
        }

        serviceToUpdate.SetThirdPartyRepairingStatus(command.ThirdPartyRepairBy, command.ThirdPartyRepairDate);

        _logger.LogInformation("Updating Service - SetThirdPartyRepair: {@Service}", serviceToUpdate);

        return await _technicalServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}