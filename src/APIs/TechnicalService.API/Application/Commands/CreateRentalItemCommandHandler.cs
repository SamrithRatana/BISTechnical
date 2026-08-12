namespace TechnicalService.API.Application.Commands;

using TechnicalService.Domain.AggregatesModel.RentalAggregate;

public class CreateRentalItemCommandHandler
    : IRequestHandler<CreateRentalItemCommand, bool>
{
    private readonly IRentalServiceRepository _rentalServiceRepository;
    private readonly IMediator _mediator;
    private readonly ILogger<CreateRentalItemCommandHandler> _logger;

    // Using DI to inject infrastructure persitence Repositories
    public CreateRentalItemCommandHandler(IMediator mediator,
        IRentalServiceRepository rentalServiceRepository,
        ILogger<CreateRentalItemCommandHandler> logger)
    {
        _rentalServiceRepository = rentalServiceRepository ?? throw new ArgumentNullException(nameof(rentalServiceRepository));
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<bool> Handle(CreateRentalItemCommand message, CancellationToken cancellationToken)
    {
        var item = new RentalItem(message.CreatedBy, message.CustomerId, message.CustomerName,
            message.ItemName, message.SerialNumber, message.Condition, message.Location, message.Duration);

        _logger.LogInformation("Creating RentalItem: {@Item}", item);

        _rentalServiceRepository.AddRentalItem(item);

        return await _rentalServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
