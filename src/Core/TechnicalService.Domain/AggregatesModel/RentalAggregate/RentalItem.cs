using System.Net;
using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.Domain.AggregatesModel.RentalAggregate;

public class RentalItem : Entity
{
    public Guid CreatedBy { get; private set; }

    public DateTime CreatedAt { get; private set; }

    public Guid CustomerId { get; private set; }

    public string CustomerName { get; private set; }

    public String ItemName { get; private set; }

    public string SerialNumber { get; private set; }

    public string Condition { get; private set; }

    public string Location { get; private set; }

    public int Duration { get; private set; }

    protected RentalItem()
    {
    }

    public RentalItem(Guid createdBy, Guid customerId, string customerName, string itemName,
        string serialNumber, string condition, string location, int duration) : this()
    {
        CreatedBy = createdBy;
        CreatedAt = DateTime.Now;
        CustomerId = customerId;
        CustomerName = customerName;
        ItemName = itemName;
        SerialNumber = serialNumber;
        Condition = condition;
        Location = location;
        Duration = duration;
        
        // Add Domain Event
    }
}
