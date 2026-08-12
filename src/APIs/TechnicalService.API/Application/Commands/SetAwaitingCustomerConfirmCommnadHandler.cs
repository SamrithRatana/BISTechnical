using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class SetAwaitingCustomerConfirmCommnadHandler : IRequestHandler<SetAwaitingCustomerConfirmCommand, bool>
{
    private readonly ITechnicalServiceRepository _technicalServiceRepository;
    private readonly IMediator _mediator;
    private readonly ILogger<SetAwaitingCustomerConfirmCommnadHandler> _logger;

    // Using DI to inject infrastructure persistence Repositories
    public SetAwaitingCustomerConfirmCommnadHandler(IMediator mediator,
        ITechnicalServiceRepository technicalServiceRepository,
        ILogger<SetAwaitingCustomerConfirmCommnadHandler> logger)
    {
        _technicalServiceRepository = technicalServiceRepository ?? throw new ArgumentNullException(nameof(technicalServiceRepository));
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<bool> Handle(SetAwaitingCustomerConfirmCommand command, CancellationToken cancellationToken)
    {
        var serviceToUpdate = await _technicalServiceRepository.GetServiceAsync(command.Id);
        
        if (serviceToUpdate == null)
        {
            return false;
        }

        serviceToUpdate.SetAwaitingCustomerConfirm(command.SetAwaitingCustomerConfirmBy, command.AwaitingCustomerConfirmDate);

        _logger.LogInformation("Updating Service - SetAwaitingCustomerConfirm: {@Service}", serviceToUpdate);

        return await _technicalServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}