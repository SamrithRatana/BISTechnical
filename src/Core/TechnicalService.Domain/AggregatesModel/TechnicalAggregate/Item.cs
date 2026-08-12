using System.ComponentModel.DataAnnotations;

namespace TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

public class Item
    : Entity
{
    [Required]
    public string ItemName { get; private set; }

    public string SerialNumber { get; private set; }

    [Required]
    public ItemType ItemType { get; private set; }

    protected Item() { }

    public Item(string itemName, string serialNumber, ItemType itemType)
    {
        ItemName = itemName;
        SerialNumber = serialNumber;
        ItemType = itemType;
    }

    public void UpdateItem(string itemName, string serialNumber, string itemType)
    {
        ItemName = itemName;
        SerialNumber = serialNumber;
        ItemType = (itemType != null) ? new ItemType(itemType) : new ItemType("Toner");
    }
}
