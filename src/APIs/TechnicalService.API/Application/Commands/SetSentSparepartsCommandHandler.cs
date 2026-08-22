using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;
namespace TechnicalService.API.Application.Commands;

public class SetSentSparepartsCommandHandler : IRequestHandler<SetSentSparepartsCommand, bool>
{
    private readonly ITechnicalServiceRepository _technicalServiceRepository;
    private readonly ILogger<SetSentSparepartsCommandHandler> _logger;
    public SetSentSparepartsCommandHandler(        ITechnicalServiceRepository technicalServiceRepository,
        ILogger<SetSentSparepartsCommandHandler> logger)    {
        _technicalServiceRepository = technicalServiceRepository ?? throw new ArgumentNullException(nameof(technicalServiceRepository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<bool> Handle(SetSentSparepartsCommand command, CancellationToken cancellationToken)
    {
        var serviceToUpdate = await _technicalServiceRepository.GetServiceAsync(command.Id);
        if (serviceToUpdate == null)
        {
            return false;
        }
        serviceToUpdate.SetSentSparepartsStatus(command.SentSparepartsDate, command.SetSentSparepartsBy);
        _logger.LogInformation("Updating Service - SetSentSpareparts: {ServiceId}", serviceToUpdate.Id);
        return await _technicalServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}