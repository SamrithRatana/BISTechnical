namespace TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

public class SparepartStockAuditLog
{
    public Guid Id { get; set; }
    public Guid SparepartId { get; set; }
    public Guid? ServiceId { get; set; }
    public string OperationType { get; set; }
    public int QuantityChange { get; set; }
    public int OldQuantity { get; set; }
    public int NewQuantity { get; set; }
    public DateTime Timestamp { get; set; }
    public Guid? PerformedBy { get; set; }
    public string Remarks { get; set; }

}