using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class UpdateSparepartCommandHandler : IRequestHandler<UpdateSparepartCommand, bool>
{
    private readonly ITechnicalServiceRepository _repairServiceRepository;
    private readonly ISparepartTaxonomyRepository _taxonomy;

    public UpdateSparepartCommandHandler(
        ITechnicalServiceRepository repairServiceRepository,
        ISparepartTaxonomyRepository taxonomy)
    {
        _repairServiceRepository = repairServiceRepository;
        _taxonomy = taxonomy;
    }

    public async Task<bool> Handle(UpdateSparepartCommand command, CancellationToken cancellationToken)
    {
        var partToUpdate = await _repairServiceRepository.GetSparepartAsync(command.Id);
        if (partToUpdate == null)
        {
            return false;
        }

        // Validate before any mutation so a bad classification leaves the
        // tracked entity untouched rather than half-updated in the change
        // tracker of a request that is about to fail.
        if (command.Classification is { } classification)
        {
            await classification.ValidateAsync(_taxonomy);
        }

        partToUpdate.UpdateSparepart(
            command.ItemName,
            command.SerialNumber,
            command.Description,
            command.UseFor,
            command.PictureUrl,
            command.LinkItemId,
            command.Quantity,
            command.DefaultPrice);

        if (command.Classification is { } set)
        {
            partToUpdate.SetClassification(set.CategoryId, set.TypeId, set.BrandId);
        }

        return await _repairServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}
