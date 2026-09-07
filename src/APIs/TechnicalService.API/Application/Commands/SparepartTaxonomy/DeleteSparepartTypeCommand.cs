namespace TechnicalService.API.Application.Commands;

public record DeleteSparepartTypeCommand(Guid Id) : IRequest<bool>;
