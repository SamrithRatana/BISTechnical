using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class UpdateRepairServiceCommandHandler : IRequestHandler<UpdateRepairServiceCommand, bool>
{
    private readonly ITechnicalServiceRepository _repairServiceRepository;

    public UpdateRepairServiceCommandHandler(ITechnicalServiceRepository repairServiceRepository)
    {
        _repairServiceRepository = repairServiceRepository;
    }

    public async Task<bool> Handle(UpdateRepairServiceCommand command, CancellationToken cancellationToken)
    {
        var serviceToUpdate = await _repairServiceRepository.GetServiceAsync(command.Id);
        if (serviceToUpdate == null)
        {
            return false;
        }

        var partList = new List<SparepartItem>();

        foreach (var part in command.SparepartItems)
        {
            partList.Add(new SparepartItem(part.SparepartId, part.Description, part.Quantity,
                Enum.Parse<SparepartCondition>(part.Condition)));
        }

        serviceToUpdate.UpdateRepairService(
            command.ReportNo,
            command.ServiceDate,
            command.CustomerId,
            command.CompanyName,
            command.Address,
            command.ContactName,
            command.PhoneNumber,
            command.CustomerRequest,
            command.Inspection,
            command.Solution,
            Enum.Parse<ServiceLocation>(command.ServiceLocation),
            command.ServiceTypeId,
            command.ServicePriorityId,
            command.StatusId,
            command.ItemId,
            command.HasContract,
            partList);
            //command.SparepartItems.ToSparepartItemEntities().ToList());
        return await _repairServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
