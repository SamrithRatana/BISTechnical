namespace TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

/// <summary>
/// Second level of the spare-part taxonomy ("ADF", "PrintHead", "Cable", …).
/// Scoped to its <see cref="SparepartCategory"/>: the same name may exist
/// under two different categories, but not twice under one.
/// </summary>
public class SparepartType : Entity, IAggregateRoot
{
    public Guid CategoryId { get; private set; }
    public SparepartCategory Category { get; private set; }
    public string Name { get; private set; }
    public string Description { get; private set; }
    public int SortOrder { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    protected SparepartType() { }

    public SparepartType(Guid categoryId, string name, string description = null, int sortOrder = 0)
    {
        CategoryId = RequireCategory(categoryId);
        Name = SparepartTaxonomyRules.NormalizeName(name, "Type");
        Description = SparepartTaxonomyRules.NormalizeDescription(description);
        SortOrder = SparepartTaxonomyRules.NormalizeSortOrder(sortOrder);
        CreatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Re-parenting (a different <paramref name="categoryId"/>) is only valid
    /// while no spare part uses this type: parts carry their own
    /// <c>CategoryId</c>, and moving the type would leave them pointing at a
    /// type outside their category. The command handler must refuse it via
    /// <see cref="ISparepartTaxonomyRepository.CountPartsUsingTypeAsync"/>.
    /// </summary>
    public void Update(Guid categoryId, string name, string description, int sortOrder)
    {
        CategoryId = RequireCategory(categoryId);
        Name = SparepartTaxonomyRules.NormalizeName(name, "Type");
        Description = SparepartTaxonomyRules.NormalizeDescription(description);
        SortOrder = SparepartTaxonomyRules.NormalizeSortOrder(sortOrder);
        UpdatedAt = DateTime.UtcNow;
    }

    private static Guid RequireCategory(Guid categoryId)
    {
        if (categoryId == Guid.Empty)
            throw new TechnicalServiceDomainException("A type must belong to a category.");
        return categoryId;
    }
}
