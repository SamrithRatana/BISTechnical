namespace TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

/// <summary>
/// Manufacturer of a spare part ("HP", "CANON", …). Independent of the
/// category/type hierarchy — one brand spans printer and photocopier parts.
/// The name is always stored upper-case (see
/// <see cref="SparepartTaxonomyRules.NormalizeBrandName"/>); the logo is optional.
/// </summary>
public class SparepartBrand : Entity, IAggregateRoot
{
    public string Name { get; private set; }
    public string LogoUrl { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    protected SparepartBrand() { }

    public SparepartBrand(string name, string logoUrl = null)
    {
        Name = SparepartTaxonomyRules.NormalizeBrandName(name);
        LogoUrl = SparepartTaxonomyRules.NormalizeLogoUrl(logoUrl);
        CreatedAt = DateTime.UtcNow;
    }

    public void Update(string name, string logoUrl)
    {
        Name = SparepartTaxonomyRules.NormalizeBrandName(name);
        LogoUrl = SparepartTaxonomyRules.NormalizeLogoUrl(logoUrl);
        UpdatedAt = DateTime.UtcNow;
    }
}
