namespace TechnicalService.API.Application.Commands;

public record DeleteSparepartBrandCommand(Guid Id) : IRequest<bool>;
