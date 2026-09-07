namespace TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

/// <summary>
/// Top level of the spare-part taxonomy ("Printer part", "Photocopy part", …).
/// A <see cref="SparepartType"/> always belongs to exactly one category.
/// </summary>
public class SparepartCategory : Entity, IAggregateRoot
{
    public string Name { get; private set; }
    public string Description { get; private set; }
    public int SortOrder { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    protected SparepartCategory() { }

    public SparepartCategory(string name, string description = null, int sortOrder = 0)
    {
        Name = SparepartTaxonomyRules.NormalizeName(name, "Category");
        Description = SparepartTaxonomyRules.NormalizeDescription(description);
        SortOrder = SparepartTaxonomyRules.NormalizeSortOrder(sortOrder);
        CreatedAt = DateTime.UtcNow;
    }

    public void Update(string name, string description, int sortOrder)
    {
        Name = SparepartTaxonomyRules.NormalizeName(name, "Category");
        Description = SparepartTaxonomyRules.NormalizeDescription(description);
        SortOrder = SparepartTaxonomyRules.NormalizeSortOrder(sortOrder);
        UpdatedAt = DateTime.UtcNow;
    }
}
