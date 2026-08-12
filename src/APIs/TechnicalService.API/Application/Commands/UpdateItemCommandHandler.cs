using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class UpdateItemCommandHandler : IRequestHandler<UpdateItemCommand, bool>
{
    private readonly ITechnicalServiceRepository _repairServiceRepository;

    public UpdateItemCommandHandler(ITechnicalServiceRepository repairServiceRepository)
    {
        _repairServiceRepository = repairServiceRepository;
    }

    public async Task<bool> Handle(UpdateItemCommand command, CancellationToken cancellationToken)
    {
        var itemToUpdate = await _repairServiceRepository.GetItemAsync(command.Id);
        if (itemToUpdate == null)
        {
            return false;
        }

        itemToUpdate.UpdateItem(command.ItemName, command.SerialNumber, command.ItemType);
        return await _repairServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
