using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class SetThirdPartyRepairCommnadHandler : IRequestHandler<SetThirdPartyRepairCommand, bool>
{
    private readonly ITechnicalServiceRepository _technicalServiceRepository;
    private readonly ILogger<SetThirdPartyRepairCommnadHandler> _logger;

    // Using DI to inject infrastructure persistence Repositories
    public SetThirdPartyRepairCommnadHandler(
        ITechnicalServiceRepository technicalServiceRepository,
        ILogger<SetThirdPartyRepairCommnadHandler> logger)
    {
        _technicalServiceRepository = technicalServiceRepository ?? throw new ArgumentNullException(nameof(technicalServiceRepository));
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

        _logger.LogInformation("Updating Service - SetThirdPartyRepair: {ServiceId}", serviceToUpdate.Id);

        return await _technicalServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}