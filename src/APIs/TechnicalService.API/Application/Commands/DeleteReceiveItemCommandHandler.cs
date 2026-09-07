using MediatR;
using Microsoft.EntityFrameworkCore;
using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;
using TechnicalService.Infrastructure;

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

        // ❌ Rule: Cannot delete Finished services (StatusId == 6 / Finished)
        if (serviceToDelete.ServiceStatusId == 6 || serviceToDelete.Status?.Name == "Finished")
        {
            _logger.LogWarning("Attempted to delete Finished service {ServiceId}", command.ServiceId);
            throw new InvalidOperationException("Cannot delete finished service report (មិនអាចលុបរបាយការណ៍ដែលជួសជុលរួចរាល់បានទេ).");
        }

        // Unlink audit logs and clean up related records so deletion does not fail on FK constraints
        if (_technicalServiceRepository.UnitOfWork is TechnicalServiceContext context)
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

        _logger.LogInformation("Deleting Service - ReceiveItem with ID: {ServiceId}", command.ServiceId);
        _technicalServiceRepository.DeleteService(serviceToDelete);

        var saved = await _technicalServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
        return saved;
    }
}