using TechnicalService.API.Extensions;
using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

/// <summary>
/// Renames / re-orders a type. Moving it to another category is allowed only
/// while no spare part uses it: parts carry their own <c>CategoryId</c>, and
/// re-parenting the type would leave them pointing at a type outside their
/// category (see <see cref="SparepartType.Update"/>).
/// </summary>
public class UpdateSparepartTypeCommandHandler(
    ISparepartTaxonomyRepository repository,
    ILogger<UpdateSparepartTypeCommandHandler> logger)
    : IRequestHandler<UpdateSparepartTypeCommand, bool>
{
    public async Task<bool> Handle(UpdateSparepartTypeCommand command, CancellationToken cancellationToken)
    {
        var categoryId = TaxonomyRequestGuards.RequireId(command.CategoryId, nameof(command.CategoryId));
        var name = TaxonomyRequestGuards.RequireName(command.Name, nameof(command.Name));

        var type = await repository.GetTypeAsync(command.Id)
            ?? throw new KeyNotFoundException($"Type {command.Id} not found.");

        if (categoryId != type.CategoryId)
        {
            if (await repository.GetCategoryAsync(categoryId) is null)
            {
                throw new RequestValidationException($"Category {categoryId} does not exist.");
            }

            var partCount = await repository.CountPartsUsingTypeAsync(type.Id);
            if (partCount > 0)
            {
                throw new ConflictException(
                    $"Type '{type.Name}' is used by {partCount} spare part(s) and cannot be moved to another category.",
                    ConflictException.InUse, partCount);
            }
        }

        if (await repository.TypeNameExistsAsync(categoryId, name, excludeId: type.Id))
        {
            throw new ConflictException(
                $"A type named '{name}' already exists in this category.", ConflictException.Duplicate);
        }

        type.Update(categoryId, name, command.Description, command.SortOrder);
        var saved = await repository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogInformation("Updated sparepart type {TypeId} '{Name}'", type.Id, type.Name);
        return saved;
    }
}
