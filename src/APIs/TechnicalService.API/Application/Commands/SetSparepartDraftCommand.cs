namespace TechnicalService.API.Application.Commands;

public record SetSparepartDraftCommand(Guid Id, bool IsDraft) : IRequest<bool>;
