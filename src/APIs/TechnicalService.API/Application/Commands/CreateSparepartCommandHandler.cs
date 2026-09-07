namespace TechnicalService.API.Application.Commands;

using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

public class CreateSparepartCommandHandler
    : IRequestHandler<CreateSparepartCommand, bool>
{
    private readonly ITechnicalServiceRepository _repairServiceRepository;
    private readonly ISparepartTaxonomyRepository _taxonomy;
    private readonly ILogger<CreateSparepartCommandHandler> _logger;

    // Using DI to inject infrastructure persitence Repositories
    public CreateSparepartCommandHandler(
        ITechnicalServiceRepository repairServiceRepository,
        ISparepartTaxonomyRepository taxonomy,
        ILogger<CreateSparepartCommandHandler> logger)
    {
        _repairServiceRepository = repairServiceRepository ?? throw new ArgumentNullException(nameof(repairServiceRepository));
        _taxonomy = taxonomy ?? throw new ArgumentNullException(nameof(taxonomy));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<bool> Handle(CreateSparepartCommand message, CancellationToken cancellationToken)
    {
        if (message.Classification is { } classification)
        {
            await classification.ValidateAsync(_taxonomy);
        }

        var sparepart = new Sparepart(
            message.ItemName,
            message.SerialNumber,
            message.Description,
            message.UseFor,
            message.PictureUrl,
            message.LinkItemId,
            message.Quantity,
            message.DefaultPrice,
            message.Classification?.CategoryId,
            message.Classification?.TypeId,
            message.Classification?.BrandId);
        _logger.LogInformation("Creating Sparepart - Sparepart: {@Sparepart}", sparepart);
        _repairServiceRepository.AddSparepart(sparepart);
        return await _repairServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
