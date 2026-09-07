using MediatR;
using Microsoft.EntityFrameworkCore;
using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;
using TechnicalService.Infrastructure;

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

            // ❌ Rule: Cannot delete Finished services (StatusId == 6 / Finished)
            if (service.ServiceStatusId == 6 || service.Status?.Name == "Finished")
            {
                _logger.LogWarning("Attempted to delete Finished service {ServiceId}", command.ServiceId);
                throw new InvalidOperationException("Cannot delete finished service report (មិនអាចលុបរបាយការណ៍ដែលជួសជុលរួចរាល់បានទេ).");
            }

            // Unlink audit logs and clean up related records so deletion does not fail on FK constraints
            if (_repository.UnitOfWork is TechnicalServiceContext context)
            {
                try
                {
                    await context.Database.ExecuteSqlRawAsync(
                        "UPDATE dbo.SparepartStockAuditLog SET ServiceId = NULL WHERE ServiceId = {0}; " +
                        "DELETE FROM dbo.StockNotificationOutbox WHERE ServiceId = {0}; " +
                        "DELETE FROM dbo.ServiceTelegramMessages WHERE ServiceId = {0};",
                        command.ServiceId, cancellationToken);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Unlinking child records for service {ServiceId} warning", command.ServiceId);
                }
            }

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