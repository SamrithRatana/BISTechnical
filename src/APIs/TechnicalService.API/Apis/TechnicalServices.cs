using ServiceMaintenance.Infrastructure.Shared.Messaging;
using TechnicalService.API.Application.Queries;

public class TechnicalServices(
    IMediator mediator,
    ITechnicalServiceQueries queries,
    ILogger<TechnicalServices> logger)
{
    public IMediator Mediator { get; set; } = mediator;
    public ILogger<TechnicalServices> Logger { get; } = logger;
    public ITechnicalServiceQueries Queries { get; } = queries;

}
