using TechnicalService.API.Extensions;
using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

/// <summary>
/// The category / type / brand a spare part is filed under. Carried as ONE
/// optional object on the create/update payloads rather than three loose
/// fields, so "the client did not send a classification" (object absent →
/// leave the part as it is) is distinguishable from "the client cleared it"
/// (object present with null ids). The CAM ID phone app still sends the
/// pre-taxonomy payload, and its edits must not wipe what the web set.
/// </summary>
public record SparepartClassification(Guid? CategoryId, Guid? TypeId, Guid? BrandId)
{
    /// <summary>
    /// Confirms every referenced row exists and the type sits inside the
    /// category. Body-field mistakes are 400s, not 404s. <see cref="Guid.Empty"/>
    /// is "none", matching <see cref="Sparepart.SetClassification"/>.
    /// </summary>
    public async Task ValidateAsync(ISparepartTaxonomyRepository taxonomy)
    {
        var categoryId = NullIfEmpty(CategoryId);
        var typeId = NullIfEmpty(TypeId);
        var brandId = NullIfEmpty(BrandId);

        if (categoryId is { } category && await taxonomy.GetCategoryAsync(category) is null)
        {
            throw new RequestValidationException($"Category {category} does not exist.");
        }

        if (typeId is { } type)
        {
            if (categoryId is null)
            {
                throw new RequestValidationException("A type requires its category to be set as well.");
            }
            if (!await taxonomy.TypeBelongsToCategoryAsync(type, categoryId.Value))
            {
                throw new RequestValidationException($"Type {type} does not exist in category {categoryId}.");
            }
        }

        if (brandId is { } brand && await taxonomy.GetBrandAsync(brand) is null)
        {
            throw new RequestValidationException($"Brand {brand} does not exist.");
        }
    }

    // Must agree with Sparepart.NullIfEmpty in the Domain project (which this
    // project cannot be referenced from): what is validated here is exactly
    // what SetClassification will store.
    private static Guid? NullIfEmpty(Guid? id) =>
        id.HasValue && id.Value != Guid.Empty ? id : null;
}
