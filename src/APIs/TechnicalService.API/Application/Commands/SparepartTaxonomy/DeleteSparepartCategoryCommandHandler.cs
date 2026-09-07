using TechnicalService.API.Extensions;
using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

/// <summary>
/// Deletes a category that nothing references. A category still carrying
/// types or spare parts is refused with a 409 naming the count — the
/// database FKs (NO ACTION) enforce the same rule if the check is raced.
/// </summary>
public class DeleteSparepartCategoryCommandHandler(
    ISparepartTaxonomyRepository repository,
    ILogger<DeleteSparepartCategoryCommandHandler> logger)
    : IRequestHandler<DeleteSparepartCategoryCommand, bool>
{
    public async Task<bool> Handle(DeleteSparepartCategoryCommand command, CancellationToken cancellationToken)
    {
        var category = await repository.GetCategoryAsync(command.Id)
            ?? throw new KeyNotFoundException($"Category {command.Id} not found.");

        var typeCount = await repository.CountTypesInCategoryAsync(category.Id);
        if (typeCount > 0)
        {
            throw new ConflictException(
                $"Category '{category.Name}' still has {typeCount} type(s). Delete or move them first.",
                ConflictException.InUse, typeCount);
        }

        var partCount = await repository.CountPartsUsingCategoryAsync(category.Id);
        if (partCount > 0)
        {
            throw new ConflictException(
                $"Category '{category.Name}' is used by {partCount} spare part(s).",
                ConflictException.InUse, partCount);
        }

        repository.RemoveCategory(category);
        var saved = await repository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogInformation("Deleted sparepart category {CategoryId} '{Name}'", category.Id, category.Name);
        return saved;
    }
}
