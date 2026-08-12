using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class ReceiveItemCommnadHandler : IRequestHandler<ReceiveItemCommand, bool>
{
    private readonly ITechnicalServiceRepository _technicalServiceRepository;
    private readonly IMediator _mediator;
    private readonly ILogger<ReceiveItemCommnadHandler> _logger;

    // Using DI to inject infrastructure persistence Repositories
    public ReceiveItemCommnadHandler(IMediator mediator,
        ITechnicalServiceRepository technicalServiceRepository,
        ILogger<ReceiveItemCommnadHandler> logger)
    {
        _technicalServiceRepository = technicalServiceRepository ?? throw new ArgumentNullException(nameof(technicalServiceRepository));
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<bool> Handle(ReceiveItemCommand message, CancellationToken cancellationToken)
    {

        var service = new Service(message.CustomerId, message.CompanyName, message.Address,
            message.ContactName, message.PhoneNumber, message.HasContract, message.ServiceDate,
            message.ReportNo, Enum.Parse<ServiceLocation>(message.ServiceLocation), 1,
            message.ServicePriorityId, message.ItemId, message.CustomerRequest, message.CreateBy);

        _logger.LogInformation("Creating Service - ReceiveItem: {@ReceiveItem}", service);

        _technicalServiceRepository.ReceiveItem(service);

        return await _technicalServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}