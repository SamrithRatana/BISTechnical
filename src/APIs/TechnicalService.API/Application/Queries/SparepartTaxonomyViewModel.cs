namespace TechnicalService.API.Application.Queries;

/// <summary>
/// Read models for the spare-part taxonomy lists. The counts are computed in
/// the same SQL statement as the row (correlated sub-selects), so a list of
/// N categories is one round trip, not N+1.
/// </summary>
public record SparepartCategoryDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public int SortOrder { get; init; }
    /// <summary>Types under this category.</summary>
    public int TypeCount { get; init; }
    /// <summary>Spare parts classified under this category.</summary>
    public int PartCount { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? UpdatedAt { get; init; }
}

public record SparepartTypeDto
{
    public Guid Id { get; init; }
    public Guid CategoryId { get; init; }
    public string CategoryName { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public int SortOrder { get; init; }
    public int PartCount { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? UpdatedAt { get; init; }
}

public record SparepartBrandDto
{
    public Guid Id { get; init; }
    /// <summary>Always upper-case.</summary>
    public string Name { get; init; } = string.Empty;
    public string? LogoUrl { get; init; }
    public int PartCount { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? UpdatedAt { get; init; }
}
