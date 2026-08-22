using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class SetFinishedStatusCommnadHandler : IRequestHandler<SetFinishedStatusCommand, bool>
{
    private readonly ITechnicalServiceRepository _technicalServiceRepository;
    private readonly ILogger<SetFinishedStatusCommnadHandler> _logger;

    // Using DI to inject infrastructure persistence Repositories
    public SetFinishedStatusCommnadHandler(
        ITechnicalServiceRepository technicalServiceRepository,
        ILogger<SetFinishedStatusCommnadHandler> logger)
    {
        _technicalServiceRepository = technicalServiceRepository ?? throw new ArgumentNullException(nameof(technicalServiceRepository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<bool> Handle(SetFinishedStatusCommand command, CancellationToken cancellationToken)
    {
        var serviceToUpdate = await _technicalServiceRepository.GetServiceAsync(command.Id);
        
        if (serviceToUpdate == null)
        {
            return false;
        }

        serviceToUpdate.SetFinishedStatus(command.FinishedDate, command.VerifiedBy);

        _logger.LogInformation("Updating Service - SetFinished: {ServiceId}", serviceToUpdate.Id);

        return await _technicalServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}