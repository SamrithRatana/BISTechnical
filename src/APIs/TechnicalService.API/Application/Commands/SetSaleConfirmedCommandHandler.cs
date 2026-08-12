using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class SetSaleConfirmedCommandHandler : IRequestHandler<SetSaleConfirmedCommand, bool>
{
    private readonly ITechnicalServiceRepository _technicalServiceRepository;
    private readonly IMediator _mediator;
    private readonly ILogger<SetSaleConfirmedCommandHandler> _logger;

    public SetSaleConfirmedCommandHandler(
        IMediator mediator,
        ITechnicalServiceRepository technicalServiceRepository,
        ILogger<SetSaleConfirmedCommandHandler> logger)
    {
        _technicalServiceRepository = technicalServiceRepository ?? throw new ArgumentNullException(nameof(technicalServiceRepository));
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<bool> Handle(SetSaleConfirmedCommand command, CancellationToken cancellationToken)
    {
        var serviceToUpdate = await _technicalServiceRepository.GetServiceAsync(command.Id);

        if (serviceToUpdate == null)
            return false;

        serviceToUpdate.SetSaleConfirmedStatus(command.SaleConfirmedDate, command.SetSaleConfirmedBy);

        _logger.LogInformation("Updating Service - SetSaleConfirmed: {@Service}", serviceToUpdate);

        return await _technicalServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}