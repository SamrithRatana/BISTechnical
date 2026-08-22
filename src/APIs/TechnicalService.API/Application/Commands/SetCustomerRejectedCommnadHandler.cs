using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class SetCustomerRejectedCommnadHandler : IRequestHandler<SetCustomerRejectedCommand, bool>
{
    private readonly ITechnicalServiceRepository _technicalServiceRepository;
    private readonly ILogger<SetCustomerRejectedCommnadHandler> _logger;

    // Using DI to inject infrastructure persistence Repositories
    public SetCustomerRejectedCommnadHandler(
        ITechnicalServiceRepository technicalServiceRepository,
        ILogger<SetCustomerRejectedCommnadHandler> logger)
    {
        _technicalServiceRepository = technicalServiceRepository ?? throw new ArgumentNullException(nameof(technicalServiceRepository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<bool> Handle(SetCustomerRejectedCommand command, CancellationToken cancellationToken)
    {
        var serviceToUpdate = await _technicalServiceRepository.GetServiceAsync(command.Id);
        
        if (serviceToUpdate == null)
        {
            return false;
        }

        serviceToUpdate.SetCustomerRejected(command.SetCustomerRejectedBy, command.CustomerRejectedDate);

        _logger.LogInformation("Updating Service - SetCustomerRejected: {ServiceId}", serviceToUpdate.Id);

        return await _technicalServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}