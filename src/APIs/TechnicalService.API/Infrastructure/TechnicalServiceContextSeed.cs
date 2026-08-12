using TechnicalService.Domain.AggregatesModel.RentalAggregate;
using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;
using TechnicalService.Domain.SeedWork;

namespace TechnicalService.API.Infrastructure;

public class TechnicalServiceContextSeed : IDbSeeder<TechnicalServiceContext>
{
    public async Task SeedAsync(TechnicalServiceContext context)
    {
        if (!context.ServiceTypes.Any())
        {
            context.ServiceTypes.AddRange(GetPredefinedServiceTypes());
            //await context.SaveChangesAsync();
        }

        if (!context.ServicePriorities.Any())
        {
            context.ServicePriorities.AddRange(GetPredefinedServicePriorities());
        }

        if (!context.ServiceStatuses.Any())
        {
            context.ServiceStatuses.AddRange(GetPredefinedServiceStatuses());
        }

        await context.SaveChangesAsync();
    }

    private static IEnumerable<ServiceType> GetPredefinedServiceTypes()
    {
        return Enumeration.GetAll<ServiceType>();
    }

    private static IEnumerable<ServicePriority> GetPredefinedServicePriorities()
    {
        return Enumeration.GetAll<ServicePriority>();
    }

    private static IEnumerable<ServiceStatus> GetPredefinedServiceStatuses()
    {
        return Enumeration.GetAll<ServiceStatus>();
    }

}
