namespace TechnicalService.API.Application.Commands;

public class CreateRentalItemCommand : IRequest<bool>
{
    [DataMember]
    public Guid CreatedBy { get; private set; }

    [DataMember]
    public Guid CustomerId { get; private set; }

    [DataMember]
    public string CustomerName { get; private set; }

    [DataMember]
    public string ItemName { get; private set; }

    [DataMember]
    public string SerialNumber { get; private set; }

    [DataMember]
    public string Condition { get; private set; }

    [DataMember]
    public string Location { get; private set; }

    [DataMember]
    public int Duration { get; private set; }

    public CreateRentalItemCommand(Guid createdBy, Guid customerId, string customerName, string itemName,
        string serialNumber, string condition, string location, int duration)
    {
        CreatedBy = createdBy;
        CustomerId = customerId;
        CustomerName = customerName;
        ItemName = itemName;
        SerialNumber = serialNumber;
        Condition = condition;
        Location = location;
        Duration = duration;
    }
}