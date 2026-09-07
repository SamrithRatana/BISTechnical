namespace TechnicalService.API.Application.Commands;

public record DeleteSparepartCategoryCommand(Guid Id) : IRequest<bool>;
