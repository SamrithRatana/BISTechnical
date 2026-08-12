namespace TechnicalService.API.Application.Commands;

public record DeleteItemCommand(Guid ItemId) : IRequest<bool>;
