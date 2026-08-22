namespace TechnicalService.API.Application.Commands;

using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

public class CreateItemCommandHandler
    : IRequestHandler<CreateItemCommand, bool>
{
    private readonly ITechnicalServiceRepository _repairServiceRepository;
    private readonly ILogger<CreateItemCommandHandler> _logger;

    // Using DI to inject infrastructure persitence Repositories
    public CreateItemCommandHandler(
        ITechnicalServiceRepository repairServiceRepository,
        ILogger<CreateItemCommandHandler> logger)
    {
        _repairServiceRepository = repairServiceRepository ?? throw new ArgumentNullException(nameof(repairServiceRepository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<bool> Handle(CreateItemCommand message, CancellationToken cancellationToken)
    {
        var itemType = new ItemType(message.ItemType);
        var item = new Item(message.ItemName, message.SerialNumber, itemType);

        _logger.LogInformation("Creating Item - Item: {@Item}", item);

        _repairServiceRepository.AddItem(item);

        return await _repairServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
