namespace TechnicalService.API.Application.Commands;

/// <summary>Creates a spare-part type under a category; returns the new id.</summary>
public record CreateSparepartTypeCommand(
    Guid CategoryId,
    string Name,
    string Description,
    int SortOrder) : IRequest<Guid>;
