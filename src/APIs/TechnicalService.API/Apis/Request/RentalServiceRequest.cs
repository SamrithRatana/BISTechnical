
using TechnicalService.API.Application.Queries;

public record CreateRentalServiceRequest(
    Guid RentalItemId,
    DateTime Date,
    string Action,
    string Note,
    Guid UserId,
    List<SparepartItem> Spareparts);


