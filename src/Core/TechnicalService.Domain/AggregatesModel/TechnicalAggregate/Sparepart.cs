using System.ComponentModel.DataAnnotations;
namespace TechnicalService.Domain.AggregatesModel.TechnicalAggregate;
public class Sparepart : Entity
{
    [Required]
    public string ItemName { get; private set; }
    public string SerialNumber { get; private set; }
    public string Description { get; private set; }
    public string UserFor { get; private set; }
    public string PictureUrl { get; private set; }
    public int Quantity { get; private set; }
    public Guid LinkItemId { get; private set; }
    public decimal DefaultPrice { get; private set; } // ✅ ADD THIS

    protected Sparepart() { }

    public Sparepart(string itemName, string serialNumber, string description,
        string useFor, string pictureUrl, Guid linkItemId,
        int quantity = 0, decimal defaultPrice = 0) // ✅ ADD defaultPrice
    {
        ItemName = itemName;
        SerialNumber = serialNumber;
        Description = description;
        UserFor = useFor;
        PictureUrl = pictureUrl;
        Quantity = quantity >= 0 ? quantity : 0;
        LinkItemId = linkItemId;
        DefaultPrice = defaultPrice >= 0 ? defaultPrice : 0; // ✅ ADD
    }

    public void UpdateSparepart(string itemName, string serialNumber, string description,
        string useFor, string pictureUrl, Guid linkItemId,
        int quantity, decimal defaultPrice = 0) // ✅ ADD defaultPrice
    {
        ItemName = itemName;
        SerialNumber = serialNumber;
        Description = description;
        UserFor = useFor;
        PictureUrl = pictureUrl;
        LinkItemId = linkItemId;
        Quantity = quantity >= 0 ? quantity : 0;
        DefaultPrice = defaultPrice >= 0 ? defaultPrice : 0; // ✅ ADD
    }

    public void UpdateQuantity(int newQuantity)
    {
        if (newQuantity < 0)
            throw new ArgumentException("Quantity cannot be negative", nameof(newQuantity));
        Quantity = newQuantity;
    }

    public void AddStock(int amount)
    {
        if (amount <= 0)
            throw new ArgumentException("Amount must be positive", nameof(amount));
        Quantity += amount;
    }

    public bool RemoveStock(int amount)
    {
        if (amount <= 0)
            throw new ArgumentException("Amount must be positive", nameof(amount));
        if (Quantity < amount)
            return false;
        Quantity -= amount;
        return true;
    }
}