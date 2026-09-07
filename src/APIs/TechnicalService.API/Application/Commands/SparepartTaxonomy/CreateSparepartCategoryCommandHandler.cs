using TechnicalService.API.Extensions;
using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class CreateSparepartCategoryCommandHandler(
    ISparepartTaxonomyRepository repository,
    ILogger<CreateSparepartCategoryCommandHandler> logger)
    : IRequestHandler<CreateSparepartCategoryCommand, Guid>
{
    public async Task<Guid> Handle(CreateSparepartCategoryCommand command, CancellationToken cancellationToken)
    {
        var name = TaxonomyRequestGuards.RequireName(command.Name, nameof(command.Name));

        if (await repository.CategoryNameExistsAsync(name))
        {
            throw new ConflictException($"A category named '{name}' already exists.", ConflictException.Duplicate);
        }

        var category = new SparepartCategory(name, command.Description, command.SortOrder);
        repository.AddCategory(category);
        await repository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogInformation("Created sparepart category {CategoryId} '{Name}'", category.Id, category.Name);
        return category.Id;
    }
}
