namespace TechnicalService.API.Application.Commands;

public class CreateItemCommand : IRequest<bool>
{
    [DataMember]
    public string ItemName { get; private set; }

    [DataMember]
    public string SerialNumber { get; private set; }

    [DataMember]
    public string ItemType { get; private set; }

    public CreateItemCommand(string itemName, string serialNumber, string itemType)
    {
        ItemName = itemName;
        SerialNumber = serialNumber;
        ItemType = itemType;
    }
}
