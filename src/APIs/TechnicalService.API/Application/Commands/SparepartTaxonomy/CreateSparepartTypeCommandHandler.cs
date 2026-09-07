using TechnicalService.API.Extensions;
using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class CreateSparepartTypeCommandHandler(
    ISparepartTaxonomyRepository repository,
    ILogger<CreateSparepartTypeCommandHandler> logger)
    : IRequestHandler<CreateSparepartTypeCommand, Guid>
{
    public async Task<Guid> Handle(CreateSparepartTypeCommand command, CancellationToken cancellationToken)
    {
        var categoryId = TaxonomyRequestGuards.RequireId(command.CategoryId, nameof(command.CategoryId));
        var name = TaxonomyRequestGuards.RequireName(command.Name, nameof(command.Name));

        // The category is a body field, so a missing one is the client's
        // mistake (400), not a missing resource (404).
        if (await repository.GetCategoryAsync(categoryId) is null)
        {
            throw new RequestValidationException($"Category {categoryId} does not exist.");
        }

        if (await repository.TypeNameExistsAsync(categoryId, name))
        {
            throw new ConflictException(
                $"A type named '{name}' already exists in this category.", ConflictException.Duplicate);
        }

        var type = new SparepartType(categoryId, name, command.Description, command.SortOrder);
        repository.AddType(type);
        await repository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogInformation("Created sparepart type {TypeId} '{Name}' in category {CategoryId}",
            type.Id, type.Name, categoryId);
        return type.Id;
    }
}
