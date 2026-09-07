namespace TechnicalService.API.Application.Queries;

/// <summary>
/// Lookup lists are small (tens of rows) and are returned whole, ordered for
/// display; paging them would only add a round trip to every dropdown.
/// </summary>
public class SparepartTaxonomyQueries(TechnicalServiceContext context) : ISparepartTaxonomyQueries
{
    public Task<List<SparepartCategoryDto>> GetCategoriesAsync(CancellationToken cancellationToken = default) =>
        context.SparepartCategories
            .AsNoTracking()
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .Select(c => new SparepartCategoryDto
            {
                Id = c.Id,
                Name = c.Name,
                Description = c.Description,
                SortOrder = c.SortOrder,
                TypeCount = context.SparepartTypes.Count(t => t.CategoryId == c.Id),
                PartCount = context.Spareparts.Count(s => s.CategoryId == c.Id),
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt,
            })
            .ToListAsync(cancellationToken);

    public Task<List<SparepartTypeDto>> GetTypesAsync(Guid? categoryId, CancellationToken cancellationToken = default)
    {
        var types = context.SparepartTypes.AsNoTracking();

        if (categoryId.HasValue && categoryId.Value != Guid.Empty)
        {
            types = types.Where(t => t.CategoryId == categoryId.Value);
        }

        return types
            .OrderBy(t => t.Category.SortOrder)
            .ThenBy(t => t.Category.Name)
            .ThenBy(t => t.SortOrder)
            .ThenBy(t => t.Name)
            .Select(t => new SparepartTypeDto
            {
                Id = t.Id,
                CategoryId = t.CategoryId,
                CategoryName = t.Category.Name,
                Name = t.Name,
                Description = t.Description,
                SortOrder = t.SortOrder,
                PartCount = context.Spareparts.Count(s => s.TypeId == t.Id),
                CreatedAt = t.CreatedAt,
                UpdatedAt = t.UpdatedAt,
            })
            .ToListAsync(cancellationToken);
    }

    public Task<List<SparepartBrandDto>> GetBrandsAsync(CancellationToken cancellationToken = default) =>
        context.SparepartBrands
            .AsNoTracking()
            .OrderBy(b => b.Name)
            .Select(b => new SparepartBrandDto
            {
                Id = b.Id,
                Name = b.Name,
                LogoUrl = b.LogoUrl,
                PartCount = context.Spareparts.Count(s => s.BrandId == b.Id),
                CreatedAt = b.CreatedAt,
                UpdatedAt = b.UpdatedAt,
            })
            .ToListAsync(cancellationToken);
}
