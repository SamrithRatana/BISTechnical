using TechnicalService.API.Extensions;
using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class CreateSparepartBrandCommandHandler(
    ISparepartTaxonomyRepository repository,
    ILogger<CreateSparepartBrandCommandHandler> logger)
    : IRequestHandler<CreateSparepartBrandCommand, Guid>
{
    public async Task<Guid> Handle(CreateSparepartBrandCommand command, CancellationToken cancellationToken)
    {
        // Upper-cased before the duplicate check so 'hp' and 'HP' collide here
        // and not only at the unique index.
        var name = SparepartTaxonomyRules.NormalizeBrandName(
            TaxonomyRequestGuards.RequireName(command.Name, nameof(command.Name)));

        if (await repository.BrandNameExistsAsync(name))
        {
            throw new ConflictException($"A brand named '{name}' already exists.", ConflictException.Duplicate);
        }

        var brand = new SparepartBrand(name, command.LogoUrl);
        repository.AddBrand(brand);
        await repository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogInformation("Created sparepart brand {BrandId} '{Name}'", brand.Id, brand.Name);
        return brand.Id;
    }
}
