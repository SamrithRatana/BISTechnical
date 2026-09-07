using TechnicalService.API.Extensions;
using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

/// <summary>
/// Request-boundary checks shared by the Category / Type / Brand handlers.
/// These reject what a client got wrong (400) before the aggregate is built;
/// the aggregate's own constructor is the second line and throws
/// <c>TechnicalServiceDomainException</c>, which maps to 400 as well.
/// </summary>
internal static class TaxonomyRequestGuards
{
    public static string RequireName(string value, string field)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            throw new RequestValidationException($"'{field}' is required.");
        }
        if (trimmed.Length > SparepartTaxonomyRules.NameMaxLength)
        {
            throw new RequestValidationException(
                $"'{field}' cannot exceed {SparepartTaxonomyRules.NameMaxLength} characters.");
        }
        return trimmed;
    }

    public static Guid RequireId(Guid id, string field)
    {
        if (id == Guid.Empty)
        {
            throw new RequestValidationException($"'{field}' is required.");
        }
        return id;
    }
}
