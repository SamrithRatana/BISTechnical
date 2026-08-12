// TechnicalService.Domain/AggregatesModel/TechnicalAggregate/SparepartManualStockOut.cs
namespace TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

public class SparepartManualStockOut : Entity
{
    public Guid SparepartId { get; private set; }
    public int Quantity { get; private set; }
    public string Reason { get; private set; }
    public Guid? PerformedBy { get; private set; }
    public DateTime CreatedAt { get; private set; }

    protected SparepartManualStockOut() { }

    public SparepartManualStockOut(
        Guid sparepartId,
        int quantity,
        string reason,
        Guid? performedBy,
        DateTime createdAt)
    {
        SparepartId = sparepartId;
        Quantity = quantity;
        Reason = reason;
        PerformedBy = performedBy;
        CreatedAt = createdAt;
    }
}