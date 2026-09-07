namespace TechnicalService.API.Application.Commands;

/// <summary>Creates a brand (name stored upper-case, logo optional); returns the new id.</summary>
public record CreateSparepartBrandCommand(
    string Name,
    string LogoUrl) : IRequest<Guid>;
