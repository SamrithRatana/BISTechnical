using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class BatchSetSparepartsDraftCommandHandler : IRequestHandler<BatchSetSparepartsDraftCommand, bool>
{
    private readonly ITechnicalServiceRepository _repository;

    public BatchSetSparepartsDraftCommandHandler(ITechnicalServiceRepository repository)
    {
        _repository = repository;
    }

    public async Task<bool> Handle(BatchSetSparepartsDraftCommand command, CancellationToken cancellationToken)
    {
        if (command.Ids == null || command.Ids.Count == 0) return true;

        foreach (var id in command.Ids)
        {
            var part = await _repository.GetSparepartAsync(id);
            if (part != null)
            {
                part.SetDraft(command.IsDraft);
            }
        }
        return await _repository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
