// DeleteSparepartItemCommand.cs
public record DeleteSparepartItemCommand(Guid ServiceId, Guid SparepartItemId)
    : IRequest<bool>;