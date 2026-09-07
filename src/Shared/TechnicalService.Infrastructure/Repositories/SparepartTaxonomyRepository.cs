namespace TechnicalService.Infrastructure.Repositories;

public class SparepartTaxonomyRepository : ISparepartTaxonomyRepository
{
    private readonly TechnicalServiceContext _context;

    public IUnitOfWork UnitOfWork => _context;

    public SparepartTaxonomyRepository(TechnicalServiceContext context)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
    }

    // ── Categories ────────────────────────────────────────────────────────

    public async Task<SparepartCategory> GetCategoryAsync(Guid id) =>
        await _context.SparepartCategories.FindAsync(id);

    public SparepartCategory AddCategory(SparepartCategory category) =>
        _context.SparepartCategories.Add(category).Entity;

    public void RemoveCategory(SparepartCategory category) =>
        _context.SparepartCategories.Remove(category);

    public Task<bool> CategoryNameExistsAsync(string name, Guid? excludeId = null) =>
        _context.SparepartCategories.AsNoTracking()
            .AnyAsync(c => c.Name == name && (excludeId == null || c.Id != excludeId.Value));

    public Task<int> CountTypesInCategoryAsync(Guid categoryId) =>
        _context.SparepartTypes.AsNoTracking().CountAsync(t => t.CategoryId == categoryId);

    public Task<int> CountPartsUsingCategoryAsync(Guid categoryId) =>
        _context.Spareparts.AsNoTracking().CountAsync(s => s.CategoryId == categoryId);

    // ── Types ─────────────────────────────────────────────────────────────

    public async Task<SparepartType> GetTypeAsync(Guid id) =>
        await _context.SparepartTypes.FindAsync(id);

    public SparepartType AddType(SparepartType type) =>
        _context.SparepartTypes.Add(type).Entity;

    public void RemoveType(SparepartType type) =>
        _context.SparepartTypes.Remove(type);

    public Task<bool> TypeNameExistsAsync(Guid categoryId, string name, Guid? excludeId = null) =>
        _context.SparepartTypes.AsNoTracking()
            .AnyAsync(t => t.CategoryId == categoryId
                        && t.Name == name
                        && (excludeId == null || t.Id != excludeId.Value));

    public Task<bool> TypeBelongsToCategoryAsync(Guid typeId, Guid categoryId) =>
        _context.SparepartTypes.AsNoTracking()
            .AnyAsync(t => t.Id == typeId && t.CategoryId == categoryId);

    public Task<int> CountPartsUsingTypeAsync(Guid typeId) =>
        _context.Spareparts.AsNoTracking().CountAsync(s => s.TypeId == typeId);

    // ── Brands ────────────────────────────────────────────────────────────

    public async Task<SparepartBrand> GetBrandAsync(Guid id) =>
        await _context.SparepartBrands.FindAsync(id);

    public SparepartBrand AddBrand(SparepartBrand brand) =>
        _context.SparepartBrands.Add(brand).Entity;

    public void RemoveBrand(SparepartBrand brand) =>
        _context.SparepartBrands.Remove(brand);

    public Task<bool> BrandNameExistsAsync(string name, Guid? excludeId = null) =>
        _context.SparepartBrands.AsNoTracking()
            .AnyAsync(b => b.Name == name && (excludeId == null || b.Id != excludeId.Value));

    public Task<int> CountPartsUsingBrandAsync(Guid brandId) =>
        _context.Spareparts.AsNoTracking().CountAsync(s => s.BrandId == brandId);
}
