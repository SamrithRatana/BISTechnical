namespace TechnicalService.API.Application.Queries;

/// <summary>
/// Read side of the spare-part taxonomy. Separate from
/// <see cref="ITechnicalServiceQueries"/> so that interface and its 3,000-line
/// implementation stop growing.
/// </summary>
public interface ISparepartTaxonomyQueries
{
    Task<List<SparepartCategoryDto>> GetCategoriesAsync(CancellationToken cancellationToken = default);
    Task<List<SparepartTypeDto>> GetTypesAsync(Guid? categoryId, CancellationToken cancellationToken = default);
    Task<List<SparepartBrandDto>> GetBrandsAsync(CancellationToken cancellationToken = default);
}
