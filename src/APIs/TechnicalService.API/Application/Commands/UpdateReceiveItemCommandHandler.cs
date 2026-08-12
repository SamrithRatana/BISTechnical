using MediatR;
using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class UpdateReceiveItemCommandHandler : IRequestHandler<UpdateReceiveItemCommand, bool>
{
    private readonly ITechnicalServiceRepository _technicalServiceRepository;
    private readonly ILogger<UpdateReceiveItemCommandHandler> _logger;

    public UpdateReceiveItemCommandHandler(
        ITechnicalServiceRepository technicalServiceRepository,
        ILogger<UpdateReceiveItemCommandHandler> logger)
    {
        _technicalServiceRepository = technicalServiceRepository ?? throw new ArgumentNullException(nameof(technicalServiceRepository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<bool> Handle(UpdateReceiveItemCommand command, CancellationToken cancellationToken)
    {
        var serviceToUpdate = await _technicalServiceRepository.GetAsync(command.Id);

        if (serviceToUpdate == null)
        {
            _logger.LogWarning("Service with ID {ServiceId} not found", command.Id);
            return false;
        }

        // Update service properties
        serviceToUpdate.UpdateReceiveItemInfo(
            command.CustomerId,
            command.CompanyName,
            command.Address,
            command.ContactName,
            command.PhoneNumber,
            command.HasContract,
            command.ServiceDate,
            command.ReportNo,
            Enum.Parse<ServiceLocation>(command.ServiceLocation),
            command.ServicePriorityId,
            command.ItemId,
            command.CustomerRequest
        );

        _logger.LogInformation("Updating Service - ReceiveItem: {@Service}", serviceToUpdate);

        return await _technicalServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}