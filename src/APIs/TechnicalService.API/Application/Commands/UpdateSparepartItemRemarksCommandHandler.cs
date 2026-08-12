using MediatR;
using Microsoft.EntityFrameworkCore;

namespace TechnicalService.API.Application.Commands;

public class UpdateSparepartItemRemarksCommandHandler
    : IRequestHandler<UpdateSparepartItemRemarksCommand, bool>
{
    private readonly TechnicalServiceContext _context;

    public UpdateSparepartItemRemarksCommandHandler(TechnicalServiceContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(
        UpdateSparepartItemRemarksCommand request,
        CancellationToken cancellationToken)
    {
        var item = await _context.SparepartItems
            .FirstOrDefaultAsync(si => si.Id == request.SparepartItemId, cancellationToken);

        if (item is null)
            throw new KeyNotFoundException(
                $"SparepartItem {request.SparepartItemId} not found.");

        // ✅ Only Remarks is touched — Quantity/SparepartId/Condition/IsHoldStatus
        // stay untouched, so the stock-adjust trigger's UPDATE(...) checks
        // all evaluate false and the trigger body no-ops.
        item.UpdateRemarks(request.Remarks);

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}