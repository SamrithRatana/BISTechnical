using TechnicalService.API.Extensions;
using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class DeleteSparepartTypeCommandHandler(
    ISparepartTaxonomyRepository repository,
    ILogger<DeleteSparepartTypeCommandHandler> logger)
    : IRequestHandler<DeleteSparepartTypeCommand, bool>
{
    public async Task<bool> Handle(DeleteSparepartTypeCommand command, CancellationToken cancellationToken)
    {
        var type = await repository.GetTypeAsync(command.Id)
            ?? throw new KeyNotFoundException($"Type {command.Id} not found.");

        var partCount = await repository.CountPartsUsingTypeAsync(type.Id);
        if (partCount > 0)
        {
            throw new ConflictException(
                $"Type '{type.Name}' is used by {partCount} spare part(s).",
                ConflictException.InUse, partCount);
        }

        repository.RemoveType(type);
        var saved = await repository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogInformation("Deleted sparepart type {TypeId} '{Name}'", type.Id, type.Name);
        return saved;
    }
}
