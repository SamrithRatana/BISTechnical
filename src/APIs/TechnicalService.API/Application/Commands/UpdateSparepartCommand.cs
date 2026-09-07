namespace TechnicalService.API.Application.Commands;

/// <summary>
/// Bound straight from the <c>PUT /api/spareparts</c> body.
/// <paramref name="Classification"/> is optional: absent leaves the part's
/// category / type / brand untouched (the phone app never sends it), present
/// replaces all three — see <see cref="SparepartClassification"/>.
/// </summary>
public record UpdateSparepartCommand(
    Guid Id,
    string ItemName,
    string SerialNumber,
    string Description,
    string UseFor,
    string PictureUrl,
    Guid LinkItemId,
    int Quantity,
    decimal DefaultPrice = 0,
    SparepartClassification? Classification = null) : IRequest<bool>;
