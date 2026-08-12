using MediatR;
using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;
namespace TechnicalService.API.Application.Commands;

public class DeleteReceiveItemCommandHandler : IRequestHandler<DeleteReceiveItemCommand, bool>
{
    private readonly ITechnicalServiceRepository _technicalServiceRepository;
    private readonly ILogger<DeleteReceiveItemCommandHandler> _logger;

    public DeleteReceiveItemCommandHandler(
        ITechnicalServiceRepository technicalServiceRepository,
        ILogger<DeleteReceiveItemCommandHandler> logger)
    {
        _technicalServiceRepository = technicalServiceRepository ?? throw new ArgumentNullException(nameof(technicalServiceRepository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<bool> Handle(DeleteReceiveItemCommand command, CancellationToken cancellationToken)
    {
        var serviceToDelete = await _technicalServiceRepository.GetAsync(command.ServiceId);
        if (serviceToDelete == null)
        {
            _logger.LogWarning("Service with ID {ServiceId} not found", command.ServiceId);
            return false;
        }

        _logger.LogInformation("Deleting Service - ReceiveItem with ID: {ServiceId}", command.ServiceId);
        _technicalServiceRepository.DeleteService(serviceToDelete);

        var saved = await _technicalServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return saved;
    }
}