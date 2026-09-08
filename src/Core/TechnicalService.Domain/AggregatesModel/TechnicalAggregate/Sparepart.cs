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
    public decimal DefaultPrice { get; private set; }
    public bool IsDraft { get; private set; }

    // ── Classification (all optional; the pre-existing catalogue has none) ──
    // Category → Type is a hierarchy; Brand is independent of both.
    // Referential integrity (the ids exist, the type belongs to the category)
    // is checked by the command handler against the database — the entity
    // only guards the shape.
    public Guid? CategoryId { get; private set; }
    public Guid? TypeId { get; private set; }
    public Guid? BrandId { get; private set; }
    public SparepartCategory Category { get; private set; }
    public SparepartType Type { get; private set; }
    public SparepartBrand Brand { get; private set; }

    protected Sparepart() { }

    public Sparepart(string itemName, string serialNumber, string description,
        string useFor, string pictureUrl, Guid linkItemId,
        int quantity = 0, decimal defaultPrice = 0,
        Guid? categoryId = null, Guid? typeId = null, Guid? brandId = null,
        bool isDraft = false)
    {
        ItemName = itemName;
        SerialNumber = serialNumber;
        Description = description;
        UserFor = useFor;
        PictureUrl = pictureUrl;
        Quantity = quantity >= 0 ? quantity : 0;
        LinkItemId = linkItemId;
        DefaultPrice = defaultPrice >= 0 ? defaultPrice : 0;
        IsDraft = isDraft;
        SetClassification(categoryId, typeId, brandId);
    }

    /// <summary>
    /// Updates the catalogue fields. Deliberately does NOT touch the
    /// classification: <c>PUT /api/spareparts</c> is called by both the web
    /// and the CAM ID phone app, and a client that does not know about
    /// category/type/brand must not wipe them on every edit. Callers that do
    /// carry those fields call <see cref="SetClassification"/> explicitly.
    /// </summary>
    public void UpdateSparepart(string itemName, string serialNumber, string description,
        string useFor, string pictureUrl, Guid linkItemId,
        int quantity, decimal defaultPrice = 0)
    {
        ItemName = itemName;
        SerialNumber = serialNumber;
        Description = description;
        UserFor = useFor;
        PictureUrl = pictureUrl;
        LinkItemId = linkItemId;
        Quantity = quantity >= 0 ? quantity : 0;
        DefaultPrice = defaultPrice >= 0 ? defaultPrice : 0;
    }

    /// <summary>
    /// Sets category / type / brand. <see cref="Guid.Empty"/> is treated as
    /// "none" because the web client sends empty guids for unset selects.
    /// A type without a category is rejected: a type only means something
    /// inside its category.
    /// </summary>
    public void SetClassification(Guid? categoryId, Guid? typeId, Guid? brandId)
    {
        var category = NullIfEmpty(categoryId);
        var type = NullIfEmpty(typeId);

        if (type.HasValue && !category.HasValue)
            throw new TechnicalServiceDomainException("A spare-part type requires a category.");

        CategoryId = category;
        TypeId = type;
        BrandId = NullIfEmpty(brandId);
    }

    private static Guid? NullIfEmpty(Guid? id) =>
        id.HasValue && id.Value != Guid.Empty ? id : null;

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

    public void SetDraft(bool isDraft)
    {
        IsDraft = isDraft;
    }
}