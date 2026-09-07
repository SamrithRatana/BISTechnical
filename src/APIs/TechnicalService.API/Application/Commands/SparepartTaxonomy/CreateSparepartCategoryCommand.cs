namespace TechnicalService.API.Application.Commands;

/// <summary>Creates a spare-part category; returns the new id.</summary>
public record CreateSparepartCategoryCommand(
    string Name,
    string Description,
    int SortOrder) : IRequest<Guid>;
