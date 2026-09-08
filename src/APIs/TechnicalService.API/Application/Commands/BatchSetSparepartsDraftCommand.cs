namespace TechnicalService.API.Application.Commands;

public record BatchSetSparepartsDraftCommand(List<Guid> Ids, bool IsDraft) : IRequest<bool>;
