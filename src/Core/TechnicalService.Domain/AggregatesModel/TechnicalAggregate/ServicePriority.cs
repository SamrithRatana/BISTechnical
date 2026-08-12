namespace TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

public class ServicePriority : Enumeration
{
    public static ServicePriority Low = new(1, nameof(Low));
    public static ServicePriority Normal = new(2, nameof(Normal));
    public static ServicePriority High = new(3, nameof(High));

    public ServicePriority(int id, string name) : base(id, name)
    {
    }
}
