using TechnicalService.API.Extensions;
using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

/// <summary>
/// A part can only be deleted while nothing refers to it: no ticket line
/// (<c>SparepartItems</c>) and no stock movement in the audit ledger
/// (<c>SparepartStockAuditLog</c>, whose FK to Spareparts is NO ACTION — the
/// ledger is never deleted). In practice that means a part created with a
/// starting quantity of zero and never moved; anything with history stays,
/// and the 409 says why.
///
/// Only the ledger check is backed by a database constraint. There is NO FK
/// from <c>SparepartItems.SparepartId</c> to <c>Spareparts</c> (the table
/// already holds 33 lines pointing at parts deleted before this endpoint
/// existed), so a ticket line inserted between the count below and the save
/// would be orphaned. Adding that FK needs those orphans cleaned up first —
/// an open item, not something to do silently here.
/// </summary>
public class DeleteSparepartCommandHandler(
    ITechnicalServiceRepository repository,
    ILogger<DeleteSparepartCommandHandler> logger)
    : IRequestHandler<DeleteSparepartCommand, bool>
{
    public async Task<bool> Handle(DeleteSparepartCommand command, CancellationToken cancellationToken)
    {
        var sparepart = await repository.GetSparepartAsync(command.SparepartId)
            ?? throw new KeyNotFoundException($"Sparepart {command.SparepartId} not found.");

        var ticketLines = await repository.CountSparepartTicketLinesAsync(sparepart.Id);
        if (ticketLines > 0)
        {
            throw new ConflictException(
                $"'{sparepart.ItemName}' is used on {ticketLines} service ticket line(s).",
                ConflictException.InUse, ticketLines);
        }

        var movements = await repository.CountSparepartStockMovementsAsync(sparepart.Id);
        if (movements > 0)
        {
            throw new ConflictException(
                $"'{sparepart.ItemName}' has {movements} stock movement(s) in the audit ledger and cannot be deleted.",
                ConflictException.InUse, movements);
        }

        repository.DeleteSparepart(sparepart);
        var saved = await repository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

        logger.LogInformation("Deleted sparepart {SparepartId} '{ItemName}'", sparepart.Id, sparepart.ItemName);
        return saved;
    }
}
