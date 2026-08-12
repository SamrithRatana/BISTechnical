using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class DeleteItemCommandHandler : IRequestHandler<DeleteItemCommand, bool>
{
    private readonly ITechnicalServiceRepository _repairServiceRepository;

    public DeleteItemCommandHandler(ITechnicalServiceRepository repairServiceRepository)
    {
        _repairServiceRepository = repairServiceRepository;
    }

    public async Task<bool> Handle(DeleteItemCommand command, CancellationToken cancellationToken)
    {
        var itemToDelete = await _repairServiceRepository.GetItemAsync(command.ItemId);
        if (itemToDelete == null)
        {
            return false;
        }

        _repairServiceRepository.DeleteItem(itemToDelete);
        return await _repairServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);

    }
}
