namespace TechnicalService.API.Application.Commands;

public record UpdateSparepartCommand(
    Guid Id,
    string ItemName,
    string SerialNumber,
    string Description,
    string UseFor,
    string PictureUrl,
    Guid LinkItemId,
    int Quantity,
    decimal DefaultPrice = 0) : IRequest<bool>; // ✅ ADD DefaultPrice