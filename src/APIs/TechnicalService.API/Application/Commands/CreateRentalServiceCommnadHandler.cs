using TechnicalService.Domain.AggregatesModel.RentalAggregate;

using TechnicalService.API.Extensions;
namespace TechnicalService.API.Application.Commands;

public class CreateRentalServiceCommnadHandler : IRequestHandler<CreateRentalServiceCommand, bool>
{
    private readonly IRentalServiceRepository _rentalServiceRepository;
    private readonly ILogger<CreateRentalServiceCommnadHandler> _logger;

    // Using DI to inject infrastructure persistence Repositories
    public CreateRentalServiceCommnadHandler(
        IRentalServiceRepository rentalServiceRepository,
        ILogger<CreateRentalServiceCommnadHandler> logger)
    {
        _rentalServiceRepository = rentalServiceRepository ?? throw new ArgumentNullException(nameof(rentalServiceRepository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<bool> Handle(CreateRentalServiceCommand command, CancellationToken cancellationToken)
    {
        var rentalService = new RentalService(command.RentalItemId, command.Date, command.Note,
            EnumParsing.Parse<ActionType>(command.Action, "Action"), command.UserId);

        // Add Sparepart
        foreach (var sparepart in command.Spareparts)
        {
            rentalService.AddSparepart(sparepart.SparepartId, sparepart.Description, sparepart.Quantity, EnumParsing.Parse<SparepartCondition>(sparepart.Condition, "Condition"));
        }

        _rentalServiceRepository.CreateRentalService(rentalService);

        _logger.LogInformation("Creating RentalService: {@RentalService}", rentalService);

        return await _rentalServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}