namespace TechnicalService.API.Application.Commands;

using TechnicalService.Domain.AggregatesModel.RentalAggregate;

public class CreateRentalItemCommandHandler
    : IRequestHandler<CreateRentalItemCommand, bool>
{
    private readonly IRentalServiceRepository _rentalServiceRepository;
    private readonly ILogger<CreateRentalItemCommandHandler> _logger;

    // Using DI to inject infrastructure persitence Repositories
    public CreateRentalItemCommandHandler(
        IRentalServiceRepository rentalServiceRepository,
        ILogger<CreateRentalItemCommandHandler> logger)
    {
        _rentalServiceRepository = rentalServiceRepository ?? throw new ArgumentNullException(nameof(rentalServiceRepository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<bool> Handle(CreateRentalItemCommand message, CancellationToken cancellationToken)
    {
        var item = new RentalItem(message.CreatedBy, message.CustomerId, message.CustomerName,
            message.ItemName, message.SerialNumber, message.Condition, message.Location, message.Duration);

        _logger.LogInformation("Creating RentalItem for customer {CustomerId}: {SerialNumber}", message.CustomerId, message.SerialNumber);

        _rentalServiceRepository.AddRentalItem(item);

        return await _rentalServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
