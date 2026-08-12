namespace TechnicalService.Domain.AggregatesModel.TechnicalAggregate;
public class ServiceStatus : Enumeration
{
    public static ServiceStatus ItemReceived = new(1, "Item Recieved");
    public static ServiceStatus Inspection = new(2, nameof(Inspection));
    public static ServiceStatus AwaitingCustomerConfirm = new(3, "Awaiting Customer Confirm");
    public static ServiceStatus AwaitingSparepart = new(4, "Awaiting Sparepart");
    public static ServiceStatus Repairing = new(5, nameof(Repairing));
    public static ServiceStatus Finished = new(6, nameof(Finished));
    public static ServiceStatus CustomerRejected = new(7, "Customer Rejected");
    public static ServiceStatus Unrepairable = new(8, nameof(Unrepairable));
    public static ServiceStatus RepairByThirdParty = new(9, "Repair by Third-Party");
    public static ServiceStatus Inspecting = new(10, nameof(Inspecting));
    public static ServiceStatus SaleConfirmed = new(11, "Sale Confirmed"); // ✅ NEW
    public static ServiceStatus SentSpareparts = new(12, "Sent Spareparts"); // ✅ NEW

    public ServiceStatus(int id, string name) : base(id, name) { }
}