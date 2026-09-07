namespace TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

/// <summary>
/// Invariants shared by the three spare-part lookup aggregates
/// (<see cref="SparepartCategory"/>, <see cref="SparepartType"/>, <see cref="SparepartBrand"/>).
/// Kept in one place so a name that is valid for a category is valid for a
/// type and a brand, and so the column widths in the EF configurations and
/// <c>sql/sparepart-taxonomy.sql</c> have a single source.
/// </summary>
public static class SparepartTaxonomyRules
{
    public const int NameMaxLength = 100;
    public const int DescriptionMaxLength = 500;
    public const int LogoUrlMaxLength = 1000;

    /// <summary>Trims, requires non-empty, and enforces <see cref="NameMaxLength"/>.</summary>
    public static string NormalizeName(string name, string entityLabel)
    {
        var trimmed = name?.Trim();
        if (string.IsNullOrEmpty(trimmed))
            throw new TechnicalServiceDomainException($"{entityLabel} name is required.");
        if (trimmed.Length > NameMaxLength)
            throw new TechnicalServiceDomainException($"{entityLabel} name cannot exceed {NameMaxLength} characters.");
        return trimmed;
    }

    /// <summary>
    /// Brand names are stored upper-case, always. Latin letters are folded here;
    /// scripts without case (Khmer) pass through unchanged, and the database
    /// CHECK constraint enforces the same rule for writes that bypass the API.
    /// </summary>
    public static string NormalizeBrandName(string name) =>
        NormalizeName(name, "Brand").ToUpperInvariant();

    /// <summary>Optional free text: empty becomes null, length capped.</summary>
    public static string NormalizeDescription(string description)
    {
        var trimmed = description?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return null;
        if (trimmed.Length > DescriptionMaxLength)
            throw new TechnicalServiceDomainException($"Description cannot exceed {DescriptionMaxLength} characters.");
        return trimmed;
    }

    /// <summary>Optional logo URL: empty becomes null, must be an absolute http(s) URL.</summary>
    public static string NormalizeLogoUrl(string logoUrl)
    {
        var trimmed = logoUrl?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return null;
        if (trimmed.Length > LogoUrlMaxLength)
            throw new TechnicalServiceDomainException($"Logo URL cannot exceed {LogoUrlMaxLength} characters.");
        if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp))
            throw new TechnicalServiceDomainException("Logo URL must be an absolute http(s) URL.");
        return trimmed;
    }

    /// <summary>Sort order is a non-negative position; anything below zero clamps to zero.</summary>
    public static int NormalizeSortOrder(int sortOrder) => sortOrder < 0 ? 0 : sortOrder;
}
