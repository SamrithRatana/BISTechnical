using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class SetAwaitingSparepartCommnadHandler : IRequestHandler<SetAwaitingSparepartCommand, bool>
{
    private readonly ITechnicalServiceRepository _technicalServiceRepository;
    private readonly ILogger<SetAwaitingSparepartCommnadHandler> _logger;

    // Using DI to inject infrastructure persistence Repositories
    public SetAwaitingSparepartCommnadHandler(
        ITechnicalServiceRepository technicalServiceRepository,
        ILogger<SetAwaitingSparepartCommnadHandler> logger)
    {
        _technicalServiceRepository = technicalServiceRepository ?? throw new ArgumentNullException(nameof(technicalServiceRepository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<bool> Handle(SetAwaitingSparepartCommand command, CancellationToken cancellationToken)
    {
        var serviceToUpdate = await _technicalServiceRepository.GetServiceAsync(command.Id);
        
        if (serviceToUpdate == null)
        {
            return false;
        }

        serviceToUpdate.SetAwaitingSparepart(command.SetAwaitingSparepartBy, command.AwaitingSparepartDate);

        _logger.LogInformation("Updating Service - SetAwaitingSparepart: {ServiceId}", serviceToUpdate.Id);

        return await _technicalServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}