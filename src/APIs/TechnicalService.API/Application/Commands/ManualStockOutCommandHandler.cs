// TechnicalService.API/Application/Commands/ManualStockOutCommandHandler.cs
using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class ManualStockOutCommandHandler(
    TechnicalServiceContext context,
    ILogger<ManualStockOutCommandHandler> logger)
    : IRequestHandler<ManualStockOutCommand, bool>
{
    public async Task<bool> Handle(
     ManualStockOutCommand request,
     CancellationToken cancellationToken)
    {
        var sparepart = await context.Spareparts
            .FirstOrDefaultAsync(s => s.Id == request.SparepartId, cancellationToken);

        if (sparepart is null)
            throw new KeyNotFoundException($"Sparepart {request.SparepartId} not found.");

        if (sparepart.Quantity < request.Quantity)
            throw new InvalidOperationException(
                $"Insufficient stock for: {sparepart.ItemName}. " +
                $"Available: {sparepart.Quantity}, Required: {request.Quantity}");

        // ── INSERT via Entity (ជៀសវាង ExecuteSqlRaw + DBNull issue) ──────
        var manualStockOut = new SparepartManualStockOut(
            sparepartId: request.SparepartId,
            quantity: request.Quantity,
            reason: request.Reason ?? string.Empty,
            performedBy: request.PerformedBy,   // Guid? — null is fine
            createdAt: DateTime.UtcNow);

        context.SparepartManualStockOuts.Add(manualStockOut);

        await context.SaveEntitiesAsync(cancellationToken);

        logger.LogInformation(
            "ManualStockOut: -{Qty} from {ItemName}. Reason: {Reason}",
            request.Quantity, sparepart.ItemName, request.Reason);

        return true;
    }
}