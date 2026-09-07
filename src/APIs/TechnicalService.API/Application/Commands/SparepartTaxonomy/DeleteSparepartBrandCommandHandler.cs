using TechnicalService.API.Extensions;
using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class DeleteSparepartBrandCommandHandler(
    ISparepartTaxonomyRepository repository,
    ILogger<DeleteSparepartBrandCommandHandler> logger)
    : IRequestHandler<DeleteSparepartBrandCommand, bool>
{
    public async Task<bool> Handle(DeleteSparepartBrandCommand command, CancellationToken cancellationToken)
    {
        var brand = await repository.GetBrandAsync(command.Id)
            ?? throw new KeyNotFoundException($"Brand {command.Id} not found.");

        var partCount = await repository.CountPartsUsingBrandAsync(brand.Id);
        if (partCount > 0)
        {
            throw new ConflictException(
                $"Brand '{brand.Name}' is used by {partCount} spare part(s).",
                ConflictException.InUse, partCount);
        }

        repository.RemoveBrand(brand);
        var saved = await repository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogInformation("Deleted sparepart brand {BrandId} '{Name}'", brand.Id, brand.Name);
        return saved;
    }
}
