namespace TechnicalService.API.Application.Commands;

public record UpdateItemCommand(Guid Id, string ItemName, string SerialNumber, string ItemType) : IRequest<bool>;
