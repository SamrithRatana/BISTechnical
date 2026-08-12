// TechnicalService.API/Application/Commands/ManualStockOutCommand.cs
namespace TechnicalService.API.Application.Commands;

public record ManualStockOutCommand(
    Guid SparepartId,
    int Quantity,
    string Reason,
    Guid? PerformedBy
) : IRequest<bool>;