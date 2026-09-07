using TechnicalService.API.Extensions;
using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class UpdateSparepartBrandCommandHandler(
    ISparepartTaxonomyRepository repository,
    ILogger<UpdateSparepartBrandCommandHandler> logger)
    : IRequestHandler<UpdateSparepartBrandCommand, bool>
{
    public async Task<bool> Handle(UpdateSparepartBrandCommand command, CancellationToken cancellationToken)
    {
        var name = SparepartTaxonomyRules.NormalizeBrandName(
            TaxonomyRequestGuards.RequireName(command.Name, nameof(command.Name)));

        var brand = await repository.GetBrandAsync(command.Id)
            ?? throw new KeyNotFoundException($"Brand {command.Id} not found.");

        if (await repository.BrandNameExistsAsync(name, excludeId: brand.Id))
        {
            throw new ConflictException($"A brand named '{name}' already exists.", ConflictException.Duplicate);
        }

        brand.Update(name, command.LogoUrl);
        var saved = await repository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogInformation("Updated sparepart brand {BrandId} '{Name}'", brand.Id, brand.Name);
        return saved;
    }
}
