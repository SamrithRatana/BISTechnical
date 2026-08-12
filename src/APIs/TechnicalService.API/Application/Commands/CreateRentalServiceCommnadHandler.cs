using TechnicalService.Domain.AggregatesModel.RentalAggregate;

namespace TechnicalService.API.Application.Commands;

public class CreateRentalServiceCommnadHandler : IRequestHandler<CreateRentalServiceCommand, bool>
{
    private readonly IRentalServiceRepository _rentalServiceRepository;
    private readonly IMediator _mediator;
    private readonly ILogger<CreateRentalServiceCommnadHandler> _logger;

    // Using DI to inject infrastructure persistence Repositories
    public CreateRentalServiceCommnadHandler(IMediator mediator,
        IRentalServiceRepository rentalServiceRepository,
        ILogger<CreateRentalServiceCommnadHandler> logger)
    {
        _rentalServiceRepository = rentalServiceRepository ?? throw new ArgumentNullException(nameof(rentalServiceRepository));
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<bool> Handle(CreateRentalServiceCommand command, CancellationToken cancellationToken)
    {
        var rentalService = new RentalService(command.RentalItemId, command.Date, command.Note,
            Enum.Parse<ActionType>(command.Action), command.UserId);

        // Add Sparepart
        foreach (var sparepart in command.Spareparts)
        {
            rentalService.AddSparepart(sparepart.SparepartId, sparepart.Description, sparepart.Quantity, Enum.Parse<SparepartCondition>(sparepart.Condition));
        }

        _rentalServiceRepository.CreateRentalService(rentalService);

        _logger.LogInformation("Creating RentalService: {@RentalService}", rentalService);

        return await _rentalServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}