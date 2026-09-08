using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class SetSparepartDraftCommandHandler : IRequestHandler<SetSparepartDraftCommand, bool>
{
    private readonly ITechnicalServiceRepository _repository;

    public SetSparepartDraftCommandHandler(ITechnicalServiceRepository repository)
    {
        _repository = repository;
    }

    public async Task<bool> Handle(SetSparepartDraftCommand command, CancellationToken cancellationToken)
    {
        var part = await _repository.GetSparepartAsync(command.Id);
        if (part == null) return false;

        part.SetDraft(command.IsDraft);
        return await _repository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
