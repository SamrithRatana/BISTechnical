namespace TechnicalService.API.Application.Commands;

public class CreateSparepartCommand : IRequest<bool>
{
    [DataMember]
    public string ItemName { get; private set; }
    [DataMember]
    public string SerialNumber { get; private set; }
    [DataMember]
    public string Description { get; private set; }
    [DataMember]
    public string UseFor { get; private set; }
    [DataMember]
    public string PictureUrl { get; private set; }
    [DataMember]
    public Guid LinkItemId { get; private set; }
    [DataMember]
    public int Quantity { get; private set; } // ✅ ADD THIS LINE
    [DataMember]
    public decimal DefaultPrice { get; private set; } // ✅ ADD


    public CreateSparepartCommand(string itemName, string serialNumber,
         string description, string useFor, string pictureUrl,
         Guid linkItemId, int quantity = 0, decimal defaultPrice = 0) // ✅ ADD
    {
        ItemName = itemName;
        SerialNumber = serialNumber;
        Description = description;
        UseFor = useFor;
        PictureUrl = pictureUrl;
        LinkItemId = linkItemId;
        Quantity = quantity;
        DefaultPrice = defaultPrice; // ✅ ADD
    }
}