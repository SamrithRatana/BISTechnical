using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class UpdateSparepartCommandHandler : IRequestHandler<UpdateSparepartCommand, bool>
{
    private readonly ITechnicalServiceRepository _repairServiceRepository;

    public UpdateSparepartCommandHandler(ITechnicalServiceRepository repairServiceRepository)
    {
        _repairServiceRepository = repairServiceRepository;
    }

    public async Task<bool> Handle(UpdateSparepartCommand command, CancellationToken cancellationToken)
    {
        var partToUpdate = await _repairServiceRepository.GetSparepartAsync(command.Id);
        if (partToUpdate == null)
        {
            return false;
        }

        partToUpdate.UpdateSparepart(
            command.ItemName,
            command.SerialNumber,
            command.Description,
            command.UseFor,
            command.PictureUrl,
            command.LinkItemId,
            command.Quantity,
                command.DefaultPrice); // ✅ ADD
                                       // ✅ ADD THIS LINE

        return await _repairServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
