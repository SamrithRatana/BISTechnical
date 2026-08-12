using MediatR;
using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

namespace TechnicalService.API.Application.Commands;

public class SetInspectingCommandHandler : IRequestHandler<SetInspectingCommand, bool>
{
    private readonly ITechnicalServiceRepository _technicalServiceRepository;
    private readonly IMediator _mediator;
    private readonly ILogger<SetInspectingCommandHandler> _logger;

    public SetInspectingCommandHandler(
        IMediator mediator,
        ITechnicalServiceRepository technicalServiceRepository,
        ILogger<SetInspectingCommandHandler> logger)
    {
        _technicalServiceRepository = technicalServiceRepository
            ?? throw new ArgumentNullException(nameof(technicalServiceRepository));
        _mediator = mediator
            ?? throw new ArgumentNullException(nameof(mediator));
        _logger = logger
            ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<bool> Handle(SetInspectingCommand command, CancellationToken cancellationToken)
    {
        var service = await _technicalServiceRepository.GetServiceAsync(command.Id);

        if (service == null)
        {
            _logger.LogWarning("Service {Id} not found for SetInspecting", command.Id);
            return false;
        }

        service.SetInspecting(command.InspectingBy, command.InspectingDate);

        _logger.LogInformation("Setting Inspecting on Service {Id}", command.Id);

        return await _technicalServiceRepository.UnitOfWork.SaveEntitiesAsync(cancellationToken);
    }
}