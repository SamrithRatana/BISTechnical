using TechnicalService.API.Extensions;
using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class UpdateSparepartCategoryCommandHandler(
    ISparepartTaxonomyRepository repository,
    ILogger<UpdateSparepartCategoryCommandHandler> logger)
    : IRequestHandler<UpdateSparepartCategoryCommand, bool>
{
    public async Task<bool> Handle(UpdateSparepartCategoryCommand command, CancellationToken cancellationToken)
    {
        var name = TaxonomyRequestGuards.RequireName(command.Name, nameof(command.Name));

        var category = await repository.GetCategoryAsync(command.Id)
            ?? throw new KeyNotFoundException($"Category {command.Id} not found.");

        if (await repository.CategoryNameExistsAsync(name, excludeId: category.Id))
        {
            throw new ConflictException($"A category named '{name}' already exists.", ConflictException.Duplicate);
        }

        category.Update(name, command.Description, command.SortOrder);
        var saved = await repository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogInformation("Updated sparepart category {CategoryId} '{Name}'", category.Id, category.Name);
        return saved;
    }
}
