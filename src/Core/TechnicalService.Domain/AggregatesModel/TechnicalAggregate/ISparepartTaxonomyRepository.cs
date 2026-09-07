namespace TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

/// <summary>
/// Persistence for the three spare-part lookup aggregates. Separate from
/// <see cref="ITechnicalServiceRepository"/> so that file does not keep
/// growing; shares the same unit of work (the DbContext).
///
/// Updates are done on the tracked entity followed by
/// <see cref="IUnitOfWork.SaveEntitiesAsync"/>, the same way spare parts are
/// updated today. The *Exists / Count* members exist so command handlers can
/// answer "duplicate name?" and "still in use?" without touching the DbContext
/// themselves.
/// </summary>
public interface ISparepartTaxonomyRepository : IRepository<SparepartCategory>
{
    // ── Categories ────────────────────────────────────────────────────────
    Task<SparepartCategory> GetCategoryAsync(Guid id);
    SparepartCategory AddCategory(SparepartCategory category);
    void RemoveCategory(SparepartCategory category);
    Task<bool> CategoryNameExistsAsync(string name, Guid? excludeId = null);
    Task<int> CountTypesInCategoryAsync(Guid categoryId);
    Task<int> CountPartsUsingCategoryAsync(Guid categoryId);

    // ── Types ─────────────────────────────────────────────────────────────
    Task<SparepartType> GetTypeAsync(Guid id);
    SparepartType AddType(SparepartType type);
    void RemoveType(SparepartType type);
    Task<bool> TypeNameExistsAsync(Guid categoryId, string name, Guid? excludeId = null);
    Task<bool> TypeBelongsToCategoryAsync(Guid typeId, Guid categoryId);
    Task<int> CountPartsUsingTypeAsync(Guid typeId);

    // ── Brands ────────────────────────────────────────────────────────────
    Task<SparepartBrand> GetBrandAsync(Guid id);
    SparepartBrand AddBrand(SparepartBrand brand);
    void RemoveBrand(SparepartBrand brand);
    Task<bool> BrandNameExistsAsync(string name, Guid? excludeId = null);
    Task<int> CountPartsUsingBrandAsync(Guid brandId);
}
