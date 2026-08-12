using MediatR;
using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class DeleteTechnicalServiceCommandHandler
    : IRequestHandler<DeleteTechnicalServiceCommand, bool>
{
    private readonly ITechnicalServiceRepository _repository;
    private readonly ILogger<DeleteTechnicalServiceCommandHandler> _logger;

    public DeleteTechnicalServiceCommandHandler(
        ITechnicalServiceRepository repository,
        ILogger<DeleteTechnicalServiceCommandHandler> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async Task<bool> Handle(
        DeleteTechnicalServiceCommand command,
        CancellationToken cancellationToken)
    {
        try
        {
            var service = await _repository.GetServiceAsync(command.ServiceId);

            if (service == null)
            {
                _logger.LogWarning("Service with ID {ServiceId} not found", command.ServiceId);
                return false;
            }

            // Optional: Add business rules for deletion
            // For example, you might not want to delete services that are "Finished"
            // if (service.Status == ServiceStatus.Finished)
            // {
            //     throw new InvalidOperationException("Cannot delete finished services");
            // }

            _repository.DeleteService(service);

            var result = await _repository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

            if (result)
            {
                _logger.LogInformation("Successfully deleted service {ServiceId}", command.ServiceId);
            }

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting service {ServiceId}", command.ServiceId);
            throw;
        }
    }
}