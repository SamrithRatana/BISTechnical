namespace TechnicalService.API.Application.Commands;

public record UpdateSparepartTypeCommand(
    Guid Id,
    Guid CategoryId,
    string Name,
    string Description,
    int SortOrder) : IRequest<bool>;
