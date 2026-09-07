namespace TechnicalService.API.Application.Commands;

public record UpdateSparepartBrandCommand(
    Guid Id,
    string Name,
    string LogoUrl) : IRequest<bool>;
