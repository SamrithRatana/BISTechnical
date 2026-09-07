namespace TechnicalService.API.Application.Commands;

public record UpdateSparepartCategoryCommand(
    Guid Id,
    string Name,
    string Description,
    int SortOrder) : IRequest<bool>;
