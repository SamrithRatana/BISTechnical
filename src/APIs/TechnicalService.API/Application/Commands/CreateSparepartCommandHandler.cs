namespace TechnicalService.API.Application.Commands;

using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

public class CreateSparepartCommandHandler
    : IRequestHandler<CreateSparepartCommand, bool>
{
    private readonly ITechnicalServiceRepository _repairServiceRepository;
    private readonly ILogger<CreateSparepartCommandHandler> _logger;

    // Using DI to inject infrastructure persitence Repositories
    public CreateSparepartCommandHandler(
        ITechnicalServiceRepository repairServiceRepository,
        ILogger<CreateSparepartCommandHandler> logger)
    {
        _repairServiceRepository = repairServiceRepository ?? throw new ArgumentNullException(nameof(repairServiceRepository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<bool> Handle(CreateSparepartCommand message, CancellationToken cancellationToken)
    {
        var sparepart = new Sparepart(
            message.ItemName,
            message.SerialNumber,
            message.Description,
            message.UseFor,
            message.PictureUrl,
            message.LinkItemId,
            message.Quantity,
                message.DefaultPrice);
        _logger.LogInformation("Creating Sparepart - Sparepart: {@Sparepart}", sparepart);
        _repairServiceRepository.AddSparepart(sparepart);
        return await _repairServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
