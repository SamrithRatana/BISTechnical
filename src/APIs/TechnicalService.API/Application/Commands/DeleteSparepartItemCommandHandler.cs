using MediatR;
using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands
{
    public class DeleteSparepartItemCommandHandler
        : IRequestHandler<DeleteSparepartItemCommand, bool>
    {
        private readonly ITechnicalServiceRepository _technicalServiceRepository;
        private readonly ILogger<DeleteSparepartItemCommandHandler> _logger;

        public DeleteSparepartItemCommandHandler(
            ITechnicalServiceRepository technicalServiceRepository,
            ILogger<DeleteSparepartItemCommandHandler> logger)
        {
            _technicalServiceRepository = technicalServiceRepository ??
                throw new ArgumentNullException(nameof(technicalServiceRepository));
            _logger = logger ??
                throw new ArgumentNullException(nameof(logger));
        }

        public async Task<bool> Handle(
            DeleteSparepartItemCommand command,
            CancellationToken cancellationToken)
        {
            _logger.LogInformation(
                "🗑️ Deleting spare part item {SparepartItemId} from service {ServiceId}",
                command.SparepartItemId,
                command.ServiceId);

            // Get the service aggregate
            var service = await _technicalServiceRepository.GetServiceAsync(command.ServiceId);

            if (service == null)
            {
                _logger.LogWarning("❌ Service {ServiceId} not found", command.ServiceId);
                return false;
            }

            // Find the spare part item to delete
            var itemToDelete = service.SparepartItems
                .FirstOrDefault(sp => sp.Id == command.SparepartItemId);

            if (itemToDelete == null)
            {
                _logger.LogWarning(
                    "❌ Spare part item {SparepartItemId} not found in service {ServiceId}",
                    command.SparepartItemId,
                    command.ServiceId);
                return false;
            }

            _logger.LogInformation(
                "📦 Found item to delete - SparepartId: {SparepartId}, Quantity: {Quantity}",
                itemToDelete.SparepartId,
                itemToDelete.Quantity);

            // CRITICAL: Remove the item from the collection
            // This marks it for deletion in EF Core's change tracker
            service.RemoveSparepartItem(command.SparepartItemId);

            _logger.LogInformation("🔄 Saving changes to database...");

            // Save changes - this will trigger the actual database DELETE
            // which in turn will fire the SQL trigger to restore stock
            var result = await _technicalServiceRepository.UnitOfWork
                .SaveEntitiesAsync(cancellationToken);

            if (result)
            {
                _logger.LogInformation(
                    "✅ Successfully deleted spare part item {SparepartItemId}. SQL trigger should have restored stock.",
                    command.SparepartItemId);
            }
            else
            {
                _logger.LogError(
                    "❌ Failed to save deletion of spare part item {SparepartItemId}",
                    command.SparepartItemId);
            }

            return result;
        }
    }
}