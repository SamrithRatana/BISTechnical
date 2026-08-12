namespace TechnicalService.API.Application.Commands;

using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

public class CreateItemCommandHandler
    : IRequestHandler<CreateItemCommand, bool>
{
    private readonly ITechnicalServiceRepository _repairServiceRepository;
    private readonly IMediator _mediator;
    private readonly ILogger<CreateItemCommandHandler> _logger;

    // Using DI to inject infrastructure persitence Repositories
    public CreateItemCommandHandler(IMediator mediator,
        ITechnicalServiceRepository repairServiceRepository,
        ILogger<CreateItemCommandHandler> logger)
    {
        _repairServiceRepository = repairServiceRepository ?? throw new ArgumentNullException(nameof(repairServiceRepository));
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
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
